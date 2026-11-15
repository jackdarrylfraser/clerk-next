interface SubscriptionAccessState {
  status: string;
  trialEnd: number | null;
  paidThrough: number | null;
}

export function hasSubscriptionAccess(
  state: SubscriptionAccessState,
  now = Math.floor(Date.now() / 1000),
): boolean {
  return (
    (state.status === "trialing" &&
      state.trialEnd !== null &&
      state.trialEnd > now) ||
    (state.paidThrough !== null && state.paidThrough > now)
  );
}
