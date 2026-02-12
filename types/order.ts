export type OrderStatus = 'pending' | 'running' | 'scheduled' | 'preparing' | 'ready' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'canceled';
export type OrderType = 'quick_billing' | 'delivery' | 'pickup' | 'reservation' | 'table' | 'group' | 'online';
export type PaymentMethod = 'cash' | 'card' | 'digital' | 'credit';
export type PaymentStatus = 'success' | 'pending' | 'failed' | 'refunded';

export interface OrderItemModifier {
  id: number;
  modifier_id: number | null;
  modifier_name_snapshot: string;
  price_adjustment_snapshot: number;
}

export interface OrderItem {
  id: number;
  menu_item_id: number | null;
  name_snapshot: string;
  item_name?: string; // legacy alias
  category_name_snapshot?: string | null;
  category_type_snapshot?: string | null;
  unit_price: number;
  qty: number;
  quantity?: number; // legacy alias
  line_total: number;
  price?: number; // legacy alias
  notes?: string | null;
  modifiers: OrderItemModifier[];
  created_at: string;
  pre_tax_unit_price?: number | null;
  tax_per_unit?: number | null;
  status?: string;
}

export interface OrderPayment {
  id: number;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  status: PaymentStatus;
  created_at: string | null;
}

export interface Order {
  id: number;
  restaurant_id: number;
  restaurant_order_id?: number | null;
  channel: OrderType;
  status: OrderStatus;
  table_id?: number | null;
  table_name?: string | null;
  table_category_name?: string | null;
  number_of_guests?: number | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  waiter_name?: string | null;
  notes?: string | null;
  subtotal: number;
  tax_total: number;
  service_charge: number;
  discount_total: number;
  manual_discount_amount: number;
  grand_total: number;
  created_at: string;
  updated_at: string;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  created_by_name?: string | null;
}

// ── Order Full Context (from /orders/{id}/full) ─────
export interface OrderTableSummary {
  id: number;
  name: string | null;
  status: string | null;
  capacity: number | null;
  table_type_id: number | null;
}

export interface KOTItem {
  id: number;
  menu_item_id?: number | null;
  name_snapshot: string;
  qty: number;
  fulfilled_qty?: number;
  status?: string;
  notes?: string | null;
  modifiers?: OrderItemModifier[];
}

export interface KOTUpdate {
  id: number;
  order_id: number;
  type: string;
  station: string;
  status: string;
  items: KOTItem[];
  created_at: string;
  updated_at?: string | null;
  auto_printed?: boolean;
}

export interface OrderFullContext {
  order: Order;
  tables: OrderTableSummary[];
  kots: KOTUpdate[];
  payments: OrderPayment[];
}

// ── Order Bill (from /orders/{id}/bill) ─────────────
export interface OrderBill {
  order_id: number;
  items: OrderItem[];
  payments: OrderPayment[];
  subtotal: number;
  tax_total: number;
  service_charge: number;
  discount_total: number;
  manual_discount_amount: number;
  grand_total: number;
  total_paid: number;
  balance_due: number;
  is_fully_paid: boolean;
  subtotal_pre_tax: number | null;
  tax_breakdown_note: string | null;
}

// ── Order Events (from /orders/{id}/events) ─────────
export interface OrderEventActor {
  id: number | null;
  name: string | null;
  email: string | null;
}

export interface OrderEvent {
  id: number;
  event: string;
  title: string;
  result: string;
  triggered_by: OrderEventActor;
  triggered_at: string | null;
  details: Record<string, any> | null;
}

// ── Payment Response (from POST /orders/{id}/payments) ──
export interface OrderPaymentResponse {
  payment: OrderPayment;
  order: Order;
  payment_complete: boolean;
  table_freed: boolean;
  table_id: number | null;
  table_status: string | null;
}

// ── Receipt Data (from /receipts/orders/{id}/data) ──
export interface RestaurantInfo {
  id: number;
  name: string;
  address: string;
  phone: string;
  description?: string | null;
  profile_picture?: string | null;
  pan_number?: string | null;
  timezone: string;
  tax_enabled: boolean;
  payment_qrs?: { name: string; payload: string }[] | null;
  fonepay_enabled?: boolean;
}

export interface PrinterConfig {
  id: number;
  name: string;
  type: string;
  address?: string | null;
  port?: number | null;
}

export interface ReceiptData {
  order: Order;
  restaurant: RestaurantInfo;
  total_paid: number;
  balance_due: number;
  is_fully_paid: boolean;
  subtotal_pre_tax: number | null;
  should_auto_print: boolean;
  printer_config: PrinterConfig | null;
}
