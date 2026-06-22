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
  meProfile: '/users/me/profile',
  preferences: '/users/profile/preferences',
  updatePreferences: '/users/profile/preferences',
  deleteMe: '/users/me',
  changePassword: '/users/change-password',
  listPermissions: '/users/permissions',
  updateUserPermissions: (id: number | string) => `/users/${id}/permissions/`,
  uploadProfilePicture: '/users/me/profile-picture',
};

export const UserAccessScopeApis = {
  list: (userId: number | string) => `/users/${userId}/access-scopes/`,
  upsert: (userId: number | string, scopeKey: string) => `/users/${userId}/access-scopes/${encodeURIComponent(scopeKey)}/`,
  remove: (userId: number | string, scopeKey: string) => `/users/${userId}/access-scopes/${encodeURIComponent(scopeKey)}/`,
};

export const RoleApis = {
  listPermissions: '/roles/permissions',
  // Avoid trailing-slash redirects in Next dev (/api/proxy/roles/ -> 308 -> /api/proxy/roles),
  // which can cause Authorization to be dropped and roles to appear as "Loading...".
  listRoles: '/roles/',
  // Optional: some backends expose built-in/system roles separately.
  listBuiltInRoles: '/roles/built-in',
  createRole: '/roles',
  updateRole: (id: number) => `/roles/${id}`,
  deleteRole: (id: number) => `/roles/${id}`,
};

