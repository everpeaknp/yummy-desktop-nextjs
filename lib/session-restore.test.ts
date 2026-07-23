import { describe, expect, it, vi } from "vitest";
import {
  beginSessionRestore,
  endSessionRestore,
  getSessionRestoreState,
  markInteractiveSessionReady,
  resetSessionRestore,
  subscribeSessionRestore,
} from "./session-restore";

describe("session restore state", () => {
  it("notifies React subscribers when restore finishes", () => {
    resetSessionRestore();
    const listener = vi.fn();
    const unsubscribe = subscribeSessionRestore(listener);

    beginSessionRestore();
    expect(getSessionRestoreState()).toEqual({
      inFlight: true,
      finished: false,
    });

    endSessionRestore();
    expect(getSessionRestoreState()).toEqual({
      inFlight: false,
      finished: true,
    });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    resetSessionRestore();
  });

  it("finishes the restore gate after interactive login", () => {
    resetSessionRestore();

    markInteractiveSessionReady();

    expect(getSessionRestoreState()).toEqual({
      inFlight: false,
      finished: true,
    });

    resetSessionRestore();
  });
});
