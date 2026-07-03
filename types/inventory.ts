export type InventoryConsumptionPurpose =
  | 'preparation'
  | 'staff_meal'
  | 'complimentary'
  | 'testing'
  | 'other';

export type InventoryConsumptionLineInput = {
  inventory_item_id: number;
  quantity: number;
};

export type InventoryConsumptionRequest = {
  restaurant_id: number;
  idempotency_key: string;
  purpose: InventoryConsumptionPurpose;
  note?: string;
  allow_negative: boolean;
  lines: InventoryConsumptionLineInput[];
};

export type InventoryConsumptionLine = {
  inventory_item_id: number;
  item_name: string;
  unit: string;
  quantity: number;
  previous_stock: number;
  resulting_stock: number;
  accounting_treatment: 'inventory_asset' | 'direct_expense';
  operational_unit_cost: number;
  book_unit_cost: number;
  cogs_amount: number;
  is_negative: boolean;
};

export type InventoryConsumptionResult = {
  batch_id?: number | null;
  restaurant_id: number;
  idempotency_key: string;
  purpose: InventoryConsumptionPurpose;
  note?: string | null;
  cogs_total: number;
  has_negative_stock: boolean;
  lines: InventoryConsumptionLine[];
};
