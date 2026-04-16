import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';

import type {
  Database,
  EventSource,
  NewOpportunityCurrent,
  OpportunityCurrentRow,
  SegmentCode,
  SegmentSource
} from '../db/schema.js';
import {
  BUSINESS_EVENT_TYPES,
  buildOpportunityUpdatedEvent,
  diffOpportunityStates,
  type OpportunityBusinessState,
  type BusinessEventType
} from '../domain/business-events.js';
import { isClosedStage, type SalesStage } from '../domain/opportunity.js';
import { parseDateOnly } from '../domain/stale-status.js';
import { commitBusinessEvent } from './commit-business-event.js';
import {
  currentProjectionToBusinessState,
  prepareOpportunityBusinessState,
  standardDownstreamJobs
} from './_helpers.js';

export interface UpdateOpportunityChanges {
  ownerUserId?: string;
  ownerName?: string;
  customerRaw?: string;
  customerNormalized?: string;
  contactPerson?: string;
  contactChannel?: string;
  productRaw?: string;
  productNormalized?: string;
  productSegmentCode?: SegmentCode;
  segmentSource?: SegmentSource;
  quantity?: number;
  valueEurK?: number;
  salesStage?: SalesStage;
  expectedCloseDate?: string;
  expectedClosePrecision?: 'day' | 'month';
  nextFollowUpDate?: string | null;
  competitorRaw?: string | null;
  stageNote?: string | null;
  followUpNote?: string | null;
  lostReason?: string | null;
  lostReasonNote?: string | null;
  winNote?: string | null;
  reopenNote?: string | null;
}

export interface UpdateOpportunityInput {
  opportunityId: string;
  baseVersion: number;
  actorUserId: string;
  source: EventSource;
  changes: UpdateOpportunityChanges;
  occurredAt?: Date;
  correlationId?: string;
  idempotencyKey?: string;
  causationId?: string | null;
  changeExplanation?: string;
  overrideNote?: string;
}

export class OpportunityNotFoundError extends Error {
  constructor(opportunityId: string) {
    super(`Opportunity ${opportunityId} was not found`);
    this.name = 'OpportunityNotFoundError';
  }
}

export async function updateOpportunity(
  db: Kysely<Database>,
  input: UpdateOpportunityInput
): Promise<{ opportunityId: string; version: number; eventId: string; eventType: BusinessEventType }> {
  const current = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .selectAll()
    .where('opportunity_id', '=', input.opportunityId)
    .executeTakeFirst();

  if (!current) {
    throw new OpportunityNotFoundError(input.opportunityId);
  }

  const occurredAt = input.occurredAt ?? new Date();
  const correlationId = input.correlationId ?? randomUUID();
  const eventId = randomUUID();
  const beforeState = currentProjectionToBusinessState(current);
  const afterState = buildUpdatedState(current, input.changes, occurredAt);
  const noteContext = buildUpdateNoteContext(beforeState, afterState, input);
  const { changedFields, beforePatch, afterPatch } = diffOpportunityStates(beforeState, afterState);

  if (changedFields.length === 0) {
    throw new Error('Update must change at least one field');
  }

  const eventType = determineUpdateEventType(
    input.source,
    beforeState.sales_stage,
    afterState.sales_stage,
    changedFields
  );
  const resultVersion = input.baseVersion + 1;

  const event = buildOpportunityUpdatedEvent({
    eventId,
    idempotencyKey:
      input.idempotencyKey ?? `update:${input.opportunityId}:${input.baseVersion}:${correlationId}`,
    opportunityId: input.opportunityId,
    actorUserId: input.actorUserId,
    source: input.source,
    correlationId,
    causationId: input.causationId ?? null,
    occurredAt,
    baseVersion: input.baseVersion,
    resultVersion,
    changedFields,
    before: beforePatch,
    after: afterPatch,
    noteContext,
    eventType
  });

  const projection = buildUpdatedProjection({
    current,
    nextState: afterState,
    eventId,
    actorUserId: input.actorUserId,
    source: input.source,
    occurredAt,
    resultVersion
  });

  await commitBusinessEvent(db, {
    event,
    projection,
    downstreamJobs: standardDownstreamJobs({
      opportunityId: input.opportunityId,
      correlationId,
      source: input.source,
      occurredAt
    })
  });

  return {
    opportunityId: input.opportunityId,
    version: resultVersion,
    eventId,
    eventType
  };
}

