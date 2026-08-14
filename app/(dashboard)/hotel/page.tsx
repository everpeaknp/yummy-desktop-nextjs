"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, BedDouble, BookOpenCheck, Brush, CalendarDays, Hotel, MoonStar, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const router = useRouter();
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
    earlyDepartureOverride: can("hotel.early_departure.override"),
    folioEdit: can("hotel.folio.edit"),
    roomOrderCreate: can("pos.order.create"),
  }), [user]);

  const changed = () => setRefreshKey((value) => value + 1);
  const openBooking = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setDetailOpen(true);
  };

  const navigation = [
    { value: "front-desk", label: "Front desk", icon: CalendarDays, visible: true },
    { value: "bookings", label: "Bookings", icon: BookOpenCheck, visible: true },
    { value: "inventory", label: "Rooms", icon: BedDouble, visible: true },
    { value: "rates", label: "Rates", icon: SlidersHorizontal, visible: true },
    { value: "housekeeping", label: "Housekeeping", icon: Brush, visible: can("hotel.housekeeping.view") },
    { value: "room-orders", label: "Room service", icon: BarChart3, visible: can("reports.analytics.view") },
    { value: "night-audit", label: "Close day", icon: MoonStar, visible: can("hotel.night_audit.run") },
  ].filter((item) => item.visible);

  if (!restaurantId) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">Hotel details are unavailable.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => router.push("/dashboard")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition hover:bg-muted" aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600"><Hotel className="h-5 w-5" /></span>
          <div className="min-w-0"><h1 className="truncate font-black">Hotel PMS</h1><p className="truncate text-xs text-muted-foreground">Bookings, rooms and daily hotel work</p></div>
        </div>
        <button type="button" onClick={() => router.push("/dashboard")} className="hidden rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted sm:block">Back to dashboard</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto max-w-[1780px] pb-10">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="lg:hidden">
          <Select value={tab} onValueChange={setTab}><SelectTrigger className="h-12 rounded-2xl bg-card"><SelectValue /></SelectTrigger><SelectContent>{navigation.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <TabsList className="hidden h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 shadow-sm lg:flex">
          {navigation.map((item) => <TabsTrigger key={item.value} value={item.value} className="rounded-xl px-4 py-2.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"><item.icon className="mr-2 h-4 w-4" />{item.label}</TabsTrigger>)}
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
      </div>
    </div>
  );
}
