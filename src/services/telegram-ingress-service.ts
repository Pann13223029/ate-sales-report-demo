import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';

import type { Database, JsonObject, NewJob } from '../db/schema.js';
import {
  extractTelegramUserId,
  telegramUpdateSchema,
  type TelegramUpdate
} from '../adapters/telegram/update-schema.js';
import {
  getTelegramWebhookInboxByUpdateId,
  insertQueuedJob,
  insertTelegramWebhookInbox
} from '../repositories/telegram-ingress-repository.js';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

export interface IngestTelegramUpdateResult {
  deduped: boolean;
  updateId: number;
  telegramUserId: string | null;
  correlationId: string;
  jobId: string | null;
}

export async function ingestTelegramUpdate(
  db: Kysely<Database>,
  rawPayload: unknown
): Promise<IngestTelegramUpdateResult> {
  const update = telegramUpdateSchema.parse(rawPayload);
  const existing = await getTelegramWebhookInboxByUpdateId(db, update.update_id);

  if (existing) {
    return {
      deduped: true,
      updateId: update.update_id,
      telegramUserId: existing.telegram_user_id,
      correlationId: existing.correlation_id,
      jobId: existing.processed_job_id
    };
  }

  const correlationId = randomUUID();
  const jobId = randomUUID();
  const telegramUserId = extractTelegramUserId(update);
  const occurredAt = new Date();
  const retainedUntil = new Date(occurredAt.getTime() + THIRTY_DAYS_IN_MS);

  await db.transaction().execute(async (trx) => {
    await insertQueuedJob(
      trx,
      buildProcessWebhookJob({
        jobId,
        correlationId,
        occurredAt,
        update,
        telegramUserId
      })
    );

    await insertTelegramWebhookInbox(trx, {
      telegramUpdateId: update.update_id,
      telegramUserId,
      correlationId,
      rawPayload: update as JsonObject,
      processingStatus: 'queued',
      processedJobId: jobId,
      retainedUntil
    });
  });

  return {
    deduped: false,
    updateId: update.update_id,
    telegramUserId,
    correlationId,
    jobId
  };
}

function buildProcessWebhookJob(params: {
  jobId: string;
  correlationId: string;
  occurredAt: Date;
  update: TelegramUpdate;
  telegramUserId: string | null;
}): NewJob {
  return {
    job_id: params.jobId,
    job_type: 'process_webhook',
    status: 'queued',
    correlation_id: params.correlationId,
    dedupe_key: `process_webhook:${params.update.update_id}`,
    payload: {
      telegram_update_id: params.update.update_id,
      telegram_user_id: params.telegramUserId,
      update_kind: classifyUpdate(params.update)
    },
    available_at: params.occurredAt,
    attempts: 0,
    max_attempts: 10
  };
}

function classifyUpdate(update: TelegramUpdate): 'message' | 'edited_message' | 'callback_query' {
  if (update.callback_query) {
    return 'callback_query';
  }

  if (update.edited_message) {
    return 'edited_message';
  }

  return 'message';
}
