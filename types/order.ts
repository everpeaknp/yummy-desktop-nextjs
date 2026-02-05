export type OrderStatus = 'pending' | 'running' | 'scheduled' | 'preparing' | 'ready' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'canceled';
export type OrderType = 'quick_billing' | 'delivery' | 'pickup' | 'reservation' | 'table' | 'group' | 'online';

export interface OrderItem {
  id: number;
  item_name: string;
  quantity: number;
  price: number;
  unit_price: number;
  modifiers?: any[];
  notes?: string;
  status: string;
}

export interface Order {
  id: number;
  restaurant_order_id?: string;
  table_id?: number | null;
  table_name?: string;
  table_category_name?: string;
  channel: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  grand_total: number;
  created_at: string;
  number_of_guests?: number;
  customer_name?: string;
  waiter_name?: string;
}
