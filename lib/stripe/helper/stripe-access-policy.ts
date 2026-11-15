import { createIdempotencyPrefix } from "@outbound-endurance/kv";
import { IDEMPOTENCY_PREFIXES } from "@/lib/constants";

interface SubscriptionAccessState {
  status: string;
  trialEnd: number | null;
  paidThrough: number | null;
}

export interface StripeAccessResult {
  hasAccess: boolean;
  expiresAt: number | null;
}

export interface StripeAccessIdempotency {
  run<T>(
    config: {
      scope: string;
      key: string;
      lockTtlSeconds: number;
      resultTtlSeconds: (value: T) => number;
    },
    operation: () => Promise<T>,
  ): Promise<
    | { status: "executed"; value: T }
    | { status: "duplicate"; value?: T }
    | { status: "in-progress"; retryAfterSeconds: number }
    | { status: "error"; error: unknown }
  >;
  forget(key: { scope: string; key: string }): Promise<void>;
}

export interface StripeAccessDependencies {
  getCustomerIds(userId: string): Promise<readonly string[]>;
  getAccessStates(
    customerId: string,
  ): Promise<readonly SubscriptionAccessState[]>;
  idempotency: StripeAccessIdempotency;
  now?: () => number;
  deniedCacheTtlSeconds?: number;
}

export function getSubscriptionAccessExpiry(
  state: SubscriptionAccessState,
  now = Math.floor(Date.now() / 1000),
): number | null {
  const validExpiries: number[] = [];

  if (
    state.status === "trialing" &&
    state.trialEnd !== null &&
    state.trialEnd > now
  ) {
    validExpiries.push(state.trialEnd);
  }
  if (state.paidThrough !== null && state.paidThrough > now) {
    validExpiries.push(state.paidThrough);
  }

  return validExpiries.length > 0 ? Math.max(...validExpiries) : null;
}

export function hasSubscriptionAccess(
  state: SubscriptionAccessState,
  now = Math.floor(Date.now() / 1000),
): boolean {
  return getSubscriptionAccessExpiry(state, now) !== null;
}

const DEFAULT_DENIED_CACHE_TTL_SECONDS = 60;
const LOCK_TTL_SECONDS = 10;

function isStripeAccessResult(value: unknown): value is StripeAccessResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("hasAccess" in value) || typeof value.hasAccess !== "boolean") {
    return false;
  }
  if (!("expiresAt" in value)) {
    return false;
  }

  return value.hasAccess
    ? typeof value.expiresAt === "number" &&
        Number.isSafeInteger(value.expiresAt)
    : value.expiresAt === null;
}

export async function checkStripeAccess(
  userId: string,
  {
    getCustomerIds,
    getAccessStates,
    idempotency,
    now = () => Math.floor(Date.now() / 1000),
    deniedCacheTtlSeconds = DEFAULT_DENIED_CACHE_TTL_SECONDS,
  }: StripeAccessDependencies,
): Promise<boolean> {
  if (
    !Number.isSafeInteger(deniedCacheTtlSeconds) ||
    deniedCacheTtlSeconds < 1
  ) {
    throw new Error(
      "The denied Stripe access cache TTL must be a positive integer",
    );
  }

  function getIdempotencyKey(userId: string): {
    scope: string;
    key: string;
  } {
    if (!userId.trim()) {
      throw new Error("A user ID is required to check Stripe access");
    }
    return {
      scope: createIdempotencyPrefix({
        ...IDEMPOTENCY_PREFIXES.stripe.access,
      }),
      key: userId,
    };
  }

  async function lookupAccess(userId: string): Promise<StripeAccessResult> {
    const customerIds = await getCustomerIds(userId);
    const accessStates = (
      await Promise.all(
        customerIds.map((customerId) => getAccessStates(customerId)),
      )
    ).flat();
    const currentTime = now();
    const accessExpiry = accessStates.reduce<number | null>(
      (latestExpiry, state) => {
        const stateExpiry = getSubscriptionAccessExpiry(state, currentTime);
        return stateExpiry === null
          ? latestExpiry
          : Math.max(latestExpiry ?? stateExpiry, stateExpiry);
      },
      null,
    );

    return {
      hasAccess: accessExpiry !== null,
      expiresAt: accessExpiry,
    };
  }

  async function runAccessLookup(
    userId: string,
    key: { scope: string; key: string },
  ): Promise<StripeAccessResult> {
    const result = await idempotency.run(
      {
        ...key,
        lockTtlSeconds: LOCK_TTL_SECONDS,
        resultTtlSeconds: (accessResult: StripeAccessResult) =>
          accessResult.expiresAt === null
            ? deniedCacheTtlSeconds
            : Math.max(1, accessResult.expiresAt - now()),
      },
      () => lookupAccess(userId),
    );

    if (result.status === "error") {
      throw result.error;
    }

    if (result.status === "in-progress") {
      throw new Error("Stripe access lookup is still in progress");
    }

    if (result.status === "duplicate" && result.value === undefined) {
      throw new Error("Stripe access idempotency result is missing");
    }

    if (!isStripeAccessResult(result.value)) {
      throw new Error("Stripe access idempotency result is invalid");
    }

    return result.value;
  }

  const key = getIdempotencyKey(userId);
  let accessResult = await runAccessLookup(userId, key);

  if (
    accessResult.hasAccess &&
    accessResult.expiresAt !== null &&
    accessResult.expiresAt <= now()
  ) {
    await idempotency.forget(key);
    accessResult = await runAccessLookup(userId, key);
  }

  return (
    accessResult.hasAccess &&
    accessResult.expiresAt !== null &&
    accessResult.expiresAt > now()
  );
}

export async function invalidateStripeAccessCache(
  userId: string,
  idempotency: StripeAccessIdempotency,
): Promise<void> {
  if (!userId.trim()) {
    throw new Error("A user ID is required to invalidate Stripe access");
  }
  await idempotency.forget({
    scope: createIdempotencyPrefix({
      ...IDEMPOTENCY_PREFIXES.stripe.access,
    }),
    key: userId,
  });
}
