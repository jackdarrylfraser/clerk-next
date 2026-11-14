import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { createIdempotencyStore } from "./idempotency";

describe("idempotency", () => {
  it("uses typed Redis commands to claim and complete idempotently", async () => {
    const records = new Map();
    const getRedisClient = () => ({
      exists: async (key) => Number(records.has(key)),
      get: async (key) => records.get(key) ?? null,
      set: async (key, value, options) => {
        if (options?.nx && records.has(key)) return null;
        records.set(key, value);
        return "OK";
      },
      ttl: async () => 45,
    });
    const idempotency = createIdempotencyStore({ getRedisClient });
    const key = {
      scope: "clerk-next:campaign",
      key: "campaign/42",
    };

    const claimed = await idempotency.begin(key);
    expect(claimed.status).toBe("claimed");
    const inProgress = await idempotency.begin(key);
    expect(inProgress).toEqual({
      status: "in-progress",
      retryAfterSeconds: 45,
    });
    const keyHash = createHash("sha256").update(key.key).digest("hex");
    expect([...records.keys()][0]).toBe(
      `clerk-next:campaign:lock:${keyHash}`,
    );
    expect([...records.keys()][0]).not.toContain("42");

    if (claimed.status !== "claimed") throw new Error("Expected claim");
    expect(await idempotency.end(key, claimed.token)).toBe(true);
    expect(await idempotency.begin(key)).toEqual({ status: "completed" });
    expect([...records.keys()]).toHaveLength(2);
  });

  it("isolates request keys by scope", async () => {
    const records = new Map();
    const idempotency = createIdempotencyStore({
      getRedisClient: () => ({
        exists: async (key) => Number(records.has(key)),
        set: async (key, value, options) => {
          if (options?.nx && records.has(key)) return null;
          records.set(key, value);
          return "OK";
        },
        ttl: async () => 45,
      }),
    });

    expect(
      (
        await idempotency.begin({
          scope: "clerk-next:first",
          key: "request-1",
        })
      ).status,
    ).toBe("claimed");
    expect(
      (
        await idempotency.begin({
          scope: "clerk-next:second",
          key: "request-1",
        })
      ).status,
    ).toBe("claimed");
    expect([...records.keys()]).toHaveLength(2);
  });

  it("does not end a claim after its lock changes", async () => {
    const records = new Map();
    const key = { scope: "clerk-next:contact", key: "request-1" };
    const keyHash = createHash("sha256").update(key.key).digest("hex");
    const lockKey = `${key.scope}:lock:${keyHash}`;
    const completedKey = `${key.scope}:completed:${keyHash}`;
    records.set(lockKey, "new-token");
    const idempotency = createIdempotencyStore({
      getRedisClient: () => ({
        get: async (redisKey) => records.get(redisKey) ?? null,
        set: async (redisKey, value) => {
          records.set(redisKey, value);
          return "OK";
        },
      }),
    });

    expect(await idempotency.end(key, "old-token")).toBe(false);
    expect(records.has(completedKey)).toBe(false);
  });

  it("rejects invalid keys and expiration values", async () => {
    const idempotency = createIdempotencyStore({ getRedisClient: () => ({}) });

    await expect(
      idempotency.begin({ scope: " ", key: "request-1" }),
    ).rejects.toThrow("Idempotency scopes");
    await expect(
      idempotency.begin({ scope: "clerk-next:contact", key: " " }),
    ).rejects.toThrow("Idempotency keys");
    await expect(
      idempotency.begin(
        { scope: "clerk-next:contact", key: "request-1" },
        { lockTtlSeconds: 0 },
      ),
    ).rejects.toThrow("lock TTL");
    await expect(
      idempotency.end(
        { scope: "clerk-next:contact", key: "request-1" },
        "token",
        { ttlSeconds: 0 },
      ),
    ).rejects.toThrow("idempotency TTL");
  });
});
