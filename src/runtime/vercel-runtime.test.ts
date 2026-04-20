import test from 'node:test';
import assert from 'node:assert/strict';

import { isAuthorizedInternalRequest } from './vercel-runtime.js';

test('isAuthorizedInternalRequest accepts bearer token when secret is configured', () => {
  assert.equal(
    isAuthorizedInternalRequest(
      {
        authorization: 'Bearer secret-token'
      },
      'secret-token'
    ),
    true
  );
});

test('isAuthorizedInternalRequest accepts x-cron-secret when secret is configured', () => {
  assert.equal(
    isAuthorizedInternalRequest(
      {
        'x-cron-secret': 'secret-token'
      },
      'secret-token'
    ),
    true
  );
});

test('isAuthorizedInternalRequest accepts vercel cron user agent when no secret is configured', () => {
  assert.equal(
    isAuthorizedInternalRequest(
      {
        'user-agent': 'vercel-cron/1.0'
      },
      null
    ),
    true
  );
});

test('isAuthorizedInternalRequest rejects unknown callers when no secret is configured', () => {
  assert.equal(
    isAuthorizedInternalRequest(
      {
        'user-agent': 'curl/8.0'
      },
      null
    ),
    false
  );
});
