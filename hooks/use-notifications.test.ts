import { describe, expect, it } from 'vitest';
import { filterNotificationTab, tabsForRole, type AppNotification } from './use-notifications';

const access = { id: 1, type: 'order', event: 'table.access_requested' } as AppNotification;
const order = { id: 2, type: 'order', event: 'order.created' } as AppNotification;
describe('notification table access category', () => {
  it.each(['admin', 'manager'])('places Table access fourth, after Inventory for %s', role => {
    expect(tabsForRole(role).map(tab => tab.type)).toEqual(['order', 'kot', 'inventory', 'table_access', 'payroll']);
  });
  it.each(['admin', 'manager', 'waiter', 'staff', 'cashier'])('has an access tab for %s', role => {
    expect(tabsForRole(role).some(tab => tab.type === 'table_access')).toBe(true);
  });
  it('keeps access requests out of food orders and general notifications', () => {
    expect(filterNotificationTab([access, order], 'order')).toEqual([order]);
    expect(filterNotificationTab([access, order], null)).toEqual([order]);
    expect(filterNotificationTab([access, order], 'table_access')).toEqual([access]);
  });
});
