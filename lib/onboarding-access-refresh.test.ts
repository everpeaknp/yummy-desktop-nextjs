import { describe, expect, it } from "vitest";
import {
  ONBOARDING_ACCESS_REFRESH_INTERVAL_MS,
  shouldRefreshOnboardingAccess,
} from "./onboarding-access-refresh";

describe("onboarding access refresh gate", () => {
  it("allows the first passive refresh", () => {
    expect(shouldRefreshOnboardingAccess(0, 1_000)).toBe(true);
  });

  it("blocks repeated focus refreshes inside the cooldown", () => {
    expect(shouldRefreshOnboardingAccess(1_000, 5_000)).toBe(false);
  });

  it("allows refresh after the cooldown", () => {
    expect(
      shouldRefreshOnboardingAccess(
        1_000,
        1_000 + ONBOARDING_ACCESS_REFRESH_INTERVAL_MS,
      ),
    ).toBe(true);
  });
});
