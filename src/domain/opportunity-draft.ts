import { z } from 'zod';

import type { SegmentCode } from '../db/schema.js';
import type { SalesStage } from './opportunity.js';

const segmentCodeSchema = z.enum(['CI', 'GET', 'LVI', 'MRM', 'PDIX', 'PP', 'PT']);
const salesStageSchema = z.enum([
  'identified',
  'qualified',
  'quoted',
  'negotiation',
  'waiting_po',
  'closed_won',
  'closed_lost'
]);

export const requiredDraftFieldKeys = [
  'customer',
  'contactPerson',
  'contactChannel',
  'product',
  'quantity',
  'valueEurK',
  'salesStage',
  'expectedCloseDate',
  'expectedClosePrecision'
] as const;

export type RequiredDraftFieldKey = (typeof requiredDraftFieldKeys)[number];
export type OpportunityDraftFieldKey =
  | RequiredDraftFieldKey
  | 'productSegmentCode'
  | 'competitorRaw'
  | 'nextFollowUpDate'
  | 'stageNote'
  | 'followUpNote'
  | 'lostReason'
  | 'lostReasonNote'
  | 'winNote'
  | 'reopenNote';

export const opportunityDraftCandidateSchema = z.object({
  customer: z.string().min(1).optional(),
  contactPerson: z.string().min(1).optional(),
  contactChannel: z.string().min(1).optional(),
  product: z.string().min(1).optional(),
  productSegmentCode: segmentCodeSchema.optional(),
  quantity: z.number().int().positive().optional(),
  valueEurK: z.number().positive().optional(),
  salesStage: salesStageSchema.optional(),
  expectedCloseDate: z.string().min(1).optional(),
  expectedClosePrecision: z.enum(['day', 'month']).optional(),
  nextFollowUpDate: z.string().min(1).optional(),
  competitorRaw: z.string().min(1).optional(),
  stageNote: z.string().min(1).optional(),
  followUpNote: z.string().min(1).optional(),
  lostReason: z.string().min(1).optional(),
  lostReasonNote: z.string().min(1).optional(),
  winNote: z.string().min(1).optional(),
  reopenNote: z.string().min(1).optional()
});

export type OpportunityDraftCandidate = z.infer<typeof opportunityDraftCandidateSchema>;

export const opportunityDraftTimelineEntrySchema = z.object({
  recorded_at: z.string().min(1),
  update_id: z.number().int().nonnegative(),
  update_kind: z.enum(['message', 'edited_message', 'callback_query']),
  chat_id: z.string().nullable(),
  message_id: z.number().int().nonnegative().nullable(),
  text: z.string().nullable()
});

export const newOpportunityDraftPayloadSchema = z.object({
  actor_user_id: z.string().uuid(),
  draft_origin: z.object({
    update_id: z.number().int().nonnegative(),
    update_kind: z.enum(['message', 'edited_message', 'callback_query'])
  }),
  parser_version: z.string().min(1),
  candidate: opportunityDraftCandidateSchema,
  missing_required: z.array(z.string().min(1)),
  parse_notes: z.array(z.string().min(1)),
  last_input: opportunityDraftTimelineEntrySchema,
  timeline: z.array(opportunityDraftTimelineEntrySchema),
  confirmed_opportunity_id: z.string().min(1).optional()
});

export type NewOpportunityDraftPayload = z.infer<typeof newOpportunityDraftPayloadSchema>;

export const updateOpportunityDraftPayloadSchema = z.object({
  actor_user_id: z.string().uuid(),
  opportunity_id: z.string().min(1),
  base_version: z.number().int().positive(),
  action_kind: z.enum(['generic_update', 'set_follow_up', 'close_lost']).default('generic_update'),
  current_summary: z.object({
    opportunityId: z.string().min(1),
    customer: z.string().min(1),
    product: z.string().min(1),
    salesStage: salesStageSchema,
    valueEurK: z.number().positive()
  }),
  parser_version: z.string().min(1),
  changes: opportunityDraftCandidateSchema,
  parse_notes: z.array(z.string().min(1)),
  last_input: opportunityDraftTimelineEntrySchema,
  timeline: z.array(opportunityDraftTimelineEntrySchema),
  confirmed_event_id: z.string().uuid().optional()
});

