"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import POSSystem from "@/components/orders/pos-system";
import { Zap, Truck, ShoppingBag, Sofa, ChevronLeft, Loader2, Armchair } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TableApis, TableTypeApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { RoomContainer, type TableData } from "@/components/tables/room-container";

interface TableType {
    id: number;
    name: string;
    restaurant_id: number;
    layout_height: number;
}

export default function NewOrderPage() {
    const [activeTab, setActiveTab] = useState("tables");
    const [selectedTable, setSelectedTable] = useState<number | null>(null);
    const [tables, setTables] = useState<TableData[]>([]);
    const [tableTypes, setTableTypes] = useState<TableType[]>([]);
    const [selectedArea, setSelectedArea] = useState("All Areas");
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

    // 2. Data Fetching — tables + table types (for layout_height)
    const fetchData = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const [tablesRes, typesRes] = await Promise.all([
                apiClient.get(TableApis.getTables(user.restaurant_id)),
                apiClient.get(TableTypeApis.getTableTypes(user.restaurant_id)),
            ]);
            if (tablesRes.data.status === "success") {
                setTables(tablesRes.data.data || []);
            }
            if (typesRes.data.status === "success") {
                setTableTypes(typesRes.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch tables:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        if (activeTab === "tables" && user?.restaurant_id) {
            fetchData();
            const interval = setInterval(fetchData, 15000);
            return () => clearInterval(interval);
        }
    }, [activeTab, user?.restaurant_id, fetchData]);

    // ─── Area options ───
    const areaOptions = (() => {
        const set = new Set<string>();
        tableTypes.forEach((tt) => set.add(tt.name));
        tables.forEach((t) => {
            if (t.table_type_name) set.add(t.table_type_name);
        });
        const sorted = Array.from(set).sort();
        return ["All Areas", ...sorted];
    })();

    const getLayoutHeight = (areaName: string): number => {
        const tt = tableTypes.find((t) => t.name === areaName);
        return tt?.layout_height ?? 200;
    };

    // ─── Filter / group ───
    const filteredTables =
        selectedArea === "All Areas"
            ? tables
            : tables.filter((t) => (t.table_type_name || "General") === selectedArea);

    const groupedTables = filteredTables.reduce(
        (acc, table) => {
            const area = table.table_type_name || "General";
            if (!acc[area]) acc[area] = [];
            acc[area].push(table);
            return acc;
        },
        {} as Record<string, TableData[]>
    );
    const sortedRooms = Object.keys(groupedTables).sort();

    const handleTableClick = (table: TableData) => {
        setSelectedTable(table.id);
    };

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
                    <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
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
                    {/* Area Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {areaOptions.map((area) => (
                            <button
                                key={area}
                                onClick={() => setSelectedArea(area)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                    selectedArea === area
                                        ? "bg-orange-600 text-white border-orange-600"
                                        : "bg-card text-foreground border-border hover:bg-muted"
                                )}
                            >
                                {area}
                            </button>
                        ))}
                    </div>

                    {/* Status Legend */}
                    <div className="flex items-center gap-5 text-sm text-muted-foreground mb-5">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Available</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span>Occupied</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                            <span>Reserved</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : tables.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-3">
                            <Armchair className="w-12 h-12 opacity-20" />
                            <p>No tables found.</p>
                        </div>
                    ) : selectedArea !== "All Areas" ? (
                        <RoomContainer
                            title={selectedArea}
                            tables={filteredTables}
                            layoutHeight={getLayoutHeight(selectedArea)}
                            onTableClick={handleTableClick}
                        />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {sortedRooms.map((roomName) => (
                                <RoomContainer
                                    key={roomName}
                                    title={roomName}
                                    tables={groupedTables[roomName]}
                                    layoutHeight={getLayoutHeight(roomName)}
                                    onTableClick={handleTableClick}
                                />
                            ))}
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
