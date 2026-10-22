import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({redirect: vi.fn(() => { throw new Error("unexpected accounting redirect"); })}));
import FinanceAccountingLayout from "./layout";
afterEach(cleanup);
describe("accounting route layout", () => {
  it("renders the requested accounting screen instead of redirecting", () => {
    render(<FinanceAccountingLayout><h1>Accounting overview</h1></FinanceAccountingLayout>);
    expect(screen.getByRole("heading", {name: "Accounting overview"})).toBeTruthy();
  });
});
