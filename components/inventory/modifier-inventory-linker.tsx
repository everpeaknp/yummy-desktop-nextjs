"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type InventoryItem = {
  id: number;
  name: string;
  unit?: string | null;
  is_active?: boolean;
};

type ModifierInventoryLink = {
  id: number;
  modifier_id: number;
  inventory_item_id: number;
  quantity_required: string;
  inventory_item_name?: string | null;
  inventory_item_unit?: string | null;
};

export function ModifierInventoryLinker({
  open,
  onOpenChange,
  modifierId,
  modifierName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modifierId: number | null;
  modifierName?: string;
}) {
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);

  const [loadingLinks, setLoadingLinks] = useState(false);
  const [links, setLinks] = useState<ModifierInventoryLink[]>([]);

  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("none");
  const [qtyRequired, setQtyRequired] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const restaurantId = user?.restaurant_id;

  const selectedInventory = useMemo(() => {
    const id = Number(selectedInventoryId);
    if (!id) return null;
    return inventoryItems.find((it) => it.id === id) || null;
  }, [selectedInventoryId, inventoryItems]);

  const resetForm = () => {
    setSelectedInventoryId("none");
    setQtyRequired("");
  };

  const fetchLinks = async (mid: number) => {
    setLoadingLinks(true);
    try {
      const res = await apiClient.get(InventoryApis.getInventoryForModifier(mid));
      if (res.data?.status === "success") {
        setLinks((res.data.data || []) as ModifierInventoryLink[]);
      } else {
        setLinks([]);
      }
    } catch (err: any) {
      setLinks([]);
      toast.error(err?.response?.data?.detail || "Failed to load modifier inventory links");
    } finally {
      setLoadingLinks(false);
    }
  };

  const fetchInventory = async (rid: number) => {
    setLoadingInventory(true);
    try {
      const url = InventoryApis.listInventoryWithQuery({ restaurantId: rid, isActive: true, limit: 500, skip: 0 });
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        const data = res.data?.data;
        const items = Array.isArray(data) ? data : (data?.items || data?.inventory_items || []);
        setInventoryItems((items || []) as InventoryItem[]);
      } else {
        setInventoryItems([]);
      }
    } catch {
      setInventoryItems([]);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const init = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!modifierId) return;
      if (restaurantId) fetchInventory(restaurantId);
      fetchLinks(modifierId);
      resetForm();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modifierId]);

  const canSave = () => {
    const mid = Number(modifierId || 0);
    const invId = Number(selectedInventoryId || 0);
    const q = Number(qtyRequired);
    return mid > 0 && invId > 0 && Number.isFinite(q) && q > 0;
  };

  const handleCreate = async () => {
    if (!modifierId) return;
    if (!canSave()) {
      toast.error("Pick an inventory item and set a quantity > 0.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        modifier_id: modifierId,
        inventory_item_id: Number(selectedInventoryId),
        quantity_required: Number(qtyRequired),
      };
      const res = await apiClient.post(InventoryApis.linkModifierInventory, payload);
      if (res.data?.status === "success") {
        toast.success("Linked modifier to inventory");
        await fetchLinks(modifierId);
        resetForm();
      } else {
        toast.error(res.data?.message || "Failed to create link");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create link");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (linkId: number) => {
    if (!modifierId) return;
    setDeletingIds((prev) => new Set(prev).add(linkId));
    try {
      const res = await apiClient.delete(InventoryApis.unlinkModifierInventory(linkId));
      if (res.data?.status === "success") {
        toast.success("Link removed");
        await fetchLinks(modifierId);
      } else {
        toast.error(res.data?.message || "Failed to remove link");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove link");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const title = modifierName ? `Inventory Usage: ${modifierName}` : "Inventory Usage";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Link this modifier option to one or more inventory items (quantity required per modifier).
          </DialogDescription>
        </DialogHeader>

        {!modifierId ? (
          <div className="text-sm text-muted-foreground">No modifier selected.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Inventory Item</Label>
                <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId} disabled={loadingInventory}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingInventory ? "Loading..." : "Select item"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="none">None</SelectItem>
                    {inventoryItems.map((it) => (
                      <SelectItem key={it.id} value={String(it.id)}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity Required</Label>
                <Input
                  inputMode="decimal"
                  placeholder={selectedInventory?.unit ? `e.g. 0.5 ${selectedInventory.unit}` : "e.g. 1"}
                  value={qtyRequired}
                  onChange={(e) => setQtyRequired(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground">
                  This amount will be deducted from inventory when the modifier is used.
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} disabled={saving || !canSave()} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Add Link
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inventory Item</TableHead>
                    <TableHead>Qty Required</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLinks ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                        Loading links…
                      </TableCell>
                    </TableRow>
                  ) : links.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                        No inventory links set for this modifier.
                      </TableCell>
                    </TableRow>
                  ) : (
                    links.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.inventory_item_name || `Item #${l.inventory_item_id}`}{" "}
                          {l.inventory_item_unit ? (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {l.inventory_item_unit}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{l.quantity_required}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/90"
                            onClick={() => handleDelete(l.id)}
                            disabled={deletingIds.has(l.id)}
                            title="Remove link"
                          >
                            {deletingIds.has(l.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

