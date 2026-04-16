import { createSign } from 'node:crypto';

import { z } from 'zod';

const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

const serviceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  token_uri: z.string().url().default(GOOGLE_TOKEN_URI)
});

export interface GoogleSheetsTabMetadata {
  sheetId: number;
  title: string;
  frozenRowCount: number | null;
}

export interface GoogleSpreadsheetMetadata {
  spreadsheetId: string;
  sheets: GoogleSheetsTabMetadata[];
}

interface GoogleAccessTokenCacheEntry {
  accessToken: string;
  expiresAtMs: number;
}

const googleAccessTokenCache = new Map<string, GoogleAccessTokenCacheEntry>();

export async function getSpreadsheetMetadata(
  serviceAccountJson: string,
  spreadsheetId: string
): Promise<GoogleSpreadsheetMetadata> {
  const data = await googleSheetsRequest<{
    spreadsheetId: string;
    sheets?: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: {
          frozenRowCount?: number;
        };
      };
    }[];
  }>(serviceAccountJson, spreadsheetId, {
    method: 'GET',
    query: {
      includeGridData: 'false',
      fields: 'spreadsheetId,sheets.properties(sheetId,title,gridProperties.frozenRowCount)'
    }
  });

  return {
    spreadsheetId: data.spreadsheetId,
    sheets: (data.sheets ?? [])
      .map((sheet) => ({
        sheetId: sheet.properties?.sheetId ?? -1,
        title: sheet.properties?.title ?? '',
        frozenRowCount: sheet.properties?.gridProperties?.frozenRowCount ?? null
      }))
      .filter((sheet) => sheet.sheetId >= 0 && sheet.title.length > 0)
  };
}

export async function batchUpdateSpreadsheet(
  serviceAccountJson: string,
  spreadsheetId: string,
  requests: readonly Record<string, unknown>[]
): Promise<void> {
  if (requests.length === 0) {
    return;
  }

  await googleSheetsRequest(serviceAccountJson, spreadsheetId, {
    method: 'POST',
    path: ':batchUpdate',
    body: {
      requests
    }
  });
}

export async function batchClearSpreadsheetValues(
  serviceAccountJson: string,
  spreadsheetId: string,
  ranges: readonly string[]
): Promise<void> {
  if (ranges.length === 0) {
    return;
  }

  await googleSheetsRequest(serviceAccountJson, spreadsheetId, {
    method: 'POST',
    path: '/values:batchClear',
    body: {
      ranges
    }
  });
}

export async function batchUpdateSpreadsheetValues(
  serviceAccountJson: string,
  spreadsheetId: string,
  data: readonly {
    range: string;
    values: readonly (readonly unknown[])[];
  }[],
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
): Promise<void> {
  if (data.length === 0) {
    return;
  }

  await googleSheetsRequest(serviceAccountJson, spreadsheetId, {
    method: 'POST',
    path: '/values:batchUpdate',
    body: {
      valueInputOption,
      data: data.map((entry) => ({
        range: entry.range,
        majorDimension: 'ROWS',
        values: entry.values
      }))
    }
  });
}

export async function getSpreadsheetValues(
  serviceAccountJson: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const data = await googleSheetsRequest<{
    values?: string[][];
  }>(serviceAccountJson, spreadsheetId, {
    method: 'GET',
    path: `/values/${encodeURIComponent(range)}`,
    query: {
      majorDimension: 'ROWS'
    }
  });

  return data.values ?? [];
}

async function googleSheetsRequest<T = unknown>(
  serviceAccountJson: string,
  spreadsheetId: string,
  values: {
    method: 'GET' | 'POST';
    path?: string | undefined;
    query?: Record<string, string> | undefined;
    body?: Record<string, unknown> | undefined;
  }
): Promise<T> {
  const accessToken = await getGoogleAccessToken(serviceAccountJson, [GOOGLE_SHEETS_SCOPE]);
  const url = new URL(`${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}${values.path ?? ''}`);

  for (const [key, value] of Object.entries(values.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const requestInit: RequestInit = {
    method: values.method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8'
    }
  };

  if (values.body) {
    requestInit.body = JSON.stringify(values.body);
  }

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    throw new Error(
      `Google Sheets API error (${response.status}): ${await readErrorResponse(response)}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getGoogleAccessToken(
  serviceAccountJson: string,
  scopes: readonly string[]
): Promise<string> {
  const serviceAccount = serviceAccountSchema.parse(JSON.parse(serviceAccountJson));
  const cacheKey = `${serviceAccount.client_email}:${scopes.join(' ')}`;
  const cached = googleAccessTokenCache.get(cacheKey);

  if (cached && cached.expiresAtMs - TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = createGoogleJwtAssertion({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    tokenUri: serviceAccount.token_uri,
    scope: scopes.join(' '),
    issuedAtSeconds: nowSeconds,
    expiresAtSeconds: nowSeconds + 3600
  });

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!response.ok) {
    throw new Error(
      `Google OAuth token error (${response.status}): ${await readErrorResponse(response)}`
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const accessToken = body.access_token;

  if (!accessToken) {
    throw new Error('Google OAuth token response did not include access_token');
  }

  const expiresInMs = (body.expires_in ?? 3600) * 1000;
  googleAccessTokenCache.set(cacheKey, {
    accessToken,
    expiresAtMs: Date.now() + expiresInMs
  });

  return accessToken;
}

function createGoogleJwtAssertion(values: {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  scope: string;
  issuedAtSeconds: number;
  expiresAtSeconds: number;
}): string {
  const encodedHeader = base64UrlEncodeJson({
    alg: 'RS256',
    typ: 'JWT'
  });
  const encodedPayload = base64UrlEncodeJson({
    iss: values.clientEmail,
    scope: values.scope,
    aud: values.tokenUri,
    exp: values.expiresAtSeconds,
    iat: values.issuedAtSeconds
  });
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  return `${unsignedToken}.${signer.sign(values.privateKey).toString('base64url')}`;
}

function base64UrlEncodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function readErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json = (await response.json()) as Record<string, unknown>;
    return JSON.stringify(json);
  }

  return await response.text();
}
