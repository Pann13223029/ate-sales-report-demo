import type { Kysely } from 'kysely';
import { z } from 'zod';

import type {
  Database,
  EventSource,
  SegmentCode,
  SegmentSource
} from '../db/schema.js';
import type { BusinessEventType } from '../domain/business-events.js';
import {
  normalizeCustomerName,
  normalizeProductName,
  trimBusinessText
} from '../domain/normalize.js';
import type { SalesStage } from '../domain/opportunity.js';
import {
  allocateNextOpportunityId,
  findProductCatalogMatch,
  getOpportunityCurrentById,
  getUserById
} from '../repositories/opportunity-repository.js';
import {
  createOpportunity,
  type CreateOpportunityInput
} from '../use-cases/create-opportunity.js';
import {
  OpportunityNotFoundError,
  updateOpportunity,
  type UpdateOpportunityChanges,
  type UpdateOpportunityInput
} from '../use-cases/update-opportunity.js';

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
const sourceSchema = z.enum(['telegram', 'sheet', 'system', 'admin']);

const createOpportunityCommandSchema = z.object({
  actorUserId: z.string().uuid(),
  ownerUserId: z.string().uuid().optional(),
  customer: z.string().min(1),
  contactPerson: z.string().min(1),
  contactChannel: z.string().min(1),
  product: z.string().min(1),
  productSegmentCode: segmentCodeSchema.optional(),
  quantity: z.number().int().positive(),
  valueEurK: z.number().positive(),
  salesStage: salesStageSchema,
  expectedCloseDate: z.string().min(1),
  expectedClosePrecision: z.enum(['day', 'month']),
  source: sourceSchema.default('telegram'),
  occurredAt: z.date().optional(),
  registerDate: z.string().min(1).optional(),
  nextFollowUpDate: z.string().min(1).nullable().optional(),
  competitorRaw: z.string().min(1).nullable().optional(),
  stageNote: z.string().min(1).nullable().optional(),
  followUpNote: z.string().min(1).nullable().optional(),
  lostReason: z.string().min(1).nullable().optional(),
  lostReasonNote: z.string().min(1).nullable().optional(),
  winNote: z.string().min(1).nullable().optional(),
  reopenNote: z.string().min(1).nullable().optional(),
  correlationId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  causationId: z.string().uuid().nullable().optional()
});

const updateOpportunityChangesSchema = z.object({
  ownerUserId: z.string().uuid().optional(),
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
  nextFollowUpDate: z.string().min(1).nullable().optional(),
  competitorRaw: z.string().min(1).nullable().optional(),
  stageNote: z.string().min(1).nullable().optional(),
  followUpNote: z.string().min(1).nullable().optional(),
  lostReason: z.string().min(1).nullable().optional(),
  lostReasonNote: z.string().min(1).nullable().optional(),
  winNote: z.string().min(1).nullable().optional(),
  reopenNote: z.string().min(1).nullable().optional()
});

const updateOpportunityCommandSchema = z.object({
  opportunityId: z.string().min(1),
  baseVersion: z.number().int().positive(),
  actorUserId: z.string().uuid(),
  source: sourceSchema.default('telegram'),
  changes: updateOpportunityChangesSchema,
  occurredAt: z.date().optional(),
  correlationId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).optional(),
  causationId: z.string().uuid().nullable().optional(),
  changeExplanation: z.string().min(1).optional(),
  overrideNote: z.string().min(1).optional()
});

export type CreateOpportunityCommand = z.infer<typeof createOpportunityCommandSchema>;
export type UpdateOpportunityCommand = z.infer<typeof updateOpportunityCommandSchema>;

export class UserResolutionError extends Error {
  constructor(userId: string) {
    super(`User ${userId} was not found or is inactive`);
    this.name = 'UserResolutionError';
  }
}

export class ProductCatalogResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductCatalogResolutionError';
  }
}

export async function createOpportunityFromCommand(
  db: Kysely<Database>,
  rawCommand: CreateOpportunityCommand
): Promise<{ opportunityId: string; version: number; eventId: string }> {
  const command = createOpportunityCommandSchema.parse(rawCommand);
  const actor = await requireUser(db, command.actorUserId);
  const owner = command.ownerUserId ? await requireUser(db, command.ownerUserId) : actor;
  const productResolution = await resolveProductInput(db, {
    rawProduct: command.product,
    manualSegmentCode: command.productSegmentCode
  });
  const opportunityId = await allocateNextOpportunityId(db);

  const input: CreateOpportunityInput = {
    opportunityId,
    actorUserId: actor.user_id,
    ownerUserId: owner.user_id,
    ownerName: owner.owner_name,
    customerRaw: trimBusinessText(command.customer),
    customerNormalized: normalizeCustomerName(command.customer),
    contactPerson: trimBusinessText(command.contactPerson),
    contactChannel: trimBusinessText(command.contactChannel),
    productRaw: trimBusinessText(command.product),
    productNormalized: productResolution.productNormalized,
    productSegmentCode: productResolution.productSegmentCode,
    segmentSource: productResolution.segmentSource,
    quantity: command.quantity,
    valueEurK: command.valueEurK,
    salesStage: command.salesStage as SalesStage,
    expectedCloseDate: command.expectedCloseDate,
    expectedClosePrecision: command.expectedClosePrecision,
    source: command.source as EventSource
  };

  applyOptionalCreateFields(input, command);

  return createOpportunity(db, input);
}