function buildUpdatedState(
  current: OpportunityCurrentRow,
  changes: UpdateOpportunityChanges,
  occurredAt: Date
): OpportunityBusinessState {
  return prepareOpportunityBusinessState({
    ownerUserId: changes.ownerUserId ?? current.owner_user_id,
    ownerName: changes.ownerName ?? current.owner_name,
    customerRaw: changes.customerRaw ?? current.customer_raw,
    customerNormalized: changes.customerNormalized ?? current.customer_normalized,
    contactPerson: changes.contactPerson ?? current.contact_person,
    contactChannel: changes.contactChannel ?? current.contact_channel,
    productRaw: changes.productRaw ?? current.product_raw,
    productNormalized: changes.productNormalized ?? current.product_normalized,
    productSegmentCode: changes.productSegmentCode ?? current.product_segment_code,
    segmentSource: changes.segmentSource ?? current.segment_source,
    quantity: changes.quantity ?? current.quantity,
    valueEurK: changes.valueEurK ?? Number(current.value_eur_k),
    salesStage: changes.salesStage ?? current.sales_stage,
    expectedCloseDate: changes.expectedCloseDate ?? current.expected_close_date,
    expectedClosePrecision: changes.expectedClosePrecision ?? current.expected_close_precision,
    nextFollowUpDate:
      changes.nextFollowUpDate !== undefined ? changes.nextFollowUpDate : current.next_follow_up_date,
    competitorRaw: changes.competitorRaw !== undefined ? changes.competitorRaw : current.competitor_raw,
    stageNote: changes.stageNote !== undefined ? changes.stageNote : current.stage_note,
    followUpNote:
      changes.followUpNote !== undefined ? changes.followUpNote : current.follow_up_note,
    lostReason: changes.lostReason !== undefined ? changes.lostReason : current.lost_reason,
    lostReasonNote:
      changes.lostReasonNote !== undefined ? changes.lostReasonNote : current.lost_reason_note,
    winNote: changes.winNote !== undefined ? changes.winNote : current.win_note,
    reopenNote: changes.reopenNote !== undefined ? changes.reopenNote : current.reopen_note,
    registerDate: current.register_date,
    occurredAt,
    previousClosedAt: current.closed_at,
    previousSalesStage: current.sales_stage
  });
}

function buildUpdateNoteContext(
  beforeState: OpportunityBusinessState,
  afterState: OpportunityBusinessState,
  input: UpdateOpportunityInput
): { change_explanation?: string; override_note?: string; required_reasons?: string[] } | undefined {
  const requiredReasons: string[] = [];
  const reopened = wasClosedAndReopened(beforeState.sales_stage, afterState.sales_stage);

  if (requiresLateStageForecastExplanation(beforeState, afterState)) {
    requiredReasons.push('late_stage_expected_close_shift_gt_30_days');
  }

  if (requiresLargeValueChangeExplanation(beforeState, afterState)) {
    requiredReasons.push('value_change_gt_20_percent');
  }

  if (reopened) {
    requiredReasons.push('reopen_note_required');
  }

  if (reopened && !hasText(afterState.reopen_note)) {
    throw new Error('Reopening an opportunity requires reopen_note');
  }

  if (requiredReasons.length > 0 && !hasAnyExplanatoryNote(afterState, input)) {
    throw new Error(`Update requires change explanation: ${requiredReasons.join(', ')}`);
  }

  if (!hasText(input.changeExplanation) && !hasText(input.overrideNote) && requiredReasons.length === 0) {
    return undefined;
  }

  const noteContext: {
    change_explanation?: string;
    override_note?: string;
    required_reasons?: string[];
  } = {};

  const changeExplanation = normalizeOptionalText(input.changeExplanation);
  const overrideNote = normalizeOptionalText(input.overrideNote);

  if (changeExplanation) {
    noteContext.change_explanation = changeExplanation;
  }

  if (overrideNote) {
    noteContext.override_note = overrideNote;
  }

  if (requiredReasons.length > 0) {
    noteContext.required_reasons = requiredReasons;
  }

  return noteContext;
}

function determineUpdateEventType(
  source: EventSource,
  previousStage: SalesStage,
  nextStage: SalesStage,
  changedFields: readonly string[]
): BusinessEventType {
  if (source === 'sheet') {
    return BUSINESS_EVENT_TYPES.managerSheetCorrection;
  }

  if (wasClosedAndReopened(previousStage, nextStage)) {
    return BUSINESS_EVENT_TYPES.opportunityReopened;
  }

  if (nextStage === 'closed_won' && previousStage !== 'closed_won') {
    return BUSINESS_EVENT_TYPES.opportunityClosedWon;
  }

  if (nextStage === 'closed_lost' && previousStage !== 'closed_lost') {
    return BUSINESS_EVENT_TYPES.opportunityClosedLost;
  }

  if (changedFields.length === 1 && changedFields[0] === 'next_follow_up_date') {
    return BUSINESS_EVENT_TYPES.followUpSet;
  }

  if (changedFields.includes('owner_user_id')) {
    return BUSINESS_EVENT_TYPES.ownerReassigned;
  }

  return BUSINESS_EVENT_TYPES.opportunityUpdated;
}

