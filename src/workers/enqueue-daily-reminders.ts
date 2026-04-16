import { loadAppEnv } from '../config/env.js';
import { createDatabaseClient, destroyDatabaseClient } from '../db/client.js';
import { enqueueDailyStaleReminderJobs } from '../services/daily-reminder-service.js';

async function main(): Promise<void> {
  const env = loadAppEnv();
  const client = createDatabaseClient(env.databaseUrl);

  try {
    const result = await enqueueDailyStaleReminderJobs(client.db);

    console.log(
      JSON.stringify(
        {
          queuedReminderJobs: result.queuedReminderJobs,
          refreshedStaleStatuses: result.refreshedStaleStatuses,
          targetedOwners: result.targetedOwners,
          targetedOpportunities: result.targetedOpportunities,
          reminderDateKey: result.reminderDateKey
        },
        null,
        2
      )
    );
  } finally {
    await destroyDatabaseClient(client);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
