import type { Kysely, Transaction } from 'kysely';

import type { Database, JobRow, NewJob } from '../db/schema.js';

export async function insertQueuedJobs(
  db: Kysely<Database> | Transaction<Database>,
  jobs: readonly NewJob[]
): Promise<void> {
  if (jobs.length === 0) {
    return;
  }

  await db
    .withSchema('ops')
    .insertInto('jobs')
    .values([...jobs])
    .onConflict((oc) => oc.column('dedupe_key').doNothing())
    .execute();
}

export async function insertJobIfMissing(
  db: Kysely<Database> | Transaction<Database>,
  job: NewJob
): Promise<boolean> {
  const inserted = await db
    .withSchema('ops')
    .insertInto('jobs')
    .values(job)
    .onConflict((oc) => oc.column('dedupe_key').doNothing())
    .returning('job_id')
    .executeTakeFirst();

  return Boolean(inserted?.job_id);
}

export async function listAvailableJobIdsByType(
  db: Kysely<Database>,
  values: {
    jobType: string;
    now: Date;
    limit: number;
  }
): Promise<string[]> {
  const rows = await db
    .withSchema('ops')
    .selectFrom('jobs')
    .select('job_id')
    .where('job_type', '=', values.jobType)
    .where('status', '=', 'queued')
    .where('available_at', '<=', values.now)
    .orderBy('available_at asc')
    .limit(values.limit)
    .execute();

  return rows.map((row) => row.job_id);
}

export async function claimQueuedJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    now: Date;
    leaseDurationMs: number;
  }
): Promise<JobRow | undefined> {
  return db.transaction().execute(async (trx) => {
    const job = await trx
      .withSchema('ops')
      .selectFrom('jobs')
      .selectAll()
      .where('job_id', '=', values.jobId)
      .forUpdate()
      .executeTakeFirst();

    if (!job) {
      return undefined;
    }

    if (job.status !== 'queued' || job.available_at > values.now) {
      return undefined;
    }

    const claimedAt = values.now;
    const leaseExpiresAt = new Date(claimedAt.getTime() + values.leaseDurationMs);
    const attempts = job.attempts + 1;

    return trx
      .withSchema('ops')
      .updateTable('jobs')
      .set({
        status: 'claimed',
        claimed_at: claimedAt,
        lease_expires_at: leaseExpiresAt,
        heartbeat_at: claimedAt,
        attempts,
        last_error: null
      })
      .where('job_id', '=', values.jobId)
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}

export async function markJobSucceeded(
  db: Kysely<Database>,
  values: {
    jobId: string;
    finishedAt: Date;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('jobs')
    .set({
      status: 'succeeded',
      finished_at: values.finishedAt,
      lease_expires_at: null,
      heartbeat_at: values.finishedAt,
      last_error: null
    })
    .where('job_id', '=', values.jobId)
    .executeTakeFirstOrThrow();
}

export async function markJobFailed(
  db: Kysely<Database>,
  values: {
    jobId: string;
    errorMessage: string;
    dead: boolean;
    finishedAt: Date;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('jobs')
    .set({
      status: values.dead ? 'dead' : 'failed',
      finished_at: values.finishedAt,
      lease_expires_at: null,
      heartbeat_at: values.finishedAt,
      last_error: values.errorMessage
    })
    .where('job_id', '=', values.jobId)
    .executeTakeFirstOrThrow();
}

export async function requeueClaimedJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    availableAt: Date;
    lastError?: string | null | undefined;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('jobs')
    .set({
      status: 'queued',
      available_at: values.availableAt,
      claimed_at: null,
      lease_expires_at: null,
      heartbeat_at: null,
      finished_at: null,
      last_error: values.lastError ?? null
    })
    .where('job_id', '=', values.jobId)
    .executeTakeFirstOrThrow();
}
