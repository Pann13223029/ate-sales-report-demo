import type { Insertable, Kysely, Transaction } from 'kysely';

import { assertProbabilityMatchesStage } from '../domain/opportunity.js';
import type {
  Database,
  NewBusinessEvent,
  NewJob,
  NewOpportunityCurrent,
  OpportunityCurrentUpdate
} from '../db/schema.js';

export interface CommitBusinessEventInput {
  event: NewBusinessEvent;
  projection: NewOpportunityCurrent;
  downstreamJobs?: readonly NewJob[];
}

export class OpportunityVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpportunityVersionConflictError';
  }
}

export async function commitBusinessEvent(
  db: Kysely<Database>,
  input: CommitBusinessEventInput
): Promise<void> {
  validateCommitBusinessEventInput(input);

  await db.transaction().execute(async (trx) => {
    const existingProjection = await trx
      .withSchema('projections')
      .selectFrom('opportunities_current')
      .select(['opportunity_id', 'current_version'])
      .where('opportunity_id', '=', input.projection.opportunity_id)
      .forUpdate()
      .executeTakeFirst();

    validateProjectionVersion(input, existingProjection?.current_version);

    await trx
      .withSchema('events')
      .insertInto('business_events')
      .values(input.event)
      .executeTakeFirstOrThrow();

    await upsertOpportunityProjection(trx, input.projection, Boolean(existingProjection));

    if (input.downstreamJobs && input.downstreamJobs.length > 0) {
      await trx.withSchema('ops').insertInto('jobs').values([...input.downstreamJobs]).execute();
    }
  });
}

function validateCommitBusinessEventInput(input: CommitBusinessEventInput): void {
  const { event, projection } = input;

  if (event.opportunity_id !== projection.opportunity_id) {
    throw new Error('Event and projection must target the same opportunity_id');
  }

  if (event.result_version !== projection.current_version) {
    throw new Error('Event result_version must match projection current_version');
  }

  if (event.base_version !== null && event.base_version !== undefined) {
    if (event.result_version !== event.base_version + 1) {
      throw new Error('Event result_version must increment base_version by exactly one');
    }
  } else if (event.result_version !== 1) {
    throw new Error('Create-style events must start at result_version 1');
  }

  assertProbabilityMatchesStage(projection.sales_stage, Number(projection.probability_pct));
}

function validateProjectionVersion(
  input: CommitBusinessEventInput,
  currentVersion: number | undefined
): void {
  const { event, projection } = input;

  if (currentVersion === undefined) {
    if (event.base_version !== null && event.base_version !== undefined) {
      throw new OpportunityVersionConflictError(
        `Opportunity ${projection.opportunity_id} does not exist, but event base_version was provided`
      );
    }

    if (event.result_version !== 1 || projection.current_version !== 1) {
      throw new OpportunityVersionConflictError(
        `Opportunity ${projection.opportunity_id} must start at version 1`
      );
    }

    return;
  }

  if (event.base_version === null || event.base_version === undefined) {
    throw new OpportunityVersionConflictError(
      `Opportunity ${projection.opportunity_id} already exists at version ${currentVersion}`
    );
  }

  if (currentVersion !== event.base_version) {
    throw new OpportunityVersionConflictError(
      `Opportunity ${projection.opportunity_id} is at version ${currentVersion}, but event expects ${event.base_version}`
    );
  }
}

async function upsertOpportunityProjection(
  trx: Transaction<Database>,
  projection: NewOpportunityCurrent,
  exists: boolean
): Promise<void> {
  if (!exists) {
    await trx
      .withSchema('projections')
      .insertInto('opportunities_current')
      .values(projection)
      .executeTakeFirstOrThrow();

    return;
  }

  const update = buildProjectionUpdate(projection);

  await trx
    .withSchema('projections')
    .updateTable('opportunities_current')
    .set(update)
    .where('opportunity_id', '=', projection.opportunity_id)
    .executeTakeFirstOrThrow();
}

function buildProjectionUpdate(projection: NewOpportunityCurrent): OpportunityCurrentUpdate {
  const {
    opportunity_id: _opportunityId,
    ...rawUpdate
  } = projection as Insertable<Database['opportunities_current']>;

  const update = Object.fromEntries(
    Object.entries(rawUpdate).filter(([, value]) => value !== undefined)
  );

  return update as OpportunityCurrentUpdate;
}
