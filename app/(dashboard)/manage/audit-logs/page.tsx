"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { HistoryApis } from "@/lib/api/endpoints";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AuditEvent = {
  id: number;
  event: string;
  entity_type: string;
  entity_id: number | null;
  target_label: string | null;
  actor_name: string | null;
  actor_role: string | null;
  source: string;
  change_field: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
};

type Filters = { search: string; entity: string; action: string; from: string; to: string };
const PAGE_SIZE = 50;

function localDate(date: Date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initialFilters(): Filters {
  const today = new Date();
  const earlier = new Date(today);
  earlier.setDate(earlier.getDate() - 30);
  return { search: "", entity: "", action: "", from: localDate(earlier), to: localDate(today) };
}

function label(value: string) {
  return value.replaceAll("_", " ").replaceAll(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.map(display).join(", ") : "—";
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length ? entries.map(([key, item]) => `${label(key)}: ${display(item)}`).join(" · ") : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function changes(log: AuditEvent) {
  const oldValue = log.old_value;
  const newValue = log.new_value;
  const before = oldValue && typeof oldValue === "object" && !Array.isArray(oldValue)
    ? oldValue as Record<string, unknown> : null;
  const after = newValue && typeof newValue === "object" && !Array.isArray(newValue)
    ? newValue as Record<string, unknown> : null;
  if ((before || after) && (before || oldValue == null) && (after || newValue == null)) {
    return Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
      .filter((key) => !before || !after || display(before[key]) !== display(after[key]))
      .map((key) => ({ key, before: display(before?.[key]), after: display(after?.[key]) }));
  }
  return [{ key: log.change_field || "Value", before: display(oldValue), after: display(newValue) }];
}

export default function AuditLogsPage() {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.entity) params.set("entity_type", filters.entity);
      if (filters.action) params.set("action", filters.action);
      if (filters.from) params.set("date_from", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) {
        const nextDay = new Date(`${filters.to}T00:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        params.set("date_to", nextDay.toISOString());
      }
      const response = await apiClient.get(HistoryApis.listAuditLogs(params.toString()));
      setItems(response.data?.data?.items ?? []);
      setTotal(response.data?.data?.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
      setError("Audit logs could not be loaded. Check your access or try again.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filters, page]);

  useEffect(() => { void load(); }, [load]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(0);
    setFilters(draft);
  }

  return (
    <AppPage className="pb-24" width="wide">
      <PageHeader title="Audit logs" description="Who changed restaurant records and when. Earlier actions appear only if they were recorded." />
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="min-w-48 flex-1 text-sm">Search person or item
          <Input name="audit-search" autoComplete="off" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Name or action…" />
        </label>
        <label className="text-sm">Area
          <select name="audit-area" className="block h-10 min-w-36 rounded-md border bg-background px-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" value={draft.entity} onChange={(event) => setDraft({ ...draft, entity: event.target.value })}>
            <option value="">All areas</option>
            {[
              "staff", "user", "role", "menu_item", "item_category", "table", "room", "table_type", "inventory_item", "supplier", "station", "printer", "expense", "expense_category", "income_entry", "discount", "tax_config", "service_charge", "customer", "restaurant", "order",
            ].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
        </label>
        <label className="text-sm">Action
          <select name="audit-action" className="block h-10 min-w-32 rounded-md border bg-background px-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}>
            <option value="">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="deactivated">Deactivated</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm">From<Input name="audit-from" autoComplete="off" type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label className="text-sm">To<Input name="audit-to" autoComplete="off" type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        <Button type="submit" disabled={loading || (!!draft.from && !!draft.to && draft.from > draft.to)}>Apply filters</Button>
      </form>

      <Card className="overflow-hidden">
        {error && <p role="alert" className="p-4 text-destructive">{error} <Button type="button" variant="outline" onClick={() => void load()}>Retry</Button></p>}
        {loading ? <p role="status" className="p-6 text-muted-foreground">Loading audit logs…</p> :
          !error && items.length === 0 ? <p className="p-6 text-muted-foreground">No recorded changes match these filters.</p> :
          <div className="divide-y">
            {items.map((log) => (
              <button key={log.id} type="button" onClick={() => setSelected(log)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                <span className="min-w-48 flex-1 font-medium">{label(log.event)}</span>
                <span className="min-w-32 flex-1 text-sm">{log.target_label || `${label(log.entity_type)} #${log.entity_id ?? "—"}`}</span>
                <span className="min-w-32 text-sm text-muted-foreground">{log.actor_name || "System"}</span>
              </button>
            ))}
          </div>}
      </Card>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">{total ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + items.length} of ${total}` : "0 events"}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" disabled={loading || (page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selected ? label(selected.event) : "Audit event"}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-muted-foreground">When</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
              <div><dt className="text-muted-foreground">Who</dt><dd>{selected.actor_name || "System"}{selected.actor_role ? ` (${selected.actor_role})` : ""}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Record</dt><dd>{selected.target_label || label(selected.entity_type)} #{selected.entity_id ?? "—"}</dd></div>
            </dl>
            {selected.reason && <p><span className="font-medium">Reason:</span> {selected.reason}</p>}
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th scope="col" className="p-2">Field</th><th scope="col" className="p-2">Before</th><th scope="col" className="p-2">After</th></tr></thead><tbody>{changes(selected).map((change) => <tr key={change.key} className="border-b"><th scope="row" className="p-2 font-medium">{label(change.key)}</th><td className="break-words p-2">{change.before}</td><td className="break-words p-2">{change.after}</td></tr>)}</tbody></table></div>
          </div>}
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
