import type { Kysely, Transaction } from 'kysely';

import type {
  Database,
  InboxProcessingStatus,
  JsonObject,
  NewJob,
  TelegramWebhookInboxRow
} from '../db/schema.js';

export async function getTelegramWebhookInboxByUpdateId(
  db: Kysely<Database>,
  telegramUpdateId: number
): Promise<TelegramWebhookInboxRow | undefined> {
  return db
    .withSchema('ops')
    .selectFrom('telegram_webhook_inbox')
    .selectAll()
    .where('telegram_update_id', '=', String(telegramUpdateId))
    .executeTakeFirst();
}

export async function insertTelegramWebhookInbox(
  trx: Transaction<Database>,
  values: {
    telegramUpdateId: number;
    telegramUserId: string | null;
    correlationId: string;
    rawPayload: JsonObject;
    processingStatus: InboxProcessingStatus;
    processedJobId: string;
    retainedUntil: Date;
  }
): Promise<void> {
  await trx
    .withSchema('ops')
    .insertInto('telegram_webhook_inbox')
    .values({
      telegram_update_id: String(values.telegramUpdateId),
      telegram_user_id: values.telegramUserId,
      correlation_id: values.correlationId,
      raw_payload: values.rawPayload,
      processing_status: values.processingStatus,
      processed_job_id: values.processedJobId,
      retained_until: values.retainedUntil
    })
    .executeTakeFirstOrThrow();
}

export async function insertQueuedJob(
  trx: Transaction<Database>,
  job: NewJob
): Promise<void> {
  await trx.withSchema('ops').insertInto('jobs').values(job).executeTakeFirstOrThrow();
}

export async function markTelegramWebhookInboxProcessed(
  db: Kysely<Database>,
  telegramUpdateId: number
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('telegram_webhook_inbox')
    .set({
      processing_status: 'processed',
      last_error: null
    })
    .where('telegram_update_id', '=', String(telegramUpdateId))
    .executeTakeFirstOrThrow();
}

export async function markTelegramWebhookInboxFailed(
  db: Kysely<Database>,
  values: {
    telegramUpdateId: number;
    errorMessage: string;
    dead: boolean;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('telegram_webhook_inbox')
    .set({
      processing_status: values.dead ? 'dead' : 'failed',
      last_error: values.errorMessage
    })
    .where('telegram_update_id', '=', String(values.telegramUpdateId))
    .executeTakeFirstOrThrow();
}
