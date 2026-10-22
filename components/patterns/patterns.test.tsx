// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdaptiveFloatingAction } from "./actions/adaptive-floating-action";
import { SearchField } from "./controls/search-field";
import { ResponsiveDataView } from "./data/responsive-data-view";
import { ListRow } from "./data/data-list";
import { MetricGrid } from "./data/metric-grid";
import { StatusBadge, statusToneFor } from "./feedback/status-badge";
import { SegmentedControl } from "./navigation/segmented-control";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shared web UI patterns", () => {
  it("exposes a clear action for a populated search", () => {
    const onClear = vi.fn();
    render(
      <SearchField value="momo" onChange={() => undefined} onClear={onClear} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders both the mobile representation and desktop table from one data source", () => {
    const rows = [{ id: 1, reference: "INV-1" }];
    render(
      <ResponsiveDataView
        data={rows}
        getKey={(row) => row.id}
        columns={[
          {
            key: "reference",
            header: "Reference",
            cell: (row) => row.reference,
          },
        ]}
        renderMobileItem={(row) => <div>Mobile {row.reference}</div>}
      />,
    );

    expect(screen.getByText("Mobile INV-1")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Reference" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "INV-1" })).toBeInTheDocument();
  });

  it("keeps the register-row composition through tablet unless a table is explicitly approved", () => {
    const { container } = render(
      <ResponsiveDataView
        data={[{ id: 1, reference: "INV-1" }]}
        getKey={(row) => row.id}
        columns={[
          {
            key: "reference",
            header: "Reference",
            cell: (row) => row.reference,
          },
        ]}
        renderMobileItem={(row) => <div>Mobile {row.reference}</div>}
      />,
    );

    expect(container.querySelector(".lg\\:hidden")).toBeInTheDocument();
    expect(container.querySelector(".lg\\:block")).toBeInTheDocument();
  });

  it("declares compact and financial metric density separately", () => {
    const { container, rerender } = render(<MetricGrid density="financial" />);
    expect(container.firstChild).toHaveClass("grid-cols-1");
    expect(container.firstChild).toHaveClass("min-[480px]:grid-cols-2");

    rerender(<MetricGrid density="compact" />);
    expect(container.firstChild).toHaveClass("min-[360px]:grid-cols-2");
  });

  it("compacts the adaptive action after its scroll threshold", () => {
    const main = document.createElement("main");
    document.body.appendChild(main);
    render(
      <AdaptiveFloatingAction
        label="New order"
        compactLabel="Create order"
        icon={<span>+</span>}
        onClick={() => undefined}
      />,
    );

    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      value: 100,
    });
    fireEvent.scroll(main);

    expect(screen.getByRole("button", { name: "Create order" })).toHaveClass(
      "w-12",
    );
  });

  it("exposes semantic status text without relying on colour", () => {
    render(<StatusBadge tone="warning">Pending</StatusBadge>);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(statusToneFor("Settled")).toBe("success");
    expect(statusToneFor("Debit")).toBe("neutral");
  });

  it("uses pressed semantics for a segmented dataset control", () => {
    render(
      <SegmentedControl
        ariaLabel="Inventory view"
        value="items"
        onValueChange={() => undefined}
        items={[
          { value: "items", label: "Items" },
          { value: "activity", label: "Activity" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Items" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps legacy row slots compatible with the shared row anatomy", () => {
    render(
      <ListRow
        icon={<span>Icon</span>}
        title="Adjustment"
        value={<span>NPR 730</span>}
        action={<button type="button">Open</button>}
      />,
    );

    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByText("NPR 730")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });
});
