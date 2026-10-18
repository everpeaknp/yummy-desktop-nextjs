"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserCheck } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export type TableAccessRequest = { id: number; table_name: string; customer_name: string; status: string; expires_at: string };

function apiErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  const candidates = [data?.detail, data?.message, data?.error];
  const message = candidates.map(value => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const details = value.map(item => typeof item === 'string' ? item : item?.msg).filter(Boolean);
      return details.length ? details.join('; ') : null;
    }
    return null;
  }).find(Boolean);
  const status = error?.response?.status;
  if (message) return status ? `${message} (HTTP ${status})` : message;
  if (status) return `${fallback} (HTTP ${status}).`;
  if (typeof error?.message === 'string' && error.message.trim()) {
    return `${fallback}: ${error.message.trim()}`;
  }
  return fallback;
}

export function TableAccessNotification({ requestId, initialRequest }: { requestId: number; initialRequest?: TableAccessRequest }) {
  const [request, setRequest] = useState<TableAccessRequest | null>(initialRequest ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    const response = await apiClient.get(`/table-visits/requests/${requestId}`);
    setRequest(current => current && current.status !== 'pending' && response.data.status === 'pending' ? current : response.data);
  }, [requestId]);
  useEffect(() => {
    if (initialRequest) { setRequest(initialRequest); return; }
    let active = true;
    const refresh = async () => {
      try { if (active && document.visibilityState === 'visible') { await load(); if (active) setError(''); } }
      catch (e: any) { if (active) setError(apiErrorMessage(e, 'Could not check this request.')); }
    };
    void refresh(); const timer = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [load, initialRequest]);
  const decide = async (approve: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      let response;
      try {
        response = await apiClient.patch(`/table-visits/requests/${requestId}`, { approve });
      } catch (e: any) {
        setError(apiErrorMessage(e, `Could not ${approve ? 'approve' : 'reject'} this request`));
        try { await load(); } catch { /* Keep the actual decision error visible. */ }
        return;
      }

      setRequest(current => current ? { ...current, status: response.data.status } : null);
      window.dispatchEvent(new Event('yummy-table-access-updated'));
      try {
        await load();
        setError('');
      } catch (e: any) {
        setError(`Decision saved, but the request status could not be refreshed: ${apiErrorMessage(e, 'Refresh failed')}`);
      }
    } finally { inFlight.current = false; setBusy(false); }
  };
  const pending = request?.status === 'pending' && new Date(request.expires_at).getTime() > Date.now();
  return <article className="flex gap-3 border-b border-border/40 bg-muted/20 px-4 py-4 text-left">
    <UserCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">Table access requested</h3>
      {request ? <><p className="mt-1 break-words text-sm"><strong>Table {request.table_name}</strong> · {request.customer_name}</p>
        {pending ? <><p className="mt-2 text-xs leading-5 text-muted-foreground">Confirm this customer is seated here before approving them as host.</p><div className="mt-3 flex flex-wrap gap-2"><Button className="min-h-11" disabled={busy} onClick={() => setConfirming(true)}>Approve host</Button><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Reject</Button></div></> : <p role="status" className="mt-2 text-sm text-muted-foreground">{request.status === 'pending' ? 'This request has expired.' : `Request ${request.status}.`}</p>}
      </> : !error && <p role="status" className="mt-2 text-sm text-muted-foreground">Checking request…</p>}
      {busy && <p role="status" className="mt-2 text-xs text-muted-foreground">Updating request…</p>}
      {error && <div className="mt-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button className="mt-2 min-h-11" variant="outline" disabled={busy} onClick={async () => { setError(''); try { await load(); } catch (e: any) { setError(apiErrorMessage(e, 'Could not refresh this request')); } }}>Refresh request</Button></div>}
    </div>
    <AlertDialog open={confirming !== null} onOpenChange={open => { if (!open) setConfirming(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirming ? 'Approve table host?' : 'Reject table access?'}</AlertDialogTitle><AlertDialogDescription>{confirming ? `Confirm ${request?.customer_name} is seated at Table ${request?.table_name}. This grants access to the current table visit, not automatic food-order acceptance.` : `Reject ${request?.customer_name}’s request for Table ${request?.table_name}?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const decision = confirming; setConfirming(null); if (decision !== null) void decide(decision); }}>{confirming ? 'Confirm approval' : 'Reject request'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </article>;
}
