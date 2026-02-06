"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, Calculator, AlertTriangle, Receipt } from "lucide-react";
import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";

interface DayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
}

type Step = 'health-check' | 'financial-snapshot' | 'cash-reconciliation' | 'success';

export function DayCloseModal({ isOpen, onClose, restaurantId }: DayCloseModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('health-check');
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [dayCloseId, setDayCloseId] = useState<number | null>(null);
  const [confirmedData, setConfirmedData] = useState<any>(null);
  const today = new Date();

  // Reset state on close
  const handleClose = () => {
    setCurrentStep('health-check');
    setSnapshotData(null);
    setDayCloseId(null);
    setConfirmedData(null);
    onClose();
  };

  const steps = [
    { id: 'health-check', label: 'Health Check' },
    { id: 'financial-snapshot', label: 'Snapshot' },
    { id: 'cash-reconciliation', label: 'Reconciliation' },
    { id: 'success', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">End of Day Close</h2>
                    <p className="text-muted-foreground text-sm">
                        {format(today, 'MMMM do, yyyy')}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-semibold border border-orange-200 dark:border-orange-900/50">
                      Step {currentStepIndex + 1} of 4
                  </div>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-2">
                 {steps.map((step, index) => {
                     const isCompleted = index < currentStepIndex;
                     const isActive = index === currentStepIndex;
                     return (
                         <div key={step.id} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                             <div 
                                className={cn(
                                    "h-full transition-all duration-500 ease-in-out",
                                    (isActive || isCompleted) ? "bg-orange-500" : "w-0"
                                )} 
                             />
                         </div>
                     )
                 })}
              </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
             {currentStep === 'health-check' && (
                 <HealthCheckStep onNext={() => setCurrentStep('financial-snapshot')} restaurantId={restaurantId} />
             )}
             {currentStep === 'financial-snapshot' && (
                 <FinancialSnapshotStep 
                    restaurantId={restaurantId}
                    onNext={(data, id) => {
                        setSnapshotData(data);
                        setDayCloseId(id);
                        setCurrentStep('cash-reconciliation');
                    }} 
                 />
             )}
             {currentStep === 'cash-reconciliation' && (
                 <CashReconciliationStep 
                    snapshot={snapshotData}
                    dayCloseId={dayCloseId}
                    onNext={(data) => {
                        setConfirmedData(data);
                        setCurrentStep('success');
                    }}
                 />
             )}
             {currentStep === 'success' && (
                 <SuccessStep data={confirmedData} onClose={handleClose} />
             )}
          </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Step Components
// --------------------------------------------------------------------------

function HealthCheckStep({ onNext, restaurantId }: { onNext: () => void; restaurantId: number }) {
    const [checks, setChecks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [canProceed, setCanProceed] = useState(false);

    useEffect(() => {
        const validate = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const res = await apiClient.get(DayCloseApis.validateClose, {
                    params: { restaurant_id: restaurantId, business_date: today }
                });
                
                if (res.data.status === 'success') {
                    const data = res.data.data;
                    const newChecks = [];

                    // 1. Active Orders
                    if (data.active_orders_count > 0) {
                        newChecks.push({ 
                            label: "Active Orders", 
                            status: 'fail', 
                            message: `${data.active_orders_count} active orders need attention` 
                        });
                    } else {
                        newChecks.push({ 
                            label: "Active Orders", 
                            status: 'pass', 
                            message: "All orders completed" 
                        });
                    }

                    // 2. Pending Refunds
                    if (data.pending_refunds_count > 0) {
                        newChecks.push({ 
                            label: "Pending Refunds", 
                            status: 'fail', 
                            message: `${data.pending_refunds_count} refunds pending processing` 
                        });
                    } else {
                        newChecks.push({ 
                            label: "Pending Refunds", 
                            status: 'pass', 
                            message: "No pending refunds" 
                        });
                    }

                    // 3. Other Blockers (e.g. Already Closed)
                    if (data.blockers && data.blockers.length > 0) {
                        // Filter out the ones we already covered to avoid duplication if backend repeats them
                        const otherBlockers = data.blockers.filter((b: string) => 
                            !b.includes("active order") && !b.includes("pending refund")
                        );
                        
                        otherBlockers.forEach((b: string) => {
                             newChecks.push({ 
                                label: "System Validation", 
                                status: 'fail', 
                                message: b 
                            });
                        });
                    }

                    setChecks(newChecks);
                    setCanProceed(data.can_close);
                } else {
                     setChecks([{ label: "Validation Failed", status: 'fail', message: res.data.message }]);
                }
            } catch (err) {
                console.error("Health check failed", err);
                setChecks([{ label: "System Connection", status: 'fail', message: "Failed to connect to server" }]);
            } finally {
                setLoading(false);
            }
        };
        validate();
    }, [restaurantId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <div className="p-2 bg-white dark:bg-blue-950 rounded-lg">
                    <Activity className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">System Health Check</h3>
                    <p className="text-xs opacity-80">Verifying pending orders and unpaid bills...</p>
                </div>
            </div>
            
            <div className="grid gap-4">
                {loading ? (
                    <div className="p-4 text-center text-muted-foreground">Running checks...</div>
                ) : (
                    checks.map((check, i) => (
                        <CheckItem key={i} label={check.label} status={check.status} message={check.message} />
                    ))
                )}
            </div>

            <div className="pt-4 flex justify-end">
                <Button onClick={onNext} disabled={!canProceed} className="gap-2">
                    Continue to Snapshot <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function CheckItem({ label, status, message }: { label: string, status: 'pass' | 'fail' | 'warn', message?: string }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-950">
            <div>
                <span className="font-medium text-sm block">{label}</span>
                {message && <span className="text-xs text-muted-foreground">{message}</span>}
            </div>
            <div className={cn(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
                status === 'pass' ? "text-green-600" : "text-red-500"
            )}>
                {status === 'pass' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {status === 'pass' ? "Passed" : "Action Needed"}
            </div>
        </div>
    )
}

function FinancialSnapshotStep({ onNext, restaurantId }: { onNext: (data: any, id: number) => void; restaurantId: number }) {
    const [snapshot, setSnapshot] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [initiating, setInitiating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const generate = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const res = await apiClient.get(DayCloseApis.generateSnapshot, {
                    params: { 
                        restaurant_id: restaurantId, 
                        business_date: today 
                    }
                });
                if (res.data.status === 'success') {
                    setSnapshot(res.data.data);
                } else {
                    setError(res.data.message || "Failed to generate snapshot");
                }
            } catch (err: any) {
                console.error("Snapshot generation failed", err);
                setError(err.response?.data?.message || "Failed to generate snapshot. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        generate();
    }, [restaurantId]);

    const handleContinue = async () => {
        setInitiating(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await apiClient.post(DayCloseApis.initiate, {
                restaurant_id: restaurantId,
                business_date: today
            });
            
            if (res.data.status === 'success') {
                const dayCloseId = res.data.data.id;
                onNext(snapshot, dayCloseId);
            } else {
                // If initiate fails, we might want to handle it. 
                // However, user might already have an open one.
                // Fallback to checking for current if initiate fails?
                // For now, let's assume success or show error.
                setError(res.data.message || "Failed to initiate day close");
            }
        } catch (err: any) {
            console.error("Initiate failed", err);
            setError(err.response?.data?.message || "Failed to proceed. Please try again.");
        } finally {
            setInitiating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Generating financial snapshot...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                     <p className="font-semibold text-red-600 dark:text-red-400">Generation Failed</p>
                     <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">{error}</p>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
             <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <div className="p-2 bg-white dark:bg-purple-950 rounded-lg">
                    <Calculator className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">Financial Snapshot</h3>
                    <p className="text-xs opacity-80">Review today's calculated totals</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Gross Sales</p>
                    <p className="text-2xl font-bold">Rs. {Number(snapshot?.gross_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Net Sales</p>
                    <p className="text-2xl font-bold">Rs. {Number(snapshot?.net_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Total Orders</p>
                    <p className="text-2xl font-bold">{snapshot?.total_orders || 0}</p>
                </div>
                 <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Cash Collected</p>
                    <p className="text-2xl font-bold">Rs. {Number(snapshot?.cash_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
            
            <div className="pt-4 flex justify-end">
                <Button onClick={handleContinue} disabled={initiating} className="gap-2">
                    {initiating ? "Starting..." : "Confirm & Reconcile"} <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function CashReconciliationStep({ onNext, snapshot, dayCloseId }: { onNext: (data: any) => void; snapshot: any; dayCloseId: number | null }) {
    const [actualCash, setActualCash] = useState<string>('');
    const [confirmationNotes, setConfirmationNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!dayCloseId) {
            setError("Missing Day Close ID. Please restart the process.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
             const res = await apiClient.post(DayCloseApis.confirm(dayCloseId), {
                 actual_cash: Number(actualCash),
                 confirmation_notes: confirmationNotes
             });
             if (res.data.status === 'success') {
                 onNext(res.data.data);
             } else {
                 setError(res.data.message || "Failed to submit day close.");
             }
        } catch (err: any) {
            console.error("Failed to confirm day close", err);
            setError(err.response?.data?.message || "Failed to submit day close.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <div className="p-2 bg-white dark:bg-emerald-950 rounded-lg">
                    <Receipt className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold">Cash Reconciliation</h3>
                    <p className="text-xs opacity-80">Verify physical cash on hand</p>
                </div>
            </div>

            <div className="space-y-4">
                 <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
                     <p className="text-sm font-medium mb-2">Expected Cash</p>
                     <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                        Rs. {Number(snapshot?.cash_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                     </p>
                 </div>
                 
                 <div className="space-y-2">
                     <label className="text-sm font-medium">Actual Cash Count</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rs.</span>
                        <input 
                            type="number" 
                            className="w-full text-2xl p-4 pl-12 rounded-xl border bg-background" 
                            placeholder="0.00"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                        />
                     </div>
                 </div>

                 <div className="space-y-2">
                     <label className="text-sm font-medium">Notes (Optional)</label>
                     <textarea 
                        className="w-full p-3 rounded-xl border bg-background text-sm" 
                        placeholder="Any discrepancies or comments..."
                        rows={3}
                        value={confirmationNotes}
                        onChange={(e) => setConfirmationNotes(e.target.value)}
                     />
                 </div>

                 {error && (
                     <div className="p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" />
                         {error}
                     </div>
                 )}
            </div>

            <div className="pt-4 flex justify-end">
                <Button 
                    onClick={handleSubmit} 
                    disabled={submitting || !actualCash}
                    variant="default" 
                    className="gap-2 bg-green-600 hover:bg-green-700"
                >
                    {submitting ? "Closing..." : "Submit Day Close"} <CheckCircle2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

function SuccessStep({ onClose, data }: { onClose: () => void; data: any }) {
    const discrepancy = Number(data?.cash_discrepancy || 0);
    const isMatched = Math.abs(discrepancy) < 0.01;
    const isOverage = discrepancy > 0;

    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-6">
            <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center border-4",
                isMatched ? "bg-green-100 text-green-600 border-green-200" :
                isOverage ? "bg-blue-100 text-blue-600 border-blue-200" :
                "bg-red-100 text-red-600 border-red-200"
            )}>
                {isMatched ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                    {isMatched ? "Day Closed Successfully!" : "Day Closed with Discrepancy"}
                </h2>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                    All reports have been generated and the sales register has been reset for tomorrow.
                </p>
            </div>

            {!isMatched && (
                <div className={cn(
                    "p-4 rounded-xl border w-full max-w-sm mx-auto text-left",
                    isOverage ? "bg-blue-50 border-blue-100 dark:bg-blue-900/20" : "bg-red-50 border-red-100 dark:bg-red-900/20"
                )}>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                         <span className="text-muted-foreground">Expected:</span>
                         <span className="font-mono text-right font-medium">Rs. {Number(data?.expected_cash || 0).toFixed(2)}</span>
                         
                         <span className="text-muted-foreground">Actual:</span>
                         <span className="font-mono text-right font-medium">Rs. {Number(data?.actual_cash || 0).toFixed(2)}</span>
                         
                         <div className="col-span-2 h-px bg-slate-200 dark:bg-slate-700 my-1" />
                         
                         <span className="font-semibold">{isOverage ? "Overage:" : "Shortage:"}</span>
                         <span className={cn("font-mono text-right font-bold", isOverage ? "text-blue-600" : "text-red-600")}>
                             {isOverage ? "+" : ""}
                             Rs. {discrepancy.toFixed(2)}
                         </span>
                    </div>
                    <div className="mt-3 text-xs bg-white dark:bg-slate-950 p-2 rounded border border-black/5 dark:border-white/5 mx-auto text-center">
                        {isOverage ? "Recorded as Income Entry" : "Recorded as Expense Entry"}
                    </div>
                </div>
            )}

            <Button onClick={onClose} size="lg" className="min-w-[200px]">
                Done
            </Button>
        </div>
    )
}

function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
