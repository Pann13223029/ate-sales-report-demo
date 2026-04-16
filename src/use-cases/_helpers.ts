import { randomUUID } from 'node:crypto';

import type {
  EventSource,
  NewJob,
  OpportunityCurrentRow,
  SegmentCode,
  SegmentSource
} from '../db/schema.js';
import type { OpportunityBusinessState } from '../domain/business-events.js';
import { isClosedStage, probabilityForStage, type SalesStage } from '../domain/opportunity.js';
import { deriveStaleStatus } from '../domain/stale-status.js';

export interface PrepareOpportunityStateInput {
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
  nextFollowUpDate?: string | null | undefined;
  competitorRaw?: string | null | undefined;
  stageNote?: string | null | undefined;
  followUpNote?: string | null | undefined;
  lostReason?: string | null | undefined;
  lostReasonNote?: string | null | undefined;
  winNote?: string | null | undefined;
  reopenNote?: string | null | undefined;
  registerDate: string;
  occurredAt: Date;
  previousClosedAt?: Date | null | undefined;
  previousSalesStage?: SalesStage | null | undefined;
}

export interface StandardJobParams {
  opportunityId: string;
  correlationId: string;
  source: EventSource;
  occurredAt: Date;
}

export function prepareOpportunityBusinessState(
  input: PrepareOpportunityStateInput
): OpportunityBusinessState {
  assertNonBlank(input.ownerName, 'ownerName');
  assertNonBlank(input.customerRaw, 'customerRaw');
  assertNonBlank(input.customerNormalized, 'customerNormalized');
  assertNonBlank(input.contactPerson, 'contactPerson');
  assertNonBlank(input.productRaw, 'productRaw');
  assertNonBlank(input.productNormalized, 'productNormalized');
  assertValidContactChannel(input.contactChannel);
  assertPositiveInteger(input.quantity, 'quantity');
  assertPositiveNumber(input.valueEurK, 'valueEurK');
  assertExpectedCloseConsistency(input.expectedCloseDate, input.expectedClosePrecision);
  assertOpenStageExpectedCloseDate(input.salesStage, input.expectedCloseDate, input.occurredAt);
  assertFollowUpDateNotPast(input.nextFollowUpDate ?? null, input.occurredAt);

  const occurredAtIso = input.occurredAt.toISOString();
  const lastActivityAt = new Date(occurredAtIso);
  const staleStatus = isClosedStage(input.salesStage)
    ? 'fresh'
    : deriveStaleStatus({
        asOf: input.occurredAt,
        nextFollowUpDate: input.nextFollowUpDate ?? null,
        lastActivityAt
      });

  return {
    owner_user_id: input.ownerUserId,
    owner_name: input.ownerName.trim(),
    customer_raw: input.customerRaw.trim(),
    customer_normalized: input.customerNormalized.trim(),
    contact_person: input.contactPerson.trim(),
    contact_channel: input.contactChannel.trim(),
    product_raw: input.productRaw.trim(),
    product_normalized: input.productNormalized.trim(),
    product_segment_code: input.productSegmentCode,
    segment_source: input.segmentSource,
    quantity: input.quantity,
    value_eur_k: roundCurrencyLikeNumber(input.valueEurK),
    sales_stage: input.salesStage,
    probability_pct: probabilityForStage(input.salesStage),
    expected_close_date: input.expectedCloseDate,
    expected_close_precision: input.expectedClosePrecision,
    next_follow_up_date: normalizeNullableText(input.nextFollowUpDate),
    stale_status: staleStatus,
    competitor_raw: normalizeNullableText(input.competitorRaw),
    stage_note: normalizeNullableText(input.stageNote),
    follow_up_note: normalizeNullableText(input.followUpNote),
    lost_reason: normalizeNullableText(input.lostReason),
    lost_reason_note: normalizeNullableText(input.lostReasonNote),
    win_note: normalizeNullableText(input.winNote),
    reopen_note: normalizeNullableText(input.reopenNote),
    register_date: input.registerDate,
    last_activity_at: occurredAtIso,
    closed_at: deriveClosedAtIso({
      nextStage: input.salesStage,
      previousStage: input.previousSalesStage ?? null,
      previousClosedAt: input.previousClosedAt ?? null,
      occurredAt: input.occurredAt
    })
  };
}

