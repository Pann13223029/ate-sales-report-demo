import { z } from 'zod';

const webhookInfoSchema = z.object({
  url: z.string(),
  has_custom_certificate: z.boolean(),
  pending_update_count: z.number().int().nonnegative(),
  ip_address: z.string().optional(),
  last_error_date: z.number().int().optional(),
  last_error_message: z.string().optional(),
  last_synchronization_error_date: z.number().int().optional(),
  max_connections: z.number().int().optional(),
  allowed_updates: z.array(z.string()).optional()
});

const telegramWebhookApiResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  result: z.union([z.boolean(), webhookInfoSchema]).optional()
});

export type TelegramWebhookInfo = z.infer<typeof webhookInfoSchema>;

export async function setTelegramWebhook(
  botToken: string,
  values: {
    url: string;
    secretToken?: string | null;
    dropPendingUpdates?: boolean;
    allowedUpdates?: string[];
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    url: values.url
  };

  if (values.secretToken) {
    payload.secret_token = values.secretToken;
  }

  if (values.dropPendingUpdates !== undefined) {
    payload.drop_pending_updates = values.dropPendingUpdates;
  }

  if (values.allowedUpdates && values.allowedUpdates.length > 0) {
    payload.allowed_updates = values.allowedUpdates;
  }

  await callTelegramWebhookApi(botToken, 'setWebhook', payload);
}

export async function deleteTelegramWebhook(
  botToken: string,
  values?: {
    dropPendingUpdates?: boolean;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (values?.dropPendingUpdates !== undefined) {
    payload.drop_pending_updates = values.dropPendingUpdates;
  }

  await callTelegramWebhookApi(botToken, 'deleteWebhook', payload);
}

export async function getTelegramWebhookInfo(botToken: string): Promise<TelegramWebhookInfo> {
  const response = await callTelegramWebhookApi(botToken, 'getWebhookInfo', {});

  const parsed = webhookInfoSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error('Telegram getWebhookInfo returned an unexpected payload');
  }

  return parsed.data;
}

async function callTelegramWebhookApi(
  botToken: string,
  method: 'setWebhook' | 'deleteWebhook' | 'getWebhookInfo',
  payload: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(buildTelegramMethodUrl(botToken, method), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const rawJson = await response.json();
  const parsed = telegramWebhookApiResponseSchema.parse(rawJson);

  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.description ?? `Telegram ${method} failed with HTTP ${response.status}`);
  }

  return parsed.result;
}

function buildTelegramMethodUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}
