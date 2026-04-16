import { randomUUID } from 'node:crypto';

import { sql, type Kysely } from 'kysely';
import { z } from 'zod';

import {
  extractTelegramUserId,
  getTelegramChatId,
  getTelegramMessageId,
  getTelegramUpdateKind,
  getTelegramUpdateText,
  telegramUpdateSchema
} from '../adapters/telegram/update-schema.js';
import { buildSendTelegramMessageJob } from '../adapters/telegram/outbound-schema.js';
import type { Database, JsonArray, JsonObject, JsonValue, TelegramDraftRow } from '../db/schema.js';
import {
  deriveMissingRequiredUpdateDraftFields,
  deriveMissingRequiredDraftFields,
  hasUpdateDraftChanges,
  mergeOpportunityDraftCandidate,
  newOpportunityDraftPayloadSchema,
  opportunityDraftCandidateSchema,
  requiredDraftFieldKeys,
  type NewOpportunityDraftPayload,
  type OpportunityDraftCandidate,
  type OpportunityDraftPayload,
  type UpdateOpportunityDraftPayload,
  updateOpportunityDraftPayloadSchema
} from '../domain/opportunity-draft.js';
import { normalizeProductName } from '../domain/normalize.js';
import { claimQueuedJob, insertQueuedJobs, markJobFailed, markJobSucceeded } from '../repositories/job-repository.js';
import {
  findProductCatalogMatch,
  getOpportunityCurrentById,
  getUserByTelegramUserId,
  listOpenOpportunitiesByOwner
} from '../repositories/opportunity-repository.js';
import {
  expireActiveDraftsForTelegramUser,
  createTelegramDraft,
  finalizeTelegramDraft,
  getActiveDraftByTelegramUserId,
  updateTelegramDraft
} from '../repositories/telegram-draft-repository.js';
import {
  getTelegramWebhookInboxByUpdateId,
  markTelegramWebhookInboxFailed,
  markTelegramWebhookInboxProcessed
} from '../repositories/telegram-ingress-repository.js';
import {
  parseOpportunityDraftInput,
  type OpportunityDraftParserConfig
} from './opportunity-draft-parser-service.js';
import {
  createOpportunityFromCommand,
  ProductCatalogResolutionError,
  updateOpportunityFromCommand
} from './opportunity-service.js';
import { renderProcessWebhookReplies } from './telegram-reply-service.js';

const processWebhookJobPayloadSchema = z.object({
  telegram_update_id: z.number().int().nonnegative(),
  telegram_user_id: z.string().nullable(),
  update_kind: z.enum(['message', 'edited_message', 'callback_query'])
});

const HELP_COMMAND = '/help';
const CANCEL_COMMAND = '/cancel';
const MY_DEALS_COMMAND = '/mydeals';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESS_WEBHOOK_JOB_LEASE_MS = 2 * 60 * 1000;
const DRAFT_TIMELINE_LIMIT = 20;

export type ProcessWebhookOutcome =
  | 'ignored_missing_user'
  | 'ignored_unknown_user'
  | 'ignored_non_text'
  | 'help_requested'
  | 'my_deals_listed'
  | 'active_draft_exists'
  | 'multiple_opportunities_detected'
  | 'draft_cancelled'
  | 'no_active_draft_to_cancel'
  | 'draft_started'
  | 'draft_message_recorded'
  | 'draft_needs_more_fields'
  | 'draft_ready_for_confirmation'
  | 'opportunity_created'
  | 'update_draft_started'
  | 'update_draft_message_recorded'
  | 'update_draft_ready_for_confirmation'
  | 'opportunity_updated'
  | 'callback_recorded'
  | 'callback_ignored';

export interface ProcessWebhookJobResult {
  skipped: boolean;
  jobId: string;
  updateId?: number;
  telegramUserId?: string | null;
  outcome?: ProcessWebhookOutcome;
  draftId?: string | null;
  actorUserId?: string | null;
  ownerName?: string | null;
  replyCount?: number;
}

interface RouteTelegramUpdateResult {
  outcome: ProcessWebhookOutcome;
  draftId: string | null;
  draftPayload?: OpportunityDraftPayload | null;
  opportunityCreated?: { opportunityId: string } | null;
  opportunityUpdated?: { opportunityId: string } | null;
  openDeals?: Awaited<ReturnType<typeof listOpenOpportunitiesByOwner>>;
}

