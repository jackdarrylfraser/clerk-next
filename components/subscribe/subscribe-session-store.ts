import {
  clearSubscribeSession,
  readSubscribeSession,
  writeSubscribeSession,
} from "./subscribe-session";
import type { SubscribeSessionState } from "./types";

interface SubscribeSessionSnapshot {
  state: SubscribeSessionState | null;
  storageError: boolean;
  isReady: boolean;
}

const serverSnapshot: SubscribeSessionSnapshot = {
  state: null,
  storageError: false,
  isReady: false,
};

const listeners = new Set<() => void>();
let snapshot = serverSnapshot;
let initialized = false;

export function subscribeToSubscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getServerSubscribeSessionSnapshot(): SubscribeSessionSnapshot {
  return serverSnapshot;
}

export function getSubscribeSessionSnapshot(): SubscribeSessionSnapshot {
  if (typeof window === "undefined") return serverSnapshot;
  if (initialized) return snapshot;

  initialized = true;
  try {
    snapshot = {
      state: readSubscribeSession(window.sessionStorage),
      storageError: false,
      isReady: true,
    };
  } catch (error) {
    console.error("Unable to read subscription session state.", error);
    snapshot = { state: null, storageError: true, isReady: true };
  }

  return snapshot;
}

export function updateStoredSubscribeSession(
  state: SubscribeSessionState,
): void {
  getSubscribeSessionSnapshot();
  let storageError = false;

  try {
    writeSubscribeSession(window.sessionStorage, state);
  } catch (error) {
    console.error("Unable to save subscription session state.", error);
    storageError = true;
  }

  snapshot = { state, storageError, isReady: true };
  notifySubscribers();
}

export function clearStoredSubscribeSession(): void {
  getSubscribeSessionSnapshot();
  let storageError = false;

  try {
    clearSubscribeSession(window.sessionStorage);
  } catch (error) {
    console.error("Unable to clear subscription session state.", error);
    storageError = true;
  }

  snapshot = { state: null, storageError, isReady: true };
  notifySubscribers();
}

function notifySubscribers(): void {
  listeners.forEach((listener) => listener());
}
