import process from 'node:process';

import { getGoogleSheetsEnv, getOperationalSheetSyncEnv, loadAppEnv } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from '../db/client.js';
import { drainJobQueues } from '../services/job-runner-service.js';

async function main(): Promise<void> {
  const env = loadAppEnv();
  const googleSheets = getGoogleSheetsEnv(env);
  const operationalSheetSync = getOperationalSheetSyncEnv(env);
  const client = createDatabaseClient(env.databaseUrl);

  try {
      const result = await drainJobQueues(client.db, {
        telegramBotToken: env.telegramBotToken,
        googleSheets,
        operationalSheetSync,
        geminiApiKey: env.geminiApiKey,
        geminiModel: env.geminiModel
      });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await destroyDatabaseClient(client);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
