"use client";

import { useEffect, useRef } from "react";
import apiClient from "@/lib/api-client";
import { getKotPrintEvents, printKotEvent } from "@/lib/kot-print-event";
import { getElectronPrintBridge } from "@/lib/receipt-network-print";

/** Print immutable KOT changes from either a direct response or a websocket signal. */
export function GlobalKotPrinter() {
  const recentPrintsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const handlePrintEvent = async (event: Event) => {
      const data = (event as CustomEvent).detail;
      const kotId = Number(data?.kot_id || data?.id || data?.kot?.id);
      if (!kotId || !getElectronPrintBridge()?.printNetworkRaw) return;

      // Honor this terminal's station assignment before competing for a print lease.
      let station = String(data?.station || data?.kot?.station || "").trim().toLowerCase();
      try {
        const localStationsRaw = localStorage.getItem("yummy_local_kot_stations");
        if (localStationsRaw !== null) {
          if (!station) {
            const response = await apiClient.get(`/kots/${kotId}`);
            station = String(response.data?.data?.station || response.data?.station || "").trim().toLowerCase();
            if (!station) return;
          }
          const localStations = JSON.parse(localStationsRaw);
          if (Array.isArray(localStations) &&
              !localStations.some((name: string) => String(name).trim().toLowerCase() === station)) return;
        }
      } catch (error) {
        console.warn("Could not verify local KOT station assignment", error);
        return;
      }

      try {
        // Modification signals may omit print_event_id. Process all pending
        // slips in order so a missed websocket signal cannot hide a cancellation.
        const pending = (await getKotPrintEvents(kotId))
          .filter((slip) => !slip.printed_at)
          .sort((a, b) => a.id - b.id);
        for (const slip of pending) {
          const now = Date.now();
          if (now - (recentPrintsRef.current.get(slip.id) || 0) < 8000) continue;
          recentPrintsRef.current.set(slip.id, now);
          try {
            await printKotEvent(kotId, slip);
          } catch (error) {
            recentPrintsRef.current.delete(slip.id);
            console.error(`[GlobalKotPrinter] KOT slip ${slip.id} could not be sent:`, error);
            break;
          }
        }
      } catch (error) {
        console.error(`[GlobalKotPrinter] Could not load saved KOT slips for ${kotId}:`, error);
      }
    };

    window.addEventListener("yummy:kot-print", handlePrintEvent);
    return () => window.removeEventListener("yummy:kot-print", handlePrintEvent);
  }, []);

  return null;
}
