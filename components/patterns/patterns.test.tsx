// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdaptiveFloatingAction } from "./actions/adaptive-floating-action";
import { SearchField } from "./controls/search-field";
import { ResponsiveDataView } from "./data/responsive-data-view";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shared web UI patterns", () => {
  it("exposes a clear action for a populated search", () => {
    const onClear = vi.fn();
    render(<SearchField value="momo" onChange={() => undefined} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders both the mobile representation and desktop table from one data source", () => {
    const rows = [{ id: 1, reference: "INV-1" }];
    render(
      <ResponsiveDataView
        data={rows}
        getKey={(row) => row.id}
        columns={[{ key: "reference", header: "Reference", cell: (row) => row.reference }]}
        renderMobileItem={(row) => <div>Mobile {row.reference}</div>}
      />
    );

    expect(screen.getByText("Mobile INV-1")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reference" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "INV-1" })).toBeInTheDocument();
  });

  it("compacts the adaptive action after its scroll threshold", () => {
    const main = document.createElement("main");
    document.body.appendChild(main);
    render(<AdaptiveFloatingAction label="New order" compactLabel="Create order" icon={<span>+</span>} onClick={() => undefined} />);

    Object.defineProperty(main, "scrollTop", { configurable: true, value: 100 });
    fireEvent.scroll(main);

    expect(screen.getByRole("button", { name: "Create order" })).toHaveClass("w-12");
  });
});

