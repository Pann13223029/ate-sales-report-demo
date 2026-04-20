import process from 'node:process';

import { destroyRuntimeContext, getRuntimeContext, runSingleRuntimeTick } from '../runtime/vercel-runtime.js';

async function main(): Promise<void> {
  const context = getRuntimeContext();

  try {
    const result = await runSingleRuntimeTick(context);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await destroyRuntimeContext();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
