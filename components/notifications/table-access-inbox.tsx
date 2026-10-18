"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { TableAccessNotification, type TableAccessRequest } from './table-access-notification';

export function TableAccessInbox() {
  const [items, setItems] = useState<TableAccessRequest[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const invalidate = useCallback(() => { ++version.current; }, []);
  const load = useCallback(async () => {
    const requestVersion = ++version.current;
    try {
      const response = await apiClient.get('/table-visits/inbox', { params: { skip: page * 25, limit: 25 } });
      if (requestVersion !== version.current) return;
      setItems(response.data.requests); setTotal(response.data.total); setError('');
    } catch (e: any) { if (requestVersion === version.current) setError(e.response?.data?.detail || 'Could not load table access requests. Retrying automatically.'); }
    finally { if (requestVersion === version.current) setLoading(false); }
  }, [page]);
  useEffect(() => {
    setLoading(true); void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 10000);
    window.addEventListener('yummy-table-access-updated', refresh);
    return () => { invalidate(); clearInterval(timer); window.removeEventListener('yummy-table-access-updated', refresh); };
  }, [load, invalidate]);
  return <section aria-label="Table access requests">
    {loading && <p role="status" className="px-4 py-3 text-sm text-muted-foreground">Loading requests…</p>}
    {error && <p role="alert" className="px-4 py-3 text-sm text-destructive">{error}</p>}
    {!loading && !error && !items.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No table access requests yet.</p>}
    {!loading && !error && items.map(item => <TableAccessNotification key={item.id} requestId={item.id} initialRequest={item} />)}
    {total > 25 && <div className="flex items-center justify-between gap-2 p-4"><Button variant="outline" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs tabular-nums">Page {page + 1}</span><Button variant="outline" disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
  </section>;
}
