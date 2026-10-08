"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, BedDouble, BookOpenCheck, Brush, CalendarDays, Check, Hotel, MoreHorizontal, MoonStar, SlidersHorizontal, WalletCards } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookingDetailDialog } from "@/components/hotel/booking-detail-dialog";
import { BookingsPanel } from "@/components/hotel/bookings-panel";
import { FrontDeskPanel } from "@/components/hotel/front-desk-panel";
import { FinancePanel } from "@/components/hotel/finance-panel";
import { HousekeepingPanel } from "@/components/hotel/housekeeping-panel";
import { HotelSetupChecklist, type HotelSetupChecklistProps } from "@/components/hotel/hotel-setup-checklist";
import { useHotelSetupReadiness, type HotelSetupReadinessResult } from "@/hooks/use-hotel-setup-readiness";
import { InventoryPanel } from "@/components/hotel/inventory-panel";
import { NightAuditPanel } from "@/components/hotel/night-audit-panel";
import { RatesPanel } from "@/components/hotel/rates-panel";
import { RoomOrderAnalyticsPanel } from "@/components/hotel/room-order-analytics-panel";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { getHotelWorkspaceTabs, hasPermission, type PermissionKey } from "@/lib/role-permissions";
import { AppPage } from "@/components/patterns/page/app-page";

type SetupProps = Omit<HotelSetupChecklistProps, keyof HotelSetupReadinessResult> & {
  restaurantId: number;
  refreshKey: number;
};

function HotelWorkspaceSetup({ restaurantId, refreshKey, ...props }: SetupProps) {
  const setup = useHotelSetupReadiness(restaurantId, props.canManageStaff);
  const { reload } = setup;
  useEffect(() => {
    if (refreshKey > 0) void reload();
  }, [refreshKey, reload]);
  return <HotelSetupChecklist {...setup} {...props} />;
}

