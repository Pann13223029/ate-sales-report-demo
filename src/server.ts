import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import process from 'node:process';

import { getGoogleSheetsEnv, getOperationalSheetSyncEnv, loadAppEnv } from './config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from './db/client.js';
import {
  getTelegramWebhookSecretHeader,
  handleTelegramWebhookHttpRequest
} from './http/telegram-webhook-handler.js';
import { drainJobQueues } from './services/job-runner-service.js';
import { maybeEnqueueScheduledWork } from './services/scheduler-service.js';

const HEALTH_PATH = '/healthz';
const TELEGRAM_WEBHOOK_PATH = '/telegram/webhook';
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

async function main(): Promise<void> {
  const env = loadAppEnv();
  const googleSheets = getGoogleSheetsEnv(env);
  const operationalSheetSync = getOperationalSheetSyncEnv(env);
  const client = createDatabaseClient(env.databaseUrl);
  let drainInFlight = false;
  let schedulerInFlight = false;

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respondJson(res, 500, {
        ok: false,
        error: message
      });
    }
  });

  const interval = setInterval(() => {
    void triggerScheduler();
    void triggerDrain();
  }, env.jobPollIntervalMs);

  interval.unref();
  void triggerScheduler();
  void triggerDrain();

  server.listen(env.port, () => {
    process.stdout.write(
      `Server listening on http://localhost:${env.port} (poll ${env.jobPollIntervalMs}ms)\n`
    );
  });

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (method === 'GET' && url.pathname === HEALTH_PATH) {
      respondJson(res, 200, {
        ok: true,
        status: 'healthy'
      });
      return;
    }

    if (method === 'POST' && url.pathname === TELEGRAM_WEBHOOK_PATH) {
      const rawBody = await readRequestBody(req, MAX_REQUEST_BODY_BYTES);
      const response = await handleTelegramWebhookHttpRequest(client.db, {
        secretHeader: getTelegramWebhookSecretHeader(nodeHeadersToFetchHeaders(req)),
        configuredSecret: env.telegramWebhookSecret,
        rawBody
      });

      respondJson(res, response.status, response.body);
      void triggerScheduler();
      void triggerDrain();
      return;
    }

    respondJson(res, 404, {
      ok: false,
      error: 'Not found'
    });
  }

  async function triggerDrain(): Promise<void> {
    if (drainInFlight) {
      return;
    }

    drainInFlight = true;

    try {
      await drainJobQueues(client.db, {
        telegramBotToken: env.telegramBotToken,
        googleSheets,
        operationalSheetSync,
        geminiApiKey: env.geminiApiKey,
        geminiModel: env.geminiModel
      });
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
    } finally {
      drainInFlight = false;
    }
  }

  async function triggerScheduler(): Promise<void> {
    if (schedulerInFlight) {
      return;
    }

    schedulerInFlight = true;

    try {
      const result = await maybeEnqueueScheduledWork(client.db, {
        reminderSchedule: {
          timeZone: env.reminderTimeZone,
          dailyHour: env.reminderDailyHour,
          dailyMinute: env.reminderDailyMinute
        },
        operationalSheetSyncIntervalMinutes: operationalSheetSync?.sheetSyncIntervalMinutes
      });

      if (result.dailyReminders.enqueueResult && result.dailyReminders.enqueueResult.queuedReminderJobs > 0) {
        process.stdout.write(
          `Scheduled ${result.dailyReminders.enqueueResult.queuedReminderJobs} daily reminder job(s) for ${result.dailyReminders.reminderDateKey} ${result.dailyReminders.localTime} ${env.reminderTimeZone}\n`
        );
      }

      if (result.operationalSheetSync && !result.operationalSheetSync.alreadyScheduled) {
        process.stdout.write(
          `Scheduled operational sheet sync for bucket ${result.operationalSheetSync.bucketKey}\n`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
    } finally {
      schedulerInFlight = false;
    }
  }

  async function shutdown(): Promise<void> {
    clearInterval(interval);
    server.close();
    await destroyDatabaseClient(client);
    process.exit(0);
  }
}

function respondJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>
): void {
  const encoded = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(encoded));
  res.end(encoded);
}

async function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new Error(`Request body exceeds ${maxBytes} bytes`);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function nodeHeadersToFetchHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  return headers;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
