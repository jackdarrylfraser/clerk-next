import { createHash, randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";

export type IdempotencyClaim =
  | { status: "claimed"; token: string }
  | { status: "in-progress"; retryAfterSeconds: number }
  | { status: "completed" };

export interface IdempotencyKey {
  scope: string;
  key: string;
}

export interface CreateIdempotencyStoreOptions {
  getRedisClient: () => Redis;
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

  return {
    async begin(
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
    },

    async end(
      key: IdempotencyKey,
      token: string,
      { ttlSeconds = 86_400 }: { ttlSeconds?: number } = {},
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

      const stored = await redis.set(completedKey, true, { ex: ttlSeconds });
      if (stored !== "OK") {
        throw new Error("Upstash Redis did not store the idempotency marker");
      }

      return true;
    },
  };
}
