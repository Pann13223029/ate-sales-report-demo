import { z } from 'zod';

const appEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  PUBLIC_WEBHOOK_URL: z.string().url().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  OPERATIONAL_WORKBOOK_ID: z.string().min(1).optional(),
  EXECUTIVE_WORKBOOK_ID: z.string().min(1).optional(),
  SHEET_SYNC_ACTOR_USER_ID: z.string().uuid().optional(),
  SHEET_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  REMINDER_TIMEZONE: z.string().min(1).default('Asia/Bangkok'),
  REMINDER_DAILY_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  REMINDER_DAILY_MINUTE: z.coerce.number().int().min(0).max(59).default(30),
  PORT: z.coerce.number().int().positive().default(3000),
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type AppEnv = Readonly<{
  databaseUrl: string;
  telegramBotToken: string | null;
  telegramWebhookSecret: string | null;
  publicWebhookUrl: string | null;
  googleServiceAccountJson: string | null;
  operationalWorkbookId: string | null;
  executiveWorkbookId: string | null;
  sheetSyncActorUserId: string | null;
  sheetSyncIntervalMinutes: number;
  geminiApiKey: string | null;
  geminiModel: string;
  reminderTimeZone: string;
  reminderDailyHour: number;
  reminderDailyMinute: number;
  port: number;
  jobPollIntervalMs: number;
  nodeEnv: 'development' | 'test' | 'production';
}>;

export function loadAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = appEnvSchema.parse(env);

  return {
    databaseUrl: parsed.DATABASE_URL,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN ?? null,
    telegramWebhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET ?? null,
    publicWebhookUrl: parsed.PUBLIC_WEBHOOK_URL ?? null,
    googleServiceAccountJson: parsed.GOOGLE_SERVICE_ACCOUNT_JSON ?? null,
    operationalWorkbookId: parsed.OPERATIONAL_WORKBOOK_ID ?? null,
    executiveWorkbookId: parsed.EXECUTIVE_WORKBOOK_ID ?? null,
    sheetSyncActorUserId: parsed.SHEET_SYNC_ACTOR_USER_ID ?? null,
    sheetSyncIntervalMinutes: parsed.SHEET_SYNC_INTERVAL_MINUTES,
    geminiApiKey: parsed.GEMINI_API_KEY ?? null,
    geminiModel: parsed.GEMINI_MODEL,
    reminderTimeZone: parsed.REMINDER_TIMEZONE,
    reminderDailyHour: parsed.REMINDER_DAILY_HOUR,
    reminderDailyMinute: parsed.REMINDER_DAILY_MINUTE,
    port: parsed.PORT,
    jobPollIntervalMs: parsed.JOB_POLL_INTERVAL_MS,
    nodeEnv: parsed.NODE_ENV
  };
}

export function requireTelegramBotToken(env: AppEnv): string {
  if (!env.telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram send workers');
  }

  return env.telegramBotToken;
}

export interface GoogleSheetsEnv {
  serviceAccountJson: string;
  operationalWorkbookId: string;
  executiveWorkbookId: string;
}

export function getGoogleSheetsEnv(env: AppEnv): GoogleSheetsEnv | null {
  const anySet =
    env.googleServiceAccountJson || env.operationalWorkbookId || env.executiveWorkbookId;

  if (!anySet) {
    return null;
  }

  if (
    !env.googleServiceAccountJson ||
    !env.operationalWorkbookId ||
    !env.executiveWorkbookId
  ) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON, OPERATIONAL_WORKBOOK_ID, and EXECUTIVE_WORKBOOK_ID must all be set together'
    );
  }

  return {
    serviceAccountJson: env.googleServiceAccountJson,
    operationalWorkbookId: env.operationalWorkbookId,
    executiveWorkbookId: env.executiveWorkbookId
  };
}

export interface OperationalSheetSyncEnv extends GoogleSheetsEnv {
  sheetSyncActorUserId: string;
  sheetSyncIntervalMinutes: number;
}

export function getOperationalSheetSyncEnv(env: AppEnv): OperationalSheetSyncEnv | null {
  const googleSheets = getGoogleSheetsEnv(env);

  if (!env.sheetSyncActorUserId) {
    return null;
  }

  if (!googleSheets) {
    throw new Error(
      'SHEET_SYNC_ACTOR_USER_ID requires GOOGLE_SERVICE_ACCOUNT_JSON, OPERATIONAL_WORKBOOK_ID, and EXECUTIVE_WORKBOOK_ID'
    );
  }

  return {
    ...googleSheets,
    sheetSyncActorUserId: env.sheetSyncActorUserId,
    sheetSyncIntervalMinutes: env.sheetSyncIntervalMinutes
  };
}
