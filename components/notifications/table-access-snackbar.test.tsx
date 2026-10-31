import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { useNotificationStore } from '@/hooks/use-notifications';
import { TableAccessSnackbar } from './table-access-snackbar';

vi.mock('@/lib/api-client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: (selector: (state: { user: { id: number; restaurant_id: number; role: string } }) => unknown) =>
    selector({ user: { id: 1, restaurant_id: 10, role: 'admin' } }),
}));
vi.mock('sonner', () => ({ toast: vi.fn() }));

const request = (id: number, table_name: string, customer_name: string) => ({
  id, table_name, customer_name, status: 'pending',
  expires_at: new Date(Date.now() + 600_000).toISOString(),
});

describe('table access snackbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useNotificationStore.setState({ panelOpen: false, activeTab: null });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('surfaces only requests that arrive after the initial inbox check and opens that inbox from Review', async () => {
    const existing = request(1, 'g4', 'Existing guest');
    const arriving = request(2, 'g5', 'Ramon');
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { requests: [existing] } } as any)
      .mockResolvedValue({ data: { requests: [existing, arriving] } } as any);

    render(<TableAccessSnackbar />);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await act(async () => { await Promise.resolve(); });
    expect(toast).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('Table access requested', expect.objectContaining({
      description: 'Table g5 · Ramon',
      action: expect.objectContaining({ label: 'Review', onClick: expect.any(Function) }),
    }));

    const options = vi.mocked(toast).mock.calls[0][1] as unknown as { action: { onClick: () => void } };
    act(() => options.action.onClick());
    expect(useNotificationStore.getState().panelOpen).toBe(true);
    expect(useNotificationStore.getState().activeTab).toBe('table_access');
  });

  it('checks immediately when the notification socket reports a new unread notification', async () => {
    const arriving = request(3, 'g2', 'Asha');
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { requests: [] } } as any)
      .mockResolvedValueOnce({ data: { requests: [arriving] } } as any);
    render(<TableAccessSnackbar />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      window.dispatchEvent(new Event('yummy-notifications-unread-increased'));
      await Promise.resolve();
    });

    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith('Table access requested', expect.objectContaining({
      description: 'Table g2 · Asha',
    }));
  });
});