export async function updateOpportunityFromCommand(
  db: Kysely<Database>,
  rawCommand: UpdateOpportunityCommand
): Promise<{ opportunityId: string; version: number; eventId: string; eventType: BusinessEventType }> {
  const command = updateOpportunityCommandSchema.parse(rawCommand);
  const current = await getOpportunityCurrentById(db, command.opportunityId);

  if (!current) {
    throw new OpportunityNotFoundError(command.opportunityId);
  }

  const actor = await requireUser(db, command.actorUserId);
  const changes: UpdateOpportunityChanges = {};

  if (command.changes.ownerUserId) {
    const owner = await requireUser(db, command.changes.ownerUserId);
    changes.ownerUserId = owner.user_id;
    changes.ownerName = owner.owner_name;
  }

  if (command.changes.customer !== undefined) {
    changes.customerRaw = trimBusinessText(command.changes.customer);
    changes.customerNormalized = normalizeCustomerName(command.changes.customer);
  }

  if (command.changes.contactPerson !== undefined) {
    changes.contactPerson = trimBusinessText(command.changes.contactPerson);
  }

  if (command.changes.contactChannel !== undefined) {
    changes.contactChannel = trimBusinessText(command.changes.contactChannel);
  }

  if (command.changes.product !== undefined || command.changes.productSegmentCode !== undefined) {
    const productResolution = await resolveProductUpdateInput(db, {
      currentSegmentSource: current.segment_source,
      currentProductNormalized: current.product_normalized,
      rawProduct: command.changes.product,
      manualSegmentCode: command.changes.productSegmentCode
    });

    if (command.changes.product !== undefined) {
      changes.productRaw = trimBusinessText(command.changes.product);
    }

    changes.productNormalized = productResolution.productNormalized;
    changes.productSegmentCode = productResolution.productSegmentCode;
    changes.segmentSource = productResolution.segmentSource;
  }

  if (command.changes.quantity !== undefined) {
    changes.quantity = command.changes.quantity;
  }

  if (command.changes.valueEurK !== undefined) {
    changes.valueEurK = command.changes.valueEurK;
  }

  if (command.changes.salesStage !== undefined) {
    changes.salesStage = command.changes.salesStage as SalesStage;
  }

  if (command.changes.expectedCloseDate !== undefined) {
    changes.expectedCloseDate = command.changes.expectedCloseDate;
  }

  if (command.changes.expectedClosePrecision !== undefined) {
    changes.expectedClosePrecision = command.changes.expectedClosePrecision;
  }

  applyNullableTextChange(changes, 'nextFollowUpDate', command.changes.nextFollowUpDate);
  applyNullableTextChange(changes, 'competitorRaw', command.changes.competitorRaw);
  applyNullableTextChange(changes, 'stageNote', command.changes.stageNote);
  applyNullableTextChange(changes, 'followUpNote', command.changes.followUpNote);
  applyNullableTextChange(changes, 'lostReason', command.changes.lostReason);
  applyNullableTextChange(changes, 'lostReasonNote', command.changes.lostReasonNote);
  applyNullableTextChange(changes, 'winNote', command.changes.winNote);
  applyNullableTextChange(changes, 'reopenNote', command.changes.reopenNote);

  const input: UpdateOpportunityInput = {
    opportunityId: command.opportunityId,
    baseVersion: command.baseVersion,
    actorUserId: actor.user_id,
    source: command.source as EventSource,
    changes
  };

  applyOptionalUpdateFields(input, command);

  return updateOpportunity(db, input);
}

async function requireUser(db: Kysely<Database>, userId: string) {
  const user = await getUserById(db, userId);

  if (!user) {
    throw new UserResolutionError(userId);
  }

  return user;
}