export default function HotelPmsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const [tab, setTab] = useState("front-desk");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [inventorySetupRequest, setInventorySetupRequest] = useState(0);
  const [ratesSetupRequest, setRatesSetupRequest] = useState(0);
  const [ratesSection, setRatesSection] = useState<"pricing" | "plans" | "settings">("pricing");

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

  const navigation = useMemo(() => {
    const allowedTabs = new Set(getHotelWorkspaceTabs(user));
    return [
      { value: "front-desk", label: "Front desk", icon: CalendarDays },
      { value: "bookings", label: "Bookings", icon: BookOpenCheck },
      { value: "inventory", label: "Rooms", icon: BedDouble },
      { value: "rates", label: "Rates", icon: SlidersHorizontal },
      { value: "housekeeping", label: "Housekeeping", icon: Brush },
      { value: "room-orders", label: "Room service", icon: BarChart3 },
      { value: "finance", label: "Finance", icon: WalletCards },
      { value: "daybook", label: "Daybook", icon: BookOpenCheck },
      { value: "night-audit", label: "Night audit", icon: MoonStar },
    ].filter((item) => allowedTabs.has(item.value));
  }, [user]);

  useEffect(() => {
    const requested = searchParams.get("section");
    setTab(
      requested && navigation.some((item) => item.value === requested)
        ? requested
        : navigation[0]?.value ?? "",
    );
  }, [navigation, searchParams]);

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    if (nextTab !== searchParams.get("section")) {
      router.push(`/hotel?section=${encodeURIComponent(nextTab)}`, { scroll: false });
    }
  };

  const mobilePrimaryValues = ["front-desk", "bookings", "inventory"];
  const mobilePrimaryNavigation = navigation.filter((item) =>
    mobilePrimaryValues.includes(item.value),
  );
  const mobileMoreNavigation = navigation.filter(
    (item) => !mobilePrimaryValues.includes(item.value),
  );
  const isMobileMoreActive = !mobilePrimaryValues.includes(tab);
  const activeNavigation = navigation.find((item) => item.value === tab) ?? navigation[0];
  const exitHref = restaurant?.restaurant_enabled ? "/dashboard" : "/manage";

  if (!restaurantId) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">Hotel details are unavailable.</div>;
  }

  if (!navigation.length) {
    return (
      <div className="flex min-h-72 items-center justify-center px-4">
        <section className="max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Hotel access is limited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your assigned hotel actions need hotel viewing access to load the booking or stay they apply to. Ask an administrator to add Hotel view alongside your specific hotel permissions.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-44 lg:pb-28">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <Hotel className="h-5 w-5" />
            </span>
            <p className="truncate text-base font-semibold tracking-tight">
              {activeNavigation?.label ?? "Hotel PMS"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(exitHref)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Exit hotel</span>
          </button>
        </div>
      </header>
      <AppPage width="wide" density="compact" className="px-4 py-4 sm:px-6 md:py-6">
      {can("hotel.view") ? <div className="mb-5">
        <HotelWorkspaceSetup
          restaurantId={restaurantId}
          refreshKey={refreshKey}
          canManageInventory={can("hotel.inventory.manage")}
          canManageRates={can("hotel.rates.manage")}
          canManageSettings={can("hotel.manage")}
          canManageStaff={can("admin.staff.view")}
          onOpenInventory={() => {
            if (!can("hotel.inventory.manage")) return;
            setInventorySetupRequest((value) => value + 1);
            handleTabChange("inventory");
          }}
          onOpenRates={() => {
            if (!can("hotel.rates.manage")) return;
            setRatesSection("plans");
            setRatesSetupRequest((value) => value + 1);
            handleTabChange("rates");
          }}
          onOpenSettings={() => {
            if (!can("hotel.manage")) return;
            setRatesSection("settings");
            setRatesSetupRequest((value) => value + 1);
            handleTabChange("rates");
          }}
          onOpenStaff={() => {
            if (can("admin.staff.view")) router.push("/staff");
          }}
        />
      </div> : null}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="hidden h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1 lg:flex">
          {navigation.map((item) => <TabsTrigger key={item.value} value={item.value} className="rounded-lg px-3 py-2 text-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"><item.icon className="mr-2 h-4 w-4" />{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="front-desk" className="mt-5"><FrontDeskPanel restaurantId={restaurantId} refreshKey={refreshKey} onOpenBooking={openBooking} /></TabsContent>
        <TabsContent value="bookings" className="mt-5"><BookingsPanel restaurantId={restaurantId} canManage={permissions.bookings} refreshKey={refreshKey} onOpenBooking={openBooking} onChanged={changed} /></TabsContent>
        <TabsContent value="inventory" className="mt-5"><InventoryPanel key={inventorySetupRequest} initialMode={inventorySetupRequest ? "manage" : "book"} restaurantId={restaurantId} canManage={can("hotel.inventory.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent>
        <TabsContent value="rates" className="mt-5"><RatesPanel key={ratesSetupRequest} initialSection={ratesSection} restaurantId={restaurantId} canManageRates={can("hotel.rates.manage")} canManageSettings={can("hotel.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent>
        {can("hotel.housekeeping.view") ? <TabsContent value="housekeeping" className="mt-5"><HousekeepingPanel restaurantId={restaurantId} canManage={can("hotel.housekeeping.manage")} refreshKey={refreshKey} onChanged={changed} /></TabsContent> : null}
        {can("hotel.view") && can("reports.analytics.view") ? <TabsContent value="room-orders" className="mt-5"><RoomOrderAnalyticsPanel restaurantId={restaurantId} refreshKey={refreshKey} /></TabsContent> : null}
        {can("hotel.view") && can("finance.income.view") ? <TabsContent value="finance" className="mt-5"><FinancePanel restaurantId={restaurantId} refreshKey={refreshKey} /></TabsContent> : null}
        {can("hotel.view") && can("reports.dayclose.view") ? (
          <TabsContent value="daybook" className="mt-5">
            <section className="mx-auto max-w-4xl rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600"><BookOpenCheck className="h-5 w-5" /></div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Review accommodation, folio activity, payments, refunds, hotel income, expenses, and accounting checks for one date. Closing the daybook saves an audited snapshot; it does not require a front-desk drawer count or stop hotel operations.
                  </p>
                </div>
                <button type="button" onClick={() => router.push("/day-close?business_line=hotel")} className="shrink-0 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600">Open hotel daybook</button>
              </div>
            </section>
          </TabsContent>
        ) : null}
        {can("hotel.view") && can("hotel.night_audit.run") ? <TabsContent value="night-audit" className="mt-5"><NightAuditPanel restaurantId={restaurantId} canRun refreshKey={refreshKey} onChanged={changed} /></TabsContent> : null}
      </Tabs>
      <BookingDetailDialog bookingId={selectedBookingId} open={detailOpen} onOpenChange={setDetailOpen} permissions={permissions} onChanged={changed} />
      </AppPage>

      <nav aria-label="Hotel workspace navigation" className="fixed inset-x-0 bottom-[calc(4.0625rem+max(env(safe-area-inset-bottom),0.5rem))] z-40 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {mobilePrimaryNavigation.map((item) => {
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleTabChange(item.value)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${active ? "text-orange-600" : "text-muted-foreground"}`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${isMobileMoreActive ? "text-orange-600" : "text-muted-foreground"}`}
            aria-expanded={mobileMoreOpen}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <SheetContent side="bottom" showCloseButton={false} overlayClassName="bg-black/35" className="max-h-[72vh] rounded-t-3xl px-4 pb-8 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>Hotel workspace</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {mobileMoreNavigation.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    handleTabChange(item.value);
                    setMobileMoreOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${active ? "bg-orange-500/10 text-orange-700" : "text-foreground hover:bg-muted"}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-orange-500 text-white" : "bg-muted text-orange-600"}`}>
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{item.label}</span>
                  {active ? <Check className="h-5 w-5" /> : null}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
