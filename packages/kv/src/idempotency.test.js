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
    });

    const keyHash = createHash("sha256").update(key.key).digest("hex");
    expect([...records.keys()]).toEqual([
      `clerk-next:campaign:lock:${keyHash}`,
      `clerk-next:campaign:completed:${keyHash}`,
    ]);
    expect([...records.keys()][0]).not.toContain("42");
    const completedKey = [...records.keys()][1];
    expect(setOptions.get(completedKey)).toEqual({ ex: 31_536_000 });
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

    await expect(
      idempotency.run(key, failOperation),
    ).rejects.toThrow("operation failed");
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

    await expect(
      idempotency.run(key, replaceLock),
    ).rejects.toThrow("claim expired");
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
