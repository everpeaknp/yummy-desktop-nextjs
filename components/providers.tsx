"use client";

import { SessionBootstrap } from "@/components/auth/session-bootstrap";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SessionBootstrap />
    </>
  );
}
