import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';

export async function readNodeRequestBody(
  req: IncomingMessage,
  maxBytes = 1024 * 1024
): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new Error(`Request body exceeds ${maxBytes} bytes`);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export function incomingHeadersToFetchHeaders(headers: IncomingHttpHeaders): Headers {
  const value = new Headers();

  for (const [key, item] of Object.entries(headers)) {
    if (Array.isArray(item)) {
      for (const entry of item) {
        value.append(key, entry);
      }
    } else if (item !== undefined) {
      value.set(key, item);
    }
  }

  return value;
}
