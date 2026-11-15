import "server-only";
import { eq } from "drizzle-orm";
import { io } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accessLevels, userAccess, type AccessLevel } from "@/db/schema";
import { auth } from "@/lib/better-auth";
import { getDb } from "@/lib/drizzle";
import { hasAccessLevel } from "@/lib/access-policy";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type CurrentUserAccess = {
  user: AuthSession["user"];
  accessLevel: AccessLevel;
};

export async function getCurrentUserAccess(): Promise<CurrentUserAccess | null> {
  await io();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  const db = getDb();
  const [record] = await db
    .select({ accessLevel: userAccess.accessLevel })
    .from(userAccess)
    .where(eq(userAccess.userId, session.user.id))
    .limit(1);

  if (!record) {
    await db
      .insert(userAccess)
      .values({ userId: session.user.id, accessLevel: "guest" })
      .onConflictDoNothing();

    return { user: session.user, accessLevel: "guest" };
  }

  if (!accessLevels.includes(record.accessLevel)) {
    throw new Error(`Invalid access level for user ${session.user.id}`);
  }

  return { user: session.user, accessLevel: record.accessLevel };
}

export async function requireUserAccess(
  required: AccessLevel,
  returnTo: string,
): Promise<CurrentUserAccess> {
  const current = await getCurrentUserAccess();
  if (!current) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  if (!hasAccessLevel(current.accessLevel, required)) {
    redirect("/subscribe/plan");
  }

  return current;
}
