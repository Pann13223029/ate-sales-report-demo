import type { IncomingHttpHeaders } from 'node:http';

import type { Kysely } from 'kysely';

import type { Database } from '../db/schema.js';
import { getGoogleSheetsEnv, getOperationalSheetSyncEnv, loadAppEnv, type AppEnv } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient, type DatabaseClient } from '../db/client.js';
import { drainJobQueues, type DrainJobQueuesResult } from '../services/job-runner-service.js';
import {
  maybeEnqueueScheduledWork,
  type MaybeEnqueueScheduledWorkResult
} from '../services/scheduler-service.js';

let cachedClient: DatabaseClient | null = null;

export interface RuntimeContext {
  env: AppEnv;
  db: Kysely<Database>;
}

export interface RuntimeTickResult {
  scheduled: MaybeEnqueueScheduledWorkResult;
  drained: DrainJobQueuesResult;
}

export function getRuntimeContext(): RuntimeContext {
  const env = loadAppEnv();

  if (!cachedClient) {
    cachedClient = createDatabaseClient(env.databaseUrl);
  }

  return {
    env,
    db: cachedClient.db
  };
}

export async function destroyRuntimeContext(): Promise<void> {
  if (!cachedClient) {
    return;
  }

  const client = cachedClient;
  cachedClient = null;
  await destroyDatabaseClient(client);
}

export async function runSingleRuntimeTick(
  context: RuntimeContext,
  values: {
    now?: Date;
  } = {}
): Promise<RuntimeTickResult> {
  const googleSheets = getGoogleSheetsEnv(context.env);
  const operationalSheetSync = getOperationalSheetSyncEnv(context.env);

  const scheduled = await maybeEnqueueScheduledWork(context.db, {
    ...(values.now ? { now: values.now } : {}),
    reminderSchedule: {
      timeZone: context.env.reminderTimeZone,
      dailyHour: context.env.reminderDailyHour,
      dailyMinute: context.env.reminderDailyMinute
    },
    operationalSheetSyncIntervalMinutes: operationalSheetSync?.sheetSyncIntervalMinutes
  });

  const drained = await drainJobQueues(context.db, {
    telegramBotToken: context.env.telegramBotToken,
    googleSheets,
    operationalSheetSync,
    geminiApiKey: context.env.geminiApiKey,
    geminiModel: context.env.geminiModel
  });

  return {
    scheduled,
    drained
  };
}

export function isAuthorizedInternalRequest(
  headers: IncomingHttpHeaders | Headers,
  configuredSecret: string | null
): boolean {
  const authorization = getHeaderValue(headers, 'authorization');
  const cronSecret = getHeaderValue(headers, 'x-cron-secret');
  const userAgent = getHeaderValue(headers, 'user-agent');

  if (configuredSecret) {
    return authorization === `Bearer ${configuredSecret}` || cronSecret === configuredSecret;
  }

  return userAgent === 'vercel-cron/1.0';
}

function getHeaderValue(headers: IncomingHttpHeaders | Headers, key: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(key);
  }

  const value = headers[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
