import { z } from 'zod';

import type {
  ClosePrecision,
  EventSource,
  JsonObject,
  NewBusinessEvent,
  SalesStage,
  SegmentCode,
  SegmentSource,
  StaleStatus
} from '../db/schema.js';

export const BUSINESS_EVENT_TYPES = {
  opportunityCreated: 'opportunity_created',
  opportunityUpdated: 'opportunity_updated',
  opportunityClosedWon: 'opportunity_closed_won',
  opportunityClosedLost: 'opportunity_closed_lost',
  opportunityReopened: 'opportunity_reopened',
  ownerReassigned: 'owner_reassigned',
  managerSheetCorrection: 'manager_sheet_correction',
  followUpSet: 'follow_up_set'
} as const;

export type BusinessEventType =
  (typeof BUSINESS_EVENT_TYPES)[keyof typeof BUSINESS_EVENT_TYPES];

export type OpportunityFieldName =
  | 'owner_user_id'
  | 'owner_name'
  | 'customer_raw'
  | 'customer_normalized'
  | 'contact_person'
  | 'contact_channel'
  | 'product_raw'
  | 'product_normalized'
  | 'product_segment_code'
  | 'segment_source'
  | 'quantity'
  | 'value_eur_k'
  | 'sales_stage'
  | 'probability_pct'
  | 'expected_close_date'
  | 'expected_close_precision'
  | 'next_follow_up_date'
  | 'stale_status'
  | 'competitor_raw'
  | 'stage_note'
  | 'follow_up_note'
  | 'lost_reason'
  | 'lost_reason_note'
  | 'win_note'
  | 'reopen_note'
  | 'register_date'
  | 'last_activity_at'
  | 'closed_at';

export interface OpportunityBusinessState {
  owner_user_id: string;
  owner_name: string;
  customer_raw: string;
  customer_normalized: string;
  contact_person: string;
  contact_channel: string;
  product_raw: string;
  product_normalized: string;
  product_segment_code: SegmentCode;
  segment_source: SegmentSource;
  quantity: number;
  value_eur_k: number;
  sales_stage: SalesStage;
  probability_pct: 0 | 5 | 25 | 50 | 75 | 90 | 100;
  expected_close_date: string;
  expected_close_precision: ClosePrecision;
  next_follow_up_date: string | null;
  stale_status: StaleStatus;
  competitor_raw: string | null;
  stage_note: string | null;
  follow_up_note: string | null;
  lost_reason: string | null;
  lost_reason_note: string | null;
  win_note: string | null;
  reopen_note: string | null;
  register_date: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface UpdateNoteContext {
  change_explanation?: string;
  override_note?: string;
  required_reasons?: string[];
}

const salesStageSchema = z.enum([
  'identified',
  'qualified',
  'quoted',
  'negotiation',
  'waiting_po',
  'closed_won',
  'closed_lost'
]);

const segmentCodeSchema = z.enum(['CI', 'GET', 'LVI', 'MRM', 'PDIX', 'PP', 'PT']);
const segmentSourceSchema = z.enum(['catalog', 'manual']);
const closePrecisionSchema = z.enum(['day', 'month']);
const staleStatusSchema = z.enum(['fresh', 'due_soon', 'overdue', 'stale']);

export const opportunityFieldNameSchema = z.enum([
  'owner_user_id',
  'owner_name',
  'customer_raw',
  'customer_normalized',
  'contact_person',
  'contact_channel',
  'product_raw',
  'product_normalized',
  'product_segment_code',
  'segment_source',
  'quantity',
  'value_eur_k',
  'sales_stage',
  'probability_pct',
  'expected_close_date',
  'expected_close_precision',
  'next_follow_up_date',
  'stale_status',
  'competitor_raw',
  'stage_note',
  'follow_up_note',
  'lost_reason',
  'lost_reason_note',
  'win_note',
  'reopen_note',
  'register_date',
  'last_activity_at',
  'closed_at'
]);

const opportunityBusinessStateSchema = z.object({
  owner_user_id: z.string().uuid(),
  owner_name: z.string().min(1),
  customer_raw: z.string().min(1),
  customer_normalized: z.string().min(1),
  contact_person: z.string().min(1),
  contact_channel: z.string().min(1),
  product_raw: z.string().min(1),
  product_normalized: z.string().min(1),
  product_segment_code: segmentCodeSchema,
  segment_source: segmentSourceSchema,
  quantity: z.number().int().positive(),
  value_eur_k: z.number().positive(),
  sales_stage: salesStageSchema,
  probability_pct: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(90),
    z.literal(100)
  ]),
  expected_close_date: z.string().min(1),
  expected_close_precision: closePrecisionSchema,
  next_follow_up_date: z.string().min(1).nullable(),
  stale_status: staleStatusSchema,
  competitor_raw: z.string().min(1).nullable(),
  stage_note: z.string().min(1).nullable(),
  follow_up_note: z.string().min(1).nullable(),
  lost_reason: z.string().min(1).nullable(),
  lost_reason_note: z.string().min(1).nullable(),
  win_note: z.string().min(1).nullable(),
  reopen_note: z.string().min(1).nullable(),
  register_date: z.string().min(1),
  last_activity_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable()
});

