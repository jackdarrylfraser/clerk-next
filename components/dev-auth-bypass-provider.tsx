"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const DevAuthBypassContext = createContext(false);

export function DevAuthBypassProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <DevAuthBypassContext.Provider value={enabled}>
      {children}
    </DevAuthBypassContext.Provider>
  );
}

export function useDevAuthBypass() {
  return useContext(DevAuthBypassContext);
}
