"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { StaffApis, UserAccessScopeApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, Wallet, Clock, Shield, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { AuthApis, RoleApis } from "@/lib/api/endpoints";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type ScopeKey = "analytics" | "orders" | "receipts";
type AccessScopeRow = {
  scope_key: ScopeKey;
  max_lookback_days?: number | null;
  window_start?: string | null;
  window_end?: string | null;
};

function DateInputWithPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  const setSelected = (d?: Date) => {
    if (!d) return onChange("");
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyyMmDd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    onChange(yyyyMmDd);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            !selected && "text-muted-foreground"
          )}
          aria-label="Pick date"
        >
          <span>{selected ? format(selected, "PPP") : "mm/dd/yyyy"}</span>
          <Calendar className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={selected}
          onSelect={setSelected}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function StaffDetailPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const id = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any>(null);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submittingPerms, setSubmittingPerms] = useState(false);

  const [scopesLoading, setScopesLoading] = useState(false);
  const [scopesByKey, setScopesByKey] = useState<Partial<Record<ScopeKey, AccessScopeRow>>>({});
  const [scopeDrafts, setScopeDrafts] = useState<Record<ScopeKey, { max_lookback_days: string; window_start: string; window_end: string }>>({
    analytics: { max_lookback_days: "", window_start: "", window_end: "" },
    orders: { max_lookback_days: "", window_start: "", window_end: "" },
    receipts: { max_lookback_days: "", window_start: "", window_end: "" },
  });
  const [scopeSavingKey, setScopeSavingKey] = useState<ScopeKey | null>(null);
  const [scopeDeletingKey, setScopeDeletingKey] = useState<ScopeKey | null>(null);

  const user = useAuth(state => state.user);
  const router = useRouter();

  const coerceDate = (raw: string) => {
    const v = String(raw || "").trim();
    return v ? v : null;
  };

  const hydrateScopeDrafts = (rows: AccessScopeRow[]) => {
    const next: any = {
      analytics: { max_lookback_days: "", window_start: "", window_end: "" },
      orders: { max_lookback_days: "", window_start: "", window_end: "" },
      receipts: { max_lookback_days: "", window_start: "", window_end: "" },
    };
    for (const r of rows) {
      const k = r.scope_key;
      if (!next[k]) continue;
      next[k] = {
        max_lookback_days: r.max_lookback_days != null ? String(r.max_lookback_days) : "",
        window_start: r.window_start ? String(r.window_start).slice(0, 10) : "",
        window_end: r.window_end ? String(r.window_end).slice(0, 10) : "",
      };
    }
    setScopeDrafts(next);
  };

  const fetchScopes = async (userId: string | number) => {
    setScopesLoading(true);
    try {
      const res = await apiClient.get(UserAccessScopeApis.list(userId));
      if (res.data?.status === "success") {
        const rows = (res.data.data || []) as AccessScopeRow[];
        const map: Partial<Record<ScopeKey, AccessScopeRow>> = {};
        for (const r of rows) map[r.scope_key] = r;
        setScopesByKey(map);
        hydrateScopeDrafts(rows);
      } else {
        setScopesByKey({});
        hydrateScopeDrafts([]);
      }
    } catch (err: any) {
      setScopesByKey({});
      hydrateScopeDrafts([]);
      toast.error(err?.response?.data?.detail || "Failed to load access scopes");
    } finally {
      setScopesLoading(false);
    }
  };

  const saveScope = async (scopeKey: ScopeKey) => {
    if (!id) return;
    const draft = scopeDrafts[scopeKey];
    const maxDaysRaw = String(draft.max_lookback_days || "").trim();
    const maxDays = maxDaysRaw ? Number(maxDaysRaw) : null;
    const windowStart = coerceDate(draft.window_start);
    const windowEnd = coerceDate(draft.window_end);

    if (!maxDays && !windowStart && !windowEnd) {
      toast.error("Set at least one constraint: max lookback days or a date window.");
      return;
    }
    if (maxDaysRaw && (!Number.isFinite(maxDays) || (maxDays as number) < 1 || (maxDays as number) > 3650)) {
      toast.error("Max lookback days must be between 1 and 3650.");
      return;
    }
    if (windowStart && windowEnd && windowStart > windowEnd) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    setScopeSavingKey(scopeKey);
    try {
      const payload: any = {};
      if (maxDays) payload.max_lookback_days = maxDays;
      if (windowStart) payload.window_start = windowStart;
      if (windowEnd) payload.window_end = windowEnd;

      const res = await apiClient.put(UserAccessScopeApis.upsert(id as string, scopeKey), payload);
      if (res.data?.status === "success") {
        toast.success("Access scope saved");
        await fetchScopes(id as string);
      } else {
        toast.error(res.data?.message || "Failed to save access scope");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save access scope");
    } finally {
      setScopeSavingKey(null);
    }
  };

  const deleteScope = async (scopeKey: ScopeKey) => {
    if (!id) return;
    setScopeDeletingKey(scopeKey);
    try {
      const res = await apiClient.delete(UserAccessScopeApis.remove(id as string, scopeKey));
      if (res.data?.status === "success") {
        toast.success("Access scope removed");
        await fetchScopes(id as string);
      } else {
        toast.error(res.data?.message || "Failed to remove access scope");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove access scope");
    } finally {
      setScopeDeletingKey(null);
    }
  };

  useEffect(() => {
    const fetchStaffDetail = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await apiClient.get(StaffApis.getStaff(id as string));
        if (response.data.status === "success") {
          const staffDetail = response.data.data;
          setStaff(staffDetail);
          setSelectedPermissions(staffDetail.permissions || []);
          fetchScopes(id as string);
        }
      } catch (err) {
        console.error("Failed to fetch staff detail:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchPermissions = async () => {
      setPermissionsLoading(true);
      try {
        // Align with staff list page: permission catalog is served by /roles/permissions.
        const response = await apiClient.get(RoleApis.listPermissions);
        if (response.data?.status === "success") setAvailablePermissions(response.data.data || []);
        else setAvailablePermissions([]);
      } catch (err) {
        console.error("Failed to fetch permissions:", err);
        setAvailablePermissions([]);
      } finally {
        setPermissionsLoading(false);
      }
    };

    fetchStaffDetail();
    fetchPermissions();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to deactivate this staff member?")) return;
    try {
      await apiClient.delete(StaffApis.delete(id as string));
      toast.success("Staff member deactivated");
      router.push('/staff');
    } catch (err: any) {
      console.error("Failed to delete staff:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to deactivate staff member";
      toast.error(errMsg);
    }
  };

  const handleUpdatePermissions = async () => {
    setSubmittingPerms(true);
    try {
      await apiClient.post(AuthApis.updateUserPermissions(id as string), {
        permission_keys: selectedPermissions
      });
      toast.success("Permissions updated successfully");
      setIsPermDialogOpen(false);
      
      // Refresh staff data to get updated permissions
      const response = await apiClient.get(StaffApis.getStaff(id as string));
      if (response.data.status === "success") {
        setStaff(response.data.data);
      }
    } catch (err) {
      console.error("Failed to update permissions:", err);
      toast.error("Failed to update permissions");
    } finally {
      setSubmittingPerms(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6">
        <Link href="/staff">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
            <p className="text-muted-foreground">The staff record you are looking for does not exist or you don't have permission to view it.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{staff.name}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> {staff.primary_role || staff.role} • ID: #STF-{staff.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Deactivate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic contact and profile details.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={staff.email || "N/A"} />
            <InfoItem icon={<Calendar className="w-4 h-4" />} label="Joined Date" value={staff.created_at ? format(new Date(staff.created_at), 'MMMM dd, yyyy') : "N/A"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Primary Role" value={<Badge variant="outline" className="capitalize">{staff.primary_role || staff.role}</Badge>} />
            <InfoItem 
              icon={<Shield className="w-4 h-4" />} 
              label="All Roles" 
              value={
                <div className="flex flex-wrap gap-1 mt-1">
                  {(staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role || "Staff"]).map((r: string) => (
                    <Badge key={r} variant="secondary" className="capitalize text-[10px] py-0">{r}</Badge>
                  ))}
                </div>
              } 
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Security & Permissions</CardTitle>
              <CardDescription>Granular access control settings.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsPermDialogOpen(true)}>
              <Shield className="w-4 h-4 mr-2" /> Manage
            </Button>
          </CardHeader>
          <CardContent>
             <div className="flex flex-wrap gap-2">
               {staff.permissions && staff.permissions.length > 0 ? (
                 staff.permissions.map((p: string) => (
                   <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                     {p}
                   </Badge>
                 ))
               ) : (
                 <p className="text-sm text-muted-foreground italic">No customized permissions. User has default role-based access.</p>
               )}
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Scopes</CardTitle>
            <CardDescription>
              Limit how far back this staff can view analytics/orders/receipts (time window or lookback days).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {scopesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading scopes…
              </div>
            ) : (
              (["analytics", "orders", "receipts"] as ScopeKey[]).map((k) => {
                const exists = Boolean(scopesByKey[k]);
                const draft = scopeDrafts[k];
                return (
                  <div key={k} className="p-4 rounded-2xl border border-border/60 bg-muted/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold capitalize">{k}</p>
                        <p className="text-xs text-muted-foreground">
                          {exists
                            ? "Scope is active (restrictions apply)."
                            : "No scope set (full access allowed)."}
                        </p>
                      </div>
                      <Badge variant={exists ? "secondary" : "outline"} className="uppercase text-[10px] font-bold">
                        {exists ? "Scoped" : "Unscoped"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Max Lookback Days</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g. 30"
                          value={draft.max_lookback_days}
                          onChange={(e) =>
                            setScopeDrafts((prev) => ({
                              ...prev,
                              [k]: { ...prev[k], max_lookback_days: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Window Start</Label>
                        <DateInputWithPicker
                          value={draft.window_start}
                          onChange={(next) =>
                            setScopeDrafts((prev) => ({
                              ...prev,
                              [k]: { ...prev[k], window_start: next },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Window End</Label>
                        <DateInputWithPicker
                          value={draft.window_end}
                          onChange={(next) =>
                            setScopeDrafts((prev) => ({
                              ...prev,
                              [k]: { ...prev[k], window_end: next },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <Button
                        className="sm:w-auto"
                        onClick={() => saveScope(k)}
                        disabled={scopeSavingKey === k || scopeDeletingKey === k}
                      >
                        {scopeSavingKey === k ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Scope
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteScope(k)}
                        disabled={!exists || scopeSavingKey === k || scopeDeletingKey === k}
                      >
                        {scopeDeletingKey === k ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Remove Scope
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>Recent actions performed by this staff member.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-center py-8 text-muted-foreground">
               No recent activity logs found.
             </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPermDialogOpen} onOpenChange={setIsPermDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Granular Permissions</DialogTitle>
            <DialogDescription>
              Select specific permissions to grant or override defaults for {staff.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[350px] pr-4">
              {permissionsLoading ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading permissions…
                </div>
              ) : availablePermissions.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
                  <p>No permission catalog returned.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        setPermissionsLoading(true);
                        const response = await apiClient.get(RoleApis.listPermissions);
                        if (response.data?.status === "success") setAvailablePermissions(response.data.data || []);
                      } catch {
                        // ignore
                      } finally {
                        setPermissionsLoading(false);
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(
                    availablePermissions.reduce((acc: any, curr: any) => {
                      if (!acc[curr.module]) acc[curr.module] = [];
                      acc[curr.module].push(curr);
                      return acc;
                    }, {})
                  ).map(([module, perms]: [string, any]) => (
                    <div key={module} className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                        {module}
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {perms.map((p: any) => (
                          <div key={p.key} className="flex items-start space-x-3">
                            <Checkbox
                              id={`perm-detail-${p.key}`}
                              checked={selectedPermissions.includes(p.key)}
                              onCheckedChange={(checked) => {
                                setSelectedPermissions((prev) =>
                                  checked ? [...prev, p.key] : prev.filter((k) => k !== p.key)
                                );
                              }}
                            />
                            <div className="grid gap-1.5 leading-none">
                              <label
                                htmlFor={`perm-detail-${p.key}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {p.key}
                              </label>
                              {p.description && (
                                <p className="text-xs text-muted-foreground">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePermissions} disabled={submittingPerms}>
              {submittingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: any, label: string, value: any }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
