"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import POSSystem from "@/components/orders/pos-system";
import { Zap, Truck, ShoppingBag, Sofa, ChevronLeft, Loader2, Armchair } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn, getImageUrl } from "@/lib/utils";
import { TableApis, TableTypeApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


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

    // Order Type Cards Configuration
    const orderTypes = [
        { 
            id: 'tables', 
            label: 'Tables', 
            icon: Sofa, 
            description: 'Dine-in service', 
            activeColor: 'bg-orange-600',
            borderColor: 'group-hover:border-orange-200'
        },
        { 
            id: 'quick_bill', 
            label: 'Quick Bill', 
            icon: Zap, 
            description: 'Fast checkout', 
            activeColor: 'bg-blue-600',
            borderColor: 'group-hover:border-blue-200'
        },
        { 
            id: 'delivery', 
            label: 'Delivery', 
            icon: Truck, 
            description: 'Online orders', 
            activeColor: 'bg-purple-600',
            borderColor: 'group-hover:border-purple-200'
        },
        { 
            id: 'pickup', 
            label: 'Pickup', 
            icon: ShoppingBag, 
            description: 'Takeaway service', 
            activeColor: 'bg-green-600',
            borderColor: 'group-hover:border-green-200'
        },
    ];

    return (
        <div className="flex flex-col min-h-screen lg:h-[calc(100vh-2rem)] max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 overflow-hidden">

            <div className="flex flex-col gap-1 mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
                <p className="text-muted-foreground">Choose an order type to begin service.</p>
            </div>

            {/* Premium (Clean) Order Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">


                {orderTypes.map((type) => (
                    <Card 
                        key={type.id}
                        className={cn(
                            "relative overflow-hidden cursor-pointer transition-all duration-200 border-border group active:scale-[0.98] shadow-sm",
                            activeTab === type.id 
                                ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20" 
                                : "bg-card hover:bg-muted/30 hover:shadow-md"
                        )}
                        onClick={() => setActiveTab(type.id)}
                    >
                        <CardContent className="p-5 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-xl transition-all duration-200",
                                    activeTab === type.id 
                                        ? type.activeColor + " text-white shadow-lg shadow-black/10" 
                                        : "bg-muted text-muted-foreground group-hover:bg-background"
                                )}>
                                    <type.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-bold tracking-tight">{type.label}</h3>
                                    <p className="text-xs text-muted-foreground font-medium">{type.description}</p>
                                </div>
                                {activeTab === type.id && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>



            <div className="mt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                {activeTab === "tables" ? (
                    <div className="flex-1 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Area Filter Chips */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 p-1 bg-muted/30 rounded-2xl w-fit shrink-0">
                            {areaOptions.map((area) => (
                                <button
                                    key={area}
                                    onClick={() => setSelectedArea(area)}
                                    className={cn(
                                        "px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                                        selectedArea === area
                                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm ring-1 ring-border/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    {area}
                                </button>
                            ))}
                        </div>

                        {/* Status Legend */}
                        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-8 ml-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                                <span>Available</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                                <span>Occupied</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
                                <span>Reserved</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground border-2 border-dashed border-border/40 rounded-[2rem] bg-muted/5">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="font-bold uppercase tracking-widest text-xs">Synchronizing Layout</p>
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/40 rounded-[2rem] gap-4 bg-muted/5">
                                <Armchair className="w-16 h-16 opacity-10" />
                                <p className="font-bold uppercase tracking-widest text-xs">No floor plan data found</p>
                            </div>
                        ) : selectedArea !== "All Areas" ? (
                            <RoomContainer
                                title={selectedArea}
                                tables={filteredTables}
                                layoutHeight={getLayoutHeight(selectedArea)}
                                onTableClick={handleTableClick}
                            />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Suspense fallback={
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            </div>
                        }>
                            <POSSystem 
                                orderId="create" 
                                defaultChannel={
                                    activeTab === "quick_bill" ? "quick_billing" : 
                                    activeTab === "delivery" ? "delivery" : "pickup"
                                } 
                            />
                        </Suspense>
                    </div>
                )}
            </div>

        </div>
    );

}
