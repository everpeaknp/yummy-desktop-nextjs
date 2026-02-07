"use client";

import { useState, useEffect, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import POSSystem from "@/components/orders/pos-system";
import { Utensils, Zap, Truck, ShoppingBag, Sofa, Users, ChevronLeft, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TableApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";

interface Table {
    id: number;
    table_name: string;
    capacity: number;
    status: string;
    table_type_name?: string;
}

export default function NewOrderPage() {
    const [activeTab, setActiveTab] = useState("tables");
    const [selectedTable, setSelectedTable] = useState<number | null>(null);
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(false);

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me);
    const router = useRouter();

    // 1. Session Restoration & Auth Guard
    useEffect(() => {
        const checkAuth = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && token) await me();

            const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && !updatedToken) router.push('/');
        };
        const timer = setTimeout(checkAuth, 500);
        return () => clearTimeout(timer);
    }, [user, me, router]);

    // 2. Data Fetching
    useEffect(() => {
        const fetchTables = async () => {
            if (!user?.restaurant_id) return;
            setLoading(true);
            try {
                const url = TableApis.getTables(user.restaurant_id);
                const response = await apiClient.get(url);
                if (response.data.status === "success") {
                    setTables(response.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch tables:", err);
            } finally {
                setLoading(false);
            }
        };

        if (activeTab === "tables" && user?.restaurant_id) {
            fetchTables();
            const interval = setInterval(fetchTables, 15000); // Poll tables less frequently
            return () => clearInterval(interval);
        }
    }, [activeTab, user]);

    // Group tables by type (Area)
    const tablesByArea = tables.reduce((acc, table) => {
        const area = table.table_type_name || "Main Hall";
        if (!acc[area]) acc[area] = [];
        acc[area].push(table);
        return acc;
    }, {} as Record<string, Table[]>);

    // If a table is selected, show POS with Back button
    if (selectedTable) {
        return (
            <div className="flex flex-col h-full gap-2">
                <div className="flex items-center gap-2 pb-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTable(null)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Tables
                    </Button>
                    <h2 className="text-lg font-semibold">Table Order</h2>
                </div>
                <Suspense fallback={<div>Loading...</div>}>
                    <POSSystem orderId="create" defaultTableId={selectedTable} />
                </Suspense>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Order</h1>
                    <p className="text-muted-foreground">Select a table or order type to start.</p>
                </div>
            </div>

            <Tabs defaultValue="tables" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6 bg-muted p-1 border border-border">
                    <TabsTrigger value="tables" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                        <Sofa className="w-4 h-4 mr-2" /> Tables
                    </TabsTrigger>
                    <TabsTrigger value="quick_bill" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <Zap className="w-4 h-4 mr-2" /> Quick Bill
                    </TabsTrigger>
                    <TabsTrigger value="delivery" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                        <Truck className="w-4 h-4 mr-2" /> Delivery
                    </TabsTrigger>
                    <TabsTrigger value="pickup" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                        <ShoppingBag className="w-4 h-4 mr-2" /> Pickup
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tables" className="mt-0">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {Object.entries(tablesByArea).map(([area, areaTables]) => (
                                <Card key={area} className="bg-card border-border shadow-sm">
                                    <div className="p-4 border-b border-border flex justify-between items-center text-sm">
                                        <h3 className="font-semibold text-primary uppercase tracking-wider">{area}</h3>
                                        <span className="text-xs text-muted-foreground">{areaTables.length} Tables</span>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                            {areaTables.map(table => {
                                                const isOccupied = table.status.toLowerCase() === 'occupied';
                                                const isReserved = table.status.toLowerCase() === 'reserved';

                                                return (
                                                    <button
                                                        key={table.id}
                                                        onClick={() => setSelectedTable(table.id)}
                                                        className={cn(
                                                            "aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105",
                                                            isOccupied
                                                                ? "bg-red-100 border-red-200 text-red-600 dark:bg-red-950/20 dark:border-red-500/50 dark:text-red-500"
                                                                : isReserved
                                                                    ? "bg-yellow-100 border-yellow-200 text-yellow-600 dark:bg-yellow-950/20 dark:border-yellow-500/50 dark:text-yellow-500"
                                                                    : "bg-green-100 border-green-200 text-green-600 hover:bg-green-200 dark:bg-emerald-950/20 dark:border-emerald-500/50 dark:text-emerald-500 dark:hover:bg-emerald-950/30"
                                                        )}
                                                    >
                                                        {isOccupied ? <Users className="w-5 h-5" /> : <Sofa className="w-5 h-5" />}
                                                        <span className="font-bold text-lg">{table.table_name.replace(/\D/g, '') || table.id}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {tables.length === 0 && !loading && (
                                <div className="col-span-full h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed border-slate-800 rounded-lg">
                                    No tables found.
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="quick_bill">
                    <Suspense fallback={<div>Loading...</div>}>
                        <POSSystem orderId="create" defaultChannel="quick_billing" />
                    </Suspense>
                </TabsContent>

                <TabsContent value="delivery">
                    <Suspense fallback={<div>Loading...</div>}>
                        <POSSystem orderId="create" defaultChannel="delivery" />
                    </Suspense>
                </TabsContent>

                <TabsContent value="pickup">
                    <Suspense fallback={<div>Loading...</div>}>
                        <POSSystem orderId="create" defaultChannel="pickup" />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