export const DashboardApis = {
  dashboardData: (id: number) => `/admin/dashboard?restaurant_id=${id}`,
  dashboardDataV2: ({
    restaurantId,
    date,
    startTime,
    endTime,
    timezone,
    businessLine,
  }: {
    restaurantId: number;
    date?: string;
    startTime?: string | Date;
    endTime?: string | Date;
    timezone?: string;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams();
    params.append('restaurant_id', restaurantId.toString());

    if (startTime) {
      const startStr = typeof startTime === 'string' ? startTime : startTime.toISOString();
      params.append('start_time', startStr);
    }
    if (endTime) {
      const endStr = typeof endTime === 'string' ? endTime : endTime.toISOString();
      params.append('end_time', endStr);
    }
    if (date && !startTime) params.append('date', date);
    if (timezone) params.append('timezone', timezone);
    if (businessLine) params.append('business_line', businessLine);

    const query = params.toString();
    return query ? `/admin/dashboard/v2?${query}` : '/admin/dashboard/v2';
  },
  dashboardDelta: ({
    restaurantId,
    since,
    businessLine,
    timezone,
    date,
    startTime,
    endTime,
  }: {
    restaurantId: number;
    since: string | Date;
    businessLine?: string;
    timezone?: string;
    date?: string;
    startTime?: string | Date;
    endTime?: string | Date;
  }) => {
    const params = new URLSearchParams();
    params.append('restaurant_id', restaurantId.toString());
    
    const sinceStr = typeof since === 'string' ? since : since.toISOString();
    params.append('since', sinceStr);

    if (businessLine) params.append('business_line', businessLine);
    if (timezone) params.append('timezone', timezone);
    if (date) params.append('date', date);
    if (startTime) {
      const startStr = typeof startTime === 'string' ? startTime : startTime.toISOString();
      params.append('start_time', startStr);
    }
    if (endTime) {
      const endStr = typeof endTime === 'string' ? endTime : endTime.toISOString();
      params.append('end_time', endStr);
    }

    return `/admin/dashboard/v2/delta?${params.toString()}`;
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
  updatePayment: (orderId: number, paymentId: number) => `/orders/${orderId}/payments/${paymentId}`,
  removePayment: (orderId: number, paymentId: number) => `/orders/${orderId}/payments/${paymentId}`,
  getOrderEvents: (id: number) => `/orders/${id}/events`,
  getOrderBill: (id: number) => `/orders/${id}/bill`,
  updateOrderStatus: (id: number) => `/orders/${id}/status`,
  updateOrder: (id: number) => `/orders/${id}`,
  activateReservation: (id: number) => `/orders/${id}/activate`,
  cancelOrder: (id: number) => `/orders/${id}/cancel`,
  refundOrder: (id: number) => `/orders/${id}/refund`,
  checkinRoom: '/orders/room/checkin',
  
  // Guest Bill / Split Bill helpers
  getGuestBills: (orderId: number) => `/orders/${orderId}/guest-bills`,
  splitBill: (orderId: number) => `/orders/${orderId}/split-bill`,
  payAllGuestBills: (orderId: number) => `/orders/${orderId}/guest-bills/pay-all`,
  transferGuestBillItem: (orderId: number) => `/orders/${orderId}/guest-bills/transfer-item`,
  mergeGuestBills: (orderId: number) => `/orders/${orderId}/guest-bills/merge`,
  cancelGuestBillSplit: (orderId: number) => `/orders/${orderId}/guest-bills/cancel-split`,
  transferGuestBillTable: (orderId: number) => `/orders/${orderId}/guest-bills/transfer-table`,
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
  upload: '/menus/upload',
};

export const TableApis = {
  createTable: (restaurantId: number) => `/restaurants/tables/${restaurantId}`,
  updateTable: (tableId: number) => `/restaurants/tables/${tableId}`,
  getTables: (restaurantId: number, spaceKind?: string) => {
    const base = `/restaurants/tables/all/${restaurantId}`;
    return spaceKind ? `${base}?space_kind=${spaceKind}` : base;
  },
  tableSummary: (restaurantId: number, fields?: string, spaceKind?: string) => {
    const params = new URLSearchParams();
    if (fields) params.append('fields', fields);
    if (spaceKind) params.append('space_kind', spaceKind);
    const query = params.toString();
    return query ? `/restaurants/tables/summary/${restaurantId}?${query}` : `/restaurants/tables/summary/${restaurantId}`;
  },
  getTableById: (tableId: number) => `/restaurants/tables/single/${tableId}`,
  deleteTable: (tableId: number) => `/restaurants/tables/${tableId}`,
  freeTable: (tableId: number) => `/restaurants/tables/${tableId}/free`,
  qrGenerate: (tableId: number) => `/qr/tables/${tableId}/generate`,
};

export const TableTypeApis = {
  getTableTypes: (restaurantId: number, spaceKind?: string) => {
    const base = `/restaurants/table-types/${restaurantId}`;
    return spaceKind ? `${base}?space_kind=${spaceKind}` : base;
  },
  createTableType: (restaurantId: number) => `/restaurants/table-types/${restaurantId}`,
  updateTableType: (tableTypeId: number) => `/restaurants/table-types/${tableTypeId}`,
  deleteTableType: (tableTypeId: number) => `/restaurants/table-types/${tableTypeId}`,
};

export const RestaurantApis = {
  getById: (id: number) => `/restaurants/${id}`,
  update: (id: number) => `/restaurants/${id}`,
  getByUser: '/restaurants/by-user',
  updateFonepay: (id: number) => `/restaurants/${id}/fonepay-config`,
  getTemplates: (id: number) => `/restaurants/${id}/templates`,
  updateTemplates: (id: number) => `/restaurants/${id}/templates`,
  upload: '/restaurants/upload',
};

export const AdminManagementApis = {
  restaurantAdmins: (restaurantId: number) => `/restaurant/${restaurantId}/admins`,
  removeAdmin: (restaurantId: number, userId: number) => `/restaurant/${restaurantId}/admins/${userId}`,
  userRestaurants: `/users/me/restaurants`,
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
  // Modifier <-> inventory linking (used to deduct inventory when a modifier is applied).
  linkModifierInventory: '/inventory/modifier-link',
  unlinkModifierInventory: (linkId: number) => `/inventory/modifier-link/${linkId}`,
  getInventoryForModifier: (modifierId: number) => `/inventory/modifier/${modifierId}`,
  awaitingPayments: '/awaiting-payments',
  awaitingPaymentById: (id: number) => `/awaiting-payments/${id}`,
  markAwaitingPaymentPaid: (id: number) => `/awaiting-payments/${id}/mark-paid`,
  rejectAwaitingPayment: (id: number) => `/awaiting-payments/${id}/reject`,
};

export const AwaitingPaymentApis = {
  list: (restaurantId: number, params: any) => {
    const qv = new URLSearchParams({ restaurant_id: restaurantId.toString(), ...params });
    return `/awaiting-payments?${qv.toString()}`;
  },
  markPaid: (id: number, restaurantId: number) => `/awaiting-payments/${id}/mark-paid?restaurant_id=${restaurantId}`,
  reject: (id: number, restaurantId: number) => `/awaiting-payments/${id}/reject?restaurant_id=${restaurantId}`,
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
    businessLine,
    include,
  }: {
    restaurantId: number;
    dateFrom?: string;
    dateTo?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    station?: string;
    businessLine?: string;
    include?: string;
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
    if (businessLine) params.append('business_line', businessLine);
    if (include) params.append('include', include);
    return `/analytics/dashboard?${params.toString()}`;
  },
  compare: ({
    restaurantId,
    dateFrom,
    dateTo,
    startTime,
    endTime,
    timezone,
    station,
    businessLine,
  }: {
    restaurantId: number;
    dateFrom?: string;
    dateTo?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    station?: string;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (startTime) params.append('start_time', startTime);
    if (endTime) params.append('end_time', endTime);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    if (businessLine) params.append('business_line', businessLine);
    return `/analytics/compare?${params.toString()}`;
  },
  menuDetails: ({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    page = 1,
    pageSize = 20,
    sortBy = 'revenue',
    sortDir = 'desc',
    search,
    category,
    businessLine,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'revenue' | 'quantity_sold' | 'name' | 'avg_price' | string;
    sortDir?: 'asc' | 'desc' | string;
    search?: string;
    category?: string;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
      page: page.toString(),
      page_size: pageSize.toString(),
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    if (timezone) params.append('timezone', timezone);
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (businessLine) params.append('business_line', businessLine);
    return `/analytics/menu/details?${params.toString()}`;
  },
  staffDetails: ({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    page = 1,
    pageSize = 20,
    businessLine,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    page?: number;
    pageSize?: number;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (timezone) params.append('timezone', timezone);
    if (businessLine) params.append('business_line', businessLine);
    return `/analytics/staff/details?${params.toString()}`;
  },
  ncOrders: ({
    restaurantId,
    dateFrom,
    dateTo,
    startTime,
    endTime,
    timezone,
    businessLine,
    skip = 0,
    limit = 20,
  }: {
    restaurantId: number;
    dateFrom?: string;
    dateTo?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    businessLine?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (startTime && endTime) {
      params.append('start_time', startTime);
      params.append('end_time', endTime);
    } else {
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
    }
    if (timezone) params.append('timezone', timezone);
    if (businessLine) params.append('business_line', businessLine);
    return `/analytics/nc/orders?${params.toString()}`;
  },
  kitchenDetails: ({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    page = 1,
    pageSize = 20,
    businessLine,
    category,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    page?: number;
    pageSize?: number;
    businessLine?: string;
    category?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (timezone) params.append('timezone', timezone);
    if (businessLine) params.append('business_line', businessLine);
    if (category) params.append('category', category);
    return `/analytics/kitchen/details?${params.toString()}`;
  },
  inventoryDetails: ({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    page = 1,
    pageSize = 20,
    view = 'item',
    businessLine,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    page?: number;
    pageSize?: number;
    view?: 'item' | 'category' | string;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
      page: page.toString(),
      page_size: pageSize.toString(),
      view,
    });
    if (timezone) params.append('timezone', timezone);
    if (businessLine) params.append('business_line', businessLine);
    return `/analytics/inventory/details?${params.toString()}`;
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
  trends: ({ metric, restaurantId, dateFrom, dateTo, startTime, endTime, timezone, station }: any) => {
    const params = new URLSearchParams({ metric });
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (startTime) params.append('start_time', startTime);
    if (endTime) params.append('end_time', endTime);
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
  update: (id: number) => `/expenses/${id}`,
  delete: (id: number) => `/expenses/${id}`,
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
    businessLine,
  }: {
    restaurantId: number;
    dateFrom: string;
    dateTo: string;
    timezone?: string;
    station?: string;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (timezone) params.append('timezone', timezone);
    if (station) params.append('station', station);
    if (businessLine) params.append('business_line', businessLine);
    return `/income/dashboard?${params.toString()}`;
  },
};

type FinanceCoreParams = {
  restaurantId: number;
  dateFrom?: string;
  dateTo?: string;
  timezone?: string;
  businessLine?: string;
  station?: string;
  startTime?: string;
  endTime?: string;
};

type FinanceTransactionParams = FinanceCoreParams & {
  eventType?: string;
  limit?: number;
  offset?: number;
};

type FinanceReportParams = FinanceCoreParams & {
  paymentMethod?: string;
  instrumentType?: string;
  instrumentName?: string;
  customerId?: number;
  billNumber?: string;
  limit?: number;
  offset?: number;
};

type AccountingCoreParams = Pick<
  FinanceCoreParams,
  'restaurantId' | 'dateFrom' | 'dateTo' | 'businessLine' | 'timezone' | 'station'
>;

type AccountingLedgerParams = AccountingCoreParams & {
  customerId?: number;
  supplierId?: number;
  asOf?: string;
};

type AccountingDaybookParams = AccountingCoreParams & {
  businessDate: string;
};

type AccountingSettlementParams = Pick<AccountingCoreParams, 'restaurantId' | 'dateFrom' | 'dateTo'> & {
  paymentMethod?: string;
  status?: string;
};

type AccountingInstrumentParams = Pick<AccountingCoreParams, 'restaurantId' | 'businessLine'> & {
  paymentMethod?: string;
  activeOnly?: boolean;
};

type AccountingVatExportParams = Pick<AccountingCoreParams, 'restaurantId' | 'dateFrom' | 'dateTo'> & {
  status?: string;
  limit?: number;
};

type AccountingDrilldownParams = Pick<AccountingCoreParams, 'restaurantId' | 'dateFrom' | 'dateTo' | 'station'> & {
  accountId?: number;
  journalEntryId?: number;
  journalLineId?: number;
  financeEventId?: number;
  sourceType?: string;
  sourceId?: number;
};

const buildFinanceQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  timezone,
  businessLine,
  station,
  startTime,
  endTime,
}: FinanceCoreParams) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (timezone) params.append('timezone', timezone);
  if (businessLine) params.append('business_line', businessLine);
  if (station) params.append('station', station);
  if (startTime) params.append('start_time', startTime);
  if (endTime) params.append('end_time', endTime);
  return params;
};

const buildAccountingQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  businessLine,
  timezone,
  station,
  customerId,
  supplierId,
  asOf,
}: AccountingLedgerParams) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (businessLine) params.append('business_line', businessLine);
  if (timezone) params.append('timezone', timezone);
  if (station) params.append('station', station);
  if (customerId) params.append('customer_id', customerId.toString());
  if (supplierId) params.append('supplier_id', supplierId.toString());
  if (asOf) params.append('as_of', asOf);
  return params;
};

const buildSettlementQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  paymentMethod,
  status,
}: AccountingSettlementParams) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (paymentMethod) params.append('payment_method', paymentMethod);
  if (status) params.append('status', status);
  return params;
};

const buildVatExportQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  status,
  limit,
}: AccountingVatExportParams) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (status) params.append('status', status);
  if (limit) params.append('limit', limit.toString());
  return params;
};

const buildAccountingDrilldownQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  station,
  accountId,
  journalEntryId,
  journalLineId,
  financeEventId,
  sourceType,
  sourceId,
}: AccountingDrilldownParams) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (station) params.append('station', station);
  if (accountId) params.append('account_id', accountId.toString());
  if (journalEntryId) params.append('journal_entry_id', journalEntryId.toString());
  if (journalLineId) params.append('journal_line_id', journalLineId.toString());
  if (financeEventId) params.append('finance_event_id', financeEventId.toString());
  if (sourceType) params.append('source_type', sourceType);
  if (sourceId) params.append('source_id', sourceId.toString());
  return params;
};

const buildFinanceReportQuery = ({
  restaurantId,
  dateFrom,
  dateTo,
  timezone,
  businessLine,
  station,
  paymentMethod,
  instrumentType,
  instrumentName,
  customerId,
  billNumber,
  limit,
  offset,
}: FinanceReportParams) => {
  const params = buildFinanceQuery({
    restaurantId,
    dateFrom,
    dateTo,
    timezone,
    businessLine,
    station,
  });
  if (paymentMethod) params.append('payment_method', paymentMethod);
  if (instrumentType) params.append('instrument_type', instrumentType);
  if (instrumentName) params.append('instrument_name', instrumentName);
  if (customerId) params.append('customer_id', customerId.toString());
  if (billNumber) params.append('bill_number', billNumber);
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  return params;
};

