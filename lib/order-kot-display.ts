import type { KOTItem, KOTUpdate } from "@/types/order";

export interface KOTItemDisplay {
  name: string;
  quantity: number;
  progressLabel: string | null;
}

export function getKOTHeading(kot: KOTUpdate): string {
  const ticketNumber = kot.kot_number?.trim();
  return ticketNumber ? `KOT ${ticketNumber}` : "Kitchen ticket";
}

export function getKOTItemDisplay(item: KOTItem): KOTItemDisplay {
  const name = item.item_name?.trim() || item.name_snapshot?.trim() || "Unnamed item";
  const recordedQuantity = Number(item.qty_change ?? item.qty ?? 0);
  const fallbackQuantity = Number(item.original_qty ?? item.deleted_qty ?? 0);
  const quantity = Math.abs(recordedQuantity || fallbackQuantity);
  const ready = Math.max(0, Number(item.qty_ready || 0));
  const served = Math.max(0, Number(item.qty_served ?? item.fulfilled_qty ?? 0));

  let progressLabel: string | null = null;
  if (served > 0) {
    progressLabel = `${served}/${quantity} served`;
  } else if (ready > 0) {
    progressLabel = `${ready}/${quantity} ready`;
  }

  return { name, quantity, progressLabel };
}