export async function processWebhookJob(
  db: Kysely<Database>,
  jobId: string,
  parserConfig: OpportunityDraftParserConfig
): Promise<ProcessWebhookJobResult> {
  const now = new Date();
  const claimedJob = await claimQueuedJob(db, {
    jobId,
    now,
    leaseDurationMs: PROCESS_WEBHOOK_JOB_LEASE_MS
  });

  if (!claimedJob) {
    return {
      skipped: true,
      jobId
    };
  }

  const payload = processWebhookJobPayloadSchema.parse(claimedJob.payload);

  try {
    const result = await db.transaction().execute(async (trx) => {
      const inbox = await getTelegramWebhookInboxByUpdateId(trx, payload.telegram_update_id);

      if (!inbox) {
        throw new Error(`Telegram inbox record for update ${payload.telegram_update_id} was not found`);
      }

      const update = telegramUpdateSchema.parse(inbox.raw_payload);
      const telegramUserId = extractTelegramUserId(update);
      const chatId = getTelegramChatId(update);
      const replyToMessageId = getTelegramMessageId(update);

      if (!telegramUserId) {
        const replies = renderProcessWebhookReplies({
          outcome: 'ignored_missing_user',
          chatId,
          replyToMessageId
        });

        await queueWebhookReplies(trx, {
          replies,
          correlationId: inbox.correlation_id,
          updateId: payload.telegram_update_id
        });

        await markTelegramWebhookInboxProcessed(trx, payload.telegram_update_id);
        await markJobSucceeded(trx, {
          jobId,
          finishedAt: new Date()
        });

        return {
          skipped: false,
          jobId,
          updateId: payload.telegram_update_id,
          telegramUserId: null,
          outcome: 'ignored_missing_user',
          draftId: null,
          actorUserId: null,
          replyCount: replies.length
        } satisfies ProcessWebhookJobResult;
      }

      await acquireTelegramUserLock(trx, telegramUserId);
      await expireActiveDraftsForTelegramUser(trx, {
        telegramUserId,
        now
      });

      const actor = await getUserByTelegramUserId(trx, telegramUserId);

      if (!actor) {
        const replies = renderProcessWebhookReplies({
          outcome: 'ignored_unknown_user',
          chatId,
          replyToMessageId
        });

        await queueWebhookReplies(trx, {
          replies,
          correlationId: inbox.correlation_id,
          updateId: payload.telegram_update_id
        });

        await markTelegramWebhookInboxProcessed(trx, payload.telegram_update_id);
        await markJobSucceeded(trx, {
          jobId,
          finishedAt: new Date()
        });

        return {
          skipped: false,
          jobId,
          updateId: payload.telegram_update_id,
          telegramUserId,
          outcome: 'ignored_unknown_user',
          draftId: null,
          actorUserId: null,
          replyCount: replies.length
        } satisfies ProcessWebhookJobResult;
      }

      const activeDraft = await getActiveDraftByTelegramUserId(trx, telegramUserId);
      const routeResult = await routeTelegramUpdate(trx, {
        updateId: payload.telegram_update_id,
        telegramUserId,
        actorUserId: actor.user_id,
        update,
        activeDraft,
        parserConfig
      });
      const replies = renderProcessWebhookReplies({
        outcome: routeResult.outcome,
        chatId,
        replyToMessageId,
        ...(routeResult.draftPayload !== undefined ? { draftPayload: routeResult.draftPayload } : {}),
        ownerName: actor.owner_name,
        ...(routeResult.opportunityCreated !== undefined
          ? { opportunityCreated: routeResult.opportunityCreated }
          : {}),
        ...(routeResult.opportunityUpdated !== undefined
          ? { opportunityUpdated: routeResult.opportunityUpdated }
          : {}),
        ...(routeResult.openDeals !== undefined ? { openDeals: routeResult.openDeals } : {})
      });

      await queueWebhookReplies(trx, {
        replies,
        correlationId: inbox.correlation_id,
        updateId: payload.telegram_update_id
      });

      await markTelegramWebhookInboxProcessed(trx, payload.telegram_update_id);
      await markJobSucceeded(trx, {
        jobId,
        finishedAt: new Date()
      });

      return {
        skipped: false,
        jobId,
        updateId: payload.telegram_update_id,
        telegramUserId,
        actorUserId: actor.user_id,
        ownerName: actor.owner_name,
        replyCount: replies.length,
        ...routeResult
      } satisfies ProcessWebhookJobResult;
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dead = claimedJob.attempts >= claimedJob.max_attempts;
    const finishedAt = new Date();

    await markJobFailed(db, {
      jobId,
      errorMessage,
      dead,
      finishedAt
    });

    await markTelegramWebhookInboxFailed(db, {
      telegramUpdateId: payload.telegram_update_id,
      errorMessage,
      dead
    });

    throw error;
  }
}

async function routeTelegramUpdate(
  db: Kysely<Database>,
  values: {
    updateId: number;
    telegramUserId: string;
    actorUserId: string;
    update: z.infer<typeof telegramUpdateSchema>;
    activeDraft: Awaited<ReturnType<typeof getActiveDraftByTelegramUserId>>;
    parserConfig: OpportunityDraftParserConfig;
  }
): Promise<RouteTelegramUpdateResult> {
  const kind = getTelegramUpdateKind(values.update);
  const text = normalizeIncomingText(getTelegramUpdateText(values.update));
  const now = new Date();
  const callbackData = values.update.callback_query?.data ?? null;

  if (kind === 'callback_query') {
    if (callbackData?.startsWith('update:start:')) {
      if (values.activeDraft) {
        return {
          outcome: 'active_draft_exists',
          draftId: values.activeDraft.draft_id,
          draftPayload: tryGetDraftPayload(values.activeDraft.payload)
        };
      }

      return startUpdateDraftFromCallback(db, {
        actorUserId: values.actorUserId,
        opportunityId: callbackData.replace('update:start:', ''),
        actionKind: 'generic_update',
        initialChanges: {},
        update: values.update,
        updateId: values.updateId,
        telegramUserId: values.telegramUserId,
        now
      });
    }

    if (callbackData?.startsWith('followup:start:')) {
      if (values.activeDraft) {
        return {
          outcome: 'active_draft_exists',
          draftId: values.activeDraft.draft_id,
          draftPayload: tryGetDraftPayload(values.activeDraft.payload)
        };
      }

      return startUpdateDraftFromCallback(db, {
        actorUserId: values.actorUserId,
        opportunityId: callbackData.replace('followup:start:', ''),
        actionKind: 'set_follow_up',
        initialChanges: {},
        update: values.update,
        updateId: values.updateId,
        telegramUserId: values.telegramUserId,
        now
      });
    }

    if (callbackData?.startsWith('closelost:start:')) {
      if (values.activeDraft) {
        return {
          outcome: 'active_draft_exists',
          draftId: values.activeDraft.draft_id,
          draftPayload: tryGetDraftPayload(values.activeDraft.payload)
        };
      }

      return startUpdateDraftFromCallback(db, {
        actorUserId: values.actorUserId,
        opportunityId: callbackData.replace('closelost:start:', ''),
        actionKind: 'close_lost',
        initialChanges: {
          salesStage: 'closed_lost'
        },
        update: values.update,
        updateId: values.updateId,
        telegramUserId: values.telegramUserId,
        now
      });
    }

    if (!values.activeDraft) {
      return {
        outcome: 'callback_ignored',
        draftId: null
      };
    }

    return handleDraftCallback(db, {
      updateId: values.updateId,
      actorUserId: values.actorUserId,
      update: values.update,
      activeDraft: values.activeDraft,
      callbackData,
      now
    });
  }

  if (!text) {
    return {
      outcome: 'ignored_non_text',
      draftId: values.activeDraft?.draft_id ?? null
    };
  }

  if (text === HELP_COMMAND) {
    return {
      outcome: 'help_requested',
      draftId: values.activeDraft?.draft_id ?? null
    };
  }

  if (text === MY_DEALS_COMMAND) {
    return {
      outcome: 'my_deals_listed',
      draftId: values.activeDraft?.draft_id ?? null,
      openDeals: await listOpenOpportunitiesByOwner(db, {
        ownerUserId: values.actorUserId,
        limit: 10
      })
    };
  }

  if (text === CANCEL_COMMAND) {
    if (!values.activeDraft) {
      return {
        outcome: 'no_active_draft_to_cancel',
        draftId: null
      };
    }

    const cancelledDraft = await finalizeTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      status: 'cancelled',
      finalizedAt: now,
      currentStep: 'cancelled',
      payload: appendDraftTimeline(values.activeDraft.payload, buildDraftTimelineEntry(values.update, values.updateId))
    });

    return {
      outcome: 'draft_cancelled',
      draftId: cancelledDraft.draft_id
    };
  }

  const nextPayloadEntry = buildDraftTimelineEntry(values.update, values.updateId);
  const parserResult = await parseOpportunityDraftInput(text, values.parserConfig);

  if (parserResult.multipleOpportunitiesDetected) {
    return {
      outcome: 'multiple_opportunities_detected',
      draftId: values.activeDraft?.draft_id ?? null,
      draftPayload: values.activeDraft ? tryGetDraftPayload(values.activeDraft.payload) : null
    };
  }

  if (values.activeDraft) {
    if (values.activeDraft.draft_type === 'update') {
      return appendToUpdateDraft(db, {
        activeDraft: values.activeDraft,
        patch: parserResult.patch,
        parseNotes: parserResult.parseNotes,
        parserVersion: parserResult.parserVersion,
        nextPayloadEntry,
        now
      });
    }

    return appendToNewDraft(db, {
      activeDraft: values.activeDraft,
      patch: parserResult.patch,
      parseNotes: parserResult.parseNotes,
      parserVersion: parserResult.parserVersion,
      nextPayloadEntry,
      now
    });
  }

  const initialCandidate = await enrichDraftCandidate(db, parserResult.patch);
  const initialPayload = buildInitialDraftPayload({
    update: values.update,
    updateId: values.updateId,
    actorUserId: values.actorUserId,
    candidate: initialCandidate.candidate,
    parseNotes: parserResult.parseNotes,
    parserVersion: parserResult.parserVersion,
    requiresManualSegment: initialCandidate.requiresManualSegment
  });
  const createdDraft = await createTelegramDraft(db, {
    draftId: randomUUID(),
    telegramUserId: values.telegramUserId,
    draftType: 'new',
    currentStep:
      initialPayload.missing_required.length === 0 ? 'awaiting_confirmation' : 'awaiting_more_fields',
    payload: toDraftPayloadJson(initialPayload),
    expiresAt: nextDraftExpiry()
  });

  return {
    outcome:
      initialPayload.missing_required.length === 0
        ? 'draft_ready_for_confirmation'
        : 'draft_started',
    draftId: createdDraft.draft_id,
    draftPayload: initialPayload
  };
}

