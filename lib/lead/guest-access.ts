import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { cookies } from "next/headers";
import { lead } from "@/db/schema";
import { env } from "@/env";
import { getDb } from "@/lib/drizzle";
import {
  isLeadVerificationCurrent,
  leadAccessWindowMs,
} from "@/lib/lead/lead-access-policy";
import {
  leadAccessCookieName,
  verifyLeadAccessToken,
} from "@/lib/lead/lead-access-token";

export async function hasGuestContentAccess(): Promise<boolean> {
  const cookieStore = await cookies();
  const leadToken = verifyLeadAccessToken(
    cookieStore.get(leadAccessCookieName)?.value,
    env.BETTER_AUTH_SECRET,
  );
  if (!leadToken) {
    return false;
  }

  const cutoff = new Date(Date.now() - leadAccessWindowMs);
  const [verifiedLead] = await getDb()
    .select({ verifiedAt: lead.verifiedAt })
    .from(lead)
    .where(and(eq(lead.id, leadToken.leadId), gte(lead.verifiedAt, cutoff)))
    .limit(1);

  return Boolean(
    verifiedLead && isLeadVerificationCurrent(verifiedLead.verifiedAt),
  );
}
