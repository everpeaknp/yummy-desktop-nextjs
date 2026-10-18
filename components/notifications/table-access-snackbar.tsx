"use client";

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/hooks/use-notifications';
import { hasPermission } from '@/lib/role-permissions';
import type { TableAccessRequest } from './table-access-notification';

const POLL_INTERVAL_MS = 10_000;

/** Surfaces new table-access requests while keeping the inbox as their source of truth. */
export function TableAccessSnackbar() {
  const user = useAuth(state => state.user);
  const seenRequestIds = useRef<Set<number> | null>(null);
  const inFlight = useRef(false);
  const canReview = hasPermission(user, 'pos.order.edit');

  const checkForRequests = useCallback(async (active: () => boolean) => {
    if (!active() || inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    try {
      const response = await apiClient.get('/table-visits/inbox', {
        params: { skip: 0, limit: 25 },
      });
      if (!active()) return;

      const now = Date.now();
      const pending = (response.data.requests as TableAccessRequest[]).filter(request =>
        request.status === 'pending' && new Date(request.expires_at).getTime() > now,
      );
      const seen = seenRequestIds.current;
      if (seen === null) {
        // Existing pending requests remain in Notifications without appearing as new alerts.
        seenRequestIds.current = new Set(pending.map(request => request.id));
        return;
      }

      for (const request of pending) {
        if (seen.has(request.id)) continue;
        seen.add(request.id);
        toast('Table access requested', {
          id: `table-access-${request.id}`,
          description: `Table ${request.table_name} · ${request.customer_name}`,
          duration: 10_000,
          action: {
            label: 'Review',
            onClick: () => {
              const notifications = useNotificationStore.getState();
              notifications.setActiveTab('table_access');
              notifications.setPanelOpen(true);
            },
          },
        });
      }
    } catch {
      // A failed inbox check should not mark or hide requests; retry on the next poll.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!canReview || !user?.restaurant_id) return;
    seenRequestIds.current = null;
    let mounted = true;
    const active = () => mounted;
    const refresh = () => void checkForRequests(active);
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('yummy-notifications-unread-increased', refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('yummy-notifications-unread-increased', refresh);
    };
  }, [canReview, user?.restaurant_id, checkForRequests]);

  return null;
}
