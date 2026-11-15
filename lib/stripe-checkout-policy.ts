export type StripeCheckoutPaymentState = "complete" | "processing" | "incomplete";

export function getStripeCheckoutPaymentState(
  session: {
    status: string | null;
    paymentStatus: string;
  },
): StripeCheckoutPaymentState {
  if (
    session.status === "complete" &&
    (session.paymentStatus === "paid" ||
      session.paymentStatus === "no_payment_required")
  ) {
    return "complete";
  }

  if (session.status === "complete" && session.paymentStatus === "unpaid") {
    return "processing";
  }

  return "incomplete";
}

export function formatStripeAmount(
  amount: number | null,
  currency: string | null,
): string | null {
  if (amount === null || currency === null) {
    return null;
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  const minorUnitScale =
    10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);

  return formatter.format(amount / minorUnitScale);
}
