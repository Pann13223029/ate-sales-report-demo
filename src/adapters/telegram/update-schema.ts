import { z } from 'zod';

const telegramUserSchema = z.object({
  id: z.number().int().nonnegative(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional()
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional()
});

const telegramMessageSchema = z.object({
  message_id: z.number().int().nonnegative(),
  date: z.number().int().nonnegative(),
  chat: telegramChatSchema,
  from: telegramUserSchema.optional(),
  text: z.string().optional()
});

const telegramCallbackQuerySchema = z.object({
  id: z.string().min(1),
  from: telegramUserSchema,
  data: z.string().optional(),
  message: telegramMessageSchema.optional()
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: telegramMessageSchema.optional(),
  edited_message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional()
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export function extractTelegramUserId(update: TelegramUpdate): string | null {
  const directMessageUserId = update.message?.from?.id ?? update.edited_message?.from?.id;

  if (directMessageUserId !== undefined) {
    return String(directMessageUserId);
  }

  return update.callback_query ? String(update.callback_query.from.id) : null;
}

export function getTelegramUpdateKind(
  update: TelegramUpdate
): 'message' | 'edited_message' | 'callback_query' {
  if (update.callback_query) {
    return 'callback_query';
  }

  if (update.edited_message) {
    return 'edited_message';
  }

  return 'message';
}

export function getTelegramUpdateText(update: TelegramUpdate): string | null {
  return update.message?.text ?? update.edited_message?.text ?? update.callback_query?.data ?? null;
}

export function getTelegramChatId(update: TelegramUpdate): string | null {
  const chatId =
    update.message?.chat.id ?? update.edited_message?.chat.id ?? update.callback_query?.message?.chat.id;

  return chatId !== undefined ? String(chatId) : null;
}

export function getTelegramMessageId(update: TelegramUpdate): number | null {
  return update.message?.message_id ?? update.edited_message?.message_id ?? update.callback_query?.message?.message_id ?? null;
}
