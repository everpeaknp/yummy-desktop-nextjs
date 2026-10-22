import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import apiClient from '@/lib/api-client';
import { TableAccessInbox } from './table-access-inbox';
vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
afterEach(cleanup);
it('uses request records for the pending count and history, not unread notifications', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 2, pending_count: 1, requests: [
    { id: 1, table_name: 'g5', customer_name: 'Guest', status: 'pending', expires_at: new Date(Date.now() + 600000).toISOString() },
    { id: 2, table_name: 'g4', customer_name: 'Previous guest', status: 'approved', expires_at: new Date().toISOString() },
  ] } });
  render(<TableAccessInbox />);
  expect(screen.queryByText(/Pending requests appear first/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Approve host' })).toBeInTheDocument();
  expect(await screen.findByText('Request approved.')).toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith('/table-visits/inbox', { params: { skip: 0, limit: 25 } });
});