export type UpdateOpportunityDraftPayload = z.infer<typeof updateOpportunityDraftPayloadSchema>;
export type OpportunityDraftPayload = NewOpportunityDraftPayload | UpdateOpportunityDraftPayload;

export interface ParsedOpportunityDraftPatch {
  patch: OpportunityDraftCandidate;
  parseNotes: string[];
}

export function parseOpportunityDraftText(text: string): ParsedOpportunityDraftPatch {
  const patch: OpportunityDraftCandidate = {};
  const parseNotes: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const parsedLine = parseLabeledLine(line);

    if (!parsedLine) {
      continue;
    }

    applyLabeledValuePatch(patch, parseNotes, parsedLine.label, parsedLine.value);
  }

  if (!patch.contactChannel) {
    const inferredChannel = inferContactChannel(text);

    if (inferredChannel) {
      patch.contactChannel = inferredChannel;
    }
  }

  return {
    patch,
    parseNotes
  };
}

export function mergeOpportunityDraftCandidate(
  current: OpportunityDraftCandidate,
  patch: OpportunityDraftCandidate
): OpportunityDraftCandidate {
  return opportunityDraftCandidateSchema.parse({
    ...current,
    ...stripUndefinedEntries(patch)
  });
}

export function deriveMissingRequiredDraftFields(
  candidate: OpportunityDraftCandidate,
  options?: {
    requiresManualSegment?: boolean;
  }
): OpportunityDraftFieldKey[] {
  const missing = new Set<OpportunityDraftFieldKey>();

  for (const field of requiredDraftFieldKeys) {
    if (!hasCandidateValue(candidate, field)) {
      missing.add(field);
    }
  }

  if (candidate.salesStage === 'negotiation' || candidate.salesStage === 'waiting_po') {
    if (!candidate.stageNote) {
      missing.add('stageNote');
    }
  }

  if (candidate.salesStage === 'closed_won' && !candidate.winNote) {
    missing.add('winNote');
  }

  if (candidate.salesStage === 'closed_lost' && !candidate.lostReason) {
    missing.add('lostReason');
  }

  if (options?.requiresManualSegment && !candidate.productSegmentCode) {
    missing.add('productSegmentCode');
  }

  return [...missing];
}

export function buildDraftStateSummary(payload: NewOpportunityDraftPayload): {
  readyToConfirm: boolean;
  missingFields: OpportunityDraftFieldKey[];
} {
  const missingFields = payload.missing_required as OpportunityDraftFieldKey[];

  return {
    readyToConfirm: missingFields.length === 0,
    missingFields
  };
}

export function hasUpdateDraftChanges(payload: UpdateOpportunityDraftPayload): boolean {
  return Object.keys(stripUndefinedEntries(payload.changes)).length > 0;
}

export function deriveMissingRequiredUpdateDraftFields(
  payload: UpdateOpportunityDraftPayload
): OpportunityDraftFieldKey[] {
  const missing = new Set<OpportunityDraftFieldKey>();
  const nextStage = payload.changes.salesStage;

  if (payload.action_kind === 'set_follow_up' && !hasCandidateValue(payload.changes, 'nextFollowUpDate')) {
    missing.add('nextFollowUpDate');
  }

  if (payload.action_kind === 'close_lost') {
    if (nextStage !== 'closed_lost') {
      missing.add('lostReason');
    }

    if (!hasCandidateValue(payload.changes, 'lostReason')) {
      missing.add('lostReason');
    }
  }

  if ((nextStage === 'negotiation' || nextStage === 'waiting_po') && !hasCandidateValue(payload.changes, 'stageNote')) {
    missing.add('stageNote');
  }

  if (nextStage === 'closed_won' && !hasCandidateValue(payload.changes, 'winNote')) {
    missing.add('winNote');
  }

  if (nextStage === 'closed_lost' && !hasCandidateValue(payload.changes, 'lostReason')) {
    missing.add('lostReason');
  }

  if (
    isClosedSalesStage(payload.current_summary.salesStage) &&
    nextStage !== undefined &&
    !isClosedSalesStage(nextStage) &&
    !hasCandidateValue(payload.changes, 'reopenNote')
  ) {
    missing.add('reopenNote');
  }

  return [...missing];
}

