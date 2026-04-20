import type { IncomingMessage } from 'node:http';

import {
  getTelegramWebhookSecretHeader,
  handleTelegramWebhookHttpRequest
} from '../../src/http/telegram-webhook-handler.js';
import { incomingHeadersToFetchHeaders, readNodeRequestBody } from '../../src/http/node-request.js';
import { getRuntimeContext, runSingleRuntimeTick } from '../../src/runtime/vercel-runtime.js';

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

export default async function handler(
  req: IncomingMessage,
  res: {
    status: (code: number) => { json: (value: Record<string, unknown>) => void };
    setHeader: (name: string, value: string) => void;
  }
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
    return;
  }

  const context = getRuntimeContext();
  const rawBody = await readNodeRequestBody(req, MAX_REQUEST_BODY_BYTES);
  const response = await handleTelegramWebhookHttpRequest(context.db, {
    secretHeader: getTelegramWebhookSecretHeader(incomingHeadersToFetchHeaders(req.headers)),
    configuredSecret: context.env.telegramWebhookSecret,
    rawBody
  });

  res.status(response.status).json(response.body);
  await runSingleRuntimeTick(context);
}
