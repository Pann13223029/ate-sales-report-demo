import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';
import { z } from 'zod';

import { sendTelegramMessage } from '../adapters/telegram/bot-api.js';
import type { Database, JsonObject, NewJob } from '../db/schema.js';
import { deriveOverdueDays, formatDateKeyInTimeZone } from '../domain/stale-status.js';
import {
  claimQueuedJob,
  insertQueuedJobs,
  markJobFailed,
  markJobSucceeded
} from '../repositories/job-repository.js';
import {
  listDailyStaleReminderCandidates,
  markDailyReminderDelivered,
  refreshOpenOpportunityStaleStatuses,
  type StaleReminderListItem
} from '../repositories/opportunity-repository.js';

const DAILY_REMINDER_JOB_TYPE = 'send_daily_stale_reminder';
const DAILY_REMINDER_JOB_LEASE_MS = 2 * 60 * 1000;
const DEFAULT_REMINDER_TIMEZONE = 'Asia/Bangkok';

const dailyStaleReminderOpportunitySchema = z.object({
  opportunity_id: z.string().min(1),
  customer_raw: z.string().min(1),
  product_raw: z.string().min(1),
  sales_stage: z.string().min(1),
  days_stale: z.number().int().nonnegative()
});

export const dailyStaleReminderJobPayloadSchema = z.object({
  chat_id: z.string().min(1),
  owner_name: z.string().min(1),
  reminder_date_key: z.string().min(1),
  time_zone: z.string().min(1).default(DEFAULT_REMINDER_TIMEZONE),
  opportunities: z.array(dailyStaleReminderOpportunitySchema).min(1)
});

export type DailyStaleReminderJobPayload = z.infer<typeof dailyStaleReminderJobPayloadSchema>;

export interface EnqueueDailyStaleReminderJobsResult {
  refreshedStaleStatuses: number;
  queuedReminderJobs: number;
  targetedOwners: number;
  targetedOpportunities: number;
  reminderDateKey: string;
}

export interface SendDailyStaleReminderJobResult {
  skipped: boolean;
  jobId: string;
  chatId?: string;
  opportunityCount?: number;
}

export async function enqueueDailyStaleReminderJobs(
  db: Kysely<Database>,
  values: {
    asOf?: Date;
    timeZone?: string;
  } = {}
): Promise<EnqueueDailyStaleReminderJobsResult> {
  const asOf = values.asOf ?? new Date();
  const timeZone = values.timeZone ?? DEFAULT_REMINDER_TIMEZONE;
  const reminderDateKey = formatDateKeyInTimeZone(asOf, timeZone);

  const refreshedStaleStatuses = await refreshOpenOpportunityStaleStatuses(db, {
    asOf
  });
  const candidates = await listDailyStaleReminderCandidates(db, {
    asOf,
    timeZone
  });
  const grouped = groupReminderCandidatesByTelegramUser(candidates);

  const jobs: NewJob[] = [];

  for (const [telegramUserId, reminderCandidates] of grouped) {
    const first = reminderCandidates[0];

    if (!first) {
      continue;
    }

    jobs.push(
      buildDailyStaleReminderJob({
        correlationId: randomUUID(),
        chatId: telegramUserId,
        ownerName: first.ownerName,
        reminderDateKey,
        timeZone,
        asOf,
        opportunities: reminderCandidates
      })
    );
  }

  await insertQueuedJobs(db, jobs);

  return {
    refreshedStaleStatuses,
    queuedReminderJobs: jobs.length,
    targetedOwners: grouped.size,
    targetedOpportunities: candidates.length,
    reminderDateKey
  };
}

