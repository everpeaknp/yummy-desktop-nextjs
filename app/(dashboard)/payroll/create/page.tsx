"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";

import apiClient from "@/lib/api-client";
import { PayrollApis, StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type StaffUser = {
  id: number; // user_id
  full_name?: string;
  email?: string;
  role?: string;
  restaurant_id?: number | null;
};

type StaffProfile = {
  id: number; // staff_id
  user_id: number;
};

type PayrollStaffOption = {
  staff_id: number;
  user_id: number;
  label: string;
  sublabel: string;
  role?: string;
};

function yyyyMmDd(d: Date) {
  // Local date input expects YYYY-MM-DD in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PayrollCreatePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const restaurant = useRestaurant((s) => s.restaurant);

  const planState = restaurant?.plan_state?.toLowerCase() || "free";
  const effectivePlan = restaurant?.effective_plan?.toLowerCase() || "free";
  const isPaid =
    (effectivePlan === "paid" || effectivePlan === "trial_paid") &&
    (planState === "paid" || planState === "trialing");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staff, setStaff] = useState<PayrollStaffOption[]>([]);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(yyyyMmDd(today));
  const [dateTo, setDateTo] = useState(yyyyMmDd(today));
  const [taxPercentage, setTaxPercentage] = useState<string>("0");

  const [includeAllStaff, setIncludeAllStaff] = useState(true);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(new Set()); // staff_id

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      // Payroll requires Staff profiles. Users without a Staff profile will fail with:
      // "Staff not found for IDs: [...]"
      const [staffRes, usersRes] = await Promise.all([
        apiClient.get(StaffProfileApis.list({ skip: 0, limit: 500 })),
        apiClient.get(StaffApis.list()),
      ]);

      if (staffRes.data?.status !== "success") {
        toast.error(staffRes.data?.message || "Failed to load staff profiles");
        return;
      }
      if (usersRes.data?.status !== "success") {
        toast.error(usersRes.data?.message || "Failed to load user list");
        return;
      }

      const profiles = (staffRes.data.data || []) as StaffProfile[];
      const users = (usersRes.data.data || []) as StaffUser[];
      const usersById = new Map<number, StaffUser>(users.map((u) => [u.id, u]));

      const options: PayrollStaffOption[] = profiles.map((p) => {
        const u = usersById.get(p.user_id);
        const label = u?.full_name || u?.email || `User #${p.user_id}`;
        const sublabel = `${u?.email || "No email"}${u?.role ? ` • ${u.role}` : ""}`;
        return { staff_id: p.id, user_id: p.user_id, label, sublabel, role: u?.role };
      });

      setStaff(options);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to load staff list");
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !isPaid) router.push("/premium");
  }, [loading, isPaid, router]);

  useEffect(() => {
    if (!user) return;
    if (!isPaid) return;
    if (!includeAllStaff) fetchStaff();
  }, [user, includeAllStaff]);

  const toggleStaff = (id: number) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const tax = Number(taxPercentage);
    if (!dateFrom || !dateTo) return toast.error("Please select a date range");
    if (Number.isNaN(tax) || tax < 0 || tax > 100) return toast.error("Tax % must be between 0 and 100");
    if (!includeAllStaff && selectedStaffIds.size === 0) return toast.error("Select at least one staff member");

    setSubmitting(true);
    try {
      const payload: any = {
        date_from: dateFrom,
        date_to: dateTo,
        tax_percentage: tax,
      };
      if (!includeAllStaff) payload.staff_ids = Array.from(selectedStaffIds); // send staff_id(s)

      const res = await apiClient.post(PayrollApis.createRun, payload);
      if (res.data?.status === "success" && res.data?.data?.id) {
        toast.success("Payroll run created");
        router.push(`/payroll/${res.data.data.id}`);
        return;
      }
      toast.error(res.data?.message || "Failed to create payroll run");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to create payroll run");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-border">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Payroll is a Premium feature</p>
              <p className="text-sm text-muted-foreground">Upgrade to Premium to create payroll runs.</p>
            </div>
            <Link href="/premium">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">View Premium</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4">
        <Link href="/payroll">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Payroll Run</h1>
          <p className="text-muted-foreground">Select a period, tax, and which staff to include.</p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Payroll Period</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tax Percentage</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Applied to payroll calculations.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff Selection
            </CardTitle>
            <p className="text-sm text-muted-foreground">Include everyone by default, or choose staff.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">All staff</span>
            <Switch checked={includeAllStaff} onCheckedChange={setIncludeAllStaff} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {includeAllStaff ? (
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="font-medium">All staff included</p>
                <p className="text-sm text-muted-foreground">Payroll will include every eligible staff member.</p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Default</Badge>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select staff ({selectedStaffIds.size} selected)
                </p>
                <Button variant="outline" onClick={fetchStaff} disabled={staffLoading}>
                  {staffLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Refresh
                </Button>
              </div>

              <ScrollArea className="h-72 rounded-xl border bg-white dark:bg-slate-950">
                <div className="p-3 space-y-2">
                  {staffLoading ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading staff...
                    </div>
                  ) : staff.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      No staff found.
                    </div>
                  ) : (
                    staff.map((s) => (
                      <label
                        key={s.staff_id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/20 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedStaffIds.has(s.staff_id)}
                            onCheckedChange={() => toggleStaff(s.staff_id)}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {s.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.sublabel}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline">Staff #{s.staff_id}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/payroll">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Create Run
        </Button>
      </div>
    </div>
  );
}
