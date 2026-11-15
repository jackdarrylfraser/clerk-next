import { isPublicOnlyMode } from "@/lib/auth";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && isPublicOnlyMode) {
    const { revokePublicOnlyAccess } = await import("@/lib/public-only");
    await revokePublicOnlyAccess();
  }
}
