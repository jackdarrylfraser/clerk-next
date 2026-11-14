import "server-only";
import { createClient } from "@libsql/client";
import { env } from "@/env";

type TursoClient = ReturnType<typeof createClient>;

let client: TursoClient | undefined;

export function getTursoClient(): TursoClient {
  const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;

  if (!url || !authToken) {
    throw new Error(
      "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  client ??= createClient({ url, authToken });
  return client;
}
