import { describe, expect, it } from "bun:test";
import {
  clearSubscribeSession,
  readSubscribeSession,
  SUBSCRIBE_SESSION_STORAGE_KEY,
  writeSubscribeSession,
} from "./subscribe-session";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

describe("subscription session storage", () => {
  it("round-trips the flow choices", () => {
    const storage = createStorage();
    const state = {
      planId: "standard",
      period: "annual",
      authMode: "sign-in",
    };

    writeSubscribeSession(storage, state);

    expect(readSubscribeSession(storage)).toEqual(state);
  });

  it("discards malformed session data", () => {
    const storage = createStorage();
    storage.setItem(SUBSCRIBE_SESSION_STORAGE_KEY, "{");

    expect(readSubscribeSession(storage)).toBeNull();
    expect(storage.getItem(SUBSCRIBE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("discards unsupported or invalid session data", () => {
    const storage = createStorage();
    storage.setItem(
      SUBSCRIBE_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        planId: "standard",
        period: "annual",
        authMode: "sign-in",
      }),
    );

    expect(readSubscribeSession(storage)).toBeNull();
    expect(storage.getItem(SUBSCRIBE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("clears the flow choices after checkout", () => {
    const storage = createStorage();
    writeSubscribeSession(storage, {
      planId: "standard",
      period: "annual",
      authMode: "sign-up",
    });

    clearSubscribeSession(storage);

    expect(readSubscribeSession(storage)).toBeNull();
  });
});
