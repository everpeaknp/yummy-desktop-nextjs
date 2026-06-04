/** Shared flag so guards wait for cold-start session restore (Electron + browser). */

let restoreInFlight = false;
let restoreFinished = false;

export function beginSessionRestore(): void {
  restoreInFlight = true;
  restoreFinished = false;
}

export function endSessionRestore(): void {
  restoreInFlight = false;
  restoreFinished = true;
}

export function resetSessionRestore(): void {
  restoreInFlight = false;
  restoreFinished = false;
}

export function isSessionRestoreInFlight(): boolean {
  return restoreInFlight;
}

export function hasSessionRestoreFinished(): boolean {
  return restoreFinished;
}
