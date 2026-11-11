import { isIP } from "node:net";

export function getIpRateLimitIdentifier(
  headers: Headers,
  nodeEnv: string,
): string | null {
  const forwardedFor = headers.get("x-forwarded-for")?.trim();
  if (forwardedFor) {
    return isIP(forwardedFor) ? `ip:${forwardedFor}` : null;
  }

  return nodeEnv === "production" ? null : "local-development";
}
