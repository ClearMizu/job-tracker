import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const defaultMigrations = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

// A bundled build has no src/ tree beside it, so the folder can be passed in.
export function createDb(
  databaseUrl: string,
  migrationsFolder: string = defaultMigrations,
) {
  if (databaseUrl !== ":memory:") {
    mkdirSync(dirname(databaseUrl), { recursive: true });
  }
  const sqlite = new Database(databaseUrl, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}

export type Db = ReturnType<typeof createDb>;
export { schema };
