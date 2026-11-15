export async function readStripeRequestBody(
  request: Request,
): Promise<{ success: true; value: unknown } | { success: false }> {
  try {
    return { success: true, value: await request.json() };
  } catch {
    return { success: false };
  }
}

export function isStripeRequestOriginAllowed(
  origin: string | null,
  applicationUrl: string,
): boolean {
  if (origin === null) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(applicationUrl).origin;
  } catch {
    return false;
  }
}
