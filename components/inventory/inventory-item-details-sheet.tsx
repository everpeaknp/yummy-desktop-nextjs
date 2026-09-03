"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownRight,
  ArrowUpRight,
  CookingPot,
  History,
  Link2,
  ListPlus,
  Loader2,
  MapPin,
  MinusCircle,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  Ruler,
  Save,
  Scale,
  StickyNote,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { InventoryApis, MenuApis, ModifierApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface InventoryItemDetailsSheetProps {
  item: any | null;
  value?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStock: (item: any) => void;
  onReduceStock: (item: any) => void;
  onCountStock: (item: any) => void;
  onViewLedger: (item: any) => void;
  onRecipeLinksChanged?: () => void;
}

function activityLabel(movement: any): string {
  const delta = Number(movement?.qty_delta) || 0;
  const sourceType = String(movement?.source_type || "").toLowerCase();
  if (sourceType.includes("purchase_return")) return "Purchase returned";
  if (sourceType.includes("purchase")) return "Purchase received";
  if (sourceType.includes("kot") || sourceType.includes("sale")) return "Used in an order";
  if (sourceType.includes("consumption")) return "Manually consumed";
  if (sourceType.includes("reversal") || sourceType.includes("voided")) return "Reversed";
  return delta >= 0 ? "Stock added" : "Stock reduced";
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function formatQuantity(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(value ?? 0);
}

export function InventoryItemDetailsSheet({
  item,
  value,
  open,
  onOpenChange,
  onAddStock,
  onReduceStock,
  onCountStock,
  onViewLedger,
  onRecipeLinksChanged,
}: InventoryItemDetailsSheetProps) {
  const user = useAuth((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    stockIn: number;
    stockOut: number;
    recent: any | null;
  } | null>(null);
  const [menuLinks, setMenuLinks] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [modifierLinks, setModifierLinks] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [requiredQuantity, setRequiredQuantity] = useState("1");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const [updatingLinkId, setUpdatingLinkId] = useState<number | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<number | null>(null);
  const [showModifierLinkForm, setShowModifierLinkForm] = useState(false);
  const [selectedModifierId, setSelectedModifierId] = useState("");
  const [modifierSearch, setModifierSearch] = useState("");
  const [modifierQuantity, setModifierQuantity] = useState("1");
  const [modifierLinkSubmitting, setModifierLinkSubmitting] = useState(false);
  const [editingModifierLinkId, setEditingModifierLinkId] = useState<number | null>(null);
  const [editingModifierQuantity, setEditingModifierQuantity] = useState("");
  const [updatingModifierLinkId, setUpdatingModifierLinkId] = useState<number | null>(null);
  const [removingModifierLinkId, setRemovingModifierLinkId] = useState<number | null>(null);

  const restaurantId = Number(user?.restaurant_id || 0);
  const role = String(user?.role || user?.primary_role || "").toLowerCase();
  const permissionKeys = new Set(user?.permissions || []);
  const canManageRecipes =
    role === "admin" ||
    role === "superadmin" ||
    permissionKeys.has("inventory.recipes.manage") ||
    permissionKeys.has("inventory.manage");

  const availableMenuItems = useMemo(() => {
    const linkedIds = new Set(menuLinks.map((link) => Number(link.menu_item_id)));
    return menuItems.filter((menu) => !linkedIds.has(Number(menu.id)) && menu.is_active !== false);
  }, [menuItems, menuLinks]);

  const availableModifiers = useMemo(() => {
    const linkedIds = new Set(modifierLinks.map((link) => Number(link.modifier_id)));
    return modifierGroups.flatMap((group) =>
      (group.modifiers || [])
        .filter((modifier: any) => modifier.is_active !== false && !linkedIds.has(Number(modifier.id)))
        .map((modifier: any) => ({ ...modifier, groupName: group.name })),
    );
  }, [modifierGroups, modifierLinks]);

  const filteredMenuItems = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    return query ? availableMenuItems.filter((menu) => menu.name.toLowerCase().includes(query)) : availableMenuItems;
  }, [availableMenuItems, menuSearch]);

  const filteredModifiers = useMemo(() => {
    const query = modifierSearch.trim().toLowerCase();
    return query ? availableModifiers.filter((modifier) => `${modifier.groupName} ${modifier.name}`.toLowerCase().includes(query)) : availableModifiers;
  }, [availableModifiers, modifierSearch]);

  const loadMenuLinks = useCallback(async () => {
    if (!item?.id || !restaurantId) return;
    setLinksLoading(true);
    try {
      const [linksResult, menusResult, modifierLinksResult, modifierGroupsResult] = await Promise.allSettled([
        apiClient.get(InventoryApis.getMenuLinksForInventory(Number(item.id), restaurantId)),
        apiClient.get(MenuApis.getMenusByRestaurant(restaurantId)),
        apiClient.get(InventoryApis.getModifierLinksForInventory(Number(item.id), restaurantId)),
        apiClient.get(ModifierApis.listGroups(restaurantId)),
      ]);
      setMenuLinks(
        linksResult.status === "fulfilled" && Array.isArray(linksResult.value.data?.data)
          ? linksResult.value.data.data
          : [],
      );
      setMenuItems(
        menusResult.status === "fulfilled" && Array.isArray(menusResult.value.data?.data)
          ? menusResult.value.data.data
          : [],
      );
      setModifierLinks(
        modifierLinksResult.status === "fulfilled" && Array.isArray(modifierLinksResult.value.data?.data)
          ? modifierLinksResult.value.data.data
          : [],
      );
      setModifierGroups(
        modifierGroupsResult.status === "fulfilled" && Array.isArray(modifierGroupsResult.value.data?.data?.groups)
          ? modifierGroupsResult.value.data.data.groups
          : [],
      );
      if (linksResult.status === "rejected") {
        throw linksResult.reason;
      }
    } catch (error) {
      console.error("Failed to load menu links for inventory item:", error);
      setMenuLinks([]);
      setMenuItems([]);
      setModifierLinks([]);
      setModifierGroups([]);
    } finally {
      setLinksLoading(false);
    }
  }, [item?.id, restaurantId]);

  useEffect(() => {
    if (!open || !item?.id) {
      setStats(null);
      setMenuLinks([]);
      setMenuItems([]);
      setModifierLinks([]);
      setModifierGroups([]);
      setShowLinkForm(false);
      setShowModifierLinkForm(false);
      setSelectedMenuId("");
      setSelectedModifierId("");
      setRequiredQuantity("1");
      setModifierQuantity("1");
      setEditingLinkId(null);
      setEditingModifierLinkId(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(
          InventoryApis.getLedger({ itemId: item.id, skip: 0, limit: 200 }),
        );
        if (cancelled) return;
        const movements: any[] = res.data?.data?.movements || [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let stockIn = 0;
        let stockOut = 0;
        for (const movement of movements) {
          const occurredAt = new Date(movement.created_at);
          if (occurredAt < monthStart) continue;
          const delta = Number(movement.qty_delta) || 0;
          if (delta > 0) stockIn += delta;
          else stockOut += Math.abs(delta);
        }
        setStats({ stockIn, stockOut, recent: movements[0] || null });
      } catch {
        if (!cancelled) setStats({ stockIn: 0, stockOut: 0, recent: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    void loadMenuLinks();
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, restaurantId, loadMenuLinks]);

  if (!item) return null;

  const unit = item.unit || "units";
  const isNegative = Number(item.current_stock) < 0;
  const heroTone = isNegative
    ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20"
    : item.is_low_stock
      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
      : "border-border bg-card";
  const heroNumberTone = isNegative
    ? "text-rose-600"
    : item.is_low_stock
      ? "text-amber-600"
      : "text-foreground";

  const handleAddLink = async () => {
    const quantity = Number(requiredQuantity);
    if (!selectedMenuId) {
      toast.error("Choose a menu item to link");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setLinkSubmitting(true);
    try {
      await apiClient.post(InventoryApis.linkMenuInventory, {
        menu_item_id: Number(selectedMenuId),
        inventory_item_id: Number(item.id),
        quantity_required: quantity,
      });
      toast.success("Menu item linked to inventory");
      setSelectedMenuId("");
      setRequiredQuantity("1");
      setShowLinkForm(false);
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not link this menu item");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const startEditingLink = (link: any) => {
    setEditingLinkId(Number(link.id));
    setEditingQuantity(String(link.quantity_required));
  };

  const handleUpdateLink = async (linkId: number) => {
    const quantity = Number(editingQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setUpdatingLinkId(linkId);
    try {
      await apiClient.patch(InventoryApis.updateMenuInventory(linkId), {
        quantity_required: quantity,
      });
      toast.success("Recipe quantity updated");
      setEditingLinkId(null);
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not update the recipe quantity");
    } finally {
      setUpdatingLinkId(null);
    }
  };

  const handleRemoveLink = async (linkId: number) => {
    setRemovingLinkId(linkId);
    try {
      await apiClient.delete(InventoryApis.unlinkMenuInventory(linkId));
      toast.success("Menu item unlinked from inventory");
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not remove this menu link");
    } finally {
      setRemovingLinkId(null);
    }
  };

  const handleAddModifierLink = async () => {
    const quantity = Number(modifierQuantity);
    if (!selectedModifierId) {
      toast.error("Choose an option or add-on to link");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setModifierLinkSubmitting(true);
    try {
      await apiClient.post(InventoryApis.linkModifierInventory, {
        modifier_id: Number(selectedModifierId),
        inventory_item_id: Number(item.id),
        quantity_required: quantity,
      });
      toast.success("Modifier linked to inventory");
      setSelectedModifierId("");
      setModifierQuantity("1");
      setShowModifierLinkForm(false);
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not link this modifier");
    } finally {
      setModifierLinkSubmitting(false);
    }
  };

  const handleUpdateModifierLink = async (linkId: number) => {
    const quantity = Number(editingModifierQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setUpdatingModifierLinkId(linkId);
    try {
      await apiClient.patch(InventoryApis.updateModifierInventory(linkId), { quantity_required: quantity });
      toast.success("Modifier quantity updated");
      setEditingModifierLinkId(null);
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not update the modifier quantity");
    } finally {
      setUpdatingModifierLinkId(null);
    }
  };

  const handleRemoveModifierLink = async (linkId: number) => {
    setRemovingModifierLinkId(linkId);
    try {
      await apiClient.delete(InventoryApis.unlinkModifierInventory(linkId));
      toast.success("Modifier unlinked from inventory");
      await loadMenuLinks();
      onRecipeLinksChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not remove this modifier link");
    } finally {
      setRemovingModifierLinkId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[580px]">
        <DialogHeader className="space-y-3 border-b px-5 py-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                isNegative
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                  : item.is_low_stock
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    : "bg-primary/10 text-primary",
              )}
            >
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <DialogTitle className="truncate text-lg leading-tight">{item.name}</DialogTitle>
                {item.is_low_stock && (
                  <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    LOW
                  </Badge>
                )}
                {!item.is_active && <Badge variant="secondary">INACTIVE</Badge>}
              </div>
              <p className="text-sm capitalize text-muted-foreground">
                {item.station || "General"} · {unit}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onAddStock(item)}>
              <PlusCircle className="mr-1.5 h-4 w-4" /> Add
            </Button>
            <Button size="sm" variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/30" onClick={() => onReduceStock(item)}>
              <MinusCircle className="mr-1.5 h-4 w-4" /> Reduce
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCountStock(item)}>
              <Scale className="mr-1.5 h-4 w-4" /> Count
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          <div className={cn("rounded-xl border p-4", heroTone)}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Current stock</p>
                <p className={cn("text-3xl font-bold tabular-nums leading-none", heroNumberTone)}>
                  {item.current_stock}
                  <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Book value</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(value ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ArrowDownRight className="h-3.5 w-3.5" />
                <p className="text-[11px] font-semibold uppercase tracking-wide">Stock in</p>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{loading ? "…" : stats?.stockIn ?? 0}<span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span></p>
              <p className="text-[11px] text-muted-foreground">This month</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <p className="text-[11px] font-semibold uppercase tracking-wide">Stock out</p>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{loading ? "…" : stats?.stockOut ?? 0}<span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span></p>
              <p className="text-[11px] text-muted-foreground">This month</p>
            </div>
          </div>

          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-3.5 py-3">
              <div className="flex gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CookingPot className="h-4 w-4" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Used in menu items</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Set the stock amount used each time a linked menu item is prepared.</p>
                </div>
              </div>
              {canManageRecipes && (
                  <Button className="shrink-0 whitespace-nowrap" size="sm" variant={showLinkForm ? "outline" : "default"} onClick={() => setShowLinkForm((shown) => !shown)}>
                  {showLinkForm ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                  {showLinkForm ? "Cancel" : "Link menu"}
                </Button>
              )}
            </div>

            {showLinkForm && canManageRecipes && (
              <div className="space-y-3 border-b bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="inventory-menu-link">Menu item</Label>
                    <Input aria-label="Search menu items" placeholder="Search menu items..." value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} className="mb-1.5 h-8" />
                    <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                      <SelectTrigger id="inventory-menu-link"><SelectValue placeholder="Choose a menu item" /></SelectTrigger>
                      <SelectContent>
                        {filteredMenuItems.map((menu) => <SelectItem key={menu.id} value={String(menu.id)}>{menu.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inventory-menu-quantity">Used per sale</Label>
                    <Input id="inventory-menu-quantity" type="number" min="0.0001" step="any" value={requiredQuantity} onChange={(event) => setRequiredQuantity(event.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Quantity is measured in {unit}. It will be deducted when the menu item follows the normal kitchen completion flow.</p>
                {availableMenuItems.length === 0 ? <p className="text-xs text-muted-foreground">All active menu items are already linked.</p> : <Button size="sm" onClick={handleAddLink} disabled={!selectedMenuId || linkSubmitting}>{linkSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Link menu item</Button>}
              </div>
            )}

            <div className="divide-y">
              {linksLoading ? <div className="flex justify-center p-7"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : menuLinks.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">No menu items use this stock item yet.</div>
              ) : menuLinks.map((link) => {
                const isEditing = editingLinkId === Number(link.id);
                const isSaving = updatingLinkId === Number(link.id);
                const isRemoving = removingLinkId === Number(link.id);
                return <div key={link.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><UtensilsCrossed className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{link.menu_item_name || "Menu item"}</p>
                    {isEditing ? <div className="mt-1.5 flex max-w-[220px] items-center gap-1.5"><Input aria-label={`Quantity used for ${link.menu_item_name || "menu item"}`} type="number" min="0.0001" step="any" value={editingQuantity} onChange={(event) => setEditingQuantity(event.target.value)} className="h-8" /><span className="text-xs text-muted-foreground">{unit}</span></div> : <p className="text-xs text-muted-foreground">Uses {formatQuantity(link.quantity_required)} {unit} per sale</p>}
                  </div>
                  {canManageRecipes && (isEditing ? <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSaving} onClick={() => void handleUpdateLink(Number(link.id))}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSaving} onClick={() => setEditingLinkId(null)}><X className="h-4 w-4" /></Button></div> : <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditingLink(link)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isRemoving} onClick={() => void handleRemoveLink(Number(link.id))}>{isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button></div>) }
                </div>;
              })}
            </div>
            {!canManageRecipes && <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">You can view recipe links, but need inventory recipe permission to change them.</p>}
          </section>

          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-3.5 py-3">
              <div className="flex gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><ListPlus className="h-4 w-4" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Used in options & add-ons</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Track stock used only when the guest selects a specific add-on or option.</p>
                </div>
              </div>
              {canManageRecipes && (
                  <Button className="shrink-0 whitespace-nowrap" size="sm" variant={showModifierLinkForm ? "outline" : "default"} onClick={() => setShowModifierLinkForm((shown) => !shown)}>
                  {showModifierLinkForm ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                  {showModifierLinkForm ? "Cancel" : "Link modifier"}
                </Button>
              )}
            </div>

            {showModifierLinkForm && canManageRecipes && (
              <div className="space-y-3 border-b bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_132px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="inventory-modifier-link">Option or add-on</Label>
                    <Input aria-label="Search options and add-ons" placeholder="Search options and add-ons..." value={modifierSearch} onChange={(event) => setModifierSearch(event.target.value)} className="mb-1.5 h-8" />
                    <Select value={selectedModifierId} onValueChange={setSelectedModifierId}>
                      <SelectTrigger id="inventory-modifier-link"><SelectValue placeholder="Choose an option" /></SelectTrigger>
                      <SelectContent>
                        {filteredModifiers.map((modifier) => <SelectItem key={modifier.id} value={String(modifier.id)}>{modifier.groupName} · {modifier.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inventory-modifier-quantity">Used per choice</Label>
                    <Input id="inventory-modifier-quantity" type="number" min="0.0001" step="any" value={modifierQuantity} onChange={(event) => setModifierQuantity(event.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Quantity is measured in {unit}. It is deducted only when this option is selected on an order.</p>
                {availableModifiers.length === 0 ? <p className="text-xs text-muted-foreground">All active options and add-ons are already linked.</p> : <Button size="sm" onClick={handleAddModifierLink} disabled={!selectedModifierId || modifierLinkSubmitting}>{modifierLinkSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Link modifier</Button>}
              </div>
            )}

            <div className="divide-y">
              {linksLoading ? <div className="flex justify-center p-7"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : modifierLinks.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">No options or add-ons use this stock item yet.</div>
              ) : modifierLinks.map((link) => {
                const isEditing = editingModifierLinkId === Number(link.id);
                const isSaving = updatingModifierLinkId === Number(link.id);
                const isRemoving = removingModifierLinkId === Number(link.id);
                return <div key={link.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Plus className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{link.modifier_name || "Option or add-on"}</p>
                    {isEditing ? <div className="mt-1.5 flex max-w-[220px] items-center gap-1.5"><Input aria-label={`Quantity used for ${link.modifier_name || "option or add-on"}`} type="number" min="0.0001" step="any" value={editingModifierQuantity} onChange={(event) => setEditingModifierQuantity(event.target.value)} className="h-8" /><span className="text-xs text-muted-foreground">{unit}</span></div> : <p className="text-xs text-muted-foreground">{link.modifier_group_name ? `${link.modifier_group_name} · ` : ""}Uses {formatQuantity(link.quantity_required)} {unit} per selection</p>}
                  </div>
                  {canManageRecipes && (isEditing ? <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSaving} onClick={() => void handleUpdateModifierLink(Number(link.id))}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSaving} onClick={() => setEditingModifierLinkId(null)}><X className="h-4 w-4" /></Button></div> : <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingModifierLinkId(Number(link.id)); setEditingModifierQuantity(String(link.quantity_required)); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isRemoving} onClick={() => void handleRemoveModifierLink(Number(link.id))}>{isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button></div>) }
                </div>;
              })}
            </div>
            {!canManageRecipes && <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">You can view modifier links, but need inventory recipe permission to change them.</p>}
          </section>

          {stats?.recent && <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium">{activityLabel(stats.recent)}</p>{stats.recent.reason && <p className="truncate text-xs text-muted-foreground">{stats.recent.reason}</p>}</div><span className="shrink-0 pl-2 text-xs text-muted-foreground">{new Date(stats.recent.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>}

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-lg border p-4">
            {item.accounting_profile?.treatment === "inventory_asset" || Number(item.book_quantity || 0) !== 0 || Number(item.book_unit_cost || 0) !== 0 ? <DetailRow icon={Ruler} label="Inventory unit cost" value={formatCurrency(item.book_unit_cost ?? 0)} /> : <DetailRow icon={Ruler} label="Reference cost estimate" value={formatCurrency(item.operational_unit_cost ?? item.cost_per_unit ?? 0)} />}
            <DetailRow icon={Package} label="Min stock level" value={`${item.min_stock_level ?? 0} ${unit}`} />
            <DetailRow icon={Truck} label="Supplier" value={item.supplier?.name || "Not set"} />
            <DetailRow icon={MapPin} label="Storage location" value={item.storage_location || "Not set"} />
            {item.description && <div className="col-span-2"><DetailRow icon={StickyNote} label="Description" value={item.description} /></div>}
          </div>

          <Button variant="outline" className="w-full" onClick={() => onViewLedger(item)}><History className="mr-2 h-4 w-4" /> View full ledger</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
