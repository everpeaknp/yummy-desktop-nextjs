import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CheckoutWorkspaceHeader,
  CheckoutWorkspacePageOnly,
  CheckoutBillItemName,
  CheckoutBillRefreshStatus,
  OrderCheckoutWorkspace,
} from "./order-checkout-workspace";

it("keeps the quick checkout panel free of a redundant title and close header", () => {
  const onBackToOrder = vi.fn();
  render(
    <>
      <CheckoutWorkspaceHeader
        presentation="quick"
        onBackToOrder={onBackToOrder}
        pageHeader={<h1>Bill &amp; Payment</h1>}
      />
      <CheckoutWorkspacePageOnly presentation="quick">
        <div>Table bill switcher</div>
      </CheckoutWorkspacePageOnly>
    </>,
  );

  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Quick checkout" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Bill & Payment" })).not.toBeInTheDocument();
  expect(screen.queryByText("Table bill switcher")).not.toBeInTheDocument();
});

it("retains the page header and page-only order context in page mode", () => {
  render(
    <>
      <CheckoutWorkspaceHeader
        presentation="page"
        pageHeader={<h1>Bill &amp; Payment</h1>}
      />
      <CheckoutWorkspacePageOnly presentation="page">
        <div>Table bill switcher</div>
      </CheckoutWorkspacePageOnly>
    </>,
  );

  expect(screen.getByRole("heading", { name: "Bill & Payment" })).toBeInTheDocument();
  expect(screen.getByText("Table bill switcher")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
});

it("opens the shared order-line editor when a quick bill item is clicked", () => {
  const onEditOrderItem = vi.fn();
  render(
    <CheckoutBillItemName
      itemId={142}
      itemName="Classic Lemonade"
      presentation="quick"
      onEditOrderItem={onEditOrderItem}
    />,
  );

  screen.getByRole("button", { name: "Edit Classic Lemonade" }).click();
  expect(onEditOrderItem).toHaveBeenCalledWith(142);
});

it("forwards item-update revisions to the mounted checkout workspace", () => {
  const workspace = OrderCheckoutWorkspace({
    orderId: 51,
    presentation: "quick",
    billRefreshToken: 3,
  } as any);

  expect((workspace as any).props.billRefreshToken).toBe(3);
});


it("offers a retry when the quick bill refresh fails", () => {
  const onRetry = vi.fn();
  render(
    <CheckoutBillRefreshStatus
      pending={false}
      failed
      onRetry={onRetry}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "The bill could not be refreshed.",
  );
  screen.getByRole("button", { name: "Retry bill refresh" }).click();
  expect(onRetry).toHaveBeenCalledTimes(1);
});
