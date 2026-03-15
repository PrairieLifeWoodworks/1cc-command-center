import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadDatabaseConfig, loadOptionalDatabaseConfig } from "@1cc/config";

import * as schema from "./schema";

export type DbSchema = typeof schema;
export type DbClient = NodePgDatabase<DbSchema>;

export interface CreateDbClientOptions {
  databaseUrl?: string;
  databaseSsl?: boolean;
}

export interface DatabaseClientHandle {
  db: DbClient;
  pool: Pool;
}

export function createDbClient(
  options: CreateDbClientOptions = {},
  env: NodeJS.ProcessEnv = process.env
): DatabaseClientHandle {
  const databaseConfig = options.databaseUrl
    ? loadOptionalDatabaseConfig(env)
    : loadDatabaseConfig(env);
  const databaseUrl = options.databaseUrl ?? databaseConfig.databaseUrl;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database client");
  }

  const databaseSsl = options.databaseSsl ?? databaseConfig.databaseSsl;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
  });

  return {
    db: drizzle(pool, { schema }),
    pool
  };
}
