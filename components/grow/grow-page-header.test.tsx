import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GrowPageHeader } from "./grow-page-header";

describe("GrowPageHeader", () => {
  it("provides a consistent page heading and action region", () => {
    render(<GrowPageHeader title="Customers" description="Manage customer permissions." actions={<button>Refresh</button>} />);

    expect(screen.getByRole("heading", { level: 1, name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("Manage customer permissions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
