import path from "node:path";

import { loadDatabaseConfig } from "@1cc/config";
import { createDbClient } from "@1cc/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main(): Promise<void> {
  const env = process.env;
  loadDatabaseConfig(env);

  const dbClient = createDbClient({}, env);
  const migrationsFolder = path.resolve(__dirname, "..", "drizzle");

  try {
    await migrate(dbClient.db, {
      migrationsFolder
    });

    console.log(
      `[apply-drizzle-migrations] applied migrations from ${migrationsFolder}`
    );
  } finally {
    await dbClient.pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[apply-drizzle-migrations] ${message}`);
  process.exit(1);
});