export async function sendDailyStaleReminderJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    botToken: string;
  }
): Promise<SendDailyStaleReminderJobResult> {
  const now = new Date();
  const claimedJob = await claimQueuedJob(db, {
    jobId: values.jobId,
    now,
    leaseDurationMs: DAILY_REMINDER_JOB_LEASE_MS
  });

  if (!claimedJob) {
    return {
      skipped: true,
      jobId: values.jobId
    };
  }

  const payload = dailyStaleReminderJobPayloadSchema.parse(claimedJob.payload);

  try {
    await sendTelegramMessage(values.botToken, buildDailyStaleReminderMessage(payload));

    await db.transaction().execute(async (trx) => {
      await markDailyReminderDelivered(trx, {
        opportunityIds: payload.opportunities.map((opportunity) => opportunity.opportunity_id),
        sentAt: new Date()
      });

      await markJobSucceeded(trx, {
        jobId: values.jobId,
        finishedAt: new Date()
      });
    });

    return {
      skipped: false,
      jobId: values.jobId,
      chatId: payload.chat_id,
      opportunityCount: payload.opportunities.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dead = claimedJob.attempts >= claimedJob.max_attempts;

    await markJobFailed(db, {
      jobId: values.jobId,
      errorMessage,
      dead,
      finishedAt: new Date()
    });

    throw error;
  }
}

function buildDailyStaleReminderJob(values: {
  correlationId: string;
  chatId: string;
  ownerName: string;
  reminderDateKey: string;
  timeZone: string;
  asOf: Date;
  opportunities: readonly StaleReminderListItem[];
}): NewJob {
  const payload = dailyStaleReminderJobPayloadSchema.parse({
    chat_id: values.chatId,
    owner_name: values.ownerName,
    reminder_date_key: values.reminderDateKey,
    time_zone: values.timeZone,
    opportunities: values.opportunities.map((opportunity) => ({
      opportunity_id: opportunity.opportunityId,
      customer_raw: opportunity.customerRaw,
      product_raw: opportunity.productRaw,
      sales_stage: opportunity.salesStage,
      days_stale: deriveOverdueDays({
        asOf: values.asOf,
        nextFollowUpDate: opportunity.nextFollowUpDate,
        lastActivityAt: opportunity.lastActivityAt
      })
    }))
  });

  return {
    job_id: randomUUID(),
    job_type: DAILY_REMINDER_JOB_TYPE,
    status: 'queued',
    correlation_id: values.correlationId,
    dedupe_key: `${DAILY_REMINDER_JOB_TYPE}:${values.chatId}:${values.reminderDateKey}`,
    payload: payload as unknown as JsonObject,
    available_at: values.asOf,
    attempts: 0,
    max_attempts: 10
  };
}

export function buildDailyStaleReminderMessage(payload: DailyStaleReminderJobPayload): {
  chat_id: string;
  text: string;
  reply_markup: {
    inline_keyboard: {
      text: string;
      callback_data: string;
    }[][];
  };
} {
  return {
    chat_id: payload.chat_id,
    text: renderDailyStaleReminderText(payload),
    reply_markup: {
      inline_keyboard: payload.opportunities.map((opportunity) => [
        {
          text: `Update ${opportunity.opportunity_id}`,
          callback_data: `update:start:${opportunity.opportunity_id}`
        },
        {
          text: 'Set Follow-up',
          callback_data: `followup:start:${opportunity.opportunity_id}`
        },
        {
          text: 'Close Lost',
          callback_data: `closelost:start:${opportunity.opportunity_id}`
        }
      ])
    }
  };
}

export function renderDailyStaleReminderText(payload: DailyStaleReminderJobPayload): string {
  const lines = [
    `Daily stale reminder for ${payload.owner_name}`,
    '',
    ...payload.opportunities.map(
      (opportunity, index) =>
        `${index + 1}. ${opportunity.opportunity_id} | ${opportunity.customer_raw} | ${opportunity.product_raw} | ${opportunity.sales_stage} | ${opportunity.days_stale} days stale`
    ),
    '',
    'Tap Update, Set Follow-up, or Close Lost on any deal to continue.'
  ];

  return lines.join('\n');
}

function groupReminderCandidatesByTelegramUser(
  candidates: readonly StaleReminderListItem[]
): Map<string, StaleReminderListItem[]> {
  const grouped = new Map<string, StaleReminderListItem[]>();

  for (const candidate of candidates) {
    const existing = grouped.get(candidate.telegramUserId);

    if (existing) {
      existing.push(candidate);
      continue;
    }

    grouped.set(candidate.telegramUserId, [candidate]);
  }

  return grouped;
}
