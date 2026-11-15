import { createHash, randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";
export { createIdempotencyPrefix } from "./idempotency-prefix";
export type { CreateIdempotencyPrefixOptions } from "./idempotency-prefix";

const DEFAULT_COMPLETION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface IdempotencyKey {
  scope: string;
  key: string;
}

export interface IdempotencyRunOptions<T = unknown> {
  lockTtlSeconds?: number;
  completionTtlSeconds?: number;
  /** TTL for the completion record; a function can choose it from the result. */
  resultTtlSeconds?: number | ((value: T) => number);
}

export interface IdempotencyRunConfig<T = unknown>
  extends IdempotencyKey, IdempotencyRunOptions<T> {}

export type IdempotencyRunResult<T> =
  | { status: "executed"; value: T }
  | { status: "duplicate"; value?: T }
  | { status: "in-progress"; retryAfterSeconds: number }
  | { status: "error"; error: unknown };

export interface CreateIdempotencyStoreOptions {
  getRedisClient: () => Redis;
}

type IdempotencyClaim =
  | { status: "claimed"; token: string }
  | { status: "in-progress"; retryAfterSeconds: number }
  | { status: "completed" };

interface CachedResult<T> {
  completed: boolean;
  hasValue: boolean;
  value?: T;
}

export function createIdempotencyStore({
  getRedisClient,
}: CreateIdempotencyStoreOptions) {
  function getKeys({ scope, key }: IdempotencyKey) {
    if (!scope.trim() || scope.length > 255) {
      throw new Error("Idempotency scopes must contain 1 to 255 characters");
    }
    if (!key.trim() || key.length > 255) {
      throw new Error("Idempotency keys must contain 1 to 255 characters");
    }

    const hash = createHash("sha256").update(key).digest("hex");
    return {
      lockKey: `${scope}:lock:${hash}`,
      completedKey: `${scope}:completed:${hash}`,
    };
  }

  async function begin(
    key: IdempotencyKey,
    { lockTtlSeconds = 60 }: { lockTtlSeconds?: number } = {},
  ): Promise<IdempotencyClaim> {
    if (!Number.isSafeInteger(lockTtlSeconds) || lockTtlSeconds < 1) {
      throw new Error("The idempotency lock TTL must be a positive integer");
    }

    const { lockKey, completedKey } = getKeys(key);
    const redis = getRedisClient();

    if (await redis.exists(completedKey)) {
      return { status: "completed" };
    }

    const token = randomUUID();
    const acquired = await redis.set(lockKey, token, {
      nx: true,
      ex: lockTtlSeconds,
    });

    if (acquired === "OK") {
      return { status: "claimed", token };
    }
    if (acquired !== null) {
      throw new Error("Upstash Redis returned an unexpected idempotency claim");
    }

    if (await redis.exists(completedKey)) {
      return { status: "completed" };
    }

    const ttl = await redis.ttl(lockKey);
    return {
      status: "in-progress",
      retryAfterSeconds: ttl > 0 ? ttl : 1,
    };
  }

  async function end(
    key: IdempotencyKey,
    token: string,
    {
      ttlSeconds = DEFAULT_COMPLETION_TTL_SECONDS,
      completedValue = JSON.stringify({ completed: true }),
    }: { ttlSeconds?: number; completedValue?: string } = {},
  ): Promise<boolean> {
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) {
      throw new Error("The idempotency TTL must be a positive integer");
    }

    const { lockKey, completedKey } = getKeys(key);
    const redis = getRedisClient();
    const currentToken = await redis.get<string>(lockKey);
    if (currentToken !== token) {
      return false;
    }

    const stored = await redis.set(completedKey, completedValue, {
      ex: ttlSeconds,
    });
    if (stored !== "OK") {
      throw new Error("Upstash Redis did not store the idempotency marker");
    }

    return true;
  }

  async function getCompletedResult<T>(
    key: IdempotencyKey,
  ): Promise<CachedResult<T>> {
    const { completedKey } = getKeys(key);
    const completedValue = await getRedisClient().get<unknown>(completedKey);
    if (typeof completedValue !== "string") {
      return { completed: false, hasValue: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(completedValue);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { completed: false, hasValue: false };
      }
      throw error;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("completed" in parsed) ||
      parsed.completed !== true
    ) {
      return { completed: false, hasValue: false };
    }

    if (!("value" in parsed)) {
      return { completed: true, hasValue: false };
    }

    return { completed: true, hasValue: true, value: parsed.value as T };
  }

  async function forget(key: IdempotencyKey): Promise<void> {
    const { lockKey, completedKey } = getKeys(key);
    await getRedisClient().del(lockKey, completedKey);
  }

  async function run<T>(
    {
      scope,
      key,
      lockTtlSeconds = 60,
      completionTtlSeconds = DEFAULT_COMPLETION_TTL_SECONDS,
      resultTtlSeconds,
    }: IdempotencyRunConfig<T>,
    operation: () => Promise<T>,
  ): Promise<IdempotencyRunResult<T>> {
    if (
      !Number.isSafeInteger(completionTtlSeconds) ||
      completionTtlSeconds < 1
    ) {
      throw new Error("The idempotency TTL must be a positive integer");
    }
    if (
      typeof resultTtlSeconds === "number" &&
      (!Number.isSafeInteger(resultTtlSeconds) || resultTtlSeconds < 1)
    ) {
      throw new Error("The idempotency result TTL must be a positive integer");
    }

    const idempotencyKey = { scope, key };
    const claim = await begin(idempotencyKey, { lockTtlSeconds });
    if (claim.status === "completed" || claim.status === "in-progress") {
      const completedResult = await getCompletedResult<T>(idempotencyKey);
      if (completedResult.completed && completedResult.hasValue) {
        return { status: "duplicate", value: completedResult.value };
      }
      if (completedResult.completed) {
        return { status: "duplicate" };
      }
      return claim.status === "completed" ? { status: "duplicate" } : claim;
    }

    try {
      const value = await operation();
      let completedValue = JSON.stringify({ completed: true });
      let resultTtl = completionTtlSeconds;

      try {
        if (resultTtlSeconds !== undefined) {
          resultTtl =
            typeof resultTtlSeconds === "function"
              ? resultTtlSeconds(value)
              : resultTtlSeconds;
          if (!Number.isSafeInteger(resultTtl) || resultTtl < 1) {
            throw new Error(
              "The idempotency result TTL must be a positive integer",
            );
          }
        }

        const serialized = JSON.stringify({ completed: true, value });
        if (serialized === undefined) {
          throw new Error("The idempotency result could not be serialized");
        }
        completedValue = serialized;
      } catch (error) {
        const completed = await end(idempotencyKey, claim.token, {
          ttlSeconds: completionTtlSeconds,
        });
        if (!completed) {
          throw new Error("Idempotency claim expired before completion");
        }
        throw error;
      }

      const completed = await end(idempotencyKey, claim.token, {
        ttlSeconds: resultTtl,
        completedValue,
      });
      if (!completed) {
        throw new Error("Idempotency claim expired before completion");
      }

      return { status: "executed", value };
    } catch (error) {
      return { status: "error", error };
    }
  }

  return { run, forget };
}