export function standardDownstreamJobs(params: StandardJobParams): NewJob[] {
  return [
    buildJob('sync_operational_sheet', params),
    buildJob('refresh_executive_workbook', params)
  ];
}

export function currentProjectionToBusinessState(
  row: OpportunityCurrentRow
): OpportunityBusinessState {
  return {
    owner_user_id: row.owner_user_id,
    owner_name: row.owner_name,
    customer_raw: row.customer_raw,
    customer_normalized: row.customer_normalized,
    contact_person: row.contact_person,
    contact_channel: row.contact_channel,
    product_raw: row.product_raw,
    product_normalized: row.product_normalized,
    product_segment_code: row.product_segment_code,
    segment_source: row.segment_source,
    quantity: row.quantity,
    value_eur_k: Number(row.value_eur_k),
    sales_stage: row.sales_stage,
    probability_pct: row.probability_pct,
    expected_close_date: row.expected_close_date,
    expected_close_precision: row.expected_close_precision,
    next_follow_up_date: row.next_follow_up_date,
    stale_status: row.stale_status,
    competitor_raw: row.competitor_raw,
    stage_note: row.stage_note,
    follow_up_note: row.follow_up_note,
    lost_reason: row.lost_reason,
    lost_reason_note: row.lost_reason_note,
    win_note: row.win_note,
    reopen_note: row.reopen_note,
    register_date: row.register_date,
    last_activity_at: row.last_activity_at.toISOString(),
    closed_at: row.closed_at ? row.closed_at.toISOString() : null
  };
}

function buildJob(jobType: string, params: StandardJobParams): NewJob {
  return {
    job_id: randomUUID(),
    job_type: jobType,
    status: 'queued',
    correlation_id: params.correlationId,
    dedupe_key: `${jobType}:${params.opportunityId}:${params.correlationId}`,
    payload: {
      opportunity_id: params.opportunityId,
      source: params.source,
      occurred_at: params.occurredAt.toISOString()
    },
    available_at: params.occurredAt,
    attempts: 0,
    max_attempts: 10
  };
}

function deriveClosedAtIso(params: {
  nextStage: SalesStage;
  previousStage: SalesStage | null;
  previousClosedAt: Date | null;
  occurredAt: Date;
}): string | null {
  if (!isClosedStage(params.nextStage)) {
    return null;
  }

  if (!params.previousStage || !isClosedStage(params.previousStage)) {
    return params.occurredAt.toISOString();
  }

  if (params.previousStage !== params.nextStage) {
    return params.occurredAt.toISOString();
  }

  return params.previousClosedAt?.toISOString() ?? params.occurredAt.toISOString();
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function assertPositiveNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
}

function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be blank`);
  }
}

function assertValidContactChannel(value: string): void {
  const trimmed = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneAllowedRegex = /^[+\d()\-\s]+$/;
  const digitCount = trimmed.replace(/\D/g, '').length;

  if (emailRegex.test(trimmed)) {
    return;
  }

  if (phoneAllowedRegex.test(trimmed) && digitCount >= 7) {
    return;
  }

  throw new Error('contactChannel must be a valid phone number or email address');
}

function assertExpectedCloseConsistency(dateValue: string, precision: 'day' | 'month'): void {
  const parsed = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`expectedCloseDate must be a valid ISO date: ${dateValue}`);
  }

  if (precision === 'month' && parsed.getUTCDate() !== 1) {
    throw new Error('Month-precision expectedCloseDate must be normalized to the first day');
  }
}

function assertOpenStageExpectedCloseDate(
  stage: SalesStage,
  dateValue: string,
  occurredAt: Date
): void {
  if (isClosedStage(stage)) {
    return;
  }

  const expected = new Date(`${dateValue}T00:00:00.000Z`);
  const today = new Date(
    Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate())
  );

  if (expected.getTime() < today.getTime()) {
    throw new Error('Open opportunities cannot use a past expected_close_date');
  }
}

function assertFollowUpDateNotPast(dateValue: string | null, occurredAt: Date): void {
  if (!dateValue) {
    return;
  }

  const followUp = new Date(`${dateValue}T00:00:00.000Z`);
  const today = new Date(
    Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate())
  );

  if (followUp.getTime() < today.getTime()) {
    throw new Error('next_follow_up_date cannot be in the past');
  }
}

function roundCurrencyLikeNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatUtcDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
