import process from 'node:process';

import { loadAppEnv } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from '../db/client.js';
import { listAvailableJobIdsByType } from '../repositories/job-repository.js';
import { processWebhookJob } from '../services/process-webhook-service.js';

const DEFAULT_BATCH_LIMIT = 10;

async function main(): Promise<void> {
  const env = loadAppEnv();
  const client = createDatabaseClient(env.databaseUrl);
  const explicitJobId = process.argv[2];
  const batchLimit = parseBatchLimit(process.argv[3]);

  try {
    const jobIds = explicitJobId
      ? [explicitJobId]
      : await listAvailableJobIdsByType(client.db, {
          jobType: 'process_webhook',
          now: new Date(),
          limit: batchLimit
        });

    const results = [];

    for (const jobId of jobIds) {
      results.push(
        await processWebhookJob(client.db, jobId, {
          geminiApiKey: env.geminiApiKey,
          geminiModel: env.geminiModel
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
