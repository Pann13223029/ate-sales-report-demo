import type { Kysely } from 'kysely';

import type {
  Database,
  DraftStatus,
  DraftType,
  JsonObject,
  TelegramDraftRow
} from '../db/schema.js';

export async function expireActiveDraftsForTelegramUser(
  db: Kysely<Database>,
  values: {
    telegramUserId: string;
    now: Date;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('telegram_drafts')
    .set({
      status: 'expired',
      finalized_at: values.now,
      updated_at: values.now
    })
    .where('telegram_user_id', '=', values.telegramUserId)
    .where('status', '=', 'active')
    .where('expires_at', '<=', values.now)
    .executeTakeFirst();
}

export async function getActiveDraftByTelegramUserId(
  db: Kysely<Database>,
  telegramUserId: string
): Promise<TelegramDraftRow | undefined> {
  return db
    .withSchema('ops')
    .selectFrom('telegram_drafts')
    .selectAll()
    .where('telegram_user_id', '=', telegramUserId)
    .where('status', '=', 'active')
    .executeTakeFirst();
}

export async function createTelegramDraft(
  db: Kysely<Database>,
  values: {
    draftId: string;
    telegramUserId: string;
    draftType: DraftType;
    status?: DraftStatus;
    opportunityId?: string | null;
    baseVersion?: number | null;
    currentStep?: string | null;
    payload: JsonObject;
    expiresAt: Date;
  }
): Promise<TelegramDraftRow> {
  return db
    .withSchema('ops')
    .insertInto('telegram_drafts')
    .values({
      draft_id: values.draftId,
      telegram_user_id: values.telegramUserId,
      draft_type: values.draftType,
      status: values.status ?? 'active',
      opportunity_id: values.opportunityId ?? null,
      base_version: values.baseVersion ?? null,
      current_step: values.currentStep ?? null,
      payload: values.payload,
      expires_at: values.expiresAt
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateTelegramDraft(
  db: Kysely<Database>,
  values: {
    draftId: string;
    currentStep?: string | null;
    payload?: JsonObject;
    expiresAt?: Date;
    updatedAt: Date;
  }
): Promise<TelegramDraftRow> {
  const update: Record<string, unknown> = {
    updated_at: values.updatedAt
  };

  if (values.currentStep !== undefined) {
    update.current_step = values.currentStep;
  }

  if (values.payload !== undefined) {
    update.payload = values.payload;
  }

  if (values.expiresAt !== undefined) {
    update.expires_at = values.expiresAt;
  }

  return db
    .withSchema('ops')
    .updateTable('telegram_drafts')
    .set(update)
    .where('draft_id', '=', values.draftId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function finalizeTelegramDraft(
  db: Kysely<Database>,
  values: {
    draftId: string;
    status: Exclude<DraftStatus, 'active'>;
    finalizedAt: Date;
    currentStep?: string | null;
    payload?: JsonObject;
  }
): Promise<TelegramDraftRow> {
  const update: Record<string, unknown> = {
    status: values.status,
    finalized_at: values.finalizedAt,
    updated_at: values.finalizedAt
  };

  if (values.currentStep !== undefined) {
    update.current_step = values.currentStep;
  }

  if (values.payload !== undefined) {
    update.payload = values.payload;
  }

  return db
    .withSchema('ops')
    .updateTable('telegram_drafts')
    .set(update)
    .where('draft_id', '=', values.draftId)
    .returningAll()
    .executeTakeFirstOrThrow();
}
