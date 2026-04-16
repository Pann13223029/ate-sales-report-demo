import type { Kysely } from 'kysely';

import type { Database } from '../db/schema.js';
import { ingestTelegramUpdate } from '../services/telegram-ingress-service.js';

const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export interface TelegramWebhookHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handleTelegramWebhookHttpRequest(
  db: Kysely<Database>,
  values: {
    secretHeader: string | null;
    configuredSecret: string | null;
    rawBody: string;
  }
): Promise<TelegramWebhookHttpResponse> {
  if (!isAuthorizedTelegramWebhook(values.secretHeader, values.configuredSecret)) {
    return {
      status: 401,
      body: {
        ok: false,
        error: 'Unauthorized webhook secret'
      }
    };
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(values.rawBody);
  } catch {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'Invalid JSON body'
      }
    };
  }

  const result = await ingestTelegramUpdate(db, parsedBody);

  return {
    status: 200,
    body: {
      ok: true,
      accepted: !result.deduped,
      deduped: result.deduped,
      update_id: result.updateId,
      correlation_id: result.correlationId
    }
  };
}

export function getTelegramWebhookSecretHeader(headers: Headers): string | null {
  return headers.get(TELEGRAM_SECRET_HEADER);
}

function isAuthorizedTelegramWebhook(
  providedSecret: string | null,
  configuredSecret: string | null
): boolean {
  if (!configuredSecret) {
    return true;
  }

  return providedSecret === configuredSecret;
}
