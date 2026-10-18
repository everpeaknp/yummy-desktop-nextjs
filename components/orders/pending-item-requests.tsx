"use client";
import { OrderRequestReview } from "./order-request-review";
type Request = Parameters<typeof OrderRequestReview>[0]["order"];
export function PendingItemRequests({ requests, canApprove, canReject, onResolved }: { requests: Request[]; canApprove: boolean; canReject: boolean; onResolved: () => Promise<void> }) {
  if (!requests.length) return null;
  return <section className="rounded-xl border border-border bg-card px-4 pt-4" aria-label="New items awaiting approval">
    <h3 className="text-sm font-semibold">New items awaiting approval <span className="text-primary">({requests.length})</span></h3>
    <p className="my-2 text-xs leading-5 text-muted-foreground">These items are not included in the accepted bill or sent to the kitchen yet.</p>
    {requests.map(request => <OrderRequestReview key={request.id} order={request} embedded canApprove={canApprove} canReject={canReject} onResolved={onResolved} />)}
  </section>;
}
