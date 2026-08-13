"use client";

import { useMemo, useState } from "react";
import { BarChart3, BedDouble, BookOpenCheck, Brush, CalendarDays, MoonStar, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingDetailDialog } from "@/components/hotel/booking-detail-dialog";
import { BookingsPanel } from "@/components/hotel/bookings-panel";
import { FrontDeskPanel } from "@/components/hotel/front-desk-panel";
import { HousekeepingPanel } from "@/components/hotel/housekeeping-panel";
import { InventoryPanel } from "@/components/hotel/inventory-panel";
import { NightAuditPanel } from "@/components/hotel/night-audit-panel";
import { RatesPanel } from "@/components/hotel/rates-panel";
import { RoomOrderAnalyticsPanel } from "@/components/hotel/room-order-analytics-panel";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

export default function HotelPmsPage() {
  const user = useAuth((state) => state.user);
  const [tab, setTab] = useState("front-desk");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const restaurantId = user?.restaurant_id ?? null;
  const can = (permission: PermissionKey) => hasPermission(user, permission);
  const permissions = useMemo(() => ({
    bookings: can("hotel.bookings.manage"),
    checkin: can("hotel.checkin"),
    checkout: can("hotel.checkout"),
    folioEdit: can("hotel.folio.edit"),
    roomOrderCreate: can("pos.order.create"),
  }), [user]);

  const changed = () => setRefreshKey((value) => value + 1);
  const openBooking = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setDetailOpen(true);
  };

  if (!restaurantId) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">Hotel property context is not available.</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      <div className="rounded-2xl border bg-gradient-to-br from-orange-500/[0.08] via-background to-background p-6">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-orange-500/15 p-3 text-orange-600"><BedDouble className="h-7 w-7" /></div><div><h1 className="text-2xl font-black tracking-tight">Hotel</h1><p className="text-sm text-muted-foreground">Bookings, rooms, guest bills, housekeeping, rates, and daily hotel tasks in one place.</p></div></div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="front-desk"><CalendarDays className="mr-2 h-4 w-4" />Front desk</TabsTrigger>
          <TabsTrigger value="bookings"><BookOpenCheck className="mr-2 h-4 w-4" />Bookings</TabsTrigger>
          <TabsTrigger value="inventory"><BedDouble className="mr-2 h-4 w-4" />Inventory</TabsTrigger>
          <TabsTrigger value="rates"><SlidersHorizontal className="mr-2 h-4 w-4" />Rates</TabsTrigger>
          {can("hotel.housekeeping.view") ? <TabsTrigger value="housekeeping"><Brush className="mr-2 h-4 w-4" />Housekeeping</TabsTrigger> : null}
          {can("reports.analytics.view") ? <TabsTrigger value="room-orders"><BarChart3 className="mr-2 h-4 w-4" />Room orders</TabsTrigger> : null}
          {can("hotel.night_audit.run") ? <TabsTrigger value="night-audit"><MoonStar className="mr-2 h-4 w-4" />Close day</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="front-desk" className="mt-5"><FrontDeskPanel restaurantId={restaurantId} refreshKey={refreshKey} onOpenBooking={openBooking} /></TabsContent>
        <TabsContent value="bookings" className="mt-5"><BookingsPanel restaurantId={restaurantId} canManage={permissions.bookings} refreshKey={refreshKey} onOpenBooking={openBooking} onChanged={changed} /></TabsContent>
        <TabsContent value="inventory" className="mt-5"><InventoryPanel restaurantId={restaurantId} canManage={can("hotel.inventory.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent>
        <TabsContent value="rates" className="mt-5"><RatesPanel restaurantId={restaurantId} canManageRates={can("hotel.rates.manage")} canManageSettings={can("hotel.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent>
        {can("hotel.housekeeping.view") ? <TabsContent value="housekeeping" className="mt-5"><HousekeepingPanel restaurantId={restaurantId} canManage={can("hotel.housekeeping.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent> : null}
        {can("reports.analytics.view") ? <TabsContent value="room-orders" className="mt-5"><RoomOrderAnalyticsPanel restaurantId={restaurantId} refreshKey={refreshKey} /></TabsContent> : null}
        {can("hotel.night_audit.run") ? <TabsContent value="night-audit" className="mt-5"><NightAuditPanel restaurantId={restaurantId} canRun refreshKey={refreshKey} onChanged={changed} /></TabsContent> : null}
      </Tabs>
      <BookingDetailDialog bookingId={selectedBookingId} open={detailOpen} onOpenChange={setDetailOpen} permissions={permissions} onChanged={changed} />
    </div>
  );
}
