import process from 'node:process';

import { getOperationalSheetSyncEnv, loadAppEnv } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from '../db/client.js';
import { maybeEnqueueScheduledWork } from '../services/scheduler-service.js';

async function main(): Promise<void> {
  const env = loadAppEnv();
  const operationalSheetSync = getOperationalSheetSyncEnv(env);
  const client = createDatabaseClient(env.databaseUrl);

  try {
    const result = await maybeEnqueueScheduledWork(client.db, {
      reminderSchedule: {
        timeZone: env.reminderTimeZone,
        dailyHour: env.reminderDailyHour,
        dailyMinute: env.reminderDailyMinute
      },
      operationalSheetSyncIntervalMinutes: operationalSheetSync?.sheetSyncIntervalMinutes
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await destroyDatabaseClient(client);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
