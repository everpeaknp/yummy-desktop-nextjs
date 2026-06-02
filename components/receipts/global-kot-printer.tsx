"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ThermalKOT } from "@/components/receipts/thermal-kot";
import apiClient from "@/lib/api-client";
import { PrinterApis, RestaurantApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";

function buildKotRawPayload(kotData: any, templateBlocks: any[]) {
    const blocks = (templateBlocks || [])
        .filter((b: any) => b?.type !== "global_settings")
        .map((b: any) => ({ ...b, cfg: b?.config ? { ...b, ...b.config } : b }))
        .filter((b: any) => (b?.is_visible ?? b?.isVisible ?? true));

    const lines: string[] = [];
    const header = blocks.find((b: any) => b.type === "header")?.cfg || {};
    lines.push(String(header.title || kotData?.restaurant?.name || "YUMMY KOT"));
    if (header.show_address !== false && kotData?.restaurant?.address) lines.push(String(kotData.restaurant.address));
    if (header.show_phone !== false && kotData?.restaurant?.phone) lines.push(`${header.phone_label || "Phone"}: ${kotData.restaurant.phone}`);

    const billInfo = blocks.find((b: any) => b.type === "bill_info")?.cfg || {};
    lines.push("---------------------------");
    lines.push(`${billInfo.kot_label || "KOT"}: ${kotData?.kot_number || kotData?.kot_id || "-"}`);
    lines.push(`${billInfo.station_label || "Station"}: ${kotData?.station || "-"}`);
    lines.push(`${billInfo.table_label || "Table"}: ${kotData?.order?.table_name || "-"}`);
    lines.push(`${billInfo.order_label || "Order"}: #${kotData?.order?.id || kotData?.order_id || "-"}`);
    lines.push("---------------------------");

    const itemsCfg = blocks.find((b: any) => b.type === "items")?.cfg || {};
    const showSerial = itemsCfg.show_serial !== false;
    const showNotes = itemsCfg.show_notes !== false;
    const items = Array.isArray(kotData?.items) ? kotData.items : [];
    items.forEach((item: any, idx: number) => {
        const name = item?.item_name || item?.name_snapshot || "Item";
        const qty = item?.qty_change ?? item?.qty ?? 1;
        lines.push(`${showSerial ? `${idx + 1}. ` : ""}${name} x${qty}`);
        if (showNotes && item?.notes) lines.push(`  Note: ${item.notes}`);
    });

    const footer = blocks.find((b: any) => b.type === "footer")?.cfg || {};
    lines.push("---------------------------");
    lines.push(String(footer.message || "KOT END"));
    lines.push("\n\n\n");
    return lines.join("\n");
}

export function GlobalKotPrinter() {
    const restaurant = useRestaurant((s) => s.restaurant);
    const [printJob, setPrintJob] = useState<{ kotData: any; template: any[] } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [printerRoutingUnauthorized, setPrinterRoutingUnauthorized] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const normalizeStation = (value?: string) => (value || "").trim().toLowerCase();
        const resolveAssignedPrinter = async (restaurantId: number, stationName?: string): Promise<any | null> => {
            const targetStation = normalizeStation(stationName);

            // If no station is present, do not fallback to "any/default" printer.
            if (!targetStation) return null;

            try {
                const restaurantState = useRestaurant.getState().restaurant as any;
                const embeddedStations = restaurantState?.kot_station_config?.stations;
                let stations = Array.isArray(embeddedStations) ? embeddedStations : [];

                if (!stations.length && !printerRoutingUnauthorized) {
                    try {
                        const stationRes = await apiClient.get(PrinterApis.stationConfig(restaurantId), {
                            headers: {
                                "x-restaurant-id": String(restaurantId),
                            },
                        });
                        stations = stationRes.data?.data?.stations || [];
                    } catch (err) {
                        const status = (err as any)?.response?.status;
                        if (status === 401 || status === 403) {
                            setPrinterRoutingUnauthorized(true);
                            console.warn("[GlobalKotPrinter] Printer routing endpoints unauthorized for this role; using embedded restaurant station mapping.");
                        } else {
                            throw err;
                        }
                    }
                }

                const printersRes = await apiClient.get(PrinterApis.list(restaurantId));
                const printers = printersRes.data?.data || [];

                const stationConfig = stations.find((s: any) => normalizeStation(s?.name) === targetStation);
                const assignedPrinterId = stationConfig?.printer_id;
                if (!assignedPrinterId) return null;

                const assignedPrinter = printers.find((p: any) => p?.id === assignedPrinterId && p?.enabled);
                return assignedPrinter || null;
            } catch (err) {
                console.error("[GlobalKotPrinter] Failed to resolve station printer", err);
                return null;
            }
        };

        const handlePrintEvent = async (e: any) => {
            let data = e.detail;
            if (!data) return;

            console.log("[GlobalKotPrinter] Received print request for KOT:", data);
            
            // If the payload is missing items (like from kot_created), fetch the full KOT
            if (!data.items || data.items.length === 0) {
                const kotId = data.kot_id || data.id;
                if (kotId) {
                    try {
                        const res = await apiClient.get(`/kots/${kotId}`);
                        if (res.data?.data) {
                            data = { ...data, ...res.data.data };
                        }
                    } catch (err) {
                        console.error("[GlobalKotPrinter] Failed to fetch full KOT details", err);
                    }
                }
            }

            // Fetch template
            let activeTemplate: any[] = [];
            const currentRestaurantId = useRestaurant.getState().restaurant?.id;
            const restId = data.restaurant_id || data.restaurantId || data.order?.restaurant_id || currentRestaurantId;
            if (restId) {
                try {
                    const res = await apiClient.get(RestaurantApis.getTemplates(restId));
                    const templatesData = res.data?.data || res.data;
                    const kotTmpl = Array.isArray(templatesData) 
                        ? templatesData.find((t: any) => t.type === 'kot' || t.name?.toLowerCase().includes('kot')) 
                        : (templatesData?.kot_template || templatesData?.template);
                        
                    if (kotTmpl) {
                        activeTemplate = Array.isArray(kotTmpl) ? kotTmpl : (kotTmpl.blocks || []);
                    }
                } catch (err) {
                    console.error("[GlobalKotPrinter] Failed to fetch KOT template", err);
                }
            }

            // Resolve strict station-level printer routing.
            const stationName = data.station || data.kot?.station;
            
            const explicitPrinterName = data.printer_config?.printer_name;
            let assignedPrinter: any | null = null;
            if (restId) {
                assignedPrinter = await resolveAssignedPrinter(restId, stationName);
            }
            const assignedPrinterName: string | null =
                explicitPrinterName ||
                assignedPrinter?.name ||
                null;

            // No assigned printer => do not print to random/default system printer.
            if (!assignedPrinterName) {
                console.warn(
                    `[GlobalKotPrinter] No assigned enabled printer found for station "${stationName || "unknown"}". Skipping auto-print.`
                );
                return;
            }

            // Set data to trigger render
            setPrintJob({
                kotData: {
                    ...data,
                    printer_config: {
                        ...(data.printer_config || {}),
                        printer_name: assignedPrinterName,
                        address: assignedPrinter?.address || data.printer_config?.address,
                        port: assignedPrinter?.connection_config?.port || data.printer_config?.port || 9100,
                        printer_type: assignedPrinter?.printer_type || data.printer_config?.printer_type
                    }
                },
                template: activeTemplate
            });
        };

        window.addEventListener("yummy:kot-print", handlePrintEvent);
        return () => window.removeEventListener("yummy:kot-print", handlePrintEvent);
    }, []);

    useEffect(() => {
        if (printJob) {
            // Wait for DOM to update then print
            const timer1 = setTimeout(() => {
                console.log("🖨️ [GlobalKotPrinter] Triggering physical/PDF print for KOT:", printJob.kotData.id || printJob.kotData.kot_id);
                
                const winAny = window as any;
                if (winAny.electronAPI) {
                    const cfg = printJob.kotData?.printer_config || {};
                    const printerType = String(cfg.printer_type || "").toLowerCase();
                    const host = String(cfg.address || "").trim();
                    const port = Number(cfg.port || 9100);
                    const isNetwork =
                        printerType.includes("network") ||
                        /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

                    if (isNetwork && host) {
                        const payload = buildKotRawPayload(printJob.kotData, template || []);

                        if (typeof winAny.electronAPI?.printNetworkRaw === "function") {
                            winAny.electronAPI.printNetworkRaw({
                                host,
                                port,
                                payload,
                            }).then((res: any) => {
                                if (!res?.success) {
                                    console.error("[GlobalKotPrinter] Network raw print failed:", res?.message);
                                }
                            }).catch((err: any) => {
                                console.error("[GlobalKotPrinter] Network raw print error:", err);
                            });
                        } else {
                            console.warn("[GlobalKotPrinter] printNetworkRaw not available in preload. Falling back to silent print.");
                            winAny.electronAPI.printSilent({
                                printerName: printJob.kotData.printer_config?.printer_name
                            });
                        }
                    } else {
                        console.log("🚀 [GlobalKotPrinter] Routing silently via Electron IPC!");
                        const targetPrinter = printJob.kotData.printer_config?.printer_name;
                        
                        // Verify the printer exists locally before printing to avoid fallback-to-default bug!
                        if (targetPrinter && winAny.electronAPI.getPrinters) {
                            winAny.electronAPI.getPrinters().then((printers: any[]) => {
                                const exists = printers.find((p: any) => p.name === targetPrinter);
                                if (!exists) {
                                    console.warn(`[GlobalKotPrinter] Printer "${targetPrinter}" not found on this machine. Ignoring print job to prevent fallback to default printer.`);
                                    return;
                                }
                                winAny.electronAPI.printSilent({ printerName: targetPrinter });
                            }).catch(() => {
                                winAny.electronAPI.printSilent({ printerName: targetPrinter });
                            });
                        } else {
                            winAny.electronAPI.printSilent({ printerName: targetPrinter });
                        }
                    }
                } else {
                    const clear = () => setPrintJob(null);
                    const onAfterPrint = () => {
                        window.removeEventListener("afterprint", onAfterPrint);
                        clear();
                    };
                    window.addEventListener("afterprint", onAfterPrint);
                    window.print();

                    // Fallback in case afterprint doesn't fire in some browsers.
                    setTimeout(() => {
                        window.removeEventListener("afterprint", onAfterPrint);
                        clear();
                    }, 4000);
                    return;
                }
                
                // Wait a bit before clearing so print dialog has the DOM
                const timer2 = setTimeout(() => {
                    setPrintJob(null);
                }, 800);
            }, 150);
            return () => clearTimeout(timer1);
        }
    }, [printJob]);

    if (!printJob || !mounted || typeof document === "undefined") return null;

    const { kotData, template } = printJob;

    // We render the KOT component in a portal attached directly to the body.
    // This allows us to hide ALL other body elements (like the Next.js root div)
    // during printing, ensuring only the KOT is printed without any layout interference.
    const content = (
        <div className="fixed inset-0 z-[99999] bg-white print:flex print:items-start print:justify-center print-kot-container">
            <div className="print-content" style={{ backgroundColor: 'white', padding: '10mm' }}>
                <ThermalKOT data={kotData} template={template} />
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0 !important; padding: 0 !important; background: white; }
                    /* Hide everything in the body EXCEPT our portal container */
                    body > *:not(.print-kot-container) {
                        display: none !important;
                    }
                    /* Ensure the container and its content are visible */
                    .print-kot-container {
                        display: flex !important;
                        position: relative !important;
                        background: white !important;
                    }
                }
                /* Hide it on screen */
                @media screen {
                    .print-kot-container {
                        display: none !important;
                    }
                }
            `}} />
        </div>
    );

    return createPortal(content, document.body);
}
