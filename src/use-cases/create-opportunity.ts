import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';

import type {
  Database,
  EventSource,
  NewOpportunityCurrent,
  SegmentCode,
  SegmentSource
} from '../db/schema.js';
import type { SalesStage } from '../domain/opportunity.js';
import { buildOpportunityCreatedEvent } from '../domain/business-events.js';
import { commitBusinessEvent } from './commit-business-event.js';
import {
  formatUtcDateOnly,
  prepareOpportunityBusinessState,
  standardDownstreamJobs
} from './_helpers.js';

export interface CreateOpportunityInput {
  opportunityId: string;
  actorUserId: string;
  ownerUserId: string;
  ownerName: string;
  customerRaw: string;
  customerNormalized: string;
  contactPerson: string;
  contactChannel: string;
  productRaw: string;
  productNormalized: string;
  productSegmentCode: SegmentCode;
  segmentSource: SegmentSource;
  quantity: number;
  valueEurK: number;
  salesStage: SalesStage;
  expectedCloseDate: string;
  expectedClosePrecision: 'day' | 'month';
  source: EventSource;
  occurredAt?: Date;
  registerDate?: string;
  nextFollowUpDate?: string | null;
  competitorRaw?: string | null;
  stageNote?: string | null;
  followUpNote?: string | null;
  lostReason?: string | null;
  lostReasonNote?: string | null;
  winNote?: string | null;
  reopenNote?: string | null;
  correlationId?: string;
  idempotencyKey?: string;
  causationId?: string | null;
}

export async function createOpportunity(
  db: Kysely<Database>,
  input: CreateOpportunityInput
): Promise<{ opportunityId: string; version: number; eventId: string }> {
  const occurredAt = input.occurredAt ?? new Date();
  const registerDate = input.registerDate ?? formatUtcDateOnly(occurredAt);
  const correlationId = input.correlationId ?? randomUUID();
  const eventId = randomUUID();
  const state = prepareOpportunityBusinessState({
    ownerUserId: input.ownerUserId,
    ownerName: input.ownerName,
    customerRaw: input.customerRaw,
    customerNormalized: input.customerNormalized,
    contactPerson: input.contactPerson,
    contactChannel: input.contactChannel,
    productRaw: input.productRaw,
    productNormalized: input.productNormalized,
    productSegmentCode: input.productSegmentCode,
    segmentSource: input.segmentSource,
    quantity: input.quantity,
    valueEurK: input.valueEurK,
    salesStage: input.salesStage,
    expectedCloseDate: input.expectedCloseDate,
    expectedClosePrecision: input.expectedClosePrecision,
    nextFollowUpDate: input.nextFollowUpDate,
    competitorRaw: input.competitorRaw,
    stageNote: input.stageNote,
    followUpNote: input.followUpNote,
    lostReason: input.lostReason,
    lostReasonNote: input.lostReasonNote,
    winNote: input.winNote,
    reopenNote: input.reopenNote,
    registerDate,
    occurredAt
  });

  const event = buildOpportunityCreatedEvent({
    eventId,
    idempotencyKey:
      input.idempotencyKey ?? `create:${input.opportunityId}:${correlationId}`,
    opportunityId: input.opportunityId,
    actorUserId: input.actorUserId,
    source: input.source,
    correlationId,
    causationId: input.causationId ?? null,
    occurredAt,
    state
  });

  const projection = buildCreateProjection({
    input,
    state,
    eventId,
    occurredAt
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
    version: 1,
    eventId
  };
}

function buildCreateProjection(params: {
  input: CreateOpportunityInput;
  state: ReturnType<typeof prepareOpportunityBusinessState>;
  eventId: string;
  occurredAt: Date;
}): NewOpportunityCurrent {
  return {
    opportunity_id: params.input.opportunityId,
    current_version: 1,
    owner_user_id: params.state.owner_user_id,
    owner_name: params.state.owner_name,
    customer_raw: params.state.customer_raw,
    customer_normalized: params.state.customer_normalized,
    contact_person: params.state.contact_person,
    contact_channel: params.state.contact_channel,
    product_raw: params.state.product_raw,
    product_normalized: params.state.product_normalized,
    product_segment_code: params.state.product_segment_code,
    segment_source: params.state.segment_source,
    quantity: params.state.quantity,
    value_eur_k: params.state.value_eur_k,
    sales_stage: params.state.sales_stage,
    probability_pct: params.state.probability_pct,
    expected_close_date: params.state.expected_close_date,
    expected_close_precision: params.state.expected_close_precision,
    next_follow_up_date: params.state.next_follow_up_date,
    stale_status: params.state.stale_status,
    competitor_raw: params.state.competitor_raw,
    stage_note: params.state.stage_note,
    follow_up_note: params.state.follow_up_note,
    lost_reason: params.state.lost_reason,
    lost_reason_note: params.state.lost_reason_note,
    win_note: params.state.win_note,
    reopen_note: params.state.reopen_note,
    register_date: params.state.register_date,
    last_activity_at: params.occurredAt,
    closed_at: params.state.closed_at ? new Date(params.state.closed_at) : null,
    last_reminder_sent_at: null,
    stale_count: 0,
    sync_version: 1,
    source: params.input.source,
    created_by_user_id: params.input.actorUserId,
    updated_by_user_id: params.input.actorUserId,
    last_event_id: params.eventId,
    created_at: params.occurredAt,
    updated_at: params.occurredAt
  };
}
