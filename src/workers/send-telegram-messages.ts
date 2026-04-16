import process from 'node:process';

import { loadAppEnv, requireTelegramBotToken } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from '../db/client.js';
import { listAvailableJobIdsByType } from '../repositories/job-repository.js';
import { sendTelegramMessageJob } from '../services/send-telegram-message-service.js';

const DEFAULT_BATCH_LIMIT = 10;

async function main(): Promise<void> {
  const env = loadAppEnv();
  const botToken = requireTelegramBotToken(env);
  const client = createDatabaseClient(env.databaseUrl);
  const explicitJobId = process.argv[2];
  const batchLimit = parseBatchLimit(process.argv[3]);

  try {
    const jobIds = explicitJobId
      ? [explicitJobId]
      : await listAvailableJobIdsByType(client.db, {
          jobType: 'send_telegram_message',
          now: new Date(),
          limit: batchLimit
        });

    const results = [];

    for (const jobId of jobIds) {
      results.push(
        await sendTelegramMessageJob(client.db, {
          jobId,
          botToken
        })
      );
    }

    process.stdout.write(`${JSON.stringify({ processed: results.length, results }, null, 2)}\n`);
  } finally {
    await destroyDatabaseClient(client);
  }
}

function parseBatchLimit(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_BATCH_LIMIT;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid batch limit: ${rawValue}`);
  }

  return parsed;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
