"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Asset = {
  id: number;
  purchase_id: number;
  name: string;
  acquired_date: string;
  in_service_date: string | null;
  cost: string;
  useful_life_months: number | null;
  residual_value: string;
  accumulated_depreciation: string;
  status: string;
};
type Depreciation = { id: number; period_start: string; amount: string };

export function FixedAssetsDialog({ open, onOpenChange, restaurantId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<Depreciation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inServiceDate, setInServiceDate] = useState("");
  const [lifeMonths, setLifeMonths] = useState("");
  const [residual, setResidual] = useState("0");
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const response = await apiClient.get("/fixed-assets", { params: { restaurant_id: restaurantId } });
      setAssets(response.data.data ?? []);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load assets");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    setInServiceDate(selected?.in_service_date ?? selected?.acquired_date ?? "");
    setLifeMonths(selected?.useful_life_months?.toString() ?? "");
    setResidual(selected?.residual_value ?? "0");
    setHistory([]);
    if (selected && open) {
      void apiClient.get(`/fixed-assets/${selected.id}/depreciation`, { params: { restaurant_id: restaurantId } })
        .then((response) => setHistory(response.data.data ?? []))
        .catch(() => toast.error("Could not load depreciation history"));
    }
  }, [selected, open, restaurantId]);

  const saveSchedule = async () => {
    if (!selected) return;
    const months = Number(lifeMonths);
    const value = Number(residual);
    if (!inServiceDate || !Number.isInteger(months) || months < 1 || months > 600 || !Number.isFinite(value) || value < 0 || value >= Number(selected.cost)) {
      toast.error("Enter a start date, a useful life in months, and a residual value below cost.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/fixed-assets/${selected.id}`, {
        in_service_date: inServiceDate,
        useful_life_months: months,
        residual_value: value,
      }, { params: { restaurant_id: restaurantId } });
      toast.success("Depreciation schedule saved");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not save schedule");
    } finally { setSaving(false); }
  };

  const postMonth = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await apiClient.post(`/fixed-assets/${selected.id}/depreciate`, null, { params: { restaurant_id: restaurantId } });
      toast.success(`Depreciation posted for ${response.data.data.period_start.slice(0, 7)}`);
      await load();
      const rows = await apiClient.get(`/fixed-assets/${selected.id}/depreciation`, { params: { restaurant_id: restaurantId } });
      setHistory(rows.data.data ?? []);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not post depreciation");
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto overscroll-contain">
      <DialogHeader>
        <DialogTitle>Equipment & assets</DialogTitle>
        <DialogDescription>Track purchased assets and record monthly book depreciation after the month ends.</DialogDescription>
      </DialogHeader>
      {loading ? <p className="text-sm text-muted-foreground">Loading assets…</p> : assets.length === 0 ? <p className="text-sm text-muted-foreground">No equipment purchases recorded yet.</p> : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="divide-y rounded-xl border">
            {assets.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)}
              className={`w-full px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selectedId === asset.id ? "bg-muted" : ""}`}>
              <span className="block break-words font-medium">{asset.name}</span>
              <span className="block text-sm text-muted-foreground">{formatCurrency(asset.cost)} · {asset.status} · Bill #{asset.purchase_id}</span>
            </button>)}
          </div>
          {selected ? <div className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="break-words font-semibold">{selected.name}</h3>
              <p className="text-sm text-muted-foreground">Cost {formatCurrency(selected.cost)} · Depreciated {formatCurrency(selected.accumulated_depreciation)} · Book value {formatCurrency(Number(selected.cost) - Number(selected.accumulated_depreciation))}</p>
            </div>
            {selected.status === "active" && Number(selected.accumulated_depreciation) === 0 ? <div className="grid gap-3">
              <div className="space-y-1"><Label htmlFor="asset-service-date">In use since</Label><Input id="asset-service-date" name="in_service_date" autoComplete="off" type="date" value={inServiceDate} onChange={(event) => setInServiceDate(event.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="asset-life">Useful life (months)</Label><Input id="asset-life" name="useful_life_months" autoComplete="off" type="number" min="1" max="600" value={lifeMonths} onChange={(event) => setLifeMonths(event.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="asset-residual">Expected value at end</Label><Input id="asset-residual" name="residual_value" autoComplete="off" type="number" min="0" step="0.01" value={residual} onChange={(event) => setResidual(event.target.value)} /></div>
              </div>
              <Button onClick={() => void saveSchedule()} disabled={saving}>Save schedule</Button>
            </div> : null}
            {selected.status === "active" && selected.useful_life_months ? <Button variant="outline" onClick={() => void postMonth()} disabled={saving}>Post next completed month</Button> : null}
            <div>
              <h4 className="text-sm font-medium">Posted months</h4>
              {history.length ? <ul className="mt-2 divide-y text-sm">{history.map((row) => <li key={row.id} className="flex justify-between py-2"><span>{row.period_start.slice(0, 7)}</span><span>{formatCurrency(row.amount)}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No depreciation posted.</p>}
            </div>
            <p className="text-xs text-muted-foreground">This is book depreciation. Tax depreciation needs separate review.</p>
          </div> : <p className="text-sm text-muted-foreground">Select an asset to see its schedule.</p>}
        </div>
      )}
    </DialogContent>
  </Dialog>;
}
