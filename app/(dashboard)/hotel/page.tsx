"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, BedDouble, BookOpenCheck, Brush, CalendarDays, Hotel, MoonStar, SlidersHorizontal, WalletCards } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingDetailDialog } from "@/components/hotel/booking-detail-dialog";
import { BookingsPanel } from "@/components/hotel/bookings-panel";
import { FrontDeskPanel } from "@/components/hotel/front-desk-panel";
import { FinancePanel } from "@/components/hotel/finance-panel";
import { HousekeepingPanel } from "@/components/hotel/housekeeping-panel";
import { InventoryPanel } from "@/components/hotel/inventory-panel";
import { NightAuditPanel } from "@/components/hotel/night-audit-panel";
import { RatesPanel } from "@/components/hotel/rates-panel";
import { RoomOrderAnalyticsPanel } from "@/components/hotel/room-order-analytics-panel";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission, type PermissionKey } from "@/lib/role-permissions";

export default function HotelPmsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuth((state) => state.user);
  const [tab, setTab] = useState("front-desk");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const restaurantId = user?.restaurant_id ?? null;
  const can = (permission: PermissionKey) => hasPermission(user, permission);
  const permissions = useMemo(() => ({
    bookings: hasPermission(user, "hotel.bookings.manage"),
    checkin: hasPermission(user, "hotel.checkin"),
    checkout: hasPermission(user, "hotel.checkout"),
    earlyDepartureOverride: hasPermission(user, "hotel.early_departure.override"),
    folioEdit: hasPermission(user, "hotel.folio.edit"),
    roomOrderCreate: hasPermission(user, "pos.order.create"),
  }), [user]);

  const changed = () => setRefreshKey((value) => value + 1);
  const openBooking = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setDetailOpen(true);
  };

  const navigation = useMemo(() => [
    { value: "front-desk", label: "Front desk", icon: CalendarDays, visible: true },
    { value: "bookings", label: "Bookings", icon: BookOpenCheck, visible: true },
    { value: "inventory", label: "Rooms", icon: BedDouble, visible: true },
    { value: "rates", label: "Rates", icon: SlidersHorizontal, visible: true },
    { value: "housekeeping", label: "Housekeeping", icon: Brush, visible: hasPermission(user, "hotel.housekeeping.view") },
    { value: "room-orders", label: "Room service", icon: BarChart3, visible: hasPermission(user, "reports.analytics.view") },
    { value: "finance", label: "Finance", icon: WalletCards, visible: hasPermission(user, "finance.income.view") },
    { value: "daybook", label: "Daybook", icon: BookOpenCheck, visible: hasPermission(user, "hotel.view") && hasPermission(user, "reports.dayclose.view") },
    { value: "night-audit", label: "Night audit", icon: MoonStar, visible: hasPermission(user, "hotel.night_audit.run") },
  ].filter((item) => item.visible), [user]);

  useEffect(() => {
    const requested = searchParams.get("section");
    if (requested && navigation.some((item) => item.value === requested)) setTab(requested);
  }, [navigation, searchParams]);

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
        {can("finance.income.view") ? <TabsContent value="finance" className="mt-5"><FinancePanel restaurantId={restaurantId} refreshKey={refreshKey} /></TabsContent> : null}
        {can("hotel.view") && can("reports.dayclose.view") ? (
          <TabsContent value="daybook" className="mt-5">
            <section className="mx-auto max-w-4xl rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600"><BookOpenCheck className="h-5 w-5" /></div>
                  <h2 className="text-xl font-bold tracking-tight">Hotel Daybook</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Review accommodation, folio activity, payments, refunds, hotel income, expenses, and accounting checks for one date. Closing the daybook saves an audited snapshot; it does not require a front-desk drawer count or stop hotel operations.
                  </p>
                </div>
                <button type="button" onClick={() => router.push("/day-close?business_line=hotel")} className="shrink-0 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600">Open hotel daybook</button>
              </div>
            </section>
          </TabsContent>
        ) : null}
        {can("hotel.night_audit.run") ? <TabsContent value="night-audit" className="mt-5"><NightAuditPanel restaurantId={restaurantId} canRun refreshKey={refreshKey} onChanged={changed} /></TabsContent> : null}
      </Tabs>
      <BookingDetailDialog bookingId={selectedBookingId} open={detailOpen} onOpenChange={setDetailOpen} permissions={permissions} onChanged={changed} />
      </div>
      </div>
    </div>
  );
}
