import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiClient from '@/lib/api-client';
import { TableAccessNotification } from './table-access-notification';

vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
let status: string;
beforeEach(() => {
  vi.clearAllMocks(); status = 'pending';
  vi.mocked(apiClient.get).mockImplementation(async () => ({ data: { id: 7, table_name: 'g5', customer_name: 'Niraj', status, expires_at: new Date(Date.now() + 600000).toISOString() } }));
  vi.mocked(apiClient.patch).mockImplementation(async () => { status = 'approved'; return { data: { status } }; });
});
afterEach(cleanup);

describe('notification table access actions', () => {
  it('approves directly after confirmation, without navigating to Tables', async () => {
    render(<TableAccessNotification requestId={7} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve host' }));
    expect(apiClient.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/table-visits/requests/7', { approve: true }));
    expect(await screen.findByText('Request approved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve host' })).not.toBeInTheDocument();
  });
  it('shows the actual result if another staff member handled the request', async () => {
    render(<TableAccessNotification requestId={7} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject request' }));
    expect(await screen.findByText('Request approved.')).toBeInTheDocument();
    expect(screen.queryByText('Request rejected.')).not.toBeInTheDocument();
  });
  it('does not offer actions on an expired notification', async () => {
    status = 'expired';
    render(<TableAccessNotification requestId={7} />);
    expect(await screen.findByText('Request expired.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve host' })).not.toBeInTheDocument();
  });
  it('shows failed permission checks without offering approval', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { data: { detail: 'You do not have access.' } } });
    render(<TableAccessNotification requestId={7} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access.');
    expect(screen.queryByRole('button', { name: 'Approve host' })).not.toBeInTheDocument();
  });
});
