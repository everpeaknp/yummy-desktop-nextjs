"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { PeriodCloseApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Download,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getISOWeek, getYear, format, startOfISOWeek, endOfISOWeek, subWeeks, subMonths } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
// import * as XLSX from "xlsx"; // Removed for optimization

export default function PeriodReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [periodType, setPeriodType] = useState("weekly");
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));
  const [previewData, setPreviewData] = useState<any>(null);
  const [activePeriodData, setActivePeriodData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewingHistorical, setViewingHistorical] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchReports = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const api =
        periodType === "weekly"
          ? PeriodCloseApis.listWeekly
          : PeriodCloseApis.listMonthly;
      const response = await apiClient.get(api(user.restaurant_id, selectedYear));
      if (response.data.status === "success") {
        setReports(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch period reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchReports();
      fetchActivePeriod();
    }
  }, [user, periodType, selectedYear]);

  const fetchActivePeriod = async () => {
    if (!user?.restaurant_id) return;
    try {
      const now = new Date();
      const year = getYear(now);
      const week = getISOWeek(now);
      const month = now.getMonth() + 1;

      const api = periodType === "weekly"
        ? PeriodCloseApis.weeklyPreview(user.restaurant_id, year, week)
        : PeriodCloseApis.monthlyPreview(user.restaurant_id, year, month);

      const response = await apiClient.get(api);
      if (response.data.status === "success") {
        setActivePeriodData(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch active period data:", err);
    }
  };

  const handlePreview = async (period?: { year: number; week?: number; month?: number }) => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const now = new Date();
      let year = period?.year || getYear(now);
      let week = period?.week || getISOWeek(now);
      let month = period?.month || now.getMonth() + 1;

      // Ensure we don't preview future weeks/months
      if (periodType === "weekly" && year === getYear(now) && week > getISOWeek(now)) {
        week = getISOWeek(now);
      }

      const api =
        periodType === "weekly"
          ? PeriodCloseApis.weeklyPreview(user.restaurant_id, year, week)
          : PeriodCloseApis.monthlyPreview(user.restaurant_id, year, month);

      const response = await apiClient.get(api);
      if (response.data.status === "success") {
        setPreviewData(response.data.data);
        setShowPreview(true);
      }
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      toast.error(err.response?.data?.detail || "Failed to load period preview");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!user?.restaurant_id || !previewData) return;
    setConfirming(true);
    try {
      const api =
        periodType === "weekly"
          ? PeriodCloseApis.confirmWeekly(user.restaurant_id, previewData.year, previewData.week_number)
          : PeriodCloseApis.confirmMonthly(user.restaurant_id, previewData.year, previewData.month);

      const response = await apiClient.post(api);
      if (response.data.status === "success") {
        toast.success(`${periodType === "weekly" ? "Weekly" : "Monthly"} close confirmed!`);
        setShowPreview(false);
        fetchReports();
        fetchActivePeriod();
      }
    } catch (err: any) {
      console.error("Failed to confirm period close:", err);
      toast.error(err.response?.data?.detail || "Failed to confirm period close");
    } finally {
      setConfirming(false);
    }
  };

  const handleDownload = async (report: any) => {
    try {
       const XLSX = await import("xlsx");
       const isWeekly = !!report.week_number;
       const data = [
         ["Period Summary", isWeekly ? `Week ${report.week_number}` : format(new Date(selectedYear, report.month - 1), 'MMMM')],
         ["Year", report.year || selectedYear],
         ["Status", "Closed"],
         ["Confirmed At", report.confirmed_at ? format(new Date(report.confirmed_at), 'MMM dd, yyyy HH:mm') : "N/A"],
         [],
         ["FINANCIAL OVERVIEW"],
         ["Net Sales", report.net_sales || report.total_net_income || 0],
         ["Total Expenses", report.expense_total || report.total_expenses || 0],
         ["Profit/Loss", (report.net_sales || report.total_net_income || 0) - (report.expense_total || report.total_expenses || 0)],
         [],
         ["PAYMENT BREAKDOWN"],
         ["Cash Sales", report.cash_sales || 0],
         ["Card Sales", report.card_sales || 0],
         ["Digital / QR", report.digital_sales || 0],
         ["Fonepay Sales", report.fonepay_sales || 0],
         [],
         ["TAX & ADJUSTMENTS"],
         ["Tax Collected", report.tax_total || 0],
         ["Discounts", report.discount_total || 0],
         ["Refunds", report.refund_total || 0],
       ];
       
       const ws = XLSX.utils.aoa_to_sheet(data);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
       
       const fileName = isWeekly 
         ? `Weekly_Report_W${report.week_number}_${selectedYear}.xlsx`
         : `Monthly_Report_${format(new Date(selectedYear, report.month - 1), 'MMMM')}_${selectedYear}.xlsx`;
         
       XLSX.writeFile(wb, fileName);
       toast.success("Report exported to Excel");
    } catch (err) {
       console.error("Export failed:", err);
       toast.error("Failed to export report");
    }
  };

  const handleViewHistorical = (report: any) => {
     setPreviewData(report);
     setViewingHistorical(true);
     setShowPreview(true);
  };

  const currentWeekNum = getISOWeek(new Date());
  const currentMonthNum = new Date().getMonth() + 1;

  // Find active report (current week/month if not in historical list)
  const isActiveClosed = reports.some(r => 
    (periodType === "weekly" && r.week_number === currentWeekNum) || 
    (periodType === "monthly" && r.month === currentMonthNum)
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Period Close</h1>
          <p className="text-muted-foreground mt-1">
            Store #52 • Yummy Restaurant Group
          </p>
        </div>
      </div>

      <Tabs
        value={periodType}
        onValueChange={(v) => {
          setPeriodType(v);
          setShowPreview(false);
        }}
        className="w-full"
      >
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 gap-8">
          <TabsTrigger
            value="weekly"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-0 pb-4 pt-2 font-semibold text-base transition-all"
          >
            Weekly
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-0 pb-4 pt-2 font-semibold text-base transition-all"
          >
            Monthly
          </TabsTrigger>
        </TabsList>

        <div className="space-y-8 mt-8">
          {/* Active Period Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
              <h2 className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground/70">
                Live Period Monitor
              </h2>
            </div>

            <Card className="bg-card border-border shadow-sm hover:shadow-md hover:border-orange-500/40 transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden" onClick={() => { setViewingHistorical(false); handlePreview(); }}>
              <CardContent className="p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                  <div className="space-y-3">
                    <h3 className="text-4xl font-bold tracking-tight group-hover:text-orange-600 transition-colors">
                      {periodType === "weekly" ? `Week ${currentWeekNum}` : format(new Date(), 'MMMM')}
                    </h3>
                    <div className="flex items-center gap-2.5 text-muted-foreground/80">
                       <Calendar className="w-4 h-4" />
                       <p className="text-sm font-semibold">
                        {periodType === "weekly" 
                          ? `${format(startOfISOWeek(new Date()), 'MMM dd')} - ${format(endOfISOWeek(new Date()), 'MMM dd')}`
                          : `${format(new Date(), 'MMMM 01')} - ${format(new Date(), 'MMM dd')}`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-1.5">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider opacity-60">Real-time Revenue</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-muted-foreground font-semibold">Rs.</span>
                       <p className="text-6xl font-bold tracking-tight">
                        {Number(activePeriodData?.net_sales || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-10 pt-8 border-t border-border/60 flex justify-between items-center">
                   <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground/50">
                        <Clock className="w-4 h-4" />
                        <span>Aggregated {activePeriodData ? 'just now' : '...'}</span>
                      </div>
                      {activePeriodData?.blockers?.length > 0 && (
                        <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[10px] font-bold uppercase text-amber-600 shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{activePeriodData.blockers.length} System Warnings</span>
                        </div>
                      )}
                   </div>
                   <div className="flex gap-4">
                      <Button 
                        onClick={(e) => { e.stopPropagation(); fetchActivePeriod(); }} 
                        variant="secondary" 
                        size="icon" 
                        className="h-11 w-11 text-muted-foreground hover:text-orange-600 hover:bg-orange-50/50 rounded-full border border-border/60 shadow-sm"
                      >
                         <RefreshCw className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"} />
                      </Button>
                      <Button className="bg-orange-600 hover:bg-orange-700 text-white border-none h-12 px-10 font-bold uppercase text-xs tracking-normal shadow-xl shadow-orange-500/20 transition-all rounded-xl transform active:scale-[0.98]">
                        Review & Confirm Close
                      </Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Closed History
                </h2>
              </div>
              <div className="flex items-center bg-card border border-border rounded-lg px-2 h-9">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold px-3 min-w-[60px] text-center">{selectedYear}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : reports.length === 0 ? (
               <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
                  <FileText className="w-10 h-10 mb-4 opacity-10" />
                  <p className="text-sm font-semibold opacity-60">No finalized records for {selectedYear}</p>
                </div>
            ) : (
              <div className="grid gap-3">
                {reports.map((report) => (
                  <Card key={report.id} className="bg-card border-border/60 hover:border-orange-500/20 hover:bg-muted/10 transition-all duration-200 group cursor-pointer" onClick={() => handleViewHistorical(report)}>
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="p-2.5 rounded-xl bg-muted border border-border group-hover:bg-background transition-colors">
                          <Calendar className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground group-hover:text-orange-500 transition-colors">
                             {periodType === "weekly" 
                               ? `Week ${report.week_number || '?'}` 
                               : report.month 
                                 ? format(new Date(selectedYear, report.month - 1), 'MMMM') 
                                 : 'Monthly Close'
                             }
                          </h3>
                          <p className="text-[11px] text-muted-foreground/70 font-bold uppercase tracking-wider">
                            {report.confirmed_at 
                              ? format(new Date(report.confirmed_at), 'MMM dd, yyyy') 
                              : report.week_start_date && report.week_end_date
                                ? `${format(new Date(report.week_start_date), 'MMM dd')} - ${format(new Date(report.week_end_date), 'MMM dd')}`
                                : 'Finalized Record'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-10">
                         <div className="text-right hidden sm:block">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-normal opacity-60 mb-0.5">Total Revenue</p>
                            <p className="text-lg font-bold text-foreground/90">Rs. {Number(report.net_sales || report.total_net_income || 0).toLocaleString()}</p>
                         </div>
                         <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-background rounded-full">
                               <FileText className="w-4 h-4" />
                            </Button>
                            <Button 
                               onClick={(e) => { e.stopPropagation(); handleDownload(report); }} 
                               variant="ghost" 
                               size="icon" 
                               className="text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5 rounded-full"
                            >
                               <Download className="w-4 h-4" />
                            </Button>
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border p-0 overflow-hidden rounded-3xl shadow-2xl">
          <DialogHeader className="p-8 pb-5 flex flex-row items-center justify-between bg-muted/20 border-b border-border/40">
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {periodType === "weekly" 
                  ? `Week ${previewData?.week_number || '?'}` 
                  : (previewData?.month ? format(new Date(selectedYear, previewData.month - 1), 'MMMM') : 'Period')} Close
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-normal opacity-80">
                {viewingHistorical ? 'Historical Financial Statement' : 'Preview Final Financials'}
              </p>
            </div>
            <Badge variant="secondary" className={`${viewingHistorical ? 'bg-emerald-500/10 text-emerald-700' : 'bg-orange-500/10 text-orange-700'} border-none font-bold uppercase text-[10px] tracking-normal h-8 px-5 rounded-full`}>
              {viewingHistorical ? 'Confirmed' : 'Pending'}
            </Badge>
          </DialogHeader>

          <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20 p-6 rounded-2xl space-y-1.5 transition-colors group hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-normal opacity-80">Net Sales</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">Rs. {Number(previewData?.net_sales || previewData?.total_net_income || 0).toLocaleString()}</p>
              </div>
              <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20 p-6 rounded-2xl space-y-1.5 transition-colors group hover:bg-red-50 dark:hover:bg-red-500/10">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-500 uppercase tracking-normal opacity-80">Total Expenses</p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-400 tracking-tight">Rs. {Number(previewData?.expense_total || previewData?.total_expenses || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-muted/40 p-6 rounded-2xl border border-border/60 shadow-sm">
               <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Total Days</span>
                  <p className="text-lg font-bold text-foreground">{previewData?.total_days || 0}</p>
               </div>
               <div className="space-y-1 text-right">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Confirmed Days</span>
                  <p className="text-lg font-bold text-foreground">{previewData?.confirmed_days_count || 0}</p>
               </div>
            </div>

            <div className="space-y-5">
               <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-1">Payment Breakdown</h4>
               <div className="grid grid-cols-1 gap-4 bg-muted/20 p-2 rounded-2xl border border-border/40">
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Cash Sales</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.cash_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Card Sales</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.card_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Digital / QR</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.digital_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-semibold text-muted-foreground">Fonepay</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.fonepay_sales || 0).toLocaleString()}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-5">
               <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-1">Adjustments & Compliance</h4>
               <div className="grid grid-cols-1 gap-4 bg-muted/20 p-2 rounded-2xl border border-border/40">
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Tax Collected</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.tax_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Discounts Applied</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.discount_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-semibold text-muted-foreground">Refunds Processed</span>
                    <span className="text-sm font-bold text-red-500">Rs. {Number(previewData?.refund_total || 0).toLocaleString()}</span>
                  </div>
               </div>
            </div>
          </div>

          <DialogFooter className="p-8 pt-4 flex flex-col gap-4 bg-muted/30 border-t border-border/40">
            {!viewingHistorical ? (
              <Button 
                  onClick={handleConfirm} 
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-sm uppercase tracking-normal shadow-xl shadow-orange-500/10 rounded-2xl transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                  disabled={confirming || !previewData?.can_close}
              >
                {confirming ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                Authorize Final Period Close
              </Button>
            ) : (
                <Button 
                   onClick={() => handleDownload(previewData)} 
                   className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-sm uppercase tracking-normal rounded-2xl shadow-lg transition-all"
                >
                   <Download className="w-5 h-5 mr-3" />
                   Download Financial Summary
                </Button>
            )}
            <Button 
                variant="ghost" 
                onClick={() => setShowPreview(false)} 
                className="w-full text-muted-foreground hover:text-foreground font-semibold h-11 text-xs tracking-wider"
            >
              {viewingHistorical ? 'Back to Dashboard' : 'Review Documents Later'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
