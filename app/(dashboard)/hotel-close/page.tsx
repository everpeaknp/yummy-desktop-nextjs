"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bed, Utensils, Calendar, Calculator, ChevronRight, AlertTriangle, Coins, RefreshCw, KeyRound, ReceiptText } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { useRestaurant } from "@/hooks/use-restaurant";
import { DayCloseApis, AnalyticsApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { toast } from "sonner";

export default function HotelClosePage() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [currentSession, setCurrentSession] = useState<any>(null);
    const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const user = useAuth(state => state.user);
    const { ready, canViewAnalytics } = useAnalyticsViewAccess();
    const restaurant = useRestaurant((s) => s.restaurant);

    const fetchHotelData = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        setError(null);
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // 1. Fetch current Hotel Day Close session status
            const sessionRes = await apiClient.get(DayCloseApis.current({
                restaurantId: user.restaurant_id,
                businessLine: "hotel"
            }));
            if (sessionRes.data?.status === "success") {
                setCurrentSession(sessionRes.data.data);
            }

            // 2. Fetch Hotel Dashboard analytics data
            const dashboardRes = await apiClient.get(AnalyticsApis.dashboard({
                restaurantId: user.restaurant_id,
                businessLine: "hotel",
                timezone,
                include: "core"
            }));
            if (dashboardRes.data?.status === "success") {
                setDashboardData(dashboardRes.data.data);
            } else {
                setError(dashboardRes.data?.message || "Failed to load hotel analytics");
            }
        } catch (err: any) {
            console.error("Failed to load hotel close details", err);
            setError(err.response?.data?.message || "Failed to sync hotel operational records");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        if (ready && canViewAnalytics && user?.restaurant_id) {
            fetchHotelData();
        }
    }, [ready, canViewAnalytics, user?.restaurant_id, fetchHotelData]);

    if (!ready || loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-xs uppercase tracking-widest font-black text-muted-foreground">Synchronizing Hotel Ledger...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold">Failed to load Hotel Day Close</h3>
                <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
                <Button onClick={fetchHotelData} variant="outline" className="rounded-xl">Retry Sync</Button>
            </div>
        );
    }

    // Isolate Room/Rent revenue vs Food/F&B revenue
    // Backend V2 dashboard or breakdown has category distributions or rent metrics
    const tabs = dashboardData?.tabs || {};
    const overview = tabs.overview?.overview || dashboardData?.overview || {};
    const kpis = tabs.overview?.kpis || tabs.finance?.kpis || dashboardData?.kpis || {};
    
    // Calculate Room Rent vs F&B splits
    // F&B is all non-rent items, Room Rent has category/revenue_category = rent
    const totalSales = kpis.gross_sales || overview.total_income || 0;
    
    // Find room rent from menu performance tabs or overall rent keys
    const roomRentSales = dashboardData?.rent_revenue ?? dashboardData?.tabs?.finance?.room_revenue ?? (() => {
        // Fallback: search breakdown category mix for "rent" or "rooms"
        const breakdown = tabs.overview?.breakdown || tabs.finance?.breakdown || dashboardData?.breakdown || {};
        const catMix = breakdown.income_by_category || breakdown.income_by_menu_category || [];
        const rentObj = catMix.find((c: any) => String(c.label || c.category_name || "").toLowerCase() === "rent" || String(c.label || c.category_name || "").toLowerCase() === "room charge");
        return rentObj?.amount || 0;
    })();

    const foodSales = Math.max(0, totalSales - roomRentSales);

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10 px-4 md:px-8">
            {/* Header section with Premium visual identity */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Hotel Day Close</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-wider text-orange-500 font-bold">
                        {restaurant?.name || "Hotel Operations"} • Room Folio Reconciliation
                    </p>
                </div>
                {currentSession && (
                    <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-orange-500" />
                        <span>Active Session Business Date: <strong>{currentSession.business_date}</strong></span>
                    </div>
                )}
            </div>

            {/* Split Metrics: Rooms Rent vs Food Sales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-500/[0.03] to-blue-500/[0.01] border-blue-500/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-60" />
                    <CardHeader className="pb-2">
                        <div className="p-2 bg-blue-500/10 w-fit rounded-xl text-blue-500 mb-2">
                            <Bed className="w-5 h-5" />
                        </div>
                        <CardTitle className="text-sm font-bold text-blue-500 uppercase tracking-widest">Room Rent Revenue</CardTitle>
                        <CardDescription>Accommodations and daily room rentals</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <span className="text-3xl font-black text-foreground">Rs. {roomRentSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-semibold border-t border-border/40 pt-3">
                            <span>Contribution Ratio:</span>
                            <span className="text-blue-500 font-bold">
                                {totalSales > 0 ? `${Math.round((roomRentSales / totalSales) * 100)}%` : "0%"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/[0.03] to-orange-500/[0.01] border-orange-500/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 opacity-60" />
                    <CardHeader className="pb-2">
                        <div className="p-2 bg-orange-500/10 w-fit rounded-xl text-orange-500 mb-2">
                            <Utensils className="w-5 h-5" />
                        </div>
                        <CardTitle className="text-sm font-bold text-orange-500 uppercase tracking-widest">Food & Beverage Revenue</CardTitle>
                        <CardDescription>Restaurant, Room Service and Dining charges</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <span className="text-3xl font-black text-foreground">Rs. {foodSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-semibold border-t border-border/40 pt-3">
                            <span>Contribution Ratio:</span>
                            <span className="text-orange-500 font-bold">
                                {totalSales > 0 ? `${Math.round((foodSales / totalSales) * 100)}%` : "0%"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reconciliation and Session Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Coins className="w-4 h-4 text-orange-500" />
                            Folio Summary
                        </CardTitle>
                        <CardDescription>Operational breakdown for this day close interval</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-border/40 text-sm">
                            <span className="font-semibold text-muted-foreground">Total Combined Revenue</span>
                            <span className="font-bold text-foreground">Rs. {totalSales.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/40 text-sm">
                            <span className="font-semibold text-muted-foreground">Total Operational Expenses</span>
                            <span className="font-bold text-red-500">Rs. {(overview.total_expense || kpis.total_expense || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/40 text-sm">
                            <span className="font-semibold text-muted-foreground">Net Lodging Cash Flow</span>
                            <span className="font-bold text-emerald-500">Rs. {(totalSales - (overview.total_expense || kpis.total_expense || 0)).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 text-sm">
                            <span className="font-semibold text-muted-foreground">Total Outstanding Credits (Unpaid Room Bills)</span>
                            <span className="font-bold text-blue-500">Rs. {(dashboardData?.receivables?.total_outstanding || 0).toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Day Close Call to Action Panel */}
                <Card className="border-orange-500/20 bg-orange-500/[0.01] flex flex-col justify-between shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <ReceiptText className="w-4 h-4 text-orange-500" />
                            Perform Hotel Close
                        </CardTitle>
                        <CardDescription>
                            Reconcile all room accounts, folio logs, and close the current hotel business day.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end gap-4 pt-4">
                        <div className="text-xs text-muted-foreground bg-muted p-3.5 rounded-xl border border-border/60 font-semibold space-y-2">
                            <p>⚠️ Before closing the hotel day:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Ensure all occupied rooms are checked in correctly.</li>
                                <li>Verify all posted room service bills are closed or charged to folios.</li>
                            </ul>
                        </div>
                        <Button 
                            className="bg-orange-500 hover:bg-orange-600 text-white w-full rounded-xl py-5 font-bold gap-2 flex items-center justify-center shadow-lg shadow-orange-500/10 transition-all active:scale-[0.98]"
                            onClick={() => setIsDayCloseOpen(true)}
                        >
                            Close Hotel Day <ChevronRight className="w-4 h-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Integration with Day Close Modal scoped for Hotel */}
            {user?.restaurant_id && (
                <DayCloseModal
                    isOpen={isDayCloseOpen}
                    onClose={() => {
                        setIsDayCloseOpen(false);
                        fetchHotelData();
                    }}
                    restaurantId={user.restaurant_id}
                    businessLine="hotel"
                />
            )}
        </div>
    );
}
