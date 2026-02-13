import { formatISO } from 'date-fns';

export const AuthApis = {
  register: '/users/',
  registerAdmin: '/users/admin/register',
  adminRegisterVerify: '/users/admin/register/verify',
  adminRegisterResend: '/users/admin/register/resend',
  userById: (id: string) => `/users/${id}`,
  updateUser: (id: number) => `/users/${id}`,
  login: '/auth/login',
  googleSignIn: '/auth/firebase/google',
  appleSignIn: '/auth/firebase/apple',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  listUsers: '/users/all',
  deleteUser: (id: number) => `/users/${id}`,
  forgotPassword: '/auth/forgot-password',
  verifyResetOtp: '/auth/verify-reset-otp',
  resetPassword: '/auth/reset-password',
  preferences: '/users/profile/preferences',
  updatePreferences: '/users/profile/preferences',
  deleteMe: '/users/me',
  changePassword: '/users/change-password',
};

export const DashboardApis = {
  dashboardData: (id: number) => `/admin/dashboard?restaurant_id=${id}`,
  dashboardDataV2: ({
    restaurantId,
    date,
    startTime,
    endTime,
  }: {
    restaurantId: number;
    date?: string;
    startTime?: Date;
    endTime?: Date;
  }) => {
    const params = new URLSearchParams();
    params.append('restaurant_id', restaurantId.toString());

    if (startTime) params.append('start_time', startTime.toISOString());
    if (endTime) params.append('end_time', endTime.toISOString());
    if (date && !startTime) params.append('date', date);

    const query = params.toString();
    return query ? `/admin/dashboard/v2?${query}` : '/admin/dashboard/v2';
  },
  dashboardDelta: ({ restaurantId, since }: { restaurantId: number; since: Date }) => {
    return `/admin/dashboard/v2/delta?restaurant_id=${restaurantId}&since=${since.toISOString()}`;
  }
};

