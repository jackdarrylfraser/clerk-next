import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { createIdempotencyStore } from "./idempotency";

function createStore(records = new Map()) {
  const setOptions = new Map();
  const getRedisClient = () => ({
    exists: async (key) => Number(records.has(key)),
    get: async (key) => records.get(key) ?? null,
    set: async (key, value, options) => {
      if (options?.nx && records.has(key)) return null;
      records.set(key, value);
      setOptions.set(key, options);
      return "OK";
    },
    del: async (...keys) => {
      let deleted = 0;
      for (const key of keys) {
        deleted += Number(records.delete(key));
      }
      return deleted;
    },
    ttl: async () => 45,
  });

  return {
    idempotency: createIdempotencyStore({ getRedisClient }),
    records,
    setOptions,
  };
}

describe("idempotency", () => {
  it("runs work once and marks the key complete", async () => {
    const { idempotency, records, setOptions } = createStore();
    const key = {
      scope: "clerk-next:campaign",
      key: "campaign/42",
    };
    async function sendCampaign() {
      return "sent";
    }

    expect(await idempotency.run(key, sendCampaign)).toEqual({
      status: "executed",
      value: "sent",
    });
    expect(await idempotency.run(key, sendCampaign)).toEqual({
      status: "duplicate",
      value: "sent",
    });

    const keyHash = createHash("sha256").update(key.key).digest("hex");
    expect([...records.keys()]).toEqual([
      `clerk-next:campaign:lock:${keyHash}`,
      `clerk-next:campaign:completed:${keyHash}`,
    ]);
    expect([...records.keys()][0]).not.toContain("42");
    const completedKey = [...records.keys()][1];
    expect(setOptions.get(completedKey)).toEqual({ ex: 604_800 });
  });

  it("allows overriding the completion TTL", async () => {
    const { idempotency, records, setOptions } = createStore();
    const key = { scope: "clerk-next:campaign", key: "campaign/43" };
    async function sendCampaign() {
      return "sent";
    }

    await idempotency.run(
      { ...key, completionTtlSeconds: 604_800 },
      sendCampaign,
    );

    const completedKey = [...records.keys()][1];
    expect(setOptions.get(completedKey)).toEqual({ ex: 604_800 });
  });

  it("returns a cached result for its custom TTL", async () => {
    const { idempotency, records, setOptions } = createStore();
    const key = { scope: "clerk-next:cache", key: "user-1" };
    let runs = 0;

    const first = await idempotency.run(
      {
        ...key,
        resultTtlSeconds: (result) => result.ttl,
      },
      async () => {
        runs += 1;
        return { access: true, ttl: 30 };
      },
    );
    const second = await idempotency.run(
      key,
      async () => {
        runs += 1;
        return { access: false, ttl: 60 };
      },
    );

    expect(first).toEqual({
      status: "executed",
      value: { access: true, ttl: 30 },
    });
    expect(second).toEqual({
      status: "duplicate",
      value: { access: true, ttl: 30 },
    });
    expect(runs).toBe(1);

    const completedKey = [...records.keys()][1];
    expect(setOptions.get(completedKey)).toEqual({ ex: 30 });
  });

  it("forgets both the lock and cached result", async () => {
    const { idempotency, records } = createStore();
    const key = { scope: "clerk-next:cache", key: "user-1" };
    await idempotency.run(
      { ...key, resultTtlSeconds: 30 },
      async () => ({ access: true }),
    );

    await idempotency.forget(key);

    expect(records.size).toBe(0);
  });

  it("uses a custom result TTL and stores the result", async () => {
    const { idempotency, records, setOptions } = createStore();
    const key = { scope: "clerk-next:cache", key: "user-2" };
    const result = await idempotency.run(
      { ...key, resultTtlSeconds: (value) => value.ttl },
      async () => ({ ttl: 30 }),
    );

    expect(result).toEqual({ status: "executed", value: { ttl: 30 } });
    const completedKey = [...records.keys()][1];
    expect(records.get(completedKey)).toBe(
      '{"completed":true,"value":{"ttl":30}}',
    );
    expect(setOptions.get(completedKey)).toEqual({ ex: 30 });
  });

  it("reports an in-progress operation without running its work", async () => {
    const { idempotency } = createStore();
    const key = { scope: "clerk-next:campaign", key: "campaign/42" };
    let finishOperation;
    let signalStarted;
    const operationStarted = new Promise((resolve) => {
      signalStarted = resolve;
    });
    const operationResult = new Promise((resolve) => {
      finishOperation = resolve;
    });
    let duplicateWorkRan = false;

    function holdOperation() {
      signalStarted();
      return operationResult;
    }

    async function duplicateOperation() {
      duplicateWorkRan = true;
    }

    const pending = idempotency.run(key, holdOperation);
    await operationStarted;

    expect(await idempotency.run(key, duplicateOperation)).toEqual({
      status: "in-progress",
      retryAfterSeconds: 45,
    });
    expect(duplicateWorkRan).toBe(false);

    finishOperation("sent");
    expect(await pending).toEqual({ status: "executed", value: "sent" });
  });

  it("isolates request keys by scope", async () => {
    const { idempotency, records } = createStore();
    async function sendFirst() {
      return "first";
    }
    async function sendSecond() {
      return "second";
    }

    expect(
      await idempotency.run(
        { scope: "clerk-next:first", key: "request-1" },
        sendFirst,
      ),
    ).toMatchObject({ status: "executed" });
    expect(
      await idempotency.run(
        { scope: "clerk-next:second", key: "request-1" },
        sendSecond,
      ),
    ).toMatchObject({ status: "executed" });
    expect([...records.keys()]).toHaveLength(4);
  });

  it("does not mark work complete when the operation throws", async () => {
    const { idempotency, records } = createStore();
    const key = { scope: "clerk-next:contact", key: "request-1" };
    const keyHash = createHash("sha256").update(key.key).digest("hex");

    async function failOperation() {
      throw new Error("operation failed");
    }

    const result = await idempotency.run(key, failOperation);
    expect(result).toEqual({
      status: "error",
      error: new Error("operation failed"),
    });
    expect(
      records.has(`${key.scope}:completed:${keyHash}`),
    ).toBe(false);
  });

  it("does not complete a claim after its lock changes", async () => {
    const { idempotency, records } = createStore();
    const key = { scope: "clerk-next:contact", key: "request-1" };
    const keyHash = createHash("sha256").update(key.key).digest("hex");
    const lockKey = `${key.scope}:lock:${keyHash}`;
    const completedKey = `${key.scope}:completed:${keyHash}`;

    async function replaceLock() {
      records.set(lockKey, "new-token");
    }

    expect(await idempotency.run(key, replaceLock)).toEqual({
      status: "error",
      error: new Error("Idempotency claim expired before completion"),
    });
    expect(records.has(completedKey)).toBe(false);
  });

  it("rejects invalid keys and expiration values", async () => {
    const { idempotency } = createStore();
    async function noOperation() {}

    await expect(
      idempotency.run({ scope: " ", key: "request-1" }, noOperation),
    ).rejects.toThrow("Idempotency scopes");
    await expect(
      idempotency.run(
        { scope: "clerk-next:contact", key: " " },
        noOperation,
      ),
    ).rejects.toThrow("Idempotency keys");
    await expect(
      idempotency.run(
        {
          scope: "clerk-next:contact",
          key: "request-1",
          lockTtlSeconds: 0,
        },
        noOperation,
      ),
    ).rejects.toThrow("lock TTL");
    await expect(
      idempotency.run(
        {
          scope: "clerk-next:contact",
          key: "request-1",
          completionTtlSeconds: 0,
        },
        noOperation,
      ),
    ).rejects.toThrow("idempotency TTL");
  });
});
