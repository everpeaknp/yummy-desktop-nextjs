/** Reactive shared state for cold-start session restore (Electron + browser). */

export type SessionRestoreState = Readonly<{
  inFlight: boolean;
  finished: boolean;
}>;

const initialState: SessionRestoreState = Object.freeze({
  inFlight: false,
  finished: false,
});

let restoreState = initialState;
const listeners = new Set<() => void>();

function updateRestoreState(nextState: SessionRestoreState): void {
  if (
    restoreState.inFlight === nextState.inFlight &&
    restoreState.finished === nextState.finished
  ) {
    return;
  }
  restoreState = Object.freeze(nextState);
  listeners.forEach((listener) => listener());
}

export function subscribeSessionRestore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionRestoreState(): SessionRestoreState {
  return restoreState;
}

export function getServerSessionRestoreState(): SessionRestoreState {
  return initialState;
}

export function beginSessionRestore(): void {
  updateRestoreState({ inFlight: true, finished: false });
}

export function endSessionRestore(): void {
  updateRestoreState({ inFlight: false, finished: true });
}

/**
 * Interactive login already has a freshly-issued access token and user.
 * Mark that session ready so dashboard guards do not wait for the cold-start
 * restore path, which only runs when the application first mounts.
 */
export function markInteractiveSessionReady(): void {
  updateRestoreState({ inFlight: false, finished: true });
}

export function resetSessionRestore(): void {
  updateRestoreState(initialState);
}

export function isSessionRestoreInFlight(): boolean {
  return restoreState.inFlight;
}

export function hasSessionRestoreFinished(): boolean {
  return restoreState.finished;
}
