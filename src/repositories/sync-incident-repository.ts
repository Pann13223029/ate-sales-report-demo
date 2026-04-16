import { randomUUID } from 'node:crypto';

import type { Kysely, Transaction } from 'kysely';

import type { Database, JsonObject, SyncIncidentSource, SyncIncidentStatus } from '../db/schema.js';

export async function createOrUpdateSyncIncident(
  db: Kysely<Database> | Transaction<Database>,
  values: {
    opportunityId?: string | null | undefined;
    issueType: string;
    source: SyncIncidentSource;
    summary: string;
    latestContext?: JsonObject | null | undefined;
    at: Date;
    currentStatus?: SyncIncidentStatus | undefined;
  }
): Promise<string> {
  const existing = await db
    .withSchema('ops')
    .selectFrom('sync_incidents')
    .selectAll()
    .where('source', '=', values.source)
    .where('issue_type', '=', values.issueType)
    .where('current_status', 'in', ['open', 'retrying'])
    .where((eb) =>
      values.opportunityId
        ? eb('opportunity_id', '=', values.opportunityId)
        : eb('opportunity_id', 'is', null)
    )
    .orderBy('first_seen_at desc')
    .executeTakeFirst();

  if (!existing) {
    const incidentId = randomUUID();

    await db
      .withSchema('ops')
      .insertInto('sync_incidents')
      .values({
        incident_id: incidentId,
        opportunity_id: values.opportunityId ?? null,
        issue_type: values.issueType,
        source: values.source,
        current_status: values.currentStatus ?? 'open',
        summary: values.summary,
        first_seen_at: values.at,
        last_attempt_at: values.at,
        retry_count: 0,
        latest_context: values.latestContext ?? null
      })
      .executeTakeFirstOrThrow();

    return incidentId;
  }

  await db
    .withSchema('ops')
    .updateTable('sync_incidents')
    .set({
      current_status: values.currentStatus ?? 'retrying',
      summary: values.summary,
      last_attempt_at: values.at,
      retry_count: existing.retry_count + 1,
      latest_context: values.latestContext ?? null
    })
    .where('incident_id', '=', existing.incident_id)
    .executeTakeFirstOrThrow();

  return existing.incident_id;
}

export async function resolveSyncIncidentsForOpportunity(
  db: Kysely<Database> | Transaction<Database>,
  values: {
    opportunityId: string;
    source?: SyncIncidentSource | undefined;
    resolvedAt: Date;
  }
): Promise<number> {
  let query = db
    .withSchema('ops')
    .updateTable('sync_incidents')
    .set({
      current_status: 'resolved',
      resolved_at: values.resolvedAt,
      last_attempt_at: values.resolvedAt
    })
    .where('opportunity_id', '=', values.opportunityId)
    .where('current_status', 'in', ['open', 'retrying']);

  if (values.source !== undefined) {
    query = query.where('source', '=', values.source);
  }

  const result = await query.executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}

export async function listOpenSheetSyncStatuses(
  db: Kysely<Database>
): Promise<Map<string, string>> {
  const incidents = await db
    .withSchema('ops')
    .selectFrom('sync_incidents')
    .select(['incident_id', 'opportunity_id', 'issue_type', 'current_status', 'last_attempt_at', 'first_seen_at'])
    .where('source', '=', 'sheet')
    .where('current_status', 'in', ['open', 'retrying'])
    .where('opportunity_id', 'is not', null)
    .execute();

  const latestByOpportunity = new Map<string, { issueType: string; currentStatus: string; sortKey: string }>();

  for (const incident of incidents) {
    const opportunityId = incident.opportunity_id;

    if (!opportunityId) {
      continue;
    }

    const sortKey = (incident.last_attempt_at ?? incident.first_seen_at).toISOString();
    const existing = latestByOpportunity.get(opportunityId);

    if (!existing || sortKey > existing.sortKey) {
      latestByOpportunity.set(opportunityId, {
        issueType: incident.issue_type,
        currentStatus: incident.current_status,
        sortKey
      });
    }
  }

  const statuses = new Map<string, string>();

  for (const [opportunityId, incident] of latestByOpportunity) {
    if (incident.currentStatus === 'retrying') {
      statuses.set(opportunityId, 'Retrying');
      continue;
    }

    statuses.set(opportunityId, formatIssueTypeAsStatus(incident.issueType));
  }

  return statuses;
}

function formatIssueTypeAsStatus(issueType: string): string {
  switch (issueType) {
    case 'conflict':
      return 'Conflict';
    case 'quarantined':
      return 'Quarantined';
    case 'pending':
      return 'Pending';
    default:
      return issueType
        .split(/[_\s]+/)
        .filter((part) => part.length > 0)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' ');
  }
}
