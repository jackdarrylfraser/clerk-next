export const leadAccessWindowMs = 30 * 24 * 60 * 60 * 1000;

export function isLeadVerificationCurrent(
  verifiedAt: Date | null,
  now = new Date(),
): boolean {
  return (
    verifiedAt !== null &&
    verifiedAt.getTime() >= now.getTime() - leadAccessWindowMs
  );
}

export function isLeadAccessIssuedAfterRevocation(
  issuedAt: number | undefined,
  revokedBefore: Date | null,
): boolean {
  return (
    revokedBefore === null ||
    (issuedAt !== undefined && issuedAt >= revokedBefore.getTime())
  );
}
