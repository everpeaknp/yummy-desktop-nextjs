import { describe, expect, it } from "vitest";

import { abnormalNormalBalanceMessage } from "./finance-statement-presentation";

describe("abnormalNormalBalanceMessage", () => {
  it("flags an asset credit balance without changing its reported value", () => {
    const reportedAssetBalance = -310;

    expect(abnormalNormalBalanceMessage("debit", reportedAssetBalance)).toBe(
      "Credit balance requires reconciliation",
    );
    expect(reportedAssetBalance).toBe(-310);
  });

  it("flags a liability debit balance", () => {
    expect(abnormalNormalBalanceMessage("credit", "-25.00")).toBe(
      "Debit balance requires reconciliation",
    );
  });

  it("does not warn for normal or zero balances", () => {
    expect(abnormalNormalBalanceMessage("debit", 310)).toBeNull();
    expect(abnormalNormalBalanceMessage("credit", 25)).toBeNull();
    expect(abnormalNormalBalanceMessage("debit", 0)).toBeNull();
  });
});
