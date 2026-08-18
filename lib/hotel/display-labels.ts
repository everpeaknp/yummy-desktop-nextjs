const labels: Record<string, string> = {
  active: "Active",
  assigned: "Assigned",
  blocked: "Needs attention",
  canceled: "Cancelled",
  closed: "Closed",
  dirty: "Needs cleaning",
  in_house: "Staying",
  due_out: "Leaving today",
  checked_in: "Checked in",
  checked_out: "Checked out",
  no_show: "Did not arrive",
  out_of_service: "Unavailable",
  out_of_order: "Needs repair",
  in_service: "Available",
  in_progress: "In progress",
  inspected: "Ready",
  held: "On hold",
  planned: "Scheduled",
  preview: "Ready to close",
  released: "Stay ended",
  reserved: "Reserved",
  unsettled: "In progress",
  paid_now: "Paid separately",
  posted_to_folio: "Included in guest bill",
  settlement_pending: "Payment needed",
  voided: "Cancelled",
  settled: "Paid",
  expected_arrivals_remaining: "Arrivals still expected",
  occupied_rooms: "Occupied rooms",
  unsettled_departures: "Departures awaiting payment",
  no_shows_processed: "Missed arrivals updated",
  room_revenue_posted: "Room charges added",
  unsettled_departure: "Guest bill must be paid",
  attention_required: "Needs attention",
  room_only: "Room only",
  half_board: "Breakfast and one meal",
  full_board: "All meals included",
};

export function humanizeHotelStatus(value: string): string {
  return labels[value] ?? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function roomServiceStatusLabel(input: {
  status: string;
  settlementStatus: string;
}): string {
  if (input.status === "canceled" || input.settlementStatus === "voided") return "Cancelled";
  if (input.settlementStatus === "posted_to_folio") return "Included in guest bill";
  if (input.settlementStatus === "paid_now") return "Paid separately";
  if (input.status === "completed") return "Delivered";
  if (input.status === "ready") return "Ready for delivery";
  if (input.status === "preparing") return "Being prepared";
  return "Order received";
}
