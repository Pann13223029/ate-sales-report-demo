import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  setTelegramWebhook
} from '../adapters/telegram/webhook-api.js';
import { loadAppEnv, requireTelegramBotToken } from '../config/env.js';

async function main(): Promise<void> {
  const env = loadAppEnv();
  const botToken = requireTelegramBotToken(env);
  const command = process.argv[2] ?? 'info';

  switch (command) {
    case 'set': {
      const rawUrl = process.argv[3] ?? env.publicWebhookUrl;

      if (!rawUrl) {
        throw new Error('Provide a public webhook base URL as an argument or PUBLIC_WEBHOOK_URL');
      }

      const webhookUrl = buildWebhookUrl(rawUrl);
      await setTelegramWebhook(botToken, {
        url: webhookUrl,
        secretToken: env.telegramWebhookSecret,
        allowedUpdates: ['message', 'edited_message', 'callback_query']
      });

      process.stdout.write(
        `${JSON.stringify({ ok: true, action: 'set', url: webhookUrl }, null, 2)}\n`
      );
      return;
    }
    case 'delete': {
      await deleteTelegramWebhook(botToken);
      process.stdout.write(`${JSON.stringify({ ok: true, action: 'delete' }, null, 2)}\n`);
      return;
    }
    case 'info': {
      const info = await getTelegramWebhookInfo(botToken);
      process.stdout.write(`${JSON.stringify({ ok: true, action: 'info', info }, null, 2)}\n`);
      return;
    }
    default:
      throw new Error(`Unsupported command: ${command}. Use one of: set, delete, info`);
  }
}

export function buildWebhookUrl(rawBaseUrl: string): string {
  const url = new URL(rawBaseUrl);

  if (
    url.pathname.endsWith('/telegram/webhook') ||
    url.pathname.endsWith('/api/telegram/webhook')
  ) {
    return url.toString();
  }

  if (url.pathname === '/' || url.pathname.length === 0) {
    url.pathname = '/api/telegram/webhook';
    return url.toString();
  }

  url.pathname = `${url.pathname.replace(/\/$/, '')}/api/telegram/webhook`;
  return url.toString();
}

if (isDirectExecution()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}
