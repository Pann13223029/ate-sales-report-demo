import { randomUUID } from 'node:crypto';

import type { Kysely, Transaction } from 'kysely';

import type { Database, WorkbookRefreshStatus } from '../db/schema.js';

export interface WorkbookLease {
  workbookKey: string;
  lockToken: string;
}

export async function acquireWorkbookLease(
  db: Kysely<Database>,
  values: {
    workbookKey: string;
    jobId: string;
    now: Date;
    leaseDurationMs: number;
  }
): Promise<WorkbookLease | null> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .withSchema('ops')
      .selectFrom('workbook_locks')
      .selectAll()
      .where('workbook_key', '=', values.workbookKey)
      .forUpdate()
      .executeTakeFirst();

    const leaseExpiresAt = new Date(values.now.getTime() + values.leaseDurationMs);
    const lockToken = randomUUID();

    if (!existing) {
      await trx
        .withSchema('ops')
        .insertInto('workbook_locks')
        .values({
          workbook_key: values.workbookKey,
          lock_token: lockToken,
          locked_by_job_id: values.jobId,
          lease_expires_at: leaseExpiresAt,
          heartbeat_at: values.now
        })
        .executeTakeFirstOrThrow();

      return {
        workbookKey: values.workbookKey,
        lockToken
      };
    }

    const stillLeased = existing.lease_expires_at && existing.lease_expires_at > values.now;

    if (stillLeased && existing.locked_by_job_id !== values.jobId) {
      return null;
    }

    await trx
      .withSchema('ops')
      .updateTable('workbook_locks')
      .set({
        lock_token: lockToken,
        locked_by_job_id: values.jobId,
        lease_expires_at: leaseExpiresAt,
        heartbeat_at: values.now
      })
      .where('workbook_key', '=', values.workbookKey)
      .executeTakeFirstOrThrow();

    return {
      workbookKey: values.workbookKey,
      lockToken
    };
  });
}

export async function releaseWorkbookLease(
  db: Kysely<Database> | Transaction<Database>,
  values: WorkbookLease
): Promise<void> {
  await db
    .withSchema('ops')
    .updateTable('workbook_locks')
    .set({
      lock_token: null,
      locked_by_job_id: null,
      lease_expires_at: null,
      heartbeat_at: null
    })
    .where('workbook_key', '=', values.workbookKey)
    .where('lock_token', '=', values.lockToken)
    .executeTakeFirst();
}

export async function markWorkbookState(
  db: Kysely<Database> | Transaction<Database>,
  values: {
    workbookKey: string;
    status: WorkbookRefreshStatus;
    at: Date;
    lastError?: string | null | undefined;
  }
): Promise<void> {
  await db
    .withSchema('ops')
    .insertInto('workbook_state')
    .values({
      workbook_key: values.workbookKey,
      last_success_at: values.status === 'healthy' ? values.at : undefined,
      last_status: values.status,
      last_error: values.lastError ?? null
    })
    .onConflict((oc) =>
      oc.column('workbook_key').doUpdateSet({
        last_success_at: values.status === 'healthy' ? values.at : undefined,
        last_status: values.status,
        last_error: values.lastError ?? null,
        updated_at: values.at
      })
    )
    .executeTakeFirstOrThrow();
}
