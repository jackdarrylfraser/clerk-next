import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { user, userAccess } from "../db/schema";
import { ACCESS_LEVELS } from "../lib/constants";

const { combinedEnv } = loadEnvConfig(process.cwd());

async function seedAdmin(): Promise<void> {
  const url = combinedEnv.TURSO_DATABASE_URL;
  const authToken = combinedEnv.TURSO_AUTH_TOKEN;
  const email = combinedEnv.SEED_ADMIN_EMAIL?.trim().toLowerCase();

  if (!url || !authToken) {
    throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Set SEED_ADMIN_EMAIL to a valid email address.");
  }

  const db = drizzle({ connection: { url, authToken }, schema });
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!existingUser) {
    const now = new Date();
    await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: combinedEnv.SEED_ADMIN_NAME?.trim() || "Admin",
        email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  const [seededUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!seededUser) {
    throw new Error("Could not find or create the seeded Better Auth user.");
  }

  await db
    .insert(userAccess)
    .values({
      userId: seededUser.id,
      accessLevel: ACCESS_LEVELS.ADMIN.value,
    })
    .onConflictDoUpdate({
      target: userAccess.userId,
      set: { accessLevel: ACCESS_LEVELS.ADMIN.value },
    });

  console.info(
    `Seeded Better Auth user access level: ${ACCESS_LEVELS.ADMIN.value}.`,
  );
}

seedAdmin().catch((error: unknown) => {
  console.error("Failed to seed Better Auth admin access:", error);
  process.exitCode = 1;
});
