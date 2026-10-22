"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import POSSystem from "@/components/orders/pos-system";
import { EntitlementGate } from "@/components/subscription/entitlement-gate";

function CreateOrderContent() {
  const searchParams = useSearchParams();
  const channel = (searchParams?.get("channel") || "table").toLowerCase();
  const stayAssignment = Number(searchParams?.get("stay_assignment") || 0) || undefined;
  const roomNumber = searchParams?.get("room") || undefined;
  const guestName = searchParams?.get("guest") || undefined;
  const entitlement =
    channel === "delivery"
      ? "orders.delivery.enabled"
      : ["pickup", "takeaway", "quick_bill", "quick_billing"].includes(channel)
        ? "orders.takeaway.enabled"
        : channel === "room_service"
          ? "business.hotel.enabled"
          : "orders.dine_in.enabled";

  return (
    <EntitlementGate entitlement={entitlement} legacyFallback>
      <POSSystem
        orderId="create"
        defaultChannel={channel}
        hotelStayRoomAssignmentId={stayAssignment}
        roomOrderLabel={roomNumber ? `Room ${roomNumber}${guestName ? ` · ${guestName}` : ""}` : undefined}
      />
    </EntitlementGate>
  );
}

export default function CreateOrderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateOrderContent />
    </Suspense>
  );
}