async function resolveProductInput(
  db: Kysely<Database>,
  params: {
    rawProduct: string;
    manualSegmentCode?: SegmentCode | undefined;
  }
): Promise<{
  productNormalized: string;
  productSegmentCode: SegmentCode;
  segmentSource: SegmentSource;
}> {
  const productNormalized = normalizeProductName(params.rawProduct);
  const matchedCatalogProduct = await findProductCatalogMatch(db, productNormalized);

  if (matchedCatalogProduct) {
    return {
      productNormalized: matchedCatalogProduct.productNormalized,
      productSegmentCode: matchedCatalogProduct.segmentCode,
      segmentSource: 'catalog'
    };
  }

  if (!params.manualSegmentCode) {
    throw new ProductCatalogResolutionError(
      'Uncataloged product requires manual productSegmentCode'
    );
  }

  return {
    productNormalized,
    productSegmentCode: params.manualSegmentCode,
    segmentSource: 'manual'
  };
}

async function resolveProductUpdateInput(
  db: Kysely<Database>,
  params: {
    currentSegmentSource: SegmentSource;
    currentProductNormalized: string;
    rawProduct?: string | undefined;
    manualSegmentCode?: SegmentCode | undefined;
  }
): Promise<{
  productNormalized: string;
  productSegmentCode: SegmentCode;
  segmentSource: SegmentSource;
}> {
  if (params.rawProduct !== undefined) {
    return resolveProductInput(db, {
      rawProduct: params.rawProduct,
      manualSegmentCode: params.manualSegmentCode
    });
  }

  if (!params.manualSegmentCode || params.currentSegmentSource !== 'manual') {
    throw new ProductCatalogResolutionError(
      'Direct product segment edits are allowed only for manual/uncataloged products'
    );
  }

  return {
    productNormalized: params.currentProductNormalized,
    productSegmentCode: params.manualSegmentCode,
    segmentSource: 'manual'
  };
}

function applyOptionalCreateFields(
  input: CreateOpportunityInput,
  command: CreateOpportunityCommand
): void {
  if (command.occurredAt) {
    input.occurredAt = command.occurredAt;
  }

  if (command.registerDate) {
    input.registerDate = command.registerDate;
  }

  if (command.nextFollowUpDate !== undefined) {
    input.nextFollowUpDate = command.nextFollowUpDate;
  }

  if (command.competitorRaw !== undefined) {
    input.competitorRaw = normalizeNullableBusinessText(command.competitorRaw);
  }

  if (command.stageNote !== undefined) {
    input.stageNote = normalizeNullableBusinessText(command.stageNote);
  }

  if (command.followUpNote !== undefined) {
    input.followUpNote = normalizeNullableBusinessText(command.followUpNote);
  }

  if (command.lostReason !== undefined) {
    input.lostReason = normalizeNullableBusinessText(command.lostReason);
  }

  if (command.lostReasonNote !== undefined) {
    input.lostReasonNote = normalizeNullableBusinessText(command.lostReasonNote);
  }

  if (command.winNote !== undefined) {
    input.winNote = normalizeNullableBusinessText(command.winNote);
  }

  if (command.reopenNote !== undefined) {
    input.reopenNote = normalizeNullableBusinessText(command.reopenNote);
  }

  if (command.correlationId) {
    input.correlationId = command.correlationId;
  }

  if (command.idempotencyKey) {
    input.idempotencyKey = command.idempotencyKey;
  }

  if (command.causationId !== undefined) {
    input.causationId = command.causationId;
  }
}

function applyOptionalUpdateFields(
  input: UpdateOpportunityInput,
  command: UpdateOpportunityCommand
): void {
  if (command.occurredAt) {
    input.occurredAt = command.occurredAt;
  }

  if (command.correlationId) {
    input.correlationId = command.correlationId;
  }

  if (command.idempotencyKey) {
    input.idempotencyKey = command.idempotencyKey;
  }

  if (command.causationId !== undefined) {
    input.causationId = command.causationId;
  }

  if (command.changeExplanation) {
    input.changeExplanation = trimBusinessText(command.changeExplanation);
  }

  if (command.overrideNote) {
    input.overrideNote = trimBusinessText(command.overrideNote);
  }
}

function applyNullableTextChange<
  TKey extends keyof Pick<
    UpdateOpportunityChanges,
    | 'nextFollowUpDate'
    | 'competitorRaw'
    | 'stageNote'
    | 'followUpNote'
    | 'lostReason'
    | 'lostReasonNote'
    | 'winNote'
    | 'reopenNote'
  >
>(
  changes: UpdateOpportunityChanges,
  key: TKey,
  value: UpdateOpportunityChanges[TKey] | undefined
): void {
  if (value !== undefined) {
    changes[key] = (
      typeof value === 'string' ? trimBusinessText(value) : value
    ) as UpdateOpportunityChanges[TKey];
  }
}

function normalizeNullableBusinessText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return trimBusinessText(value);
}
