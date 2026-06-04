export type KotPrintItem = {
  id?: string | number;
  item_name?: string;
  name_snapshot?: string;
  name?: string;
  qty_change?: number;
  qty?: number;
  quantity?: number;
  deleted_qty?: number;
  is_deleted?: number;
  modifiers?: Array<{
    modifier_name_snapshot?: string;
    name?: string;
  }>;
  notes?: string | null;
  qty_for_print?: number;
};

export type KotPrintContext = {
  kot: any;
  order: any;
  restaurant: any;
  kotType: string;
  title: string;
  activeItems: KotPrintItem[];
  cancelledItems: KotPrintItem[];
  hasCancelledItems: boolean;
};

export function getKotItems(kot: any): KotPrintItem[] {
  return Array.isArray(kot?.items) ? kot.items : [];
}

export function getActiveKotItems(kot: any): KotPrintItem[] {
  return getKotItems(kot).filter((item) => {
    const qty = Number(item?.qty_change ?? item?.qty ?? item?.quantity ?? 0);
    return qty > 0 && Number(item?.is_deleted || 0) !== 1;
  });
}

export function getCancelledKotItems(kot: any): KotPrintItem[] {
  return getKotItems(kot)
    .filter((item) => {
      const qtyChange = Number(item?.qty_change ?? 0);
      const deletedQty = Number(item?.deleted_qty ?? 0);
      return deletedQty > 0 || Number(item?.is_deleted || 0) === 1 || qtyChange < 0;
    })
    .map((item) => ({
      ...item,
      qty_for_print:
        Number(item?.deleted_qty ?? 0) > 0
          ? Number(item.deleted_qty)
          : Math.abs(Number(item?.qty_change ?? item?.qty ?? item?.quantity ?? 0)),
    }));
}

export function getKotPrintContext(data: any): KotPrintContext {
  const kot = data?.kot || data;
  const order = data?.order || {};
  const restaurant = data?.restaurant || {};
  const activeItems = getActiveKotItems(kot);
  const cancelledItems = getCancelledKotItems(kot);
  const kotType = String(kot?.type || "").toUpperCase();
  const isRemoval =
    kotType === "REMOVE" ||
    kotType === "CANCEL" ||
    kotType === "CANCELLED" ||
    cancelledItems.length > 0;

  return {
    kot,
    order,
    restaurant,
    kotType,
    title: isRemoval ? "CANCEL ORDER" : kotType === "INITIAL" ? "NEW ORDER" : "ADD ORDER",
    activeItems,
    cancelledItems,
    hasCancelledItems: cancelledItems.length > 0,
  };
}
