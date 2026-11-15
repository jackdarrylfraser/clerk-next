import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { publicOnlyState, session } from "@/db/schema";
import { getDb } from "@/lib/drizzle";

export function redirectIfPublicOnly(): void {
  if (env.PUBLIC_ONLY_MODE === "true") {
    redirect("/public");
  }
}

export async function revokePublicOnlyAccess(): Promise<void> {
  const now = new Date();
  const database = getDb();

  await database.transaction(async (transaction) => {
    await transaction.delete(session);
    await transaction
      .insert(publicOnlyState)
      .values({ id: 1, leadAccessRevokedBefore: now })
      .onConflictDoUpdate({
        target: publicOnlyState.id,
        set: { leadAccessRevokedBefore: now },
      });
  });
}

export async function getLeadAccessRevokedBefore(): Promise<Date | null> {
  const [state] = await getDb()
    .select({ revokedBefore: publicOnlyState.leadAccessRevokedBefore })
    .from(publicOnlyState)
    .where(eq(publicOnlyState.id, 1))
    .limit(1);

  return state?.revokedBefore ?? null;
}
