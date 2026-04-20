import type { IncomingMessage } from 'node:http';

import {
  getRuntimeContext,
  isAuthorizedInternalRequest,
  runSingleRuntimeTick
} from '../src/runtime/vercel-runtime.js';

export default async function handler(
  req: IncomingMessage,
  res: {
    status: (code: number) => { json: (value: Record<string, unknown>) => void };
    setHeader: (name: string, value: string) => void;
  }
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
    return;
  }

  const context = getRuntimeContext();

  if (!isAuthorizedInternalRequest(req.headers, context.env.internalApiSecret)) {
    res.status(401).json({
      ok: false,
      error: 'Unauthorized cron request'
    });
    return;
  }

  const result = await runSingleRuntimeTick(context);

  res.status(200).json({
    ok: true,
    scheduled: result.scheduled,
    drained: result.drained
  });
}
