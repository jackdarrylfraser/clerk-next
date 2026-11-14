import "server-only";
import { drizzle, type drizzle as Drizzle } from "drizzle-orm/libsql";
import { env } from "@/env";
import * as schema from "../db/schema";

type TursoDatabase = ReturnType<typeof Drizzle>;

let database: TursoDatabase | undefined;

export function getDb(): TursoDatabase {
  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;

  if (!url || !authToken) {
    throw new Error(
      "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  database ??= drizzle({ connection: { url, authToken }, schema });
  return database;
}
