import type { Kysely } from 'kysely';

import { sendTelegramMessage } from '../adapters/telegram/bot-api.js';
import { sendTelegramMessageJobPayloadSchema } from '../adapters/telegram/outbound-schema.js';
import type { Database } from '../db/schema.js';
import { claimQueuedJob, markJobFailed, markJobSucceeded } from '../repositories/job-repository.js';

const SEND_TELEGRAM_MESSAGE_JOB_LEASE_MS = 2 * 60 * 1000;

export interface SendTelegramMessageJobResult {
  skipped: boolean;
  jobId: string;
  chatId?: string;
}

export async function sendTelegramMessageJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    botToken: string;
  }
): Promise<SendTelegramMessageJobResult> {
  const now = new Date();
  const claimedJob = await claimQueuedJob(db, {
    jobId: values.jobId,
    now,
    leaseDurationMs: SEND_TELEGRAM_MESSAGE_JOB_LEASE_MS
  });

  if (!claimedJob) {
    return {
      skipped: true,
      jobId: values.jobId
    };
  }

  const payload = sendTelegramMessageJobPayloadSchema.parse(claimedJob.payload);

  try {
    await sendTelegramMessage(values.botToken, payload);

    await markJobSucceeded(db, {
      jobId: values.jobId,
      finishedAt: new Date()
    });

    return {
      skipped: false,
      jobId: values.jobId,
      chatId: payload.chat_id
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dead = claimedJob.attempts >= claimedJob.max_attempts;

    await markJobFailed(db, {
      jobId: values.jobId,
      errorMessage,
      dead,
      finishedAt: new Date()
    });

    throw error;
  }
}