const partialOpportunityBusinessStateSchema = opportunityBusinessStateSchema.partial();

const updateNoteContextSchema = z.object({
  change_explanation: z.string().min(1).optional(),
  override_note: z.string().min(1).optional(),
  required_reasons: z.array(z.string().min(1)).optional()
});

export const opportunityCreatedPayloadSchema = z.object({
  state: opportunityBusinessStateSchema
});

export const opportunityUpdatedPayloadSchema = z.object({
  changed_fields: z.array(opportunityFieldNameSchema).min(1),
  before: partialOpportunityBusinessStateSchema,
  after: partialOpportunityBusinessStateSchema,
  note_context: updateNoteContextSchema.optional()
});

export type OpportunityCreatedPayload = z.infer<typeof opportunityCreatedPayloadSchema>;
export type OpportunityUpdatedPayload = z.infer<typeof opportunityUpdatedPayloadSchema>;

export function buildOpportunityCreatedEvent(params: {
  eventId: string;
  idempotencyKey: string;
  opportunityId: string;
  actorUserId: string;
  source: EventSource;
  correlationId: string;
  causationId?: string | null;
  occurredAt: Date;
  state: OpportunityBusinessState;
}): NewBusinessEvent {
  const payload = opportunityCreatedPayloadSchema.parse({
    state: params.state
  });

  return {
    event_id: params.eventId,
    idempotency_key: params.idempotencyKey,
    event_type: BUSINESS_EVENT_TYPES.opportunityCreated,
    opportunity_id: params.opportunityId,
    actor_type: 'user',
    actor_user_id: params.actorUserId,
    source: params.source,
    correlation_id: params.correlationId,
    causation_id: params.causationId ?? null,
    base_version: null,
    result_version: 1,
    occurred_at: params.occurredAt,
    payload: payload as JsonObject
  };
}

export function buildOpportunityUpdatedEvent(params: {
  eventId: string;
  idempotencyKey: string;
  opportunityId: string;
  actorUserId: string;
  source: EventSource;
  correlationId: string;
  causationId?: string | null | undefined;
  occurredAt: Date;
  baseVersion: number;
  resultVersion: number;
  changedFields: readonly OpportunityFieldName[];
  before: Partial<OpportunityBusinessState>;
  after: Partial<OpportunityBusinessState>;
  noteContext?: UpdateNoteContext | undefined;
  eventType?: BusinessEventType | undefined;
}): NewBusinessEvent {
  const payloadInput: {
    changed_fields: OpportunityFieldName[];
    before: Partial<OpportunityBusinessState>;
    after: Partial<OpportunityBusinessState>;
    note_context?: UpdateNoteContext;
  } = {
    changed_fields: [...params.changedFields],
    before: params.before,
    after: params.after
  };

  if (params.noteContext) {
    payloadInput.note_context = params.noteContext;
  }

  const payload = opportunityUpdatedPayloadSchema.parse(payloadInput);

  return {
    event_id: params.eventId,
    idempotency_key: params.idempotencyKey,
    event_type: params.eventType ?? BUSINESS_EVENT_TYPES.opportunityUpdated,
    opportunity_id: params.opportunityId,
    actor_type: 'user',
    actor_user_id: params.actorUserId,
    source: params.source,
    correlation_id: params.correlationId,
    causation_id: params.causationId ?? null,
    base_version: params.baseVersion,
    result_version: params.resultVersion,
    occurred_at: params.occurredAt,
    payload: payload as JsonObject
  };
}

export function diffOpportunityStates(
  before: OpportunityBusinessState,
  after: OpportunityBusinessState
): {
  changedFields: OpportunityFieldName[];
  beforePatch: Partial<OpportunityBusinessState>;
  afterPatch: Partial<OpportunityBusinessState>;
} {
  const changedFields: OpportunityFieldName[] = [];
  const beforePatch: Partial<OpportunityBusinessState> = {};
  const afterPatch: Partial<OpportunityBusinessState> = {};

  for (const fieldName of opportunityFieldNameSchema.options) {
    if (!isSameValue(before[fieldName], after[fieldName])) {
      changedFields.push(fieldName);
      setPatchValue(beforePatch, fieldName, before[fieldName]);
      setPatchValue(afterPatch, fieldName, after[fieldName]);
    }
  }

  return { changedFields, beforePatch, afterPatch };
}

function isSameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setPatchValue(
  patch: Partial<OpportunityBusinessState>,
  fieldName: OpportunityFieldName,
  value: OpportunityBusinessState[OpportunityFieldName]
): void {
  (
    patch as Record<OpportunityFieldName, OpportunityBusinessState[OpportunityFieldName] | undefined>
  )[fieldName] = value;
}
