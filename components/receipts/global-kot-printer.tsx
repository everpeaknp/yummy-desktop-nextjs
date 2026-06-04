"use client";

import React, { useEffect, useRef } from "react";
import apiClient from "@/lib/api-client";
import { PrinterApis, RestaurantApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";

// ─────────────────────────────────────────────────────────────────────────────
// ESC/POS helpers
// ─────────────────────────────────────────────────────────────────────────────
const ESC = "\x1B";
const GS  = "\x1D";
const LF  = "\n";

const CMD = {
    init:        `${ESC}@`,
    center:      `${ESC}a\x01`,
    left:        `${ESC}a\x00`,
    right:       `${ESC}a\x02`,
    boldOn:      `${ESC}E\x01`,
    boldOff:     `${ESC}E\x00`,
    dblWidthOn:  `${ESC}!\x20`,   // Double width
    dblHeightOn: `${ESC}!\x10`,   // Double height
    dblBothOn:   `${ESC}!\x30`,   // Double width + height
    normalSize:  `${ESC}!\x00`,   // Reset size
    cut:         `${GS}V\x00`,    // Full cut
    feed: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
};

function align(cmd: string) {
    if (cmd === "center") return CMD.center;
    if (cmd === "right")  return CMD.right;
    return CMD.left;
}

function resolvePlaceholders(text: string, kot: any, order: any, restaurant: any): string {
    if (!text || typeof text !== "string") return text || "";
    const date    = kot?.created_at ? new Date(kot.created_at) : new Date();
    const dateStr = date.toLocaleDateString("en-GB");
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return text
        .replace(/\{\{station_ticket_title\}\}/g, `${(kot?.station || "KITCHEN").toUpperCase()} ORDER TICKET`)
        .replace(/\{\{station\}\}/g, kot?.station || "KITCHEN")
        .replace(/\{\{kot_number\}\}/g, String(kot?.kot_number || kot?.id || ""))
        .replace(/\{\{table\}\}/g, order?.table_name || "N/A")
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{time\}\}/g, timeStr)
        .replace(/\{\{order_id\}\}/g, String(order?.id || ""))
        .replace(/\{\{type\}\}/g, kot?.type || "INITIAL")
        .replace(/\{\{restaurant_name\}\}/g, restaurant?.name || "YUMMY RESTAURANT")
        .replace(/\{\{restaurant_address\}\}/g, restaurant?.address || "")
        .replace(/\{\{restaurant_phone\}\}/g, restaurant?.phone || "")
        .replace(/\{\{restaurant_pan\}\}/g, restaurant?.pan_number || "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-aware ESC/POS builder
// Reads the KOT designer template blocks and converts to raw ESC/POS bytes.
// Falls back to a hardcoded default if no template is provided.
// ─────────────────────────────────────────────────────────────────────────────
function buildEscPosKot(kotData: any, template: any[] = []): string {
    const kot        = kotData?.kot || kotData;
    const order      = kotData?.order || {};
    const restaurant = kotData?.restaurant || {};

    // ── Parse template global settings ───────────────────────────────────────
    const globalBlock   = template.find((b: any) => b.type === "global_settings");
    const paperSize     = globalBlock?.paper_size || globalBlock?.config?.paper_size || "80mm";
    // 80mm = 48 chars,  58mm = 32 chars  (at default font A)
    const WIDTH         = paperSize === "58mm" ? 32 : 48;
    const SEP           = "-".repeat(WIDTH);

    const visibleBlocks = template
        .filter((b: any) => b.type !== "global_settings")
        .filter((b: any) => b.is_visible ?? b.isVisible ?? true);

    // Initialize printer state (ESC @) to clear previous fonts/alignments
    let p = CMD.init;

    // ── No template — use clean default layout ────────────────────────────────
    if (visibleBlocks.length === 0) {
        const id        = kot.id || kotData.kot_id || "-";
        const kotNumber = kot.kot_number || String(id);
        const station   = kot.station || "";
        const table     = order.table_name || order.table || "";
        const date      = new Date().toLocaleString();
        const items: any[] = kot.items || [];
        const nameW     = WIDTH - 6;

        p += CMD.center + CMD.boldOn;
        p += `*** KITCHEN ORDER ***${LF}`;
        p += CMD.boldOff + CMD.left + LF;
        p += `${SEP}${LF}`;
        p += `KOT: #${kotNumber}${LF}`;
        if (station) p += `STATION: ${station.toUpperCase()}${LF}`;
        if (table)   p += `TABLE: ${table}${LF}`;
        p += `DATE: ${date}${LF}`;
        p += `${SEP}${LF}`;
        p += `${"ITEM".padEnd(nameW, " ")}${"QTY".padStart(6, " ")}${LF}`;
        p += `${SEP}${LF}`;
        items.forEach((item: any) => {
            const rawName = String(item.item_name || item.name_snapshot || item.name || "Item");
            const qty     = String(item.qty_change ?? item.qty ?? item.quantity ?? 1);
            p += `${rawName.substring(0, nameW).padEnd(nameW, " ")}${qty.padStart(6, " ")}${LF}`;
            if (item.notes) p += `  > ${item.notes}${LF}`;
            (item.modifiers || []).forEach((m: any) => {
                const mn = m.modifier_name_snapshot || m.name || "";
                if (mn) p += `  + ${mn}${LF}`;
            });
        });
        p += `${SEP}${LF}`;
    } else {
        // ── Template-driven layout ────────────────────────────────────────────
        visibleBlocks.forEach((block: any) => {
            const cfg  = block.config ? { ...block, ...block.config } : block;
            const type = block.type;
            const a    = align(cfg.align || "left");
            const bold = (cfg.bold || cfg.is_bold) ? CMD.boldOn : CMD.boldOff;

            p += a + bold;

            switch (type) {
                case "header": {
                    const name    = resolvePlaceholders(cfg.title || restaurant?.name || "YUMMY RESTAURANT", kot, order, restaurant);
                    const address = resolvePlaceholders(cfg.address || restaurant?.address || "", kot, order, restaurant);
                    const phone   = resolvePlaceholders(cfg.phone || restaurant?.phone || "", kot, order, restaurant);
                    p += `${name.toUpperCase()}${LF}`;
                    if (cfg.show_address !== false && address) p += `${address.toUpperCase()}${LF}`;
                    if (cfg.show_phone !== false && phone)     p += `${cfg.phone_label || "CONTACT"}: ${phone}${LF}`;
                    if (cfg.show_pan === true) {
                        const pan = resolvePlaceholders(cfg.pan || restaurant?.pan_number || "", kot, order, restaurant);
                        if (pan) p += `${cfg.pan_label || "PAN"}: ${pan}${LF}`;
                    }
                    p += `${SEP}${LF}`;
                    break;
                }

                case "divider":
                    p += `${SEP}${LF}`;
                    break;

                case "bill_info": {
                    const date   = kot.created_at ? new Date(kot.created_at) : new Date();
                    const dateStr = date.toLocaleDateString("en-GB");
                    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

                    if (cfg.show_kot_number !== false) {
                        const kotNum  = kot.kot_number || kot.id;
                        const stLabel = cfg.station_label || "STATION";
                        const kotLabel = cfg.kot_label || "KOT";
                        const stVal   = kot.station || "";

                        if (cfg.show_station === true && stVal) {
                            // KOT# on left, STATION on right
                            const left  = `${kotLabel}: #${kotNum}`;
                            const right = `${stLabel}: ${stVal.toUpperCase()}`;
                            const space = WIDTH - left.length - right.length;
                            p += `${left}${" ".repeat(Math.max(1, space))}${right}${LF}`;
                        } else {
                            p += `${kotLabel}: #${kotNum}${LF}`;
                        }
                    }

                    if (cfg.show_table !== false) {
                        const tbl = order.table_name || "N/A";
                        p += `${cfg.table_label || "TABLE"}: ${tbl}${LF}`;
                    }

                    if (cfg.show_order_id !== false) {
                        p += `${cfg.order_label || "ORDER"}: #${order.id || ""}${LF}`;
                    }

                    if (cfg.show_date === true) {
                        p += `${cfg.date_label || "DATE"}: ${dateStr}${LF}`;
                    }

                    if (cfg.show_time === true) {
                        p += `${cfg.time_label || "TIME"}: ${timeStr}${LF}`;
                    }

                    if (cfg.show_user === true) {
                        const user = order.waiter_name || kot.created_by_staff_name || "N/A";
                        p += `${cfg.user_label || "USER"}: ${user}${LF}`;
                    }

                    p += `${SEP}${LF}`;
                    break;
                }

                case "items": {
                    const nameW     = WIDTH - 6;
                    const showSerial = cfg.show_serial !== false;
                    const serialW   = showSerial ? 4 : 0;
                    const itemNameW = nameW - serialW;

                    // Header row
                    const itemLabel = (cfg.item_label || "ITEM").padEnd(itemNameW - (showSerial ? serialW : 0), " ");
                    const qtyLabel  = (cfg.qty_label  || "QTY").padStart(6, " ");
                    if (showSerial) {
                        p += `${"#".padEnd(serialW)}${itemLabel}${qtyLabel}${LF}`;
                    } else {
                        p += `${itemLabel}${qtyLabel}${LF}`;
                    }
                    p += `${SEP}${LF}`;

                    (kot.items || []).forEach((item: any, idx: number) => {
                        const rawName = String(item.item_name || item.name_snapshot || item.name || "Item");
                        const qty     = String(item.qty_change ?? item.qty ?? item.quantity ?? 1);
                        const sn      = showSerial ? `${String(idx + 1).padEnd(serialW)}` : "";
                        const nameStr = rawName.substring(0, itemNameW).padEnd(itemNameW, " ");
                        p += `${sn}${nameStr}${qty.padStart(6, " ")}${LF}`;
                        if (item.notes) p += `  > ${item.notes}${LF}`;
                        (item.modifiers || []).forEach((m: any) => {
                            const mn = m.modifier_name_snapshot || m.name || "";
                            if (mn) p += `  + ${mn}${LF}`;
                        });
                    });
                    p += `${SEP}${LF}`;
                    break;
                }

                case "text":
                case "custom_text": {
                    const txt = resolvePlaceholders(cfg.text || cfg.content || "", kot, order, restaurant);
                    if (txt) p += `${txt}${LF}`;
                    break;
                }

                case "footer": {
                    const msg = resolvePlaceholders(cfg.message || "End of Ticket", kot, order, restaurant);
                    p += `${SEP}${LF}`;
                    p += `${msg}${LF}`;
                    break;
                }

                default:
                    break;
            }

            // Reset bold and alignment after each block
            p += CMD.boldOff + CMD.left;

            // Block padding
            const paddingBottom = Number(cfg.padding_bottom || 0);
            for (let i = 0; i < Math.ceil(paddingBottom / 8); i++) p += LF;
        });
    }

    // Feed paper and cut
    p += CMD.feed(6);  // Feed 6 lines to clear cutter gap
    p += CMD.cut;

    // Null padding to prevent TCP FIN before printer reads cut
    for (let i = 0; i < 50; i++) p += "\x00";

    return p;
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

            // Check if this device is assigned to print for this station
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

            // ── Deduplication (8s window) ────────────────────────────────────
            const kotId = data.kot_id || data.id || data.kot?.id;
            const key   = `id:${String(kotId)}`;
            const now   = Date.now();
            const lastSeen = recentPrintsRef.current.get(key) || 0;
            if (now - lastSeen < 8000) {
                console.log(`[GlobalKotPrinter] Skipping duplicate KOT ${kotId} (${now - lastSeen}ms ago)`);
                return;
            }
            recentPrintsRef.current.set(key, now);

            // ── Skip if already auto-printed ─────────────────────────────────
            if (data.auto_printed_at || data.kot?.auto_printed_at) {
                console.log(`[GlobalKotPrinter] KOT ${kotId} already auto-printed. Skipping.`);
                return;
            }

            // ── Fetch full KOT if items missing ──────────────────────────────
            if ((!data.items || data.items.length === 0) && kotId) {
                try {
                    console.log(`[GlobalKotPrinter] Fetching full KOT #${kotId}...`);
                    const res = await apiClient.get(`/kots/${kotId}`);
                    data = res.data?.data || res.data;
                } catch (err) {
                    console.error("[GlobalKotPrinter] Failed to fetch KOT:", err);
                    return;
                }
            }

            // ── Fetch KOT template from designer ─────────────────────────────
            let template: any[] = [];
            const currentRestaurantId = useRestaurant.getState().restaurant?.id;
            const restId = data.restaurant_id || data.order?.restaurant_id || currentRestaurantId;

            if (restId) {
                try {
                    const res = await apiClient.get(RestaurantApis.getTemplates(restId));
                    const templatesData = res.data?.data || res.data;
                    const kotTmpl = Array.isArray(templatesData)
                        ? templatesData.find((t: any) => t.type === "kot" || t.name?.toLowerCase().includes("kot"))
                        : (templatesData?.kot_template || templatesData?.template);
                    if (kotTmpl) {
                        template = Array.isArray(kotTmpl) ? kotTmpl : (kotTmpl.blocks || []);
                        console.log(`[GlobalKotPrinter] Loaded KOT template with ${template.length} blocks`);
                    }
                } catch (err) {
                    console.warn("[GlobalKotPrinter] Failed to fetch KOT template, using default layout:", err);
                }
            }

            // ── Resolve station printer ──────────────────────────────────────
            const stationName = data.station || data.kot?.station;
            console.log(`[GlobalKotPrinter] Resolving printer for station="${stationName}", restaurant=${restId}`);

            const assignedPrinter = restId ? await resolveAssignedPrinter(restId, stationName) : null;
            if (!assignedPrinter) {
                console.warn(`[GlobalKotPrinter] No printer assigned for station "${stationName}". Skipping auto-print.`);
                return;
            }

            console.log(`[GlobalKotPrinter] Assigned printer:`, assignedPrinter.name, assignedPrinter.address, assignedPrinter.printer_type);

            // ── Atomic Backend Claim (prevents Flutter + Electron double printing) ──
            // FAIL-OPEN: only skip if backend EXPLICITLY returns false (another device claimed it).
            // On network errors or timeouts → still print (don't block on backend unavailability).
            if (kotId) {
                try {
                    const claimRes = await apiClient.post(`/kots/${kotId}/mark-auto-printed`);
                    const claimed = claimRes.data?.data;
                    if (claimed === false) {
                        console.log(`[GlobalKotPrinter] KOT ${kotId} already claimed by another terminal. Skipping.`);
                        return;
                    }
                    console.log(`[GlobalKotPrinter] ✅ Claimed KOT ${kotId} for printing.`);
                } catch (err: any) {
                    const status = err?.response?.status;
                    if (status === 409) {
                        // 409 Conflict = another device claimed it first
                        console.log(`[GlobalKotPrinter] KOT ${kotId} claimed by another terminal (409). Skipping.`);
                        return;
                    }
                    // Network error / 404 / 500 → fail-open, print anyway
                    console.warn(`[GlobalKotPrinter] Claim request failed (status=${status}), printing anyway:`, err?.message);
                }
            }

            const winAny = window as any;
            if (!winAny.electronAPI) {
                console.warn("[GlobalKotPrinter] Not in Electron. Cannot print.");
                return;
            }

            const isNetworkPrinter =
                assignedPrinter.printer_type === "network" ||
                /^\d{1,3}(\.\d{1,3}){3}$/.test(String(assignedPrinter.address || "").trim());

            if (isNetworkPrinter && winAny.electronAPI.printNetworkRaw) {
                const host    = String(assignedPrinter.address || "").trim();
                const port    = Number(assignedPrinter.connection_config?.port || 9100);
                const payload = buildEscPosKot(data, template);

                console.log(`[GlobalKotPrinter] 🖨️ Sending raw ESC/POS (${payload.length} bytes) → ${host}:${port}`);
                console.log(`[GlobalKotPrinter] Template blocks used: ${template.length > 0 ? template.length : "0 (default layout)"}`);

                try {
                    const result = await winAny.electronAPI.printNetworkRaw({ host, port, payload });
                    console.log(`[GlobalKotPrinter] ✅ Print result:`, result);
                } catch (err) {
                    console.error(`[GlobalKotPrinter] ❌ Print error:`, err);
                }
            } else if (winAny.electronAPI.printSilent) {
                const printerName = assignedPrinter.name;
                console.log(`[GlobalKotPrinter] 🖨️ Silent Windows print → ${printerName}`);
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

    return null;
}
