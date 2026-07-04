"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Loader2, Plus, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, InventoryApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { AccountingNav } from "./accounting-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ChartAccount,
  InventoryAccountingProfile,
  InventoryAccountingTreatment,
  InventoryAdoption,
  InventoryLegacyAudit,
} from "@/types/accounting";

type BaseResponse<T> = { data?: T; message?: string };
type InventoryItem = {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  book_quantity?: number;
  book_unit_cost?: number;
  accounting_profile_id?: number | null;
};

const emptyProfile = {
  name: "",
  treatment: "inventory_asset" as InventoryAccountingTreatment,
  inventory_asset_account_id: "",
  cogs_account_id: "",
  direct_expense_account_id: "",
  wastage_account_id: "",
  variance_account_id: "",
  is_default: false,
};

export function InventoryAccountingClient() {
  const user = useAuth((state) => state.user);
  const restaurantId = user?.restaurant_id;
  const canView = hasPermission(user, "inventory.accounting.view");
  const canManage = hasPermission(user, "inventory.accounting.manage");
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<InventoryAccountingProfile[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [adoptions, setAdoptions] = useState<InventoryAdoption[]>([]);
  const [audit, setAudit] = useState<InventoryLegacyAudit | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);

  const draft = useMemo(
    () => adoptions.find((adoption) => adoption.status === "draft") ?? null,
    [adoptions],
  );
  const posted = useMemo(
    () => adoptions.find((adoption) => adoption.status === "posted") ?? null,
    [adoptions],
  );
  const ledgerAccounts = accounts.filter((account) => account.node_type !== "group" && account.is_active);

  const load = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const [profilesResponse, accountsResponse, itemsResponse, adoptionsResponse, auditResponse] =
        await Promise.all([
          apiClient.get<BaseResponse<InventoryAccountingProfile[]>>(
            AccountingApis.inventoryProfiles(restaurantId),
          ),
          apiClient.get<BaseResponse<ChartAccount[]>>(
            AccountingApis.accounts({ restaurantId }),
          ),
          apiClient.get(InventoryApis.listInventoryWithQuery({ restaurantId, limit: 1000 })),
          apiClient.get<BaseResponse<InventoryAdoption[]>>(
            AccountingApis.inventoryAdoptions(restaurantId),
          ),
          apiClient.get<BaseResponse<InventoryLegacyAudit>>(
            AccountingApis.inventoryLegacyAudit(restaurantId),
          ),
        ]);
      setProfiles(profilesResponse.data.data ?? []);
      setAccounts(accountsResponse.data.data ?? []);
      setItems(itemsResponse.data.data?.items ?? []);
      setAdoptions(adoptionsResponse.data.data ?? []);
      setAudit(auditResponse.data.data ?? null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Inventory accounting data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const createProfile = async () => {
    if (!restaurantId) return;
    const numberOrNull = (value: string) => (value ? Number(value) : null);
    try {
      await apiClient.post(AccountingApis.createInventoryProfile(), {
        restaurant_id: restaurantId,
        name: profileForm.name.trim(),
        treatment: profileForm.treatment,
        inventory_asset_account_id: numberOrNull(profileForm.inventory_asset_account_id),
        cogs_account_id: numberOrNull(profileForm.cogs_account_id),
        direct_expense_account_id: numberOrNull(profileForm.direct_expense_account_id),
        wastage_account_id: numberOrNull(profileForm.wastage_account_id),
        variance_account_id: numberOrNull(profileForm.variance_account_id),
        is_default: profileForm.is_default,
        is_active: true,
      });
      toast.success("Inventory profile created.");
      setProfileDialogOpen(false);
      setProfileForm(emptyProfile);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Profile could not be created.");
    }
  };

  const assignProfile = async (itemId: number, profileId: string) => {
    if (!restaurantId) return;
    try {
      await apiClient.put(AccountingApis.assignInventoryProfile(itemId, restaurantId), {
        accounting_profile_id: profileId === "default" ? null : Number(profileId),
        reason: "Accountant inventory policy assignment",
      });
      toast.success("Item profile updated.");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Profile assignment failed.");
    }
  };

  const createAdoption = async () => {
    if (!restaurantId) return;
    try {
      await apiClient.post(AccountingApis.createInventoryAdoption(), {
        restaurant_id: restaurantId,
        activation_at: new Date().toISOString(),
      });
      toast.success("Inventory adoption draft created.");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Adoption draft could not be created.");
    }
  };

  const updateAdoptionLine = async (
    itemId: number,
    profileId: number,
    unitBookValue: number,
  ) => {
    if (!restaurantId || !draft) return;
    try {
      await apiClient.patch(
        AccountingApis.updateInventoryAdoptionLine(draft.id, itemId, restaurantId),
        { accounting_profile_id: profileId, unit_book_value: unitBookValue },
      );
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Adoption line could not be updated.");
    }
  };

  const postAdoption = async () => {
    if (!restaurantId || !draft) return;
    try {
      await apiClient.post(AccountingApis.postInventoryAdoption(draft.id, restaurantId));
      toast.success("Opening inventory valuation posted.");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Adoption could not be posted.");
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5" />
          <div><h1 className="font-semibold">Permission required</h1><p className="text-sm">Inventory accounting access is not assigned to this role.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">Profiles, opening valuation, COGS, and legacy review.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <AccountingNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Profiles</p><p className="mt-1 text-xl font-semibold">{profiles.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assigned items</p><p className="mt-1 text-xl font-semibold">{items.filter((item) => item.accounting_profile_id).length}/{items.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Opening valuation</p><p className="mt-1 text-xl font-semibold">Rs. {Number(posted?.total_book_value ?? draft?.total_book_value ?? 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Legacy exceptions</p><p className="mt-1 text-xl font-semibold">{audit?.legacy_unclassified ?? 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="profiles">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="assignments">Item assignments</TabsTrigger>
          <TabsTrigger value="adoption">Opening valuation</TabsTrigger>
          <TabsTrigger value="exceptions">Legacy review</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Accounting profiles</CardTitle>
              {canManage ? <Button size="sm" onClick={() => setProfileDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New profile</Button> : null}
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-5 py-3">Profile</th><th className="px-5 py-3">Treatment</th><th className="px-5 py-3">Asset / Expense</th><th className="px-5 py-3">COGS</th><th className="px-5 py-3">Status</th></tr></thead>
                <tbody>{profiles.map((profile) => <tr key={profile.id} className="border-b"><td className="px-5 py-3 font-medium">{profile.name}{profile.is_default ? " · Default" : ""}</td><td className="px-5 py-3">{profile.treatment === "inventory_asset" ? "Stock value" : "Expense immediately"}</td><td className="px-5 py-3">{profile.inventory_asset_account_id ?? profile.direct_expense_account_id ?? "-"}</td><td className="px-5 py-3">{profile.cogs_account_id ?? "-"}</td><td className="px-5 py-3">{profile.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Item assignments</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] text-sm"><thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Profile</th></tr></thead><tbody>
              {items.map((item) => <tr key={item.id} className="border-b"><td className="px-5 py-3 font-medium">{item.name}</td><td className="px-5 py-3">{Number(item.current_stock).toLocaleString()} {item.unit}</td><td className="px-5 py-3"><Select disabled={!canManage} value={item.accounting_profile_id ? String(item.accounting_profile_id) : "default"} onValueChange={(value) => void assignProfile(item.id, value)}><SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Restaurant default</SelectItem>{profiles.filter((profile) => profile.is_active).map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{profile.name}</SelectItem>)}</SelectContent></Select></td></tr>)}
            </tbody></table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="adoption" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Opening inventory valuation</CardTitle><p className="mt-1 text-sm text-muted-foreground">Existing quantities remain unchanged. Enter book values only for capitalized stock.</p></div>{!draft && !posted && canManage ? <Button onClick={createAdoption}><BookOpenCheck className="mr-2 h-4 w-4" />Start adoption</Button> : null}</CardHeader>
            <CardContent className="p-0">
              {posted ? <div className="p-5 text-sm"><p className="font-medium text-emerald-700">Posted on {new Date(posted.posted_at || posted.created_at).toLocaleString()}</p><p className="mt-1">Opening inventory: Rs. {Number(posted.total_book_value).toLocaleString()}</p></div> : draft ? <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Profile</th><th className="px-5 py-3">Unit value</th><th className="px-5 py-3">Total</th></tr></thead><tbody>{draft.lines.map((line) => <tr key={line.id} className="border-b"><td className="px-5 py-3 font-medium">{line.item_name}</td><td className="px-5 py-3">{Number(line.quantity_snapshot).toLocaleString()} {line.unit}</td><td className="px-5 py-3"><Select value={line.accounting_profile_id ? String(line.accounting_profile_id) : ""} onValueChange={(value) => void updateAdoptionLine(line.inventory_item_id, Number(value), Number(line.unit_book_value))}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Select profile" /></SelectTrigger><SelectContent>{profiles.filter((profile) => profile.is_active).map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{profile.name}</SelectItem>)}</SelectContent></Select></td><td className="px-5 py-3"><Input className="w-32" type="number" min="0" step="0.01" defaultValue={Number(line.unit_book_value)} disabled={line.treatment === "direct_expense"} onBlur={(event) => line.accounting_profile_id && void updateAdoptionLine(line.inventory_item_id, line.accounting_profile_id, Number(event.target.value))} /></td><td className="px-5 py-3">Rs. {Number(line.total_book_value).toLocaleString()}</td></tr>)}</tbody></table><div className="flex items-center justify-between border-t p-5"><span className="font-semibold">Total: Rs. {Number(draft.total_book_value).toLocaleString()}</span>{canManage ? <Button onClick={postAdoption}><Save className="mr-2 h-4 w-4" />Post opening valuation</Button> : null}</div></div> : <p className="p-5 text-sm text-muted-foreground">No inventory adoption has been started.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Legacy inventory review</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[760px] text-sm"><thead className="border-y bg-muted/40 text-left text-muted-foreground"><tr><th className="px-5 py-3">Adjustment</th><th className="px-5 py-3">Item</th><th className="px-5 py-3">Cost</th><th className="px-5 py-3">Classification</th><th className="px-5 py-3">Reason</th></tr></thead><tbody>{(audit?.lines ?? []).map((line) => <tr key={line.adjustment_id} className="border-b"><td className="px-5 py-3">#{line.adjustment_id}</td><td className="px-5 py-3 font-medium">{line.item_name}</td><td className="px-5 py-3">{line.cost == null ? "-" : `Rs. ${Number(line.cost).toLocaleString()}`}</td><td className="px-5 py-3">{line.classification.replaceAll("_", " ")}</td><td className="px-5 py-3 text-muted-foreground">{line.reason}</td></tr>)}</tbody></table>{!audit?.lines.length ? <p className="p-5 text-sm text-muted-foreground">No legacy inventory exceptions.</p> : null}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New inventory accounting profile</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Name</Label><Input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Food Stock" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Treatment</Label><Select value={profileForm.treatment} onValueChange={(value) => setProfileForm({ ...profileForm, treatment: value as InventoryAccountingTreatment })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inventory_asset">Stock value, then COGS</SelectItem><SelectItem value="direct_expense">Expense immediately</SelectItem></SelectContent></Select></div>
            {profileForm.treatment === "inventory_asset" ? <><AccountSelect label="Inventory asset account" value={profileForm.inventory_asset_account_id} accounts={ledgerAccounts.filter((account) => account.account_type === "asset")} onChange={(value) => setProfileForm({ ...profileForm, inventory_asset_account_id: value })} /><AccountSelect label="COGS account" value={profileForm.cogs_account_id} accounts={ledgerAccounts.filter((account) => account.account_type === "expense")} onChange={(value) => setProfileForm({ ...profileForm, cogs_account_id: value })} /></> : <AccountSelect label="Direct expense account" value={profileForm.direct_expense_account_id} accounts={ledgerAccounts.filter((account) => account.account_type === "expense")} onChange={(value) => setProfileForm({ ...profileForm, direct_expense_account_id: value })} />}
            <AccountSelect label="Wastage account" value={profileForm.wastage_account_id} accounts={ledgerAccounts.filter((account) => account.account_type === "expense")} onChange={(value) => setProfileForm({ ...profileForm, wastage_account_id: value })} optional />
            <AccountSelect label="Variance account" value={profileForm.variance_account_id} accounts={ledgerAccounts.filter((account) => account.account_type === "expense")} onChange={(value) => setProfileForm({ ...profileForm, variance_account_id: value })} optional />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Cancel</Button><Button onClick={createProfile} disabled={!profileForm.name.trim()}>Create profile</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountSelect({ label, value, accounts, onChange, optional = false }: { label: string; value: string; accounts: ChartAccount[]; onChange: (value: string) => void; optional?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value || (optional ? "none" : "")} onValueChange={(next) => onChange(next === "none" ? "" : next)}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{optional ? <SelectItem value="none">Use standard mapping</SelectItem> : null}{accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.code} · {account.name}</SelectItem>)}</SelectContent></Select></div>;
}
