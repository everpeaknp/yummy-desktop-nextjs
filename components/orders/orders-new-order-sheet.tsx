"use client";

import { useEffect, useState } from "react";
import { ChevronUp, Pin, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { MobileNewOrderFlow, type MobileOrderStart } from "@/components/orders/mobile-new-order-flow";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useEntitlement } from "@/hooks/use-subscription";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";

const primaryOrderStorageKey = "orders:primary-order-type";

const primaryOrderLabels: Record<MobileOrderStart, string> = {
  dine_in: "Dine in",
  quick_billing: "Quick bill",
  pickup: "Pickup",
  delivery: "Delivery",
  room_service: "Room service",
};

export function OrdersNewOrderSheet() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [primaryOrderType, setPrimaryOrderType] = useState<MobileOrderStart | null>(null);
  const router = useRouter();
  const restaurant = useRestaurant((state) => state.restaurant);
  const dineInAccess = useEntitlement("orders.dine_in.enabled", true);
  const takeawayAccess = useEntitlement("orders.takeaway.enabled", true);
  const deliveryAccess = useEntitlement("orders.delivery.enabled", true);
  const hotelEnabled = restaurant?.hotel_enabled ?? false;
  const hotelAccess = useEntitlement("business.hotel.enabled", hotelEnabled);

  useEffect(() => {
    const saved = window.localStorage.getItem(primaryOrderStorageKey) as MobileOrderStart | null;
    if (["dine_in", "quick_billing", "pickup", "delivery", "room_service"].includes(saved || "")) {
      setPrimaryOrderType(saved);
    }
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    const updateScrollState = () => {
      setIsScrolled((scrollContainer?.scrollTop || window.scrollY) > 72);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    scrollContainer?.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
      scrollContainer?.removeEventListener("scroll", updateScrollState);
    };
  }, []);

  const setPrimary = (type: MobileOrderStart) => {
    setPrimaryOrderType(type);
    window.localStorage.setItem(primaryOrderStorageKey, type);
  };

  const openNewOrderRoute = (type: MobileOrderStart) => {
    setOpen(false);
    router.push(`/orders/new?start=${type}`);
  };

  const openPrimary = () => {
    if (primaryOrderType) {
      openNewOrderRoute(primaryOrderType);
      return;
    }
    setOpen(true);
  };

  const hasPinnedPrimary = Boolean(primaryOrderType);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="!bg-black/15"
          className="new-order-sheet-motion inset-x-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 h-auto max-h-[55dvh] overflow-hidden rounded-[28px] border border-border bg-background p-0 shadow-2xl md:hidden"
        >
          <SheetTitle className="sr-only">New order</SheetTitle>
          <div className="overflow-hidden">
            <MobileNewOrderFlow
              canDineIn={dineInAccess.allowed}
              canTakeaway={takeawayAccess.allowed}
              canDelivery={deliveryAccess.allowed}
              canRoomService={hotelEnabled && hotelAccess.allowed}
              tables={[]}
              tableAreas={[]}
              rooms={[]}
              loadingTables={false}
              loadingRooms={false}
              onBrowseTables={() => openNewOrderRoute("dine_in")}
              onBrowseRooms={() => openNewOrderRoute("room_service")}
              onStart={openNewOrderRoute}
              onChooseTable={() => undefined}
              onChooseRoom={() => undefined}
              primaryOrderType={primaryOrderType}
              onSetPrimaryOrderType={setPrimary}
              embedded
            />
          </div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "orders-new-order-cta fixed z-[60] flex items-center justify-center",
          "transition-[left,width,transform,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none md:hidden",
          open
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 h-12 w-12 -translate-x-1/2"
            : isScrolled && hasPinnedPrimary
              ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-[calc(100%-14rem)] h-12 w-52 gap-2"
              : isScrolled
              ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-[calc(100%-4rem)] h-12 w-12"
              : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 h-12 w-[calc(100%-2rem)]",
        )}
      >
        <button
          type="button"
          aria-label={open ? "Close new order" : isScrolled && hasPinnedPrimary ? `Start a ${primaryOrderLabels[primaryOrderType!]} order` : "Start a new order"}
          aria-expanded={open}
          onClick={open ? () => setOpen(false) : openPrimary}
          className={cn(
            "flex h-full items-center justify-center overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/25",
            "transition-[border-radius,box-shadow] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
            open || isScrolled ? "rounded-full" : "rounded-2xl",
            isScrolled && hasPinnedPrimary && !open ? "min-w-0 flex-1 px-3" : "w-full",
          )}
        >
          {isScrolled && hasPinnedPrimary && !open ? null : <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <Plus className={cn("absolute h-5 w-5 transition-[opacity,transform] duration-300", open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
            <X className={cn("absolute h-5 w-5 transition-[opacity,transform] duration-300", open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
          </span>}
          {isScrolled && hasPinnedPrimary && !open ? <Pin className="-ml-1 mr-1.5 h-4 w-4 shrink-0 fill-current" /> : null}
          <span className={cn("ml-2 max-w-32 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width,margin,opacity] duration-300", open || (isScrolled && !hasPinnedPrimary) ? "ml-0 max-w-0 opacity-0" : "opacity-100", isScrolled && hasPinnedPrimary && !open && "ml-0")}>{isScrolled && hasPinnedPrimary && !open ? primaryOrderLabels[primaryOrderType!] : "New order"}</span>
        </button>
        {isScrolled && hasPinnedPrimary && !open ? (
          <button
            type="button"
            aria-label="Choose a different order type"
            onClick={() => setOpen(true)}
            className="flex h-full w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-card px-3 text-sm font-semibold text-foreground shadow-lg shadow-black/10 ring-1 ring-border transition-transform active:scale-95"
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </button>
        ) : null}
        {!open && !isScrolled ? (
          <button
            type="button"
            aria-label="Choose order type"
            onClick={() => setOpen(true)}
            className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </>
  );
}
