import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), user: { restaurant_id: 52 }, me: vi.fn(), push: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: (select: any) => select({ user: mocks.user, me: mocks.me }) }));
vi.mock('@/hooks/use-restaurant', () => ({ useRestaurant: (select: any) => select({ restaurant: { currency: 'NPR' } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/api-client', () => ({ default: { get: mocks.get } }));
vi.mock('@/lib/role-permissions', () => ({ hasPermission: () => false }));
vi.mock('@/components/customers/add-customer-dialog', () => ({ AddCustomerDialog: () => null }));
vi.mock('@/components/customers/edit-customer-dialog', () => ({ EditCustomerDialog: () => null }));
vi.mock('@/components/customers/credit-reminder-settings-dialog', () => ({ CreditReminderSettingsDialog: () => null }));
vi.mock('@/components/customers/loyalty-settings-dialog', () => ({ LoyaltySettingsDialog: () => null }));
import CustomersPage from '@/app/(dashboard)/customers/page';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
test('receivables filter finds later-page customers and combines with search', async () => {
  mocks.get.mockImplementation(async (_url, options) => ({ data: { status: 'success', data: {
    total: 101, customers: options.params.skip === 0
      ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Settled ${i}`, credit: i === 0 ? null : 0 }))
      : [{ id: 101, name: 'Customer owes money', credit: 50 }],
  } } }));
  render(<CustomersPage />);
  await waitFor(() => expect(screen.getAllByText('Customer owes money').length).toBeGreaterThan(0));
  expect(mocks.get).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Has receivables' })[0]);
  expect(screen.queryByText('Settled 1')).not.toBeInTheDocument();
  expect(screen.getAllByText('Customer owes money').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByPlaceholderText('Search name, phone, or email'), { target: { value: 'no match' } });
  expect(screen.queryByText('Customer owes money')).not.toBeInTheDocument();
  expect(screen.getByText('No customers found')).toBeInTheDocument();
});