function buildUpdatedProjection(params: {
  current: OpportunityCurrentRow;
  nextState: OpportunityBusinessState;
  eventId: string;
  actorUserId: string;
  source: EventSource;
  occurredAt: Date;
  resultVersion: number;
}): NewOpportunityCurrent {
  return {
    opportunity_id: params.current.opportunity_id,
    current_version: params.resultVersion,
    owner_user_id: params.nextState.owner_user_id,
    owner_name: params.nextState.owner_name,
    customer_raw: params.nextState.customer_raw,
    customer_normalized: params.nextState.customer_normalized,
    contact_person: params.nextState.contact_person,
    contact_channel: params.nextState.contact_channel,
    product_raw: params.nextState.product_raw,
    product_normalized: params.nextState.product_normalized,
    product_segment_code: params.nextState.product_segment_code,
    segment_source: params.nextState.segment_source,
    quantity: params.nextState.quantity,
    value_eur_k: params.nextState.value_eur_k,
    sales_stage: params.nextState.sales_stage,
    probability_pct: params.nextState.probability_pct,
    expected_close_date: params.nextState.expected_close_date,
    expected_close_precision: params.nextState.expected_close_precision,
    next_follow_up_date: params.nextState.next_follow_up_date,
    stale_status: params.nextState.stale_status,
    competitor_raw: params.nextState.competitor_raw,
    stage_note: params.nextState.stage_note,
    follow_up_note: params.nextState.follow_up_note,
    lost_reason: params.nextState.lost_reason,
    lost_reason_note: params.nextState.lost_reason_note,
    win_note: params.nextState.win_note,
    reopen_note: params.nextState.reopen_note,
    register_date: params.current.register_date,
    last_activity_at: params.occurredAt,
    closed_at: params.nextState.closed_at ? new Date(params.nextState.closed_at) : null,
    last_reminder_sent_at: null,
    stale_count: 0,
    sync_version: String(BigInt(params.current.sync_version) + 1n),
    source: params.source,
    created_by_user_id: params.current.created_by_user_id,
    updated_by_user_id: params.actorUserId,
    last_event_id: params.eventId,
    created_at: params.current.created_at,
    updated_at: params.occurredAt
  };
}

function requiresLateStageForecastExplanation(
  beforeState: OpportunityBusinessState,
  afterState: OpportunityBusinessState
): boolean {
  const wasLateStage = ['negotiation', 'waiting_po'].includes(beforeState.sales_stage);
  const isLateStage = ['negotiation', 'waiting_po'].includes(afterState.sales_stage);

  if (
    beforeState.expected_close_date === afterState.expected_close_date
    || (!wasLateStage && !isLateStage)
  ) {
    return false;
  }

  const beforeDate = parseDateOnly(beforeState.expected_close_date);
  const afterDate = parseDateOnly(afterState.expected_close_date);
  const diffDays = Math.abs(afterDate.getTime() - beforeDate.getTime()) / (24 * 60 * 60 * 1000);

  return diffDays > 30;
}

function requiresLargeValueChangeExplanation(
  beforeState: OpportunityBusinessState,
  afterState: OpportunityBusinessState
): boolean {
  if (beforeState.value_eur_k === afterState.value_eur_k || beforeState.value_eur_k === 0) {
    return false;
  }

  const ratio = Math.abs(afterState.value_eur_k - beforeState.value_eur_k) / beforeState.value_eur_k;
  return ratio > 0.2;
}

function wasClosedAndReopened(previousStage: SalesStage, nextStage: SalesStage): boolean {
  return isClosedStage(previousStage) && !isClosedStage(nextStage);
}

function hasText(value: string | null | undefined): boolean {
  return normalizeOptionalText(value) !== undefined;
}

function hasAnyExplanatoryNote(
  afterState: OpportunityBusinessState,
  input: UpdateOpportunityInput
): boolean {
  return (
    hasText(input.changeExplanation)
    || hasText(input.overrideNote)
    || hasText(afterState.stage_note)
    || hasText(afterState.follow_up_note)
    || hasText(afterState.reopen_note)
  );
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
