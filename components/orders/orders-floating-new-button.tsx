import { Plus } from "lucide-react";
import { AdaptiveFloatingAction } from "@/components/patterns/actions/adaptive-floating-action";

export function OrdersFloatingNewButton() {
  return (
    <AdaptiveFloatingAction
      href="/orders/new"
      label="New order"
      compactLabel="Create a new order"
      icon={<Plus className="h-5 w-5" />}
    />
  );
}
