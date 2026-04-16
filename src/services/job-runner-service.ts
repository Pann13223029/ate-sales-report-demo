import type { Kysely } from 'kysely';

import type { Database } from '../db/schema.js';
import { sendDailyStaleReminderJob } from './daily-reminder-service.js';
import { listAvailableJobIdsByType } from '../repositories/job-repository.js';
import type { OperationalSheetSyncConfig } from './operational-sheet-sync-service.js';
import { reconcileOperationalSheetJob } from './operational-sheet-sync-service.js';
import { processWebhookJob } from './process-webhook-service.js';
import { sendTelegramMessageJob } from './send-telegram-message-service.js';
import type { GoogleSheetsRuntimeConfig } from './workbook-sync-service.js';
import { refreshExecutiveWorkbookJob, syncOperationalWorkbookJob } from './workbook-sync-service.js';

export interface DrainJobQueuesResult {
  processedWebhookJobs: number;
  processedDailyReminderJobs: number;
  processedTelegramSendJobs: number;
  processedOperationalWorkbookJobs: number;
  processedExecutiveWorkbookJobs: number;
  processedOperationalSheetSyncJobs: number;
}

export async function drainJobQueues(
  db: Kysely<Database>,
  values: {
    telegramBotToken: string | null;
    googleSheets: GoogleSheetsRuntimeConfig | null;
    operationalSheetSync: OperationalSheetSyncConfig | null;
    geminiApiKey: string | null;
    geminiModel: string;
    processWebhookLimit?: number;
    dailyReminderLimit?: number;
    sendTelegramLimit?: number;
    operationalWorkbookLimit?: number;
    executiveWorkbookLimit?: number;
    operationalSheetSyncLimit?: number;
  }
): Promise<DrainJobQueuesResult> {
  const processWebhookLimit = values.processWebhookLimit ?? 10;
  const dailyReminderLimit = values.dailyReminderLimit ?? 10;
  const sendTelegramLimit = values.sendTelegramLimit ?? 10;
  const operationalWorkbookLimit = values.operationalWorkbookLimit ?? 5;
  const executiveWorkbookLimit = values.executiveWorkbookLimit ?? 5;
  const operationalSheetSyncLimit = values.operationalSheetSyncLimit ?? 2;

  const processWebhookJobIds = await listAvailableJobIdsByType(db, {
    jobType: 'process_webhook',
    now: new Date(),
    limit: processWebhookLimit
  });

  for (const jobId of processWebhookJobIds) {
    await processWebhookJob(db, jobId, {
      geminiApiKey: values.geminiApiKey,
      geminiModel: values.geminiModel
    });
  }

  let processedDailyReminderJobs = 0;
  let processedTelegramSendJobs = 0;
  let processedOperationalWorkbookJobs = 0;
  let processedExecutiveWorkbookJobs = 0;
  let processedOperationalSheetSyncJobs = 0;

  if (values.telegramBotToken) {
    const dailyReminderJobIds = await listAvailableJobIdsByType(db, {
      jobType: 'send_daily_stale_reminder',
      now: new Date(),
      limit: dailyReminderLimit
    });

    for (const jobId of dailyReminderJobIds) {
      await sendDailyStaleReminderJob(db, {
        jobId,
        botToken: values.telegramBotToken
      });
    }

    processedDailyReminderJobs = dailyReminderJobIds.length;

    const sendTelegramJobIds = await listAvailableJobIdsByType(db, {
      jobType: 'send_telegram_message',
      now: new Date(),
      limit: sendTelegramLimit
    });

    for (const jobId of sendTelegramJobIds) {
      await sendTelegramMessageJob(db, {
        jobId,
        botToken: values.telegramBotToken
      });
    }

    processedTelegramSendJobs = sendTelegramJobIds.length;
  }

  if (values.googleSheets) {
    const operationalWorkbookJobIds = await listAvailableJobIdsByType(db, {
      jobType: 'sync_operational_sheet',
      now: new Date(),
      limit: operationalWorkbookLimit
    });

    for (const jobId of operationalWorkbookJobIds) {
      await syncOperationalWorkbookJob(db, {
        jobId,
        googleSheets: values.googleSheets
      });
    }

    processedOperationalWorkbookJobs = operationalWorkbookJobIds.length;

    const executiveWorkbookJobIds = await listAvailableJobIdsByType(db, {
      jobType: 'refresh_executive_workbook',
      now: new Date(),
      limit: executiveWorkbookLimit
    });

    for (const jobId of executiveWorkbookJobIds) {
      await refreshExecutiveWorkbookJob(db, {
        jobId,
        googleSheets: values.googleSheets
      });
    }

    processedExecutiveWorkbookJobs = executiveWorkbookJobIds.length;
  }

  if (values.operationalSheetSync) {
    const operationalSheetSyncJobIds = await listAvailableJobIdsByType(db, {
      jobType: 'reconcile_operational_sheet',
      now: new Date(),
      limit: operationalSheetSyncLimit
    });

    for (const jobId of operationalSheetSyncJobIds) {
      await reconcileOperationalSheetJob(db, {
        jobId,
        config: values.operationalSheetSync
      });
    }

    processedOperationalSheetSyncJobs = operationalSheetSyncJobIds.length;
  }

  return {
    processedWebhookJobs: processWebhookJobIds.length,
    processedDailyReminderJobs,
    processedTelegramSendJobs,
    processedOperationalWorkbookJobs,
    processedExecutiveWorkbookJobs,
    processedOperationalSheetSyncJobs
  };
}
