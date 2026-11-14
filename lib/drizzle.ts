import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/env";
import * as schema from "../db/schema";

function createDatabase(url: string, authToken: string) {
  return drizzle({ connection: { url, authToken }, schema });
}

type TursoDatabase = ReturnType<typeof createDatabase>;

let database: TursoDatabase | undefined;

export function getDb(): TursoDatabase {
  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;

  if (!url || !authToken) {
    throw new Error(
      "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  database ??= createDatabase(url, authToken);
  return database;
}
