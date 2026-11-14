"use client";

import { useSyncExternalStore } from "react";
import { resolveSubscribeState } from "./flow-state";
import {
  clearStoredSubscribeSession,
  getServerSubscribeSessionSnapshot,
  getSubscribeSessionSnapshot,
  subscribeToSubscribeSession,
  updateStoredSubscribeSession,
} from "./subscribe-session-store";
import type {
  SubscribeQuery,
  SubscribeSessionState,
} from "./types";

export function useSubscribeSession(query: SubscribeQuery) {
  const snapshot = useSyncExternalStore(
    subscribeToSubscribeSession,
    getSubscribeSessionSnapshot,
    getServerSubscribeSessionSnapshot,
  );
  const state = resolveSubscribeState(query, snapshot.state);

  function update(patch: Partial<SubscribeSessionState>): void {
    const nextState = { ...state, ...patch };
    updateStoredSubscribeSession(nextState);
  }

  function clear(): void {
    clearStoredSubscribeSession();
  }

  return {
    isReady: snapshot.isReady,
    state,
    storageError: snapshot.storageError,
    update,
    clear,
  };
}
