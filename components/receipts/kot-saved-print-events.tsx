"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getElectronPrintBridge } from "@/lib/receipt-network-print";
import { getKotPrintEvents, printKotEvent, type KotPrintEvent } from "@/lib/kot-print-event";

function slipLabel(action: string): string {
  const value = action.toUpperCase();
  if (value.includes("CANCEL") || value === "REMOVE") return "Cancellation slip";
  if (value.includes("ADD")) return "Added items slip";
  if (value === "INITIAL") return "Initial slip";
  return "KOT change slip";
}

export function KotSavedPrintEvents({ kotId }: { kotId: number }) {
  const [events, setEvents] = useState<KotPrintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const canPrint = Boolean(getElectronPrintBridge()?.printNetworkRaw);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getKotPrintEvents(kotId)
      .then((value) => { if (active) setEvents(value); })
      .catch(() => { if (active) setError("Could not load saved print slips."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kotId]);

  const handlePrint = async (event: KotPrintEvent) => {
    setPrintingId(event.id);
    try {
      await printKotEvent(kotId, event);
      toast.success(event.printed_at ? "Copy sent to printer" : "Saved slip sent to printer");
      try {
        setEvents(await getKotPrintEvents(kotId));
      } catch {
        setError("Slip sent. Refresh slips to update its status.");
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not print saved slip.");
    } finally {
      setPrintingId(null);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setEvents(await getKotPrintEvents(kotId));
    } catch {
      setError("Could not load saved print slips.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-border/60 bg-card p-4" aria-label="Saved KOT print slips">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Saved print slips</h3>
        <Button type="button" variant="ghost" size="sm" className="h-10" disabled={loading || printingId !== null} onClick={refresh}>Refresh slips</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Print an unsent change or a marked copy of a slip already sent.</p>
      {loading ? <p className="mt-3 text-sm text-muted-foreground" role="status">Loading slips…</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive" role="status">{error}</p> : null}
      {!loading && !error && events.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No saved slips yet.</p> : null}
      {events.length > 0 ? (
        <ul className="mt-3 divide-y divide-border/60">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {slipLabel(event.action)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">#{event.id} · {event.printed_at ? "Sent" : "Unsent"}</span>
                </p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">
                  {event.items.map((item) => `${item.name} ×${item.qty}`).join(", ")}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" disabled={!canPrint || printingId !== null} onClick={() => handlePrint(event)}>
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                {printingId === event.id ? "Sending…" : event.printed_at ? "Reprint copy" : "Print slip"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {!canPrint ? <p className="mt-2 text-xs text-muted-foreground">Printing saved slips requires the Yummy desktop app and a network printer.</p> : null}
    </section>
  );
}
