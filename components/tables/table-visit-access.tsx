"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';

type Visit = { id: number; table_name: string; host_name: string; expired: boolean; members: { account_id: number; name: string; status: string; is_host: boolean }[] };
type AccessList = { requests: { id: number; table_name: string; customer_name: string }[]; visits: Visit[] };

export function TableVisitAccess() {
  const [data, setData] = useState<AccessList>({ requests: [], visits: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    const response = await apiClient.get('/table-visits/staff');
    setData(response.data); setError(''); setLoading(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try { await load(); } catch { if (!cancelled) { setError('Could not load table access requests.'); setLoading(false); } }
    };
    void refresh(); const timer = setInterval(refresh, 10000);
    window.addEventListener('yummy-table-access-updated', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('yummy-table-access-updated', refresh); };
  }, [load]);
  const act = async (task: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await task(); await load(); }
    catch (e: any) { setError(e.response?.data?.detail || 'Could not update table access. Refresh before trying again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <details className="my-4 rounded-xl border border-border bg-card p-4">
    <summary className="cursor-pointer py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Manage customer table visits{data.requests.length ? ` · ${data.requests.length} pending` : ''}</summary>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="table-visits-title" className="font-semibold">Customer table access</h2><Button variant="outline" disabled={busy} onClick={() => act(load)}>Refresh</Button></div>
    <p className="mt-1 text-sm text-muted-foreground">Confirm the customer is seated at the table before approving. Food requests still need separate acceptance.</p>
    {loading && <p role="status" className="mt-3 text-sm">Loading requests…</p>}
    {!loading && !data.requests.length && <p className="mt-3 text-sm text-muted-foreground">No pending access requests.</p>}
    <ul className="divide-y divide-border">{data.requests.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="min-w-0 break-words text-sm"><strong>Table {request.table_name}</strong> · {request.customer_name}</span><div className="flex gap-2"><Button disabled={busy} onClick={() => { if (window.confirm(`Confirm ${request.customer_name} is seated at Table ${request.table_name} and should become host?`)) void act(() => apiClient.patch(`/table-visits/requests/${request.id}`, { approve: true })); }}>Approve host</Button><Button variant="outline" disabled={busy} onClick={() => act(() => apiClient.patch(`/table-visits/requests/${request.id}`, { approve: false }))}>Reject</Button></div></li>)}</ul>
    {!!data.visits.length && <details className="mt-3"><summary className="cursor-pointer py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Active visits ({data.visits.length})</summary><ul className="divide-y divide-border">{data.visits.map(visit => <li key={visit.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">Table {visit.table_name} · Host: {visit.host_name}{visit.expired ? ' · Expired access' : ''}</span><Button variant="outline" disabled={busy} onClick={() => { if (window.confirm('End this visit and revoke all guest access? All orders must be completed or canceled first.')) void act(() => apiClient.post(`/table-visits/${visit.id}/close`)); }}>End visit</Button></div><div className="mt-2 flex flex-wrap gap-2">{visit.members.filter(m => !m.is_host && m.status === 'approved').map(m => <Button key={m.account_id} variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Transfer hosting to ${m.name}?`)) void act(() => apiClient.patch(`/table-visits/${visit.id}/host/${m.account_id}`)); }}>Make {m.name} host</Button>)}</div></li>)}</ul></details>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </details>;
}
