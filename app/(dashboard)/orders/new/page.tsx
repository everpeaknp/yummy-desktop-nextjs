"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import POSSystem from "@/components/orders/pos-system";
import { Zap, Truck, ShoppingBag, Sofa, ChevronLeft, Loader2, Armchair, Bed, BedDouble, Filter, Table2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn, getImageUrl } from "@/lib/utils";
import { TableApis, TableTypeApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEntitlement } from "@/hooks/use-subscription";


interface TableType {
    id: number;
    name: string;
    restaurant_id: number;
    layout_height: number;
}

export default function NewOrderPage() {
    const [activeTab, setActiveTab] = useState("tables");
    const [multiTableMode, setMultiTableMode] = useState(false);
    const [selectedTables, setSelectedTables] = useState<number[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [activePOS, setActivePOS] = useState<{
        orderId: string;
        tableId?: number;
        tableIds?: number[];
        channel?: string;
    } | null>(null);
    const [tables, setTables] = useState<TableData[]>([]);
    const [rooms, setRooms] = useState<TableData[]>([]);
    const [tableTypes, setTableTypes] = useState<TableType[]>([]);
    const [roomTableTypes, setRoomTableTypes] = useState<TableType[]>([]);
    const [selectedArea, setSelectedArea] = useState("All Areas");
    const [selectedWing, setSelectedWing] = useState("All Floors");
    const [loading, setLoading] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(false);

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me);
    const restaurant = useRestaurant((s) => s.restaurant);
    const router = useRouter();
    const hotelEnabled = restaurant?.hotel_enabled ?? false;
    const dineInAccess = useEntitlement("orders.dine_in.enabled", true);
    const takeawayAccess = useEntitlement("orders.takeaway.enabled", true);
    const deliveryAccess = useEntitlement("orders.delivery.enabled", true);
    const hotelAccess = useEntitlement("business.hotel.enabled", hotelEnabled);
    const orderAccessLoading =
        dineInAccess.loading ||
        takeawayAccess.loading ||
        deliveryAccess.loading ||
        hotelAccess.loading;
    const orderAccessError =
        (!dineInAccess.resolved && dineInAccess.error) ||
        (!takeawayAccess.resolved && takeawayAccess.error) ||
        (!deliveryAccess.resolved && deliveryAccess.error) ||
        (!hotelAccess.resolved && hotelAccess.error);

    useEffect(() => {
        if (orderAccessLoading || orderAccessError) return;
        const allowedByTab: Record<string, boolean> = {
            tables: dineInAccess.allowed,
            rooms: hotelEnabled && hotelAccess.allowed,
            quick_bill: takeawayAccess.allowed,
            delivery: deliveryAccess.allowed,
            pickup: takeawayAccess.allowed,
        };
        if (allowedByTab[activeTab]) return;
        const firstAllowed = Object.keys(allowedByTab).find((tab) => allowedByTab[tab]);
        setActiveTab(firstAllowed ?? "locked");
        setActivePOS(null);
        setSelectedTables([]);
    }, [
        activeTab,
        deliveryAccess.allowed,
        dineInAccess.allowed,
        hotelAccess.allowed,
        hotelEnabled,
        orderAccessError,
        orderAccessLoading,
        takeawayAccess.allowed,
    ]);

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
                apiClient.get(`${TableApis.getTables(user.restaurant_id)}?space_kind=table`),
                apiClient.get(`${TableTypeApis.getTableTypes(user.restaurant_id)}?space_kind=table`),
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

    // 3. Data Fetching — rooms (space_kind=room) + room table types (for floor layout_height)
    const fetchRooms = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoadingRooms(true);
        try {
            const [roomsRes, typesRes] = await Promise.all([
                apiClient.get(`${TableApis.getTables(user.restaurant_id)}?space_kind=room`),
                apiClient.get(`${TableTypeApis.getTableTypes(user.restaurant_id)}?space_kind=room`),
            ]);
            if (roomsRes.data.status === "success") {
                setRooms(roomsRes.data.data || []);
            }
            if (typesRes.data.status === "success") {
                setRoomTableTypes(typesRes.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch rooms:", err);
        } finally {
            setLoadingRooms(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        if (activeTab === "tables" && user?.restaurant_id) {
            fetchData();
            const interval = setInterval(fetchData, 15000);
            return () => clearInterval(interval);
        }
    }, [activeTab, user?.restaurant_id, fetchData]);

    useEffect(() => {
        if (activeTab === "rooms" && user?.restaurant_id) {
            fetchRooms();
            const interval = setInterval(fetchRooms, 15000);
            return () => clearInterval(interval);
        }
    }, [activeTab, user?.restaurant_id, fetchRooms]);

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
    const areaStats = areaOptions.map((area) => {
        const bucket =
            area === "All Areas"
                ? tables
                : tables.filter((t) => (t.table_type_name || "General") === area);
        const occupied = bucket.filter((t) => String(t.status).toLowerCase() === "occupied").length;
        return { area, total: bucket.length, occupied };
    });

    // ─── Room Floor options ───
    const roomAreaOptions = (() => {
        const set = new Set<string>();
        roomTableTypes.forEach((tt) => set.add(tt.name));
        rooms.forEach((r) => {
            if (r.table_type_name) set.add(r.table_type_name);
        });
        const sorted = Array.from(set).sort();
        return ["All Floors", ...sorted];
    })();

    const getRoomLayoutHeight = (floorName: string): number => {
        const tt = roomTableTypes.find((t) => t.name === floorName);
        return tt?.layout_height ?? 200;
    };

    // ─── Room Filter / group ───
    const filteredRooms =
        selectedWing === "All Floors"
            ? rooms
            : rooms.filter((r) => (r.table_type_name || "General") === selectedWing);

    const groupedRooms = filteredRooms.reduce(
        (acc, room) => {
            const floor = room.table_type_name || "General";
            if (!acc[floor]) acc[floor] = [];
            acc[floor].push(room);
            return acc;
        },
        {} as Record<string, TableData[]>
    );
    const sortedRoomFloors = Object.keys(groupedRooms).sort();

    const roomAreaStats = roomAreaOptions.map((floor) => {
        const bucket =
            floor === "All Floors"
                ? rooms
                : rooms.filter((r) => (r.table_type_name || "General") === floor);
        const occupied = bucket.filter((r) => String(r.status).toLowerCase() === "occupied").length;
        return { floor, total: bucket.length, occupied };
    });

    const handleTableClick = (table: TableData) => {
        if (!multiTableMode) {
            const existingOrderId = table.active_order_ids?.[0] || 'create';
            setActivePOS({
                orderId: existingOrderId.toString(),
                tableId: table.id,
            });
            return;
        }
        setSelectedTables(prev => {
            if (prev.includes(table.id)) {
                return prev.filter(id => id !== table.id);
            } else {
                return [...prev, table.id];
            }
        });
    };

    if (orderAccessLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (orderAccessError) {
        return (
            <div className="mx-auto w-full max-w-2xl p-6">
                <Card>
                    <CardContent className="space-y-4 p-6">
                        <h1 className="text-lg font-bold">Unable to verify order-channel access</h1>
                        <p className="text-sm text-muted-foreground">{orderAccessError}</p>
                        <Button variant="outline" onClick={() => router.push("/premium")}>Open billing</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (activeTab === "locked") {
        return (
            <div className="mx-auto w-full max-w-2xl p-6">
                <Card>
                    <CardContent className="space-y-4 p-6">
                        <h1 className="text-lg font-bold">No ordering channel is included in this plan</h1>
                        <p className="text-sm text-muted-foreground">Review the published plans to enable an ordering workflow.</p>
                        <Button onClick={() => router.push("/premium")}>View plans</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (activePOS) {
        let label = "Table Order";
        if (activePOS.channel === "room_service") {
            const roomDetails = rooms.find(r => r.id === activePOS.tableId);
            label = `Room Service — ${roomDetails?.table_name || `Room ${activePOS.tableId}`}`;
        } else if (activePOS.tableIds && activePOS.tableIds.length > 0) {
            const selectedNames = activePOS.tableIds
                .map(id => tables.find(t => t.id === id)?.table_name)
                .filter(Boolean)
                .join(", ");
            label = `Multi-Table Order: ${selectedNames}`;
        } else if (activePOS.tableId) {
            const tableDetails = tables.find(t => t.id === activePOS.tableId);
            label = `Table Order — ${tableDetails?.table_name || `Table ${activePOS.tableId}`}`;
        }

        return (
            <div className="flex flex-col h-full gap-2">
                <div className="flex items-center gap-2 pb-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                        setActivePOS(null);
                        setSelectedTables([]);
                    }}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Tables/Rooms
                    </Button>
                    <h2 className="text-lg font-semibold">{label}</h2>
                </div>
                <Suspense fallback={<div>Loading...</div>}>
                    <POSSystem 
                        orderId={activePOS.orderId} 
                        defaultTableId={activePOS.tableId} 
                        defaultTableIds={activePOS.tableIds}
                        defaultChannel={activePOS.channel} 
                    />
                </Suspense>
            </div>
        );
    }

    // Order Type Cards Configuration
    const orderTypes = [
        { 
            id: 'tables', 
            label: 'Dine-In', 
            icon: Sofa, 
            description: 'Table service', 
            activeColor: 'bg-orange-600',
            show: dineInAccess.allowed,
        },
        // Room service — only shown when hotel is enabled
        ...(hotelEnabled ? [{
            id: 'rooms',
            label: 'Room Service',
            icon: BedDouble,
            description: 'Hotel room orders',
            activeColor: 'bg-blue-600',
            show: hotelAccess.allowed,
        }] : []),
        { 
            id: 'quick_bill', 
            label: 'Quick Bill', 
            icon: Zap, 
            description: 'Fast checkout', 
            activeColor: 'bg-indigo-600',
            show: takeawayAccess.allowed,
        },
        { 
            id: 'delivery', 
            label: 'Delivery', 
            icon: Truck, 
            description: 'Online orders', 
            activeColor: 'bg-purple-600',
            show: deliveryAccess.allowed,
        },
        { 
            id: 'pickup', 
            label: 'Pickup', 
            icon: ShoppingBag, 
            description: 'Takeaway service', 
            activeColor: 'bg-green-600',
            show: takeawayAccess.allowed,
        },
    ];

    return (
        <div className="flex flex-col w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">

            <div className="flex flex-col gap-1 mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
                <p className="text-muted-foreground">Choose an order type to begin service.</p>
            </div>

            {/* Premium (Clean) Order Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">


                {orderTypes.filter((type) => type.show).map((type) => (
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



            <div className="mt-4 flex flex-col">
                {activeTab === "rooms" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Floor Filter Chips */}
                        <div className="pb-3 pt-1">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">
                                <Filter className="w-3.5 h-3.5" />
                                <span>Filter Floor</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-3 pr-2">
                                {roomAreaStats.map(({ floor, total, occupied }) => (
                                    <button
                                        key={floor}
                                        onClick={() => setSelectedWing(floor)}
                                        className={cn(
                                            "shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 border",
                                            selectedWing === floor
                                                ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-sm ring-1 ring-blue-200/60"
                                                : "text-muted-foreground border-transparent bg-muted/30 hover:text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <span>{floor}</span>
                                        <span className="ml-2 text-xs opacity-80">{total}</span>
                                        {occupied > 0 && (
                                            <span className="ml-1 text-[10px] text-red-500">•{occupied}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Room Status Legend */}
                        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 ml-2 shrink-0">
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

                        {loadingRooms ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-4 text-muted-foreground border-2 border-dashed border-border/40 rounded-[2rem] bg-muted/5">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="font-bold uppercase tracking-widest text-xs">Loading Rooms</p>
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/40 rounded-[2rem] gap-4 bg-muted/5">
                                <BedDouble className="w-16 h-16 opacity-10" />
                                <p className="font-bold uppercase tracking-widest text-xs">No rooms configured</p>
                                <p className="text-xs text-muted-foreground">Add rooms with space_kind=room from the Rooms management page</p>
                            </div>
                        ) : selectedWing !== "All Floors" ? (
                            <div className="w-full lg:w-[calc(50%-1rem)]">
                                <RoomContainer
                                    title={selectedWing}
                                    tables={filteredRooms}
                                    layoutHeight={getRoomLayoutHeight(selectedWing)}
                                    onTableClick={(room) => setSelectedRoom(room.id)}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {sortedRoomFloors.map((floorName) => (
                                    <RoomContainer
                                        key={floorName}
                                        title={floorName}
                                        tables={groupedRooms[floorName]}
                                        layoutHeight={getRoomLayoutHeight(floorName)}
                                        onTableClick={(room) => setSelectedRoom(room.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === "tables" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Area Filter Chips */}
                        <div className="pb-3 pt-1">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">
                                <Filter className="w-3.5 h-3.5" />
                                <span>Filter Area</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-3 pr-2">
                                <button
                                    onClick={() => {
                                        setMultiTableMode(!multiTableMode);
                                        setSelectedTables([]);
                                    }}
                                    className={cn(
                                        "shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 border flex items-center gap-2 mr-2",
                                        multiTableMode
                                            ? "bg-orange-600 hover:bg-orange-700 text-white border-transparent shadow-sm"
                                            : "text-muted-foreground border-border/50 bg-muted/20 hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    <Table2 className="h-3.5 w-3.5" />
                                    <span>Multi-Table Select</span>
                                    {multiTableMode && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                </button>

                                {areaStats.map(({ area, total, occupied }) => (
                                    <button
                                        key={area}
                                        onClick={() => setSelectedArea(area)}
                                        className={cn(
                                            "shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 border",
                                            selectedArea === area
                                                ? "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 shadow-sm ring-1 ring-orange-200/60"
                                                : "text-muted-foreground border-transparent bg-muted/30 hover:text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <span>{area}</span>
                                        <span className="ml-2 text-xs opacity-80">{total}</span>
                                        {occupied > 0 && (
                                            <span className="ml-1 text-[10px] text-red-500">•{occupied}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
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
                            <div className="w-full lg:w-[calc(50%-1rem)]">
                                <RoomContainer
                                    title={selectedArea}
                                    tables={filteredTables}
                                    layoutHeight={getLayoutHeight(selectedArea)}
                                    onTableClick={handleTableClick}
                                    selectedTableIds={selectedTables}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {sortedRooms.map((roomName) => (
                                    <RoomContainer
                                        key={roomName}
                                        title={roomName}
                                        tables={groupedTables[roomName]}
                                        layoutHeight={getLayoutHeight(roomName)}
                                        onTableClick={handleTableClick}
                                        selectedTableIds={selectedTables}
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

            {selectedTables.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <span className="text-sm font-semibold">
                        Selected {selectedTables.length} table{selectedTables.length > 1 ? 's' : ''}:{" "}
                        <span className="text-primary font-bold">
                            {selectedTables.map(id => tables.find(t => t.id === id)?.table_name).filter(Boolean).join(", ")}
                        </span>
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTables([])}>
                            Clear
                        </Button>
                        <Button size="sm" onClick={() => setActivePOS({ orderId: 'create', tableIds: selectedTables })}>
                            Open Order
                        </Button>
                    </div>
                </div>
            )}

        </div>
    );

}
