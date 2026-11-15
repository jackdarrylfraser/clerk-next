type SubscribeFlowStep = "account" | "payment";

export function getSubscribeRedirect(
  step: SubscribeFlowStep,
  isSignedIn: boolean,
): "/subscribe/account" | "/subscribe/payment" | null {
  if (step === "account" && isSignedIn) return "/subscribe/payment";
  if (step === "payment" && !isSignedIn) return "/subscribe/account";
  return null;
}
