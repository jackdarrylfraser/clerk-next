import { describe, expect, it } from "bun:test";
import { createIdempotencyStore } from "./idempotency";

describe("idempotency store", () => {
  it("uses atomic Redis claims and reports their state", async () => {
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
    const store = createIdempotencyStore({
      getRedisClient,
      prefix: "test",
    });

    const claimed = await store.begin("campaign-42");
    expect(claimed.status).toBe("claimed");
    const inProgress = await store.begin("campaign-42");
    expect(inProgress).toEqual({
      status: "in-progress",
      retryAfterSeconds: 45,
    });
    expect([...records.keys()][0]).toMatch(/^test:lock:[a-f0-9]{64}$/);
    expect([...records.keys()][0]).not.toContain("campaign-42");

    if (claimed.status !== "claimed") throw new Error("Expected claim");
    expect(await store.complete("campaign-42", claimed.token)).toBe(true);
    expect(await store.begin("campaign-42")).toEqual({ status: "completed" });
  });

  it("does not complete a claim after its lock changes", async () => {
    const records = new Map();
    const getRedisClient = () => ({
      get: async (key) => records.get(key) ?? null,
      set: async (key, value) => {
        records.set(key, value);
        return "OK";
      },
    });
    const store = createIdempotencyStore({
      getRedisClient,
      prefix: "test",
    });

    expect(await store.complete("request-1", "old-token")).toBe(false);
  });

  it("rejects invalid keys and expiration values", async () => {
    const store = createIdempotencyStore({
      getRedisClient: () => ({ eval: async () => 1 }),
      prefix: "test",
    });

    await expect(store.begin(" ")).rejects.toThrow("Idempotency keys");
    await expect(store.begin("request-1", { lockTtlSeconds: 0 })).rejects.toThrow(
      "lock TTL",
    );
    await expect(
      store.complete("request-1", "token", { ttlSeconds: 0 }),
    ).rejects.toThrow("idempotency TTL");
  });
});
