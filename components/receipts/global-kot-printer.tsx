"use client";

import React, { useEffect, useRef } from "react";
import apiClient from "@/lib/api-client";
import { PrinterApis, RestaurantApis, KotApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";

// ─────────────────────────────────────────────────────────────────────────────
// Raw ESC/POS builder — matches Flutter KOT format exactly
// ─────────────────────────────────────────────────────────────────────────────
function buildEscPosKot(kotData: any): string {
    const ESC = "\x1B";
    const GS = "\x1D";
    const NL = "\r\n";

    const id = kotData.id || kotData.kot_id || "-";
    const kotNumber = kotData.kot_number || String(id);
    const station = kotData.station || "";
    const table = kotData.order?.table_name || kotData.order?.table || kotData.table_name || kotData.table || "";
    const items: any[] = kotData.items || kotData.kot?.items || [];
    const date = new Date().toLocaleString();

    const lines: string[] = [];

    // Initialize printer
    lines.push(`${ESC}@`);

    // Center + Bold header
    lines.push(`${ESC}a\x01`); // Center
    lines.push(`${ESC}E\x01`); // Bold on
    lines.push(`*** KITCHEN ORDER ***`);
    lines.push(`${ESC}E\x00`); // Bold off
    lines.push(``);

    // Left-align info block
    lines.push(`${ESC}a\x00`);
    lines.push(`--------------------------------`);
    lines.push(`KOT: #${kotNumber}`);
    if (station) lines.push(`STATION: ${station.toUpperCase()}`);
    if (table) lines.push(`TABLE: ${table}`);
    lines.push(`DATE: ${date}`);
    lines.push(`--------------------------------`);
    lines.push(`ITEM                         QTY`);
    lines.push(`--------------------------------`);

    items.forEach((item: any) => {
        const rawName = String(item.item_name || item.name_snapshot || item.name || "Item");
        const qty = String(item.qty_change || item.qty || item.quantity || 1);
        const name = rawName.substring(0, 28).padEnd(28, " ");
        const qtyStr = qty.padStart(4, " ");
        lines.push(`${name}${qtyStr}`);

        // Print notes if present
        if (item.notes) {
            lines.push(`  > ${item.notes}`);
        }

        // Print modifiers if present
        const mods: any[] = item.modifiers || [];
        mods.forEach((mod: any) => {
            const modName = mod.modifier_name_snapshot || mod.name || "";
            if (modName) lines.push(`  + ${modName}`);
        });
    });

    lines.push(`--------------------------------`);
    // Feed enough lines so the last content clears the cutter blade
    // (thermal printers have ~3-4cm gap between print head and cutter)
    lines.push(`\n\n\n\n\n\n`);

    // ESC d 6 = Feed 6 more lines, then GS V B 0 = full cut
    lines.push(`${ESC}d\x06${GS}V\x42\x00`);

    let payload = lines.join(NL);

    // Null-byte padding to prevent TCP FIN from cutting data before printer reads it
    for (let i = 0; i < 50; i++) payload += "\x00";

    return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// GlobalKotPrinter Component
// ─────────────────────────────────────────────────────────────────────────────
export function GlobalKotPrinter() {
    const recentPrintsRef = useRef<Map<string, number>>(new Map());
    const [printerRoutingUnauthorized, setPrinterRoutingUnauthorized] = React.useState(false);

    useEffect(() => {
        const normalizeStation = (v?: string) => (v || "").trim().toLowerCase();

        const resolveAssignedPrinter = async (restaurantId: number, stationName?: string): Promise<any | null> => {
            const targetStation = normalizeStation(stationName);
            if (!targetStation) return null;

            // Check if this device is even assigned to print for this station
            try {
                const localStationsRaw = localStorage.getItem("yummy_local_kot_stations");
                if (localStationsRaw !== null) {
                    const localStations: string[] = JSON.parse(localStationsRaw).map((s: string) => normalizeStation(s));
                    if (!localStations.includes(targetStation)) {
                        console.log(`[GlobalKotPrinter] Station "${stationName}" not assigned to this device. Skipping.`);
                        return null;
                    }
                }
            } catch (e) { /* ignore */ }

            try {
                const restaurantState = useRestaurant.getState().restaurant as any;
                let stations: any[] = restaurantState?.kot_station_config?.stations || [];

                if (!stations.length && !printerRoutingUnauthorized) {
                    try {
                        const res = await apiClient.get(PrinterApis.stationConfig(restaurantId), {
                            headers: { "x-restaurant-id": String(restaurantId) }
                        });
                        stations = res.data?.data?.stations || [];
                    } catch (err: any) {
                        const status = err?.response?.status;
                        if (status === 401 || status === 403) {
                            setPrinterRoutingUnauthorized(true);
                        } else {
                            throw err;
                        }
                    }
                }

                const printersRes = await apiClient.get(PrinterApis.list(restaurantId));
                const printers: any[] = printersRes.data?.data || [];

                const stationConfig = stations.find((s: any) => normalizeStation(s?.name) === targetStation);
                const assignedPrinterId = stationConfig?.printer_id;
                if (!assignedPrinterId) {
                    console.warn(`[GlobalKotPrinter] No printer mapped to station "${targetStation}".`);
                    return null;
                }

                const printer = printers.find((p: any) => p?.id === assignedPrinterId && p?.enabled);
                if (!printer) {
                    console.warn(`[GlobalKotPrinter] Assigned printer ID ${assignedPrinterId} not found or disabled.`);
                    return null;
                }

                return printer;
            } catch (err) {
                console.error("[GlobalKotPrinter] Failed to resolve station printer:", err);
                return null;
            }
        };

        const handlePrintEvent = async (e: any) => {
            let data = e.detail;
            if (!data) return;

            console.log("[GlobalKotPrinter] Received KOT event:", data);

            // ── Deduplication (8s window) ────────────────────────────────
            const kotId = data.kot_id || data.id || data.kot?.id;
            const key = `id:${String(kotId)}`;
            const now = Date.now();
            const lastSeen = recentPrintsRef.current.get(key) || 0;
            if (now - lastSeen < 8000) {
                console.log(`[GlobalKotPrinter] Skipping duplicate KOT ${kotId} (seen ${now - lastSeen}ms ago)`);
                return;
            }
            recentPrintsRef.current.set(key, now);

            // ── Skip if already auto-printed ────────────────────────────
            if (data.auto_printed_at || data.kot?.auto_printed_at) {
                console.log(`[GlobalKotPrinter] KOT ${kotId} already marked auto-printed. Skipping.`);
                return;
            }

            // ── Fetch full KOT data if items are missing ─────────────────
            if ((!data.items || data.items.length === 0) && kotId) {
                try {
                    console.log(`[GlobalKotPrinter] Fetching full KOT data for #${kotId}...`);
                    const res = await apiClient.get(`/kots/${kotId}`);
                    data = res.data?.data || res.data;
                    console.log(`[GlobalKotPrinter] Fetched KOT data:`, data);
                } catch (err) {
                    console.error("[GlobalKotPrinter] Failed to fetch KOT details:", err);
                    return;
                }
            }

            // ── Resolve station printer ───────────────────────────────────
            const stationName = data.station || data.kot?.station;
            const currentRestaurantId = useRestaurant.getState().restaurant?.id;
            const restId = data.restaurant_id || data.order?.restaurant_id || currentRestaurantId;

            console.log(`[GlobalKotPrinter] Resolving printer for station="${stationName}", restaurantId=${restId}`);

            const assignedPrinter = restId ? await resolveAssignedPrinter(restId, stationName) : null;

            if (!assignedPrinter) {
                console.warn(`[GlobalKotPrinter] No printer assigned for station "${stationName}". Cannot auto-print.`);
                return;
            }

            console.log(`[GlobalKotPrinter] Assigned printer:`, assignedPrinter.name, assignedPrinter.address, assignedPrinter.printer_type);

            // ── Print ─────────────────────────────────────────────────────
            const winAny = window as any;
            if (!winAny.electronAPI) {
                console.warn("[GlobalKotPrinter] Not running in Electron. Cannot print.");
                return;
            }

            const isNetworkPrinter =
                assignedPrinter.printer_type === "network" ||
                /^\d{1,3}(\.\d{1,3}){3}$/.test(String(assignedPrinter.address || "").trim());

            if (isNetworkPrinter && winAny.electronAPI.printNetworkRaw) {
                // ── RAW ESC/POS over TCP (network printer / simulator) ────
                const host = String(assignedPrinter.address || "").trim();
                const port = Number(assignedPrinter.connection_config?.port || 9100);

                const payload = buildEscPosKot(data);

                console.log(`[GlobalKotPrinter] 🖨️ Sending raw ESC/POS to ${host}:${port} (${payload.length} bytes)`);

                try {
                    const result = await winAny.electronAPI.printNetworkRaw({ host, port, payload });
                    console.log(`[GlobalKotPrinter] ✅ Print result:`, result);
                } catch (err) {
                    console.error(`[GlobalKotPrinter] ❌ Print error:`, err);
                }
            } else if (winAny.electronAPI.printSilent) {
                // ── Silent Windows spooler print (USB / directly connected) ─
                const printerName = assignedPrinter.name;
                console.log(`[GlobalKotPrinter] 🖨️ Sending silent Windows print to: ${printerName}`);
                try {
                    await winAny.electronAPI.printSilent({ printerName });
                    console.log(`[GlobalKotPrinter] ✅ Silent print sent.`);
                } catch (err) {
                    console.error(`[GlobalKotPrinter] ❌ Silent print error:`, err);
                }
            } else {
                console.warn(`[GlobalKotPrinter] No valid print path available.`);
            }
        };

        window.addEventListener("yummy:kot-print", handlePrintEvent);
        return () => window.removeEventListener("yummy:kot-print", handlePrintEvent);
    }, []);

    // This component renders nothing — it just listens and prints
    return null;
}