export const OrderApis = {
  createOrder: '/orders/',
  getOrder: (id: number) => `/orders/${id}`,
  listOrders: '/orders/',
  activeOrders: '/orders/active',
  ordersSummary: '/orders/summary',
  getOrderFull: (id: number) => `/orders/${id}/full`,
  ordersSummaryPaginated: ({
    restaurantId,
    cursor,
    limit,
    channel,
    fields
  }: {
    restaurantId: number;
    cursor?: number;
    limit?: number;
    channel?: string;
    fields?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (cursor) params.append('cursor', cursor.toString());
    if (limit) params.append('limit', limit.toString());
    if (channel) params.append('channel', channel);
    if (fields) params.append('fields', fields);
    return `/orders/summary?${params.toString()}`;
  },
  addItemsToOrder: (id: number) => `/orders/${id}/items/bulk-add`,
  updateOrderItems: (id: number) => `/orders/${id}/items/bulk-update`,
  addPayment: (id: number) => `/orders/${id}/payments`,
  getOrderEvents: (id: number) => `/orders/${id}/events`,
  getOrderBill: (id: number) => `/orders/${id}/bill`,
  updateOrderStatus: (id: number) => `/orders/${id}/status`,
  updateOrder: (id: number) => `/orders/${id}`,
  activateReservation: (id: number) => `/orders/${id}/activate`,
  cancelOrder: (id: number) => `/orders/${id}/cancel`,
  refundOrder: (id: number) => `/orders/${id}/refund`,
};

export const PaymentApis = {
  fonepayQr: '/payments/fonepay/qr',
  fonepayStatus: (prn: string) => `/payments/fonepay/${encodeURIComponent(prn)}/status`,
};

export const MenuApis = {
  getMenusByRestaurant: (restaurantId: number, itemCategoryId?: number) => {
    const params = new URLSearchParams();
    if (itemCategoryId) params.append('item_category_id', itemCategoryId.toString());
    const query = params.toString();
    return query ? `/menus/restaurant/${restaurantId}?${query}` : `/menus/restaurant/${restaurantId}`;
  },
  getMenusGroupedByRestaurant: (restaurantId: number) => `/menus/restaurant/${restaurantId}/grouped`,
  menuSummary: (restaurantId: number, { categoryId, fields }: { categoryId?: number; fields?: string } = {}) => {
    const params = new URLSearchParams();
    if (categoryId) params.append('item_category_id', categoryId.toString());
    if (fields) params.append('fields', fields);
    const query = params.toString();
    return query ? `/menus/restaurant/${restaurantId}/summary?${query}` : `/menus/restaurant/${restaurantId}/summary`;
  },
  createMenu: (restaurantId: number) => `/menus/${restaurantId}`,
  updateMenu: (id: number) => `/menus/${id}`,
  deleteMenu: (id: number) => `/menus/${id}`,
};

export const TableApis = {
  createTable: (restaurantId: number) => `/restaurants/tables/${restaurantId}`,
  updateTable: (tableId: number) => `/restaurants/tables/${tableId}`,
  getTables: (restaurantId: number) => `/restaurants/tables/all/${restaurantId}`,
  tableSummary: (restaurantId: number, fields?: string) => {
    const base = `/restaurants/tables/summary/${restaurantId}`;
    return fields ? `${base}?fields=${encodeURIComponent(fields)}` : base;
  },
  getTableById: (tableId: number) => `/restaurants/tables/single/${tableId}`,
  deleteTable: (tableId: number) => `/restaurants/tables/${tableId}`,
  freeTable: (tableId: number) => `/restaurants/tables/${tableId}/free`,
};

export const TableTypeApis = {
  getTableTypes: (restaurantId: number) => `/restaurants/table-types/${restaurantId}`,
  createTableType: (restaurantId: number) => `/restaurants/table-types/${restaurantId}`,
  updateTableType: (tableTypeId: number) => `/restaurants/table-types/${tableTypeId}`,
  deleteTableType: (tableTypeId: number) => `/restaurants/table-types/${tableTypeId}`,
};

export const CustomerApis = {
  listCustomers: (restaurantId: number) => `/customers?restaurant_id=${restaurantId}`,
  getCustomer: (id: number) => `/customers/${id}`,
  createCustomer: '/customers',
  updateCustomer: (id: number) => `/customers/${id}`,
  deleteCustomer: (id: number) => `/customers/${id}`,
  redeemLoyaltyPoints: (id: number) => `/customers/${id}/loyalty/redeem`,
  repayCredit: (id: number) => `/customers/${id}/credit/repay`,
  getCreditHistory: (id: number) => `/customers/${id}/credit/history`,
};

export const InventoryApis = {
  listInventory: '/inventory/items',
  listInventoryWithQuery: ({
    restaurantId,
    isActive,
    lowStockOnly = false,
    skip = 0,
    limit = 100,
    include,
    station,
  }: {
    restaurantId: number;
    isActive?: boolean;
    lowStockOnly?: boolean;
    skip?: number;
    limit?: number;
    include?: string;
    station?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      low_stock_only: lowStockOnly.toString(),
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (isActive !== undefined) params.append('is_active', isActive.toString());
    if (include) params.append('include', include);
    if (station) params.append('station', station);
    return `/inventory/items?${params.toString()}`;
  },
  getInventoryItem: (id: number) => `/inventory/items/${id}`,
  createInventoryItem: '/inventory/items',
  updateInventoryItem: (id: number) => `/inventory/items/${id}`,
  deleteInventoryItem: (id: number) => `/inventory/items/${id}`,
  lowStockInventory: '/inventory/items/low-stock',
  adjustInventory: (id: number) => `/inventory/items/${id}/adjust`,
  getAdjustments: (id: number) => `/inventory/items/${id}/adjustments`,
  getAdjustment: (id: number) => `/inventory/adjustments/${id}`,
  markAdjustmentPayment: (id: number) => `/inventory/adjustments/${id}/payment`,
  rejectAdjustmentPayment: (id: number) => `/inventory/adjustments/${id}/reject`,
  getLedger: ({ itemId, skip = 0, limit = 100, timezone }: { itemId: number; skip?: number; limit?: number; timezone?: string }) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (timezone) params.append('timezone', timezone);
    return `/inventory/items/${itemId}/ledger?${params.toString()}`;
  },
  linkMenuInventory: '/inventory/menu-link',
  unlinkMenuInventory: (linkId: number) => `/inventory/menu-link/${linkId}`,
  getMenuInventory: (menuItemId: number) => `/inventory/menu/${menuItemId}`,
  awaitingPayments: '/awaiting-payments',
  awaitingPaymentById: (id: number) => `/awaiting-payments/${id}`,
  markAwaitingPaymentPaid: (id: number) => `/awaiting-payments/${id}/mark-paid`,
  rejectAwaitingPayment: (id: number) => `/awaiting-payments/${id}/reject`,
};

export const AnalyticsApis = {
  dashboard: ({
    restaurantId,
    dateFrom,
    dateTo,
    startTime,
    endTime,
    timezone,
    station,
  }: {
    restaurantId: number;
    dateFrom?: string;
    dateTo?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    station?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (startTime && endTime) {
      params.append('start_time', startTime);
      params.append('end_time', endTime);
    } else {
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
    }
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    return `/analytics/dashboard?${params.toString()}`;
  },
  overview: ({ restaurantId, dateFrom, dateTo, timezone, station }: any) => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    const query = params.toString();
    return query ? `/analytics/overview?${query}` : '/analytics/overview';
  },
  trends: ({ metric, restaurantId, dateFrom, dateTo, timezone, station }: any) => {
    const params = new URLSearchParams({ metric });
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    return `/analytics/trends?${params.toString()}`;
  },
  breakdown: ({ type, restaurantId, dateFrom, dateTo, timezone, station }: any) => {
    const params = new URLSearchParams({ type });
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    return `/analytics/breakdown?${params.toString()}`;
  },
};

export const ItemCategoryApis = {
  getItemCategories: (restaurantId: number) => `/item-categories/restaurant/${restaurantId}`,
  createItemCategory: (restaurantId: number) => `/item-categories/${restaurantId}`,
  updateItemCategory: (id: number) => `/item-categories/${id}`,
  deleteItemCategory: (id: number) => `/item-categories/${id}`,
};

export const ExpenseApis = {
  list: '/expenses/',
  summaryTotal: '/expenses/summary/total',
  pendingCandidates: '/expenses/candidates',
  approveCandidate: (id: number) => `/expenses/candidates/${id}/approve`,
  rejectCandidate: (id: number) => `/expenses/candidates/${id}/reject`,
  expenseDetail: (id: number) => `/expenses/${id}`,
  expenseCategories: '/expenses/categories',
  createExpenseCategory: '/expenses/categories',
  updateExpenseCategory: (id: number) => `/expenses/categories/${id}`,
  deleteExpenseCategory: (id: number) => `/expenses/categories/${id}`,
};

export const IncomeApis = {
  summary: '/income/summary',
  recent: '/income/recent',
  bySource: '/income/by-source',
  byPaymentMethod: '/income/by-payment-method',
  manual: '/income/manual',
  dashboard: ({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    station,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    station?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    return `/income/dashboard?${params.toString()}`;
  },
};

export const KotApis = {
  getKotById: (kotId: number) => `/kots/${kotId}`,
  getKotUpdatesByOrder: (orderId: number) => `/kots/orders/${orderId}`,
  getKotUpdatesByTable: (tableId: number) => `/kots/tables/${tableId}`,
  getKotUpdatesByRestaurant: (restaurantId: number) => `/kots/restaurants/${restaurantId}`,
  searchKots: '/kots/search',
  updateKotStatus: (kotId: number) => `/kots/${kotId}/status`,
  updateKotItemFulfillment: (kotId: number, itemId: number) => `/kots/${kotId}/items/${itemId}/fulfillment`,
  markKotItemAll: (kotId: number, itemId: number) => `/kots/${kotId}/items/${itemId}/fulfillment/mark-all`,
  markAllKotItems: (kotId: number) => `/kots/${kotId}/fulfillment/mark-all`,
  rejectKot: (kotId: number) => `/kots/${kotId}/reject`,
  rejectKotItem: (kotId: number, itemId: number) => `/kots/${kotId}/items/${itemId}/reject`,
  acceptKotItem: (kotId: number, itemId: number) => `/kots/${kotId}/items/${itemId}/accept`,
  getKotActivity: (kotId: number) => `/kots/${kotId}/activity`,
  markKotAutoPrinted: (kotId: number) => `/kots/${kotId}/mark-auto-printed`,
  releaseKotAutoPrinted: (kotId: number) => `/kots/${kotId}/release-auto-printed`,
  requestFallback: (kotId: number, canPrint = true) => `/kots/${kotId}/request-fallback?can_print=${canPrint}`,
};

export const ReceiptApis = {
  getReceiptData: (orderId: number) => `/receipts/orders/${orderId}/data`,
};

export const ModifierApis = {
  listGroups: (restaurantId: number) => `/modifiers/groups?restaurant_id=${restaurantId}`,
  createGroup: '/modifiers/groups',
  getGroup: (groupId: number) => `/modifiers/groups/${groupId}`,
  updateGroup: (groupId: number) => `/modifiers/groups/${groupId}`,
  deleteGroup: (groupId: number) => `/modifiers/groups/${groupId}`,
  listItemsByGroup: (groupId: number) => `/modifiers/groups/${groupId}/modifiers`,
  listItems: '/modifiers',
  createItem: '/modifiers',
  getItem: (itemId: number) => `/modifiers/${itemId}`,
  updateItem: (itemId: number) => `/modifiers/${itemId}`,
  deleteItem: (itemId: number) => `/modifiers/${itemId}`,
};

export const DiscountApis = {
  listDiscountsForRestaurant: (restaurantId: number) => `/discounts/restaurant/${restaurantId}`,
  getDiscount: (id: number) => `/discounts/${id}`,
  createDiscount: '/discounts/',
  updateDiscount: (id: number) => `/discounts/${id}`,
  deleteDiscount: (id: number) => `/discounts/${id}`,
  getDiscountByCode: (restaurantId: number, code: string) => `/discounts/restaurant/${restaurantId}/code/${code}`,
};

export const ReservationApis = {
  // Aligning with Flutter: Use /orders endpoints for all reservation actions
  listReservations: (restaurantId: number) => `/orders?restaurant_id=${restaurantId}&channel=reservation`,
  getReservation: (id: number) => `/orders/${id}`,
  createReservation: '/orders/',
  updateReservation: (id: number) => `/orders/${id}`,
  deleteReservation: (id: number) => `/orders/${id}`,
  // Status updates via /orders/{id}/status
  confirmReservation: (id: number) => `/orders/${id}/status`,
  seatReservation: (id: number) => `/orders/${id}/activate`,
  completeReservation: (id: number) => `/orders/${id}/status`,
  cancelReservation: (id: number) => `/orders/${id}/cancel`,
  noShowReservation: (id: number) => `/orders/${id}/status`,
};

export const NotificationApis = {
  list: ({
    restaurantId,
    type,
    status,
    skip = 0,
    limit = 100,
  }: {
    restaurantId?: number;
    type?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    return `/notifications?${params.toString()}`;
  },
  unreadCount: (restaurantId?: number) => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    return `/notifications/unread-count?${params.toString()}`;
  },
  markRead: '/notifications/read',
};

export const DayCloseApis = {
  current: '/day-closes/current',
  validateClose: '/day-closes/validate-close',
  initiate: '/day-closes/initiate',
  generateSnapshot: '/day-closes/generate-snapshot',
  confirm: (id: number) => `/day-closes/${id}/confirm`,
  cancel: (id: number) => `/day-closes/${id}/cancel`,
  list: ({ restaurantId, start, end, status }: { restaurantId?: number; start?: string; end?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (start) params.append('date_from', start);
    if (end) params.append('date_to', end);
    if (status) params.append('status', status);
    const query = params.toString();
    return query ? `/day-closes?${query}` : '/day-closes';
  },
  detail: (id: number) => `/day-closes/${id}`,
  auditLog: (id: number) => `/day-closes/${id}/audit-log`,
  savedSnapshot: (id: number) => `/day-closes/${id}/snapshot`,
  reopen: (id: number) => `/day-closes/${id}/reopen`,
};

export const HistoryApis = {
  listAuditLogs: (params: string) => `/history/audit-logs?${params}`,
  listUserActivity: (userId: number) => `/history/activity/user/${userId}`,
  listActivityByDate: (params: string) => `/history/activity?${params}`,
};

export const SupplierApis = {
  listSuppliers: (restaurantId: number, isActive?: boolean) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (isActive !== undefined) params.append('is_active', isActive.toString());
    return `/suppliers?${params.toString()}`;
  },
  getSupplier: (id: number, restaurantId: number) => `/suppliers/${id}?restaurant_id=${restaurantId}`,
  createSupplier: '/suppliers',
  updateSupplier: (id: number, restaurantId: number) => `/suppliers/${id}?restaurant_id=${restaurantId}`,
  deleteSupplier: (id: number, restaurantId: number) => `/suppliers/${id}?restaurant_id=${restaurantId}`,
};
