import { redirect } from "next/navigation";

// Supplier bills and their FIFO/manual settlement allocations now live in the
// supplier workspace. Preserve old links without preserving a second workflow.
export default function LegacyAwaitingPaymentsPage() {
  redirect("/suppliers");
}
