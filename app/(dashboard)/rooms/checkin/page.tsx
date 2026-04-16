"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { TableApis, OrderApis } from "@/lib/api/endpoints";
import { Bed, KeyRound, Clock, CheckCircle2, Loader2, Search } from "lucide-react";
import { type TableData } from "@/components/tables/room-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { CheckinModal } from "@/components/rooms/checkin-modal";
import { CheckoutModal } from "@/components/rooms/checkout-modal";

export default function CheckInPage() {
  const [rooms, setRooms] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<TableData | null>(null);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchRooms = useCallback(async (showLoader = false) => {
    if (!user?.restaurant_id) return;
    if (showLoader) setLoading(true);
    try {
      const res = await apiClient.get(TableApis.getTables(user.restaurant_id, "room"));
      if (res.data.status === "success") {
        setRooms(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) fetchRooms(true);
  }, [user?.restaurant_id, fetchRooms]);

  const handleCheckinClick = (room: TableData) => {
    setActiveRoom(room);
    setCheckinModalOpen(true);
  };

  const handleCheckoutClick = (room: TableData) => {
    setActiveRoom(room);
    setCheckoutModalOpen(true);
  };

  // Derived state
  const filteredRooms = rooms.filter(
    (r) =>
      r.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.table_type_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inHouseRooms = filteredRooms.filter((r) => {
    const s = r.status?.toLowerCase();
    return s === "occupied" || s === "payment_completed" || s === "bill_printed";
  });
  const availableRooms = filteredRooms.filter((r) => {
    const s = r.status?.toLowerCase();
    return s === "available" || s === "free" || s === "reserved";
  });

  // Metrics (stubbed with rough logic based on rooms list)
  const pendingCheckins = availableRooms.length; // Conceptually
  const inHouseCount = inHouseRooms.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Check In / Check Out</h1>
        <p className="text-muted-foreground mt-1">Manage guest arrivals and departures</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available Rooms</p>
            <p className="text-2xl font-bold">{pendingCheckins}</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">In-House Guests</p>
            <p className="text-2xl font-bold">{inHouseCount}</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Checked Out Today</p>
            <p className="text-2xl font-bold">-</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search rooms..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="in-house" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="in-house">In-House ({inHouseRooms.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({availableRooms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="in-house" className="space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : inHouseRooms.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              No rooms are currently occupied.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Room</th>
                    <th className="px-4 py-3 font-medium">Floor / Area</th>
                    <th className="px-4 py-3 font-medium">Capacity</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inHouseRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{room.table_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{room.table_type_name || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{room.capacity}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => handleCheckoutClick(room)}>
                          Manage / Check-out
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableRooms.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              No available rooms right now.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Room</th>
                    <th className="px-4 py-3 font-medium">Floor / Area</th>
                    <th className="px-4 py-3 font-medium">Nightly Rate</th>
                    <th className="px-4 py-3 font-medium">Capacity</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {availableRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{room.table_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{room.table_type_name || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">${room.price_per_night || 0}</td>
                      <td className="px-4 py-3 text-muted-foreground">{room.capacity}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 max-w-[120px]" onClick={() => handleCheckinClick(room)}>
                          Check-in
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CheckinModal
        isOpen={checkinModalOpen}
        onOpenChange={setCheckinModalOpen}
        room={activeRoom}
        restaurantId={user?.restaurant_id ?? undefined}
        onSuccess={() => fetchRooms()}
      />

      <CheckoutModal
        isOpen={checkoutModalOpen}
        onOpenChange={setCheckoutModalOpen}
        room={activeRoom}
        onSuccess={() => fetchRooms()}
      />
    </div>
  );
}