export const FinanceApis = {
  overview: (params: FinanceCoreParams) => `/finance/overview?${buildFinanceQuery(params).toString()}`,
  transactions: (params: FinanceTransactionParams) => {
    const query = buildFinanceQuery(params);
    if (params.eventType) query.append('event_type', params.eventType);
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.offset) query.append('offset', params.offset.toString());
    return `/finance/transactions?${query.toString()}`;
  },
  expenses: (params: FinanceCoreParams) => `/finance/expenses?${buildFinanceQuery(params).toString()}`,
  receivables: (params: FinanceCoreParams) => `/finance/receivables?${buildFinanceQuery(params).toString()}`,
  reconciliation: (params: FinanceCoreParams) => `/finance/reconciliation?${buildFinanceQuery(params).toString()}`,
};

export const FinanceReportApis = {
  salesBook: (params: FinanceReportParams) =>
    `/finance-reports/sales-book?${buildFinanceReportQuery(params).toString()}`,
  invoices: (params: FinanceReportParams) =>
    `/finance-reports/invoices?${buildFinanceReportQuery(params).toString()}`,
  payments: (params: FinanceReportParams) =>
    `/finance-reports/payments?${buildFinanceReportQuery(params).toString()}`,
  refunds: (params: FinanceReportParams) =>
    `/finance-reports/refunds?${buildFinanceReportQuery(params).toString()}`,
  vatSales: (params: FinanceReportParams) =>
    `/finance-reports/vat-sales?${buildFinanceReportQuery(params).toString()}`,
};

