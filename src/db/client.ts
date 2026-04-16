import { Pool } from '@neondatabase/serverless';
import { Kysely, PostgresDialect } from 'kysely';

import type { Database } from './schema.js';

export interface DatabaseClient {
  db: Kysely<Database>;
  pool: Pool;
}

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  });

  return { db, pool };
}

export async function destroyDatabaseClient(client: DatabaseClient): Promise<void> {
  await client.db.destroy();
}
