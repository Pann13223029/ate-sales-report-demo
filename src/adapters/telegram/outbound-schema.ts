import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { JsonObject, NewJob } from '../../db/schema.js';

const inlineKeyboardButtonSchema = z.object({
  text: z.string().min(1),
  callback_data: z.string().min(1)
});

export const sendTelegramMessageJobPayloadSchema = z.object({
  chat_id: z.string().min(1),
  text: z.string().min(1),
  reply_to_message_id: z.number().int().positive().optional(),
  reply_markup: z
    .object({
      inline_keyboard: z.array(z.array(inlineKeyboardButtonSchema).min(1)).min(1)
    })
    .optional()
});

export type SendTelegramMessageJobPayload = z.infer<typeof sendTelegramMessageJobPayloadSchema>;
export type TelegramInlineKeyboardButton = z.infer<typeof inlineKeyboardButtonSchema>;

export interface TelegramOutboundMessage {
  chatId: string;
  text: string;
  replyToMessageId?: number;
  inlineKeyboard?: TelegramInlineKeyboardButton[][];
}

export function buildSendTelegramMessageJob(values: {
  correlationId: string;
  availableAt?: Date;
  message: TelegramOutboundMessage;
  dedupeKey?: string;
}): NewJob {
  const payload = buildSendTelegramMessagePayload(values.message);

  return {
    job_id: randomUUID(),
    job_type: 'send_telegram_message',
    status: 'queued',
    correlation_id: values.correlationId,
    dedupe_key: values.dedupeKey ?? null,
    payload,
    available_at: values.availableAt ?? new Date(),
    attempts: 0,
    max_attempts: 10
  };
}

export function buildSendTelegramMessagePayload(
  message: TelegramOutboundMessage
): JsonObject {
  const payload: JsonObject = {
    chat_id: message.chatId,
    text: message.text
  };

  if (message.replyToMessageId !== undefined) {
    payload.reply_to_message_id = message.replyToMessageId;
  }

  if (message.inlineKeyboard && message.inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: message.inlineKeyboard
    };
  }

  return payload;
}