export const AccountingApis = {
  health: (params: AccountingCoreParams) =>
    `/accounting/health?${buildAccountingQuery(params).toString()}`,
  daybook: (params: AccountingDaybookParams) => {
    const query = buildAccountingQuery(params);
    query.append('business_date', params.businessDate);
    return `/accounting/daybook?${query.toString()}`;
  },
  dayCloses: (params: AccountingCoreParams & { skip?: number; limit?: number }) => {
    const query = buildAccountingQuery(params);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());
    return `/accounting/day-closes?${query.toString()}`;
  },
  dayClose: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}`,
  dayClosePostingStatus: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/posting-status?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/posting-status`,
  dayCloseReview: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/review?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/review`,
  evaluateDayClose: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/evaluate?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/evaluate`,
  approveDayCloseReview: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/approve?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/approve`,
  dayCloseEvidence: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/evidence?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/evidence`,
  dayCloseJournalTrace: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/journal-trace?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/journal-trace`,
  postDayCloseMissingEvents: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/post-missing-events?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/post-missing-events`,
  softCloseDayClose: (dayCloseId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/day-closes/${dayCloseId}/soft-close?restaurant_id=${restaurantId}`
      : `/accounting/day-closes/${dayCloseId}/soft-close`,
  setupStatus: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/setup/status?${buildAccountingQuery(params).toString()}`,
  repairSetup: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/setup/repair?${buildAccountingQuery(params).toString()}`,
  openingBalances: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/opening-balances?${buildAccountingQuery(params).toString()}`,
  createOpeningBalance: () => '/accounting/opening-balances',
  updateOpeningBalance: (batchId: number) => `/accounting/opening-balances/${batchId}`,
  postOpeningBalance: (batchId: number) => `/accounting/opening-balances/${batchId}/post`,
  reverseOpeningBalance: (batchId: number) => `/accounting/opening-balances/${batchId}/reverse`,
  journalVouchers: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/journal-vouchers?${buildAccountingQuery(params).toString()}`,
  createJournalVoucher: () => '/accounting/journal-vouchers',
  updateJournalVoucher: (entryId: number) => `/accounting/journal-vouchers/${entryId}`,
  submitJournalVoucher: (entryId: number) => `/accounting/journal-vouchers/${entryId}/submit`,
  approveJournalVoucher: (entryId: number) => `/accounting/journal-vouchers/${entryId}/approve`,
  rejectJournalVoucher: (entryId: number) => `/accounting/journal-vouchers/${entryId}/reject`,
  postJournalVoucher: (entryId: number) => `/accounting/journal-vouchers/${entryId}/post`,
  journalEntry: (entryId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/journal-entries/${entryId}?restaurant_id=${restaurantId}`
      : `/accounting/journal-entries/${entryId}`,
  reverseJournalEntry: (entryId: number) => `/accounting/journal-entries/${entryId}/reverse`,
  drilldown: (params: AccountingDrilldownParams) =>
    `/accounting/drilldown?${buildAccountingDrilldownQuery(params).toString()}`,
  sourceTrace: ({ restaurantId, sourceType, sourceId }: { restaurantId: number; sourceType: string; sourceId: number }) =>
    `/accounting/source-trace?restaurant_id=${restaurantId}&source_type=${encodeURIComponent(sourceType)}&source_id=${sourceId}`,
  arAging: (params: Pick<AccountingLedgerParams, 'restaurantId' | 'asOf' | 'customerId'>) =>
    `/accounting/ar-aging?${buildAccountingQuery(params).toString()}`,
  apAging: (params: Pick<AccountingLedgerParams, 'restaurantId' | 'asOf' | 'supplierId'>) =>
    `/accounting/ap-aging?${buildAccountingQuery(params).toString()}`,
  customerStatement: (params: Pick<AccountingLedgerParams, 'restaurantId' | 'dateFrom' | 'dateTo' | 'customerId'>) =>
    `/accounting/customer-statement?${buildAccountingQuery(params).toString()}`,
  supplierStatement: (params: Pick<AccountingLedgerParams, 'restaurantId' | 'dateFrom' | 'dateTo' | 'supplierId'>) =>
    `/accounting/supplier-statement?${buildAccountingQuery(params).toString()}`,
  settlements: (params: AccountingSettlementParams) =>
    `/accounting/settlements?${buildSettlementQuery(params).toString()}`,
  paymentInstruments: ({ restaurantId, businessLine, paymentMethod, activeOnly }: AccountingInstrumentParams) => {
    const query = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (businessLine) query.append('business_line', businessLine);
    if (paymentMethod) query.append('payment_method', paymentMethod);
    if (activeOnly !== undefined) query.append('active_only', String(activeOnly));
    return `/accounting/payment-instruments?${query.toString()}`;
  },
  createPaymentInstrument: () => '/accounting/payment-instruments',
  updatePaymentInstrument: (instrumentId: number) => `/accounting/payment-instruments/${instrumentId}`,
  deactivatePaymentInstrument: (instrumentId: number) => `/accounting/payment-instruments/${instrumentId}/deactivate`,
  paymentBanks: (restaurantId: number) => `/accounting/payment-banks?restaurant_id=${restaurantId}`,
  createPaymentBank: () => '/accounting/payment-banks',
  updatePaymentBank: (bankId: number) => `/accounting/payment-banks/${bankId}`,
  createCashTransfer: () => '/accounting/cash-transfers',
  previewSettlement: () => '/accounting/settlements/preview',
  createSettlement: () => '/accounting/settlements',
  confirmSettlementBank: (batchId: number) => `/accounting/settlements/${batchId}/confirm-bank`,
  matchSettlement: (batchId: number) => `/accounting/settlements/${batchId}/match`,
  approveSettlementVariance: (batchId: number) => `/accounting/settlements/${batchId}/approve-variance`,
  postSettlement: (batchId: number) => `/accounting/settlements/${batchId}/post`,
  reverseSettlement: (batchId: number, reversalDate?: string) =>
    reversalDate
      ? `/accounting/settlements/${batchId}/reverse?reversal_date=${encodeURIComponent(reversalDate)}`
      : `/accounting/settlements/${batchId}/reverse`,
  vatExportRuns: (params: AccountingVatExportParams) =>
    `/accounting/vat-export/runs?${buildVatExportQuery(params).toString()}`,
  validateVatExport: () => '/accounting/vat-export/validate',
  generateVatExport: () => '/accounting/vat-export/generate',
  downloadVatExport: (runId: number, restaurantId?: number) =>
    restaurantId
      ? `/accounting/vat-export/${runId}/download?restaurant_id=${restaurantId}`
      : `/accounting/vat-export/${runId}/download`,
  periods: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/periods?${buildAccountingQuery(params).toString()}`,
  generatePeriods: () => '/accounting/periods/generate',
  periodPreflight: (periodId: number) => `/accounting/periods/${periodId}/preflight`,
  softClosePeriod: (periodId: number) => `/accounting/periods/${periodId}/soft-close`,
  lockPeriod: (periodId: number, force = false) => `/accounting/periods/${periodId}/lock?force=${force}`,
  reopenPeriod: (periodId: number) => `/accounting/periods/${periodId}/reopen`,
  accounts: (params: Pick<AccountingCoreParams, 'restaurantId'>) =>
    `/accounting/accounts?${buildAccountingQuery(params).toString()}`,
  createAccount: () => '/accounting/accounts',
  updateAccount: (accountId: number, restaurantId: number) =>
    `/accounting/accounts/${accountId}?restaurant_id=${restaurantId}`,
  mappings: (params: Pick<AccountingCoreParams, 'restaurantId' | 'businessLine'>) =>
    `/accounting/mappings?${buildAccountingQuery(params).toString()}`,
  createMapping: () => '/accounting/mappings',
  updateMapping: (mappingId: number, restaurantId: number) =>
    `/accounting/mappings/${mappingId}?restaurant_id=${restaurantId}`,
  resolveMappingException: () => "/accounting/mapping-exceptions/resolve",
  reverseRepostMappingException: () => "/accounting/mapping-exceptions/reverse-repost",
  mappingAudit: (mappingId: number, restaurantId: number) =>
    `/accounting/mappings/${mappingId}/audit?restaurant_id=${restaurantId}`,
  seedDefaults: (params: Pick<AccountingCoreParams, 'restaurantId' | 'businessLine'>) =>
    `/accounting/seed-defaults?${buildAccountingQuery(params).toString()}`,
  seedDefaultsAll: () => '/accounting/seed-defaults/all',
  postFinanceEvents: (params: AccountingCoreParams) =>
    `/accounting/post-finance-events?${buildAccountingQuery(params).toString()}`,
  backfillDryRun: () => '/accounting/backfill/dry-run',
  backfillCommit: (dryRunId: number) => `/accounting/backfill/commit?dry_run_id=${dryRunId}`,
  backfillRuns: ({ restaurantId, limit = 50 }: { restaurantId: number; limit?: number }) =>
    `/accounting/backfill/runs?restaurant_id=${restaurantId}&limit=${limit}`,
};

export const AccountingReportApis = {
  trialBalance: (params: AccountingCoreParams) =>
    `/accounting/trial-balance?${buildAccountingQuery(params).toString()}`,
  profitLoss: (params: AccountingCoreParams) =>
    `/accounting/profit-loss?${buildAccountingQuery(params).toString()}`,
  balanceSheet: (params: AccountingCoreParams) =>
    `/accounting/balance-sheet?${buildAccountingQuery(params).toString()}`,
  generalLedger: (params: AccountingCoreParams) =>
    `/accounting/general-ledger?${buildAccountingQuery(params).toString()}`,
  vatSummary: (params: AccountingCoreParams) =>
    `/accounting/vat-summary?${buildAccountingQuery(params).toString()}`,
  customerLedger: (params: AccountingLedgerParams) =>
    `/accounting/customer-ledger?${buildAccountingQuery(params).toString()}`,
  supplierLedger: (params: AccountingLedgerParams) =>
    `/accounting/supplier-ledger?${buildAccountingQuery(params).toString()}`,
  cashFlow: (params: AccountingCoreParams) =>
    `/accounting/cash-flow?${buildAccountingQuery(params).toString()}`,
  mappingExceptions: (params: AccountingCoreParams) =>
    `/accounting/mapping-exceptions?${buildAccountingQuery(params).toString()}`,
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
    entityType,
    entityId,
    skip = 0,
    limit = 100,
  }: {
    restaurantId?: number;
    type?: string;
    status?: string;
    entityType?: string;
    entityId?: number;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (entityType) params.append("entity_type", entityType);
    if (entityId) params.append("entity_id", entityId.toString());
    return `/notifications?${params.toString()}`;
  },
  unreadCount: (restaurantId?: number) => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    return `/notifications/unread-count?${params.toString()}`;
  },
  markRead: '/notifications/read',
  forOrder: (orderId: number, { restaurantId, skip = 0, limit = 100 }: { restaurantId?: number; skip?: number; limit?: number } = {}) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (restaurantId) params.append("restaurant_id", restaurantId.toString());
    return `/notifications/orders/${orderId}?${params.toString()}`;
  },
  forKot: (kotId: number, { restaurantId, skip = 0, limit = 100 }: { restaurantId?: number; skip?: number; limit?: number } = {}) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (restaurantId) params.append("restaurant_id", restaurantId.toString());
    return `/notifications/kots/${kotId}?${params.toString()}`;
  },
  forInventoryItem: (
    inventoryItemId: number,
    { restaurantId, skip = 0, limit = 100 }: { restaurantId?: number; skip?: number; limit?: number } = {},
  ) => {
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (restaurantId) params.append("restaurant_id", restaurantId.toString());
    return `/notifications/inventory/${inventoryItemId}?${params.toString()}`;
  },
};

export const DayCloseApis = {
  current: ({
    restaurantId,
    businessLine,
    businessDate,
  }: {
    restaurantId: number;
    businessLine?: string;
    businessDate?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (businessLine) params.append('business_line', businessLine);
    if (businessDate) params.append('business_date', businessDate);
    return `/day-closes/current?${params.toString()}`;
  },
  validateClose: ({
    restaurantId,
    businessLine,
    businessDate,
  }: {
    restaurantId: number;
    businessLine?: string;
    businessDate?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (businessLine) params.append('business_line', businessLine);
    if (businessDate) params.append('business_date', businessDate);
    return `/day-closes/validate-close?${params.toString()}`;
  },
  initiate: '/day-closes/initiate',
  generateSnapshot: ({
    restaurantId,
    businessLine,
    businessDate,
  }: {
    restaurantId: number;
    businessLine?: string;
    businessDate?: string;
  }) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (businessLine) params.append('business_line', businessLine);
    if (businessDate) params.append('business_date', businessDate);
    return `/day-closes/generate-snapshot?${params.toString()}`;
  },
  confirm: (id: number) => `/day-closes/${id}/confirm`,
  cancel: (id: number) => `/day-closes/${id}/cancel`,
  listAdjustments: (id: number) => `/day-closes/${id}/adjustments`,
  addExpenseAdjustment: (id: number) => `/day-closes/${id}/adjustments/expense`,
  addIncomeAdjustment: (id: number) => `/day-closes/${id}/adjustments/income`,
  list: ({
    restaurantId,
    start,
    end,
    status,
    businessLine,
    skip,
    limit,
  }: {
    restaurantId?: number;
    start?: string;
    end?: string;
    status?: string;
    businessLine?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId.toString());
    if (start) params.append('date_from', start);
    if (end) params.append('date_to', end);
    if (status) params.append('status', status);
    if (businessLine) params.append('business_line', businessLine);
    if (skip !== undefined) params.append('skip', skip.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    const query = params.toString();
    return query ? `/day-closes?${query}` : '/day-closes';
  },
  sessions: ({
    restaurantId,
    businessLine,
    skip = 0,
    limit = 50,
  }: {
    restaurantId: number;
    businessLine?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (businessLine) params.append('business_line', businessLine);
    return `/day-closes/sessions?${params.toString()}`;
  },
  detail: (id: number) => `/day-closes/${id}`,
  get: (id: number) => `/day-closes/${id}`,
  auditLog: (id: number) => `/day-closes/${id}/audit-log`,
  savedSnapshot: (id: number) => `/day-closes/${id}/snapshot`,
  snapshot: (id: number) => `/day-closes/${id}/snapshot`,
  reopen: (id: number) => `/day-closes/${id}/reopen`,
  exportPdf: (id: number) => `/day-closes/${id}/export/pdf`,
  exportExcel: (id: number) => `/day-closes/${id}/export/excel`,
};

export const DrawerSessionApis = {
  configurations: ({
    restaurantId,
    businessLine = 'restaurant',
  }: {
    restaurantId: number;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      business_line: businessLine,
    });
    return `/drawer-sessions/configurations?${params.toString()}`;
  },
  openableConfigurations: ({
    restaurantId,
    businessLine = 'restaurant',
  }: {
    restaurantId: number;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      business_line: businessLine,
    });
    return `/drawer-sessions/openable-configurations?${params.toString()}`;
  },
  saveConfiguration: '/drawer-sessions/configurations',
  cashiers: ({ restaurantId }: { restaurantId: number }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
    });
    return `/drawer-sessions/cashiers?${params.toString()}`;
  },
  assignments: ({
    restaurantId,
    businessLine = 'restaurant',
  }: {
    restaurantId: number;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      business_line: businessLine,
    });
    return `/drawer-sessions/assignments?${params.toString()}`;
  },
  saveAssignment: '/drawer-sessions/assignments',
  setControls: ({
    restaurantId,
    enabled,
  }: {
    restaurantId: number;
    enabled: boolean;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      enabled: String(enabled),
    });
    return `/drawer-sessions/controls?${params.toString()}`;
  },
  suggestion: ({
    restaurantId,
    businessDate,
    businessLine = 'restaurant',
    station = 'general',
    drawerKey,
  }: {
    restaurantId: number;
    businessDate: string;
    businessLine?: string;
    station?: string;
    drawerKey: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      business_date: businessDate,
      business_line: businessLine,
      station,
      drawer_key: drawerKey,
    });
    return `/drawer-sessions/suggestion?${params.toString()}`;
  },
  open: '/drawer-sessions/open',
  active: ({
    restaurantId,
    businessLine = 'restaurant',
  }: {
    restaurantId: number;
    businessLine?: string;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      business_line: businessLine,
    });
    return `/drawer-sessions/active?${params.toString()}`;
  },
  movement: (sessionId: number) => `/drawer-sessions/${sessionId}/movements`,
  closingPrompt: (sessionId: number) => `/drawer-sessions/${sessionId}/closing-prompt`,
  expectedBreakdown: (sessionId: number) => `/drawer-sessions/${sessionId}/expected-breakdown`,
  closingCount: (sessionId: number) => `/drawer-sessions/${sessionId}/closing-count`,
  settlementDecision: (sessionId: number) => `/drawer-sessions/${sessionId}/settlement-decision`,
  approveVariance: (sessionId: number) => `/drawer-sessions/${sessionId}/approve-variance`,
  reopen: (sessionId: number) => `/drawer-sessions/${sessionId}/reopen`,
};

export const HistoryApis = {
  listAuditLogs: (params: string) => `/history/audit-logs?${params}`,
  getAuditLog: (id: number) => `/history/audit-logs/${id}`,
  listUserActivity: (userId: number) => `/history/activity/user/${userId}`,
  listActivityByDate: (params: string) => `/history/activity?${params}`,
};

export const PrinterApis = {
  list: (restaurantId: number) => `/printers/restaurants/${restaurantId}`,
  create: (restaurantId: number) => `/printers/restaurants/${restaurantId}`,
  get: (id: number) => `/printers/${id}`,
  update: (id: number) => `/printers/${id}`,
  delete: (id: number) => `/printers/${id}`,
  test: (id: number) => `/printers/${id}/test`,
  default: (restaurantId: number) => `/printers/restaurants/${restaurantId}/default`,
  stationConfig: (restaurantId: number) => `/printers/restaurants/${restaurantId}/station-config`,
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

export const StaffApis = {
  list: () => `/users/all`,
  getStaff: (id: number | string) => `/users/${id}`,
  create: '/users/',
  update: (id: number | string) => `/users/${id}`,
  delete: (id: number | string) => `/users/${id}`,
};

export const StaffProfileApis = {
  list: ({ skip = 0, limit = 200, search }: { skip?: number; limit?: number; search?: string } = {}) => {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (search) params.append('search', search);
    // apiClient already uses baseURL `/api/proxy` in local dev; don't double-prefix.
    return `/staff?${params.toString()}`;
  },
  get: (staffId: number) => `/staff/${staffId}`,
  create: "/staff",
};

export const PayrollApis = {
  listRuns: (statuses?: string[]) => {
    const params = new URLSearchParams();
    if (statuses) statuses.forEach(s => params.append('statuses', s));
    const q = params.toString();
    return q ? `/payroll/runs?${q}` : '/payroll/runs';
  },
  getRun: (id: number) => `/payroll/runs/${id}`,
  createRun: '/payroll/runs',
  approveRun: (id: number) => `/payroll/runs/${id}/approve`,
  markPaid: (id: number) => `/payroll/runs/${id}/paid`,
  cancelRun: (id: number) => `/payroll/runs/${id}/cancel`,
  addAdjustments: (id: number) => `/payroll/runs/${id}/adjustments`,
  deleteAdjustment: (adjustmentId: number) => `/payroll/adjustments/${adjustmentId}`,
  runPdf: (id: number) => `/payroll/runs/${id}/pdf`,
};

export const PeriodCloseApis = {
  weeklyPreview: (restaurantId: number, year: number, week: number) => 
    `/period-closes/weekly/preview?restaurant_id=${restaurantId}&year=${year}&week_number=${week}`,
  confirmWeekly: (restaurantId: number, year: number, week: number) => 
    `/period-closes/weekly/confirm?restaurant_id=${restaurantId}&year=${year}&week_number=${week}`,
  weeklyRebuild: (restaurantId: number, year: number, week: number) =>
    `/period-closes/weekly/rebuild?restaurant_id=${restaurantId}&year=${year}&week_number=${week}`,
  listWeekly: (restaurantId: number, year?: number) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (year) params.append('year', year.toString());
    return `/period-closes/weekly?${params.toString()}`;
  },
  weeklySnapshot: (weeklyCloseId: number) => `/period-closes/weekly/${weeklyCloseId}/snapshot`,
  weeklyPreviewPdf: (restaurantId: number, year: number, week: number, doc: string) =>
    `/period-closes/weekly/preview/export/pdf?restaurant_id=${restaurantId}&year=${year}&week_number=${week}&doc=${encodeURIComponent(doc)}`,
  weeklyClosePdf: (weeklyCloseId: number, doc: string) =>
    `/period-closes/weekly/${weeklyCloseId}/export/pdf?doc=${encodeURIComponent(doc)}`,
  monthlyPreview: (restaurantId: number, year: number, month: number) => 
    `/period-closes/monthly/preview?restaurant_id=${restaurantId}&year=${year}&month=${month}`,
  confirmMonthly: (restaurantId: number, year: number, month: number) => 
    `/period-closes/monthly/confirm?restaurant_id=${restaurantId}&year=${year}&month=${month}`,
  monthlyRebuild: (restaurantId: number, year: number, month: number) =>
    `/period-closes/monthly/rebuild?restaurant_id=${restaurantId}&year=${year}&month=${month}`,
  listMonthly: (restaurantId: number, year?: number) => {
    const params = new URLSearchParams({ restaurant_id: restaurantId.toString() });
    if (year) params.append('year', year.toString());
    return `/period-closes/monthly?${params.toString()}`;
  },
  monthlySnapshot: (monthlyCloseId: number) => `/period-closes/monthly/${monthlyCloseId}/snapshot`,
  monthlyPreviewPdf: (restaurantId: number, year: number, month: number, doc: string) =>
    `/period-closes/monthly/preview/export/pdf?restaurant_id=${restaurantId}&year=${year}&month=${month}&doc=${encodeURIComponent(doc)}`,
  monthlyClosePdf: (monthlyCloseId: number, doc: string) =>
    `/period-closes/monthly/${monthlyCloseId}/export/pdf?doc=${encodeURIComponent(doc)}`,
};

export const GeneralPurchaseApis = {
  list: ({
    restaurantId,
    status,
    businessLine,
    skip = 0,
    limit = 100,
  }: {
    restaurantId: number;
    status?: string;
    businessLine?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);
    if (businessLine) params.append('business_line', businessLine);
    return `/general-purchases?${params.toString()}`;
  },
  get: (id: number) => `/general-purchases/${id}`,
  create: '/general-purchases',
  update: (id: number) => `/general-purchases/${id}`,
  delete: (id: number) => `/general-purchases/${id}`,
  receive: (id: number) => `/general-purchases/${id}/receive`,
  cancel: (id: number) => `/general-purchases/${id}/cancel`,
  return: (id: number) => `/general-purchases/${id}/return`,
  awaitingPayments: (restaurantId: number) => `/awaiting-payments/general?restaurant_id=${restaurantId}`,
};

export const TaxConfigApis = {
  list: (restaurantId: number) => `/tax-config/restaurant/${restaurantId}`,
  get: (id: number) => `/tax-config/${id}`,
  create: '/tax-config/',
  update: (id: number) => `/tax-config/${id}`,
  delete: (id: number) => `/tax-config/${id}`,
};

export const FeedbackApis = {
  submit: "/feedbacks/",
};

export const TransactionsApis = {
  list: ({
    restaurantId,
    userId,
    paymentUserId,
    types,
    dateFrom,
    dateTo,
    skip = 0,
    limit = 100,
  }: {
    restaurantId: number;
    userId?: number;
    paymentUserId?: number;
    types?: string[];
    dateFrom?: string; // YYYY-MM-DD
    dateTo?: string; // YYYY-MM-DD
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams({
      restaurant_id: restaurantId.toString(),
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (userId) params.append("user_id", userId.toString());
    if (paymentUserId) params.append("payment_user_id", paymentUserId.toString());
    if (types?.length) types.forEach((t) => params.append("types", t));
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    return `/transactions?${params.toString()}`;
  },
};
