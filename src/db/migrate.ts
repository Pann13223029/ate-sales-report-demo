import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PoolClient } from '@neondatabase/serverless';

import { createDatabaseClient, destroyDatabaseClient } from './client.js';
import { loadAppEnv } from '../config/env.js';

interface AppliedMigration {
  name: string;
  checksum: string;
}

const MIGRATION_TRACKING_SQL = `
  create table if not exists public.schema_migrations (
    migration_name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )
`;

async function main(): Promise<void> {
  const env = loadAppEnv();
  const client = createDatabaseClient(env.databaseUrl);

  try {
    const poolClient = await client.pool.connect();

    try {
      await poolClient.query(MIGRATION_TRACKING_SQL);
      const applied = await loadAppliedMigrations(poolClient);
      const migrationDir = resolveMigrationDirectory();
      const migrationFiles = await readdir(migrationDir);

      for (const fileName of migrationFiles.sort()) {
        if (!fileName.endsWith('.sql')) {
          continue;
        }

        const filePath = join(migrationDir, fileName);
        const migrationSql = await readFile(filePath, 'utf8');
        const checksum = createHash('sha256').update(migrationSql).digest('hex');
        const existing = applied.get(fileName);

        if (existing) {
          if (existing !== checksum) {
            throw new Error(
              `Checksum mismatch for already-applied migration ${fileName}. ` +
                'Refuse to continue because the SQL contract changed after apply.'
            );
          }

          continue;
        }

        console.log(`Applying migration ${fileName}`);
        await applyMigration(poolClient, fileName, checksum, migrationSql);
      }
    } finally {
      poolClient.release();
    }
  } finally {
    await destroyDatabaseClient(client);
  }
}

function resolveMigrationDirectory(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);

  return resolve(currentDir, '../../db/migrations');
}

async function loadAppliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<AppliedMigration>(
    `
      select migration_name as name, checksum
      from public.schema_migrations
      order by migration_name asc
    `
  );

  return new Map(result.rows.map((row) => [row.name, row.checksum]));
}

async function applyMigration(
  client: PoolClient,
  fileName: string,
  checksum: string,
  migrationSql: string
): Promise<void> {
  const statements = splitSqlStatements(migrationSql);

  await client.query('begin');

  try {
    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query(
      `
        insert into public.schema_migrations (migration_name, checksum)
        values ($1, $2)
      `,
      [fileName, checksum]
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (inLineComment) {
      current += char;

      if (char === '\n') {
        inLineComment = false;
      }

      continue;
    }

    if (inBlockComment) {
      current += char;

      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        inBlockComment = false;
      }

      continue;
    }

    if (inSingleQuote) {
      current += char;

      if (char === "'" && next === "'") {
        current += next;
        index += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = false;
      }

      continue;
    }

    if (inDoubleQuote) {
      current += char;

      if (char === '"' && next === '"') {
        current += next;
        index += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = false;
      }

      continue;
    }

    if (char === '-' && next === '-') {
      current += char + next;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      current += char + next;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'") {
      current += char;
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      current += char;
      inDoubleQuote = true;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();

      if (statement.length > 0) {
        statements.push(statement);
      }

      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();

  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
