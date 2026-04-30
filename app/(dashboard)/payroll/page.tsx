"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { PayrollApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Search, Filter, DollarSign, Calendar, ArrowLeft, CheckCircle2, AlertCircle, Clock, FileText, Crown, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRestaurant } from "@/hooks/use-restaurant";
import { toast } from "sonner";

type PayrollRunList = {
  id: number;
  date_from: string;
  date_to: string;
  status: string;
  paid_at?: string | null;
  total_payroll_amount?: number;
  total_amount?: number;
};

export default function PayrollPage() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PayrollRunList[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffCountByRunId, setStaffCountByRunId] = useState<Record<number, number>>({});

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();
  const restaurant = useRestaurant((s) => s.restaurant);

  const planState = restaurant?.plan_state?.toLowerCase() || "free";
  const effectivePlan = restaurant?.effective_plan?.toLowerCase() || "free";
  const isPaid =
    (effectivePlan === "paid" || effectivePlan === "trial_paid") &&
    (planState === "paid" || planState === "trialing");

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');
    };
    checkAuth();
  }, [user, me, router]);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const statuses = statusFilter === 'all' ? undefined : [statusFilter];
      const response = await apiClient.get(PayrollApis.listRuns(statuses));
      if (response.data.status === "success") {
        const list = (response.data.data || []) as PayrollRunList[];
        setRuns(list);
        setStaffCountByRunId({});

        // List endpoint does not include item count; fetch a few details to show accurate staff counts.
        const top = list.slice(0, 12);
        const settled = await Promise.allSettled(
          top.map(async (r) => {
            const detail = await apiClient.get(PayrollApis.getRun(r.id));
            const items = detail.data?.data?.items;
            const count = Array.isArray(items) ? items.length : undefined;
            return { id: r.id, count };
          })
        );
        const nextCounts: Record<number, number> = {};
        for (const s of settled) {
          if (s.status === "fulfilled" && typeof s.value.count === "number") {
            nextCounts[s.value.id] = s.value.count;
          }
        }
        if (Object.keys(nextCounts).length) setStaffCountByRunId(nextCounts);
      }
    } catch (err) {
      console.error("Failed to fetch payroll runs:", err);
      const e: any = err;
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to fetch payroll runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPaid) {
      setLoading(false);
      return;
    }
    if (user?.restaurant_id) {
      fetchRuns();
    }
  }, [user, statusFilter, isPaid]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
    if (s === 'approved') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    if (s === 'draft') return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
    if (s === 'cancelled') return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const totalPayroll = runs.reduce((acc, run) => acc + (run.total_payroll_amount || run.total_amount || 0), 0);
  const pendingApproval = runs.filter(r => r.status === 'draft').length;

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
            <p className="text-muted-foreground">Manage staff compensation and payroll runs.</p>
          </div>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => router.push('/payroll/create')}>
          <Plus className="w-4 h-4 mr-2" /> New Payroll Run
        </Button>
      </div>

      {!isPaid ? (
        <Card className="border-border">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/20">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Payroll is a Premium feature</h2>
                <p className="text-sm text-muted-foreground">
                  Your current plan doesn’t include payroll management. Upgrade to enable payroll runs, approvals, and PDF exports.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/premium">
                <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  View Premium
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Total Payroll (Historic)" value={`Rs. ${totalPayroll.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} color="text-emerald-600" />
        <MetricCard label="Pending Approval" value={pendingApproval} icon={<Clock className="w-5 h-5" />} color="text-amber-600" />
        <MetricCard label="Last Run" value={runs[0]?.date_to ? new Date(runs[0].date_to).toLocaleDateString() : 'None'} icon={<Calendar className="w-5 h-5" />} color="text-blue-600" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Runs History</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : !isPaid ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          Upgrade to Premium to view payroll runs.
        </div>
      ) : (
        <Card className="border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No payroll runs found.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => router.push(`/payroll/${run.id}`)}>
                    <TableCell className="font-medium">#PR-{run.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{new Date(run.date_from).toLocaleDateString()} - {new Date(run.date_to).toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">
                          {run.paid_at ? `Paid on: ${new Date(run.paid_at).toLocaleDateString()}` : "Paid on: —"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-500">
                      Rs. {Number(run.total_payroll_amount || run.total_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeof staffCountByRunId[run.id] === "number" ? `${staffCountByRunId[run.id]} Staff` : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                       <Button variant="ghost" size="sm" onClick={() => router.push(`/payroll/${run.id}`)}>
                         <FileText className="w-4 h-4 mr-1" /> View
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color }: any) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-muted ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
