import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import process from 'node:process';

import { loadAppEnv } from './config/env.js';
import {
  getTelegramWebhookSecretHeader,
  handleTelegramWebhookHttpRequest
} from './http/telegram-webhook-handler.js';
import { incomingHeadersToFetchHeaders, readNodeRequestBody } from './http/node-request.js';
import {
  destroyRuntimeContext,
  getRuntimeContext,
  isAuthorizedInternalRequest,
  runSingleRuntimeTick
} from './runtime/vercel-runtime.js';

const HEALTH_PATH = '/healthz';
const API_HEALTH_PATH = '/api/healthz';
const TELEGRAM_WEBHOOK_PATH = '/telegram/webhook';
const API_TELEGRAM_WEBHOOK_PATH = '/api/telegram/webhook';
const API_CRON_PATH = '/api/cron';
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

async function main(): Promise<void> {
  const env = loadAppEnv();
  const context = getRuntimeContext();
  let tickInFlight = false;

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
    void triggerTick();
  }, env.jobPollIntervalMs);

  interval.unref();
  void triggerTick();

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

    if (method === 'GET' && (url.pathname === HEALTH_PATH || url.pathname === API_HEALTH_PATH)) {
      respondJson(res, 200, {
        ok: true,
        status: 'healthy'
      });
      return;
    }

    if (
      method === 'POST' &&
      (url.pathname === TELEGRAM_WEBHOOK_PATH || url.pathname === API_TELEGRAM_WEBHOOK_PATH)
    ) {
      const rawBody = await readNodeRequestBody(req, MAX_REQUEST_BODY_BYTES);
      const response = await handleTelegramWebhookHttpRequest(context.db, {
        secretHeader: getTelegramWebhookSecretHeader(incomingHeadersToFetchHeaders(req.headers)),
        configuredSecret: env.telegramWebhookSecret,
        rawBody
      });

      respondJson(res, response.status, response.body);
      void triggerTick();
      return;
    }

    if (method === 'GET' && url.pathname === API_CRON_PATH) {
      if (!isAuthorizedInternalRequest(req.headers, env.internalApiSecret)) {
        respondJson(res, 401, {
          ok: false,
          error: 'Unauthorized cron request'
        });
        return;
      }

      const result = await runSingleRuntimeTick(context);
      respondJson(res, 200, {
        ok: true,
        scheduled: result.scheduled,
        drained: result.drained
      });
      return;
    }

    respondJson(res, 404, {
      ok: false,
      error: 'Not found'
    });
  }

  async function triggerTick(): Promise<void> {
    if (tickInFlight) {
      return;
    }

    tickInFlight = true;

    try {
      const result = await runSingleRuntimeTick(context);

      if (
        result.scheduled.dailyReminders.enqueueResult &&
        result.scheduled.dailyReminders.enqueueResult.queuedReminderJobs > 0
      ) {
        process.stdout.write(
          `Scheduled ${result.scheduled.dailyReminders.enqueueResult.queuedReminderJobs} daily reminder job(s) for ${result.scheduled.dailyReminders.reminderDateKey} ${result.scheduled.dailyReminders.localTime} ${env.reminderTimeZone}\n`
        );
      }

      if (
        result.scheduled.operationalSheetSync &&
        !result.scheduled.operationalSheetSync.alreadyScheduled
      ) {
        process.stdout.write(
          `Scheduled operational sheet sync for bucket ${result.scheduled.operationalSheetSync.bucketKey}\n`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
    } finally {
      tickInFlight = false;
    }
  }

  async function shutdown(): Promise<void> {
    clearInterval(interval);
    server.close();
    await destroyRuntimeContext();
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

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