async function acquireTelegramUserLock(db: Kysely<Database>, telegramUserId: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(${telegramUserId}::bigint)`.execute(db);
}

function buildInitialDraftPayload(values: {
  update: z.infer<typeof telegramUpdateSchema>;
  updateId: number;
  actorUserId: string;
  candidate: OpportunityDraftCandidate;
  parseNotes: string[];
  parserVersion: string;
  requiresManualSegment: boolean;
}): NewOpportunityDraftPayload {
  const timelineEntry = buildDraftTimelineEntry(values.update, values.updateId);

  return newOpportunityDraftPayloadSchema.parse({
    actor_user_id: values.actorUserId,
    draft_origin: {
      update_id: values.updateId,
      update_kind: getTelegramUpdateKind(values.update)
    },
    parser_version: values.parserVersion,
    candidate: values.candidate,
    missing_required: deriveMissingRequiredDraftFields(values.candidate, {
      requiresManualSegment: values.requiresManualSegment
    }),
    parse_notes: values.parseNotes,
    last_input: timelineEntry,
    timeline: [timelineEntry]
  });
}

async function handleDraftCallback(
  db: Kysely<Database>,
  values: {
    updateId: number;
    actorUserId: string;
    update: z.infer<typeof telegramUpdateSchema>;
    activeDraft: TelegramDraftRow;
    callbackData: string | null;
    now: Date;
  }
): Promise<RouteTelegramUpdateResult> {
  const timelineEntry = buildDraftTimelineEntry(values.update, values.updateId);

  if (values.callbackData === 'draft:cancel') {
    const cancelledDraft = await finalizeTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      status: 'cancelled',
      finalizedAt: values.now,
      currentStep: 'cancelled',
      payload: appendDraftTimeline(values.activeDraft.payload, timelineEntry)
    });

    return {
      outcome: 'draft_cancelled',
      draftId: cancelledDraft.draft_id
    };
  }

  if (values.callbackData === 'update:confirm') {
    const payload = ensureUpdateOpportunityDraftPayload(
      appendDraftTimeline(values.activeDraft.payload, timelineEntry)
    );
    const missingRequired = deriveMissingRequiredUpdateDraftFields(payload);

    if (!hasUpdateDraftChanges(payload)) {
      const updatedDraft = await updateTelegramDraft(db, {
        draftId: values.activeDraft.draft_id,
        currentStep: 'awaiting_update_changes',
        payload: toDraftPayloadJson(payload),
        expiresAt: nextDraftExpiry(values.now),
        updatedAt: values.now
      });

      return {
        outcome: 'update_draft_message_recorded',
        draftId: updatedDraft.draft_id,
        draftPayload: ensureUpdateOpportunityDraftPayload(updatedDraft.payload)
      };
    }

    if (missingRequired.length > 0) {
      const updatedDraft = await updateTelegramDraft(db, {
        draftId: values.activeDraft.draft_id,
        currentStep: 'awaiting_update_changes',
        payload: toDraftPayloadJson(payload),
        expiresAt: nextDraftExpiry(values.now),
        updatedAt: values.now
      });

      return {
        outcome: 'update_draft_message_recorded',
        draftId: updatedDraft.draft_id,
        draftPayload: ensureUpdateOpportunityDraftPayload(updatedDraft.payload)
      };
    }

    const updated = await updateOpportunityFromCommand(db, buildUpdateCommandFromDraft(payload));

    await finalizeTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      status: 'confirmed',
      finalizedAt: values.now,
      currentStep: 'confirmed',
      payload: toDraftPayloadJson(
        updateOpportunityDraftPayloadSchema.parse({
          ...payload,
          confirmed_event_id: updated.eventId
        })
      )
    });

    return {
      outcome: 'opportunity_updated',
      draftId: values.activeDraft.draft_id,
      draftPayload: payload,
      opportunityUpdated: {
        opportunityId: updated.opportunityId
      }
    };
  }

  if (values.callbackData !== 'draft:confirm') {
    const updatedDraft = await updateTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      currentStep: 'callback_query_received',
      payload: appendDraftTimeline(values.activeDraft.payload, timelineEntry),
      expiresAt: nextDraftExpiry(values.now),
      updatedAt: values.now
    });

    return {
      outcome: 'callback_recorded',
      draftId: updatedDraft.draft_id,
      draftPayload: tryGetDraftPayload(updatedDraft.payload)
    };
  }

  const payload = ensureNewOpportunityDraftPayload(appendDraftTimeline(values.activeDraft.payload, timelineEntry));

  if (payload.missing_required.length > 0) {
    const updatedDraft = await updateTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      currentStep: 'awaiting_more_fields',
      payload: toDraftPayloadJson(payload),
      expiresAt: nextDraftExpiry(values.now),
      updatedAt: values.now
    });

    return {
      outcome: 'draft_needs_more_fields',
      draftId: updatedDraft.draft_id,
      draftPayload: ensureNewOpportunityDraftPayload(updatedDraft.payload)
    };
  }

  try {
    const created = await createOpportunityFromCommand(db, buildCreateCommandFromDraft(payload));

    await finalizeTelegramDraft(db, {
      draftId: values.activeDraft.draft_id,
      status: 'confirmed',
      finalizedAt: values.now,
      currentStep: 'confirmed',
      payload: toDraftPayloadJson(
        newOpportunityDraftPayloadSchema.parse({
          ...payload,
          confirmed_opportunity_id: created.opportunityId
        })
      )
    });

    return {
      outcome: 'opportunity_created',
      draftId: values.activeDraft.draft_id,
      draftPayload: payload,
      opportunityCreated: {
        opportunityId: created.opportunityId
      }
    };
  } catch (error) {
    if (error instanceof ProductCatalogResolutionError) {
      const repairedPayload = newOpportunityDraftPayloadSchema.parse({
        ...payload,
        missing_required: deriveMissingRequiredDraftFields(payload.candidate, {
          requiresManualSegment: true
        }),
        parse_notes: [...payload.parse_notes, error.message]
      });

      const updatedDraft = await updateTelegramDraft(db, {
        draftId: values.activeDraft.draft_id,
        currentStep: 'awaiting_more_fields',
        payload: toDraftPayloadJson(repairedPayload),
        expiresAt: nextDraftExpiry(values.now),
        updatedAt: values.now
      });

      return {
        outcome: 'draft_needs_more_fields',
        draftId: updatedDraft.draft_id,
        draftPayload: ensureNewOpportunityDraftPayload(updatedDraft.payload)
      };
    }

    throw error;
  }
}

async function startUpdateDraftFromCallback(
  db: Kysely<Database>,
  values: {
    actorUserId: string;
    opportunityId: string;
    actionKind: UpdateOpportunityDraftPayload['action_kind'];
    initialChanges: OpportunityDraftCandidate;
    update: z.infer<typeof telegramUpdateSchema>;
    updateId: number;
    telegramUserId: string;
    now: Date;
  }
): Promise<RouteTelegramUpdateResult> {
  const current = await getOpportunityCurrentById(db, values.opportunityId);

  if (!current) {
    return {
      outcome: 'callback_ignored',
      draftId: null
    };
  }

  const timelineEntry = buildDraftTimelineEntry(values.update, values.updateId);
  const payload = buildUpdateDraftPayload({
    actorUserId: values.actorUserId,
    opportunityId: current.opportunity_id,
    baseVersion: current.current_version,
    currentCustomer: current.customer_raw,
    currentProduct: current.product_raw,
    currentSalesStage: current.sales_stage,
    currentValueEurK: Number(current.value_eur_k),
    actionKind: values.actionKind,
    initialChanges: values.initialChanges,
    timelineEntry
  });

  const createdDraft = await createTelegramDraft(db, {
    draftId: randomUUID(),
    telegramUserId: values.telegramUserId,
    draftType: 'update',
    currentStep: hasReadyUpdateDraftChanges(payload)
      ? 'awaiting_update_confirmation'
      : 'awaiting_update_changes',
    payload: toDraftPayloadJson(payload),
    expiresAt: nextDraftExpiry(values.now)
  });

  return {
    outcome: 'update_draft_started',
    draftId: createdDraft.draft_id,
    draftPayload: payload
  };
}

async function appendToNewDraft(
  db: Kysely<Database>,
  values: {
    activeDraft: TelegramDraftRow;
    patch: OpportunityDraftCandidate;
    parseNotes: string[];
    parserVersion: string;
    nextPayloadEntry: JsonObject;
    now: Date;
  }
): Promise<RouteTelegramUpdateResult> {
  const payload = ensureNewOpportunityDraftPayload(appendDraftTimeline(values.activeDraft.payload, values.nextPayloadEntry));
  const mergedCandidate = await enrichDraftCandidate(
    db,
    mergeOpportunityDraftCandidate(payload.candidate, values.patch)
  );
  const nextPayload = newOpportunityDraftPayloadSchema.parse({
    ...payload,
    candidate: mergedCandidate.candidate,
    missing_required: deriveMissingRequiredDraftFields(mergedCandidate.candidate, {
      requiresManualSegment: mergedCandidate.requiresManualSegment
    }),
    parse_notes: [...payload.parse_notes, ...values.parseNotes],
    parser_version: values.parserVersion,
    last_input: values.nextPayloadEntry
  });
  const updatedDraft = await updateTelegramDraft(db, {
    draftId: values.activeDraft.draft_id,
    currentStep:
      nextPayload.missing_required.length === 0 ? 'awaiting_confirmation' : 'awaiting_more_fields',
    payload: toDraftPayloadJson(nextPayload),
    expiresAt: nextDraftExpiry(values.now),
    updatedAt: values.now
  });

  return {
    outcome:
      nextPayload.missing_required.length === 0
        ? 'draft_ready_for_confirmation'
        : payload.timeline.length === 1
          ? 'draft_started'
          : 'draft_needs_more_fields',
    draftId: updatedDraft.draft_id,
    draftPayload: ensureNewOpportunityDraftPayload(updatedDraft.payload)
  };
}

async function appendToUpdateDraft(
  db: Kysely<Database>,
  values: {
    activeDraft: TelegramDraftRow;
    patch: OpportunityDraftCandidate;
    parseNotes: string[];
    parserVersion: string;
    nextPayloadEntry: JsonObject;
    now: Date;
  }
): Promise<RouteTelegramUpdateResult> {
  const payload = ensureUpdateOpportunityDraftPayload(
    appendDraftTimeline(values.activeDraft.payload, values.nextPayloadEntry)
  );
  const mergedChanges = await enrichDraftCandidate(
    db,
    mergeOpportunityDraftCandidate(payload.changes, values.patch)
  );
  const nextPayload = updateOpportunityDraftPayloadSchema.parse({
    ...payload,
    changes: mergedChanges.candidate,
    parse_notes: [...payload.parse_notes, ...values.parseNotes],
    parser_version: values.parserVersion,
    last_input: values.nextPayloadEntry
  });
  const updatedDraft = await updateTelegramDraft(db, {
    draftId: values.activeDraft.draft_id,
    currentStep: hasReadyUpdateDraftChanges(nextPayload)
      ? 'awaiting_update_confirmation'
      : 'awaiting_update_changes',
    payload: toDraftPayloadJson(nextPayload),
    expiresAt: nextDraftExpiry(values.now),
    updatedAt: values.now
  });

  return {
    outcome: hasReadyUpdateDraftChanges(nextPayload)
      ? 'update_draft_ready_for_confirmation'
      : 'update_draft_message_recorded',
    draftId: updatedDraft.draft_id,
    draftPayload: ensureUpdateOpportunityDraftPayload(updatedDraft.payload)
  };
}

function appendDraftTimeline(currentPayload: JsonValue, entry: JsonObject): JsonObject {
  const payload = coerceJsonObject(currentPayload);
  const timeline = Array.isArray(payload.timeline) ? [...payload.timeline] : [];
  timeline.push(entry);

  const boundedTimeline = timeline.slice(-DRAFT_TIMELINE_LIMIT);

  return {
    ...payload,
    last_input: entry,
    timeline: boundedTimeline as JsonArray
  };
}

function buildDraftTimelineEntry(
  update: z.infer<typeof telegramUpdateSchema>,
  updateId: number
): JsonObject {
  const kind = getTelegramUpdateKind(update);
  const text = getTelegramUpdateText(update);
  const chatId = getTelegramChatId(update);
  const messageId = getTelegramMessageId(update);

  return {
    recorded_at: new Date().toISOString(),
    update_id: updateId,
    update_kind: kind,
    chat_id: chatId,
    message_id: messageId,
    text: text
  };
}

function normalizeIncomingText(text: string | null): string | null {
  if (text === null) {
    return null;
  }

  const normalized = text.trim();
  return normalized.length > 0 ? normalized : null;
}

function coerceJsonObject(value: JsonValue): JsonObject {
  return isJsonObject(value) ? value : {};
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function nextDraftExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + DRAFT_TTL_MS);
}

function tryGetNewDraftPayload(value: JsonValue): NewOpportunityDraftPayload | null {
  const parsed = newOpportunityDraftPayloadSchema.safeParse(coerceLegacyDraftPayload(value));
  return parsed.success ? parsed.data : null;
}

function ensureNewOpportunityDraftPayload(value: JsonValue): NewOpportunityDraftPayload {
  return newOpportunityDraftPayloadSchema.parse(coerceLegacyDraftPayload(value));
}

function ensureUpdateOpportunityDraftPayload(value: JsonValue): UpdateOpportunityDraftPayload {
  return updateOpportunityDraftPayloadSchema.parse(value);
}

function tryGetDraftPayload(value: JsonValue): OpportunityDraftPayload | null {
  const updateDraft = updateOpportunityDraftPayloadSchema.safeParse(value);

  if (updateDraft.success) {
    return updateDraft.data;
  }

  return tryGetNewDraftPayload(value);
}

async function enrichDraftCandidate(
  db: Kysely<Database>,
  candidate: OpportunityDraftCandidate
): Promise<{
  candidate: OpportunityDraftCandidate;
  requiresManualSegment: boolean;
}> {
  if (!candidate.product) {
    return {
      candidate,
      requiresManualSegment: false
    };
  }

  const match = await findProductCatalogMatch(db, normalizeProductName(candidate.product));

  if (!match) {
    return {
      candidate,
      requiresManualSegment: true
    };
  }

  return {
    candidate: opportunityDraftCandidateSchema.parse({
      ...candidate,
      productSegmentCode: match.segmentCode
    }),
    requiresManualSegment: false
  };
}

function buildCreateCommandFromDraft(payload: NewOpportunityDraftPayload) {
  const candidate = payload.candidate;

  return {
    actorUserId: payload.actor_user_id,
    customer: requiredDraftValue(candidate.customer, 'customer'),
    contactPerson: requiredDraftValue(candidate.contactPerson, 'contactPerson'),
    contactChannel: requiredDraftValue(candidate.contactChannel, 'contactChannel'),
    product: requiredDraftValue(candidate.product, 'product'),
    productSegmentCode: candidate.productSegmentCode,
    quantity: requiredNumericDraftValue(candidate.quantity, 'quantity'),
    valueEurK: requiredNumericDraftValue(candidate.valueEurK, 'valueEurK'),
    salesStage: requiredDraftValue(candidate.salesStage, 'salesStage'),
    expectedCloseDate: requiredDraftValue(candidate.expectedCloseDate, 'expectedCloseDate'),
    expectedClosePrecision: requiredDraftValue(
      candidate.expectedClosePrecision,
      'expectedClosePrecision'
    ),
    nextFollowUpDate: candidate.nextFollowUpDate ?? null,
    competitorRaw: candidate.competitorRaw ?? null,
    stageNote: candidate.stageNote ?? null,
    followUpNote: candidate.followUpNote ?? null,
    lostReason: candidate.lostReason ?? null,
    lostReasonNote: candidate.lostReasonNote ?? null,
    winNote: candidate.winNote ?? null,
    reopenNote: candidate.reopenNote ?? null,
    source: 'telegram' as const
  };
}

function buildUpdateDraftPayload(values: {
  actorUserId: string;
  opportunityId: string;
  baseVersion: number;
  actionKind: UpdateOpportunityDraftPayload['action_kind'];
  initialChanges: OpportunityDraftCandidate;
  currentCustomer: string;
  currentProduct: string;
  currentSalesStage: UpdateOpportunityDraftPayload['current_summary']['salesStage'];
  currentValueEurK: number;
  timelineEntry: JsonObject;
}): UpdateOpportunityDraftPayload {
  return updateOpportunityDraftPayloadSchema.parse({
    actor_user_id: values.actorUserId,
    opportunity_id: values.opportunityId,
    base_version: values.baseVersion,
    action_kind: values.actionKind,
    current_summary: {
      opportunityId: values.opportunityId,
      customer: values.currentCustomer,
      product: values.currentProduct,
      salesStage: values.currentSalesStage,
      valueEurK: values.currentValueEurK
    },
    parser_version: 'heuristic_v1',
    changes: values.initialChanges,
    parse_notes: [],
    last_input: values.timelineEntry,
    timeline: [values.timelineEntry]
  });
}

function buildUpdateCommandFromDraft(payload: UpdateOpportunityDraftPayload) {
  const changes = payload.changes;

  return {
    opportunityId: payload.opportunity_id,
    baseVersion: payload.base_version,
    actorUserId: payload.actor_user_id,
    source: 'telegram' as const,
    changes: {
      ...(changes.customer !== undefined ? { customer: changes.customer } : {}),
      ...(changes.contactPerson !== undefined ? { contactPerson: changes.contactPerson } : {}),
      ...(changes.contactChannel !== undefined ? { contactChannel: changes.contactChannel } : {}),
      ...(changes.product !== undefined ? { product: changes.product } : {}),
      ...(changes.productSegmentCode !== undefined
        ? { productSegmentCode: changes.productSegmentCode }
        : {}),
      ...(changes.quantity !== undefined ? { quantity: changes.quantity } : {}),
      ...(changes.valueEurK !== undefined ? { valueEurK: changes.valueEurK } : {}),
      ...(changes.salesStage !== undefined ? { salesStage: changes.salesStage } : {}),
      ...(changes.expectedCloseDate !== undefined
        ? { expectedCloseDate: changes.expectedCloseDate }
        : {}),
      ...(changes.expectedClosePrecision !== undefined
        ? { expectedClosePrecision: changes.expectedClosePrecision }
        : {}),
      ...(changes.nextFollowUpDate !== undefined
        ? { nextFollowUpDate: changes.nextFollowUpDate }
        : {}),
      ...(changes.competitorRaw !== undefined ? { competitorRaw: changes.competitorRaw } : {}),
      ...(changes.stageNote !== undefined ? { stageNote: changes.stageNote } : {}),
      ...(changes.followUpNote !== undefined ? { followUpNote: changes.followUpNote } : {}),
      ...(changes.lostReason !== undefined ? { lostReason: changes.lostReason } : {}),
      ...(changes.lostReasonNote !== undefined ? { lostReasonNote: changes.lostReasonNote } : {}),
      ...(changes.winNote !== undefined ? { winNote: changes.winNote } : {}),
      ...(changes.reopenNote !== undefined ? { reopenNote: changes.reopenNote } : {})
    }
  };
}

function hasReadyUpdateDraftChanges(payload: UpdateOpportunityDraftPayload): boolean {
  return hasUpdateDraftChanges(payload) && deriveMissingRequiredUpdateDraftFields(payload).length === 0;
}

function requiredDraftValue<T extends string>(value: T | undefined, field: string): T {
  if (!value) {
    throw new Error(`Draft field ${field} is required before confirmation`);
  }

  return value;
}

function requiredNumericDraftValue(value: number | undefined, field: string): number {
  if (value === undefined) {
    throw new Error(`Draft field ${field} is required before confirmation`);
  }

  return value;
}

function toDraftPayloadJson(payload: OpportunityDraftPayload): JsonObject {
  return JSON.parse(JSON.stringify(payload)) as JsonObject;
}

function coerceLegacyDraftPayload(value: JsonValue): JsonValue {
  const payload = coerceJsonObject(value);

  if (
    payload.actor_user_id &&
    payload.draft_origin &&
    payload.last_input &&
    payload.timeline &&
    payload.parser_version === undefined
  ) {
    return {
      ...payload,
      parser_version: 'heuristic_v1',
      candidate: {},
      missing_required: [...requiredDraftFieldKeys],
      parse_notes: []
    };
  }

  return value;
}

async function queueWebhookReplies(
  db: Kysely<Database>,
  values: {
    replies: ReturnType<typeof renderProcessWebhookReplies>;
    correlationId: string;
    updateId: number;
  }
): Promise<void> {
  if (values.replies.length === 0) {
    return;
  }

  const jobs = values.replies.map((reply, index) =>
    buildSendTelegramMessageJob({
      correlationId: values.correlationId,
      message: reply,
      dedupeKey: `send_telegram_message:${values.updateId}:${index}`
    })
  );

  await insertQueuedJobs(db, jobs);
}