function parseLabeledLine(line: string): { label: string; value: string } | null {
  const match = line.match(/^([^:=\-]{2,40})\s*[:=\-]\s*(.+)$/);

  if (!match) {
    return null;
  }

  const [, rawLabel, rawValue] = match;

  if (!rawLabel || !rawValue) {
    return null;
  }

  return {
    label: normalizeLabel(rawLabel),
    value: rawValue.trim()
  };
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyLabeledValuePatch(
  patch: OpportunityDraftCandidate,
  parseNotes: string[],
  label: string,
  value: string
): void {
  if (matchesLabel(label, ['customer', 'company', 'client'])) {
    patch.customer = value;
    return;
  }

  if (matchesLabel(label, ['contact', 'contact person', 'pic', 'person'])) {
    patch.contactPerson = value;
    return;
  }

  if (matchesLabel(label, ['contact channel', 'channel', 'phone', 'email'])) {
    patch.contactChannel = value;
    return;
  }

  if (matchesLabel(label, ['product', 'item', 'model'])) {
    patch.product = value;
    return;
  }

  if (matchesLabel(label, ['segment', 'product segment'])) {
    const segment = parseSegmentCode(value);

    if (segment) {
      patch.productSegmentCode = segment;
    } else {
      parseNotes.push(`Could not parse product segment from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['qty', 'quantity'])) {
    const quantity = parsePositiveInteger(value);

    if (quantity !== null) {
      patch.quantity = quantity;
    } else {
      parseNotes.push(`Could not parse quantity from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['value', 'amount', 'eur', 'value eur', 'value eur 000'])) {
    const parsedValue = parseValueEurK(value);

    if (parsedValue !== null) {
      patch.valueEurK = parsedValue;
    } else {
      parseNotes.push(`Could not parse value from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['stage', 'status'])) {
    const stage = parseSalesStage(value);

    if (stage) {
      patch.salesStage = stage;
    } else {
      parseNotes.push(`Could not parse sales stage from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['expected close', 'close', 'close date', 'expected close date'])) {
    const parsedDate = parseExpectedClose(value);

    if (parsedDate) {
      patch.expectedCloseDate = parsedDate.date;
      patch.expectedClosePrecision = parsedDate.precision;
    } else {
      parseNotes.push(`Could not parse expected close from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['next follow up', 'follow up date', 'next follow-up date'])) {
    const parsedDate = parseExpectedClose(value);

    if (parsedDate) {
      patch.nextFollowUpDate = parsedDate.date;
    } else {
      parseNotes.push(`Could not parse next follow-up date from "${value}"`);
    }

    return;
  }

  if (matchesLabel(label, ['competitor', 'comp'])) {
    patch.competitorRaw = value;
    return;
  }

  if (matchesLabel(label, ['stage note'])) {
    patch.stageNote = value;
    return;
  }

  if (matchesLabel(label, ['follow up note', 'follow-up note', 'note'])) {
    patch.followUpNote = value;
    return;
  }

  if (matchesLabel(label, ['lost reason'])) {
    patch.lostReason = value;
    return;
  }

  if (matchesLabel(label, ['lost reason note'])) {
    patch.lostReasonNote = value;
    return;
  }

  if (matchesLabel(label, ['win note'])) {
    patch.winNote = value;
    return;
  }

  if (matchesLabel(label, ['reopen note'])) {
    patch.reopenNote = value;
  }
}

function matchesLabel(label: string, candidates: readonly string[]): boolean {
  return candidates.includes(label);
}

function parseSegmentCode(rawValue: string): SegmentCode | null {
  const normalized = rawValue.trim().toUpperCase();
  const parsed = segmentCodeSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

function parsePositiveInteger(rawValue: string): number | null {
  const normalized = rawValue.replace(/,/g, '').trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseValueEurK(rawValue: string): number | null {
  const compact = rawValue
    .toLowerCase()
    .replace(/eur|\(000\)|,/g, '')
    .replace(/\s+/g, '')
    .trim();

  const hasTrailingK = compact.endsWith('k');
  const numericPart = hasTrailingK ? compact.slice(0, -1) : compact;

  if (!/^\d+(\.\d+)?$/.test(numericPart)) {
    return null;
  }

  let value = Number(numericPart);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (!hasTrailingK && value >= 1000) {
    value = value / 1000;
  }

  return Number(value.toFixed(2));
}

function parseSalesStage(rawValue: string): SalesStage | null {
  const normalized = rawValue.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

  const aliases: Record<SalesStage, string[]> = {
    identified: ['identified', 'identify'],
    qualified: ['qualified', 'qualify'],
    quoted: ['quoted', 'quote', 'quotation'],
    negotiation: ['negotiation', 'negotiating'],
    waiting_po: ['waiting po', 'waiting_po', 'po', 'waiting for po'],
    closed_won: ['closed won', 'closed_won', 'won', 'win'],
    closed_lost: ['closed lost', 'closed_lost', 'lost', 'lose']
  };

  for (const [stage, values] of Object.entries(aliases) as Array<[SalesStage, string[]]>) {
    if (values.includes(normalized)) {
      return stage;
    }
  }

  const parsed = salesStageSchema.safeParse(normalized.replace(/ /g, '_'));
  return parsed.success ? parsed.data : null;
}

function parseExpectedClose(rawValue: string): { date: string; precision: 'day' | 'month' } | null {
  const value = rawValue.trim();

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return normalizeDayDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slashMatch) {
    return normalizeDayDate(Number(slashMatch[3]), Number(slashMatch[2]), Number(slashMatch[1]));
  }

  const lower = value.toLowerCase();
  const monthMatch = lower.match(/^([a-z\u0E00.]+)\s+(\d{4})$/u);

  if (monthMatch) {
    const [, rawMonthToken, rawYear] = monthMatch;

    if (!rawMonthToken || !rawYear) {
      return null;
    }

    const month = parseMonthToken(rawMonthToken);

    if (month !== null) {
      return {
        date: formatDateOnly(Number(rawYear), month, 1),
        precision: 'month'
      };
    }
  }

  return null;
}

function normalizeDayDate(
  year: number,
  month: number,
  day: number
): { date: string; precision: 'day' } | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    date: formatDateOnly(year, month, day),
    precision: 'day'
  };
}

function parseMonthToken(token: string): number | null {
  const normalized = token.replace(/\./g, '').trim();
  const map: Record<string, number> = {
    jan: 1,
    january: 1,
    'มค': 1,
    'มกราคม': 1,
    feb: 2,
    february: 2,
    'กพ': 2,
    'กุมภาพันธ์': 2,
    mar: 3,
    march: 3,
    'มีค': 3,
    'มีนาคม': 3,
    apr: 4,
    april: 4,
    'เมย': 4,
    'เมษายน': 4,
    may: 5,
    'พค': 5,
    'พฤษภาคม': 5,
    jun: 6,
    june: 6,
    'มิย': 6,
    'มิถุนายน': 6,
    jul: 7,
    july: 7,
    'กค': 7,
    'กรกฎาคม': 7,
    aug: 8,
    august: 8,
    'สค': 8,
    'สิงหาคม': 8,
    sep: 9,
    sept: 9,
    september: 9,
    'กย': 9,
    'กันยายน': 9,
    oct: 10,
    october: 10,
    'ตค': 10,
    'ตุลาคม': 10,
    nov: 11,
    november: 11,
    'พย': 11,
    'พฤศจิกายน': 11,
    dec: 12,
    december: 12,
    'ธค': 12,
    'ธันวาคม': 12
  };

  return map[normalized] ?? null;
}

function inferContactChannel(text: string): string | undefined {
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  if (emailMatch) {
    return emailMatch[0];
  }

  const phoneMatch = text.match(/(?:\+?\d[\d\s()-]{6,}\d)/);

  if (phoneMatch) {
    return phoneMatch[0].trim();
  }

  return undefined;
}

function hasCandidateValue(
  candidate: OpportunityDraftCandidate,
  field: OpportunityDraftFieldKey
): boolean {
  const value = candidate[field];

  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function isClosedSalesStage(value: SalesStage): boolean {
  return value === 'closed_won' || value === 'closed_lost';
}

function stripUndefinedEntries<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function formatDateOnly(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
