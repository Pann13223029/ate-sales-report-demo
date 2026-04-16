import { z } from 'zod';

import type { SendTelegramMessageJobPayload } from './outbound-schema.js';

const telegramApiResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional()
});

export async function sendTelegramMessage(
  botToken: string,
  message: SendTelegramMessageJobPayload
): Promise<void> {
  const response = await fetch(buildTelegramMethodUrl(botToken, 'sendMessage'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: message.chat_id,
      text: message.text,
      reply_to_message_id: message.reply_to_message_id,
      reply_markup: message.reply_markup
    })
  });

  const rawJson = await response.json();
  const payload = telegramApiResponseSchema.parse(rawJson);

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram sendMessage failed with HTTP ${response.status}`);
  }
}

function buildTelegramMethodUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}
