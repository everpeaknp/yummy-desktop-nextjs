"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThermalKOT } from "@/components/receipts/thermal-kot";
import apiClient from "@/lib/api-client";
import { PrinterApis, RestaurantApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";

export function GlobalKotPrinter() {
    const restaurant = useRestaurant((s) => s.restaurant);
    const [printJob, setPrintJob] = useState<{ kotData: any; template: any[] } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [printerRoutingUnauthorized, setPrinterRoutingUnauthorized] = useState(false);
    const recentPrintsRef = useRef<Map<string, number>>(new Map());

    const buildDedupeKeys = (data: any) => {
        const orderId = data?.order_id || data?.order?.id || data?.data?.order_id;
        const station = String(data?.station || data?.kot?.station || data?.data?.station || "").trim().toLowerCase();
        const kotNumber = String(data?.kot_number || data?.kot?.kot_number || data?.data?.kot_number || "").trim().toLowerCase();
        const explicitIds = [
            data?.kot_id,
            data?.id,
            data?.kot?.id,
            data?.data?.id,
            data?.data?.kot_id
        ]
            .filter(Boolean)
            .map((value) => `id:${String(value)}`);

        const compositeKeys = [
            orderId && kotNumber ? `order:${orderId}:kot:${kotNumber}` : null,
            orderId && station && kotNumber ? `order:${orderId}:station:${station}:kot:${kotNumber}` : null,
            orderId && station ? `order:${orderId}:station:${station}` : null,
        ].filter(Boolean) as string[];

        return [...explicitIds, ...compositeKeys];
    };

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const normalizeStation = (value?: string) => (value || "").trim().toLowerCase();
        const resolveAssignedPrinter = async (restaurantId: number, stationName?: string): Promise<any | null> => {
            const targetStation = normalizeStation(stationName);

            // If no station is present, do not fallback to "any/default" printer.
            if (!targetStation) return null;

            // PREVENT MULTIPLE PCS PRINTING THE SAME KOT:
            // Check if THIS device is configured to auto-print for this station.
            try {
                const localStationsRaw = localStorage.getItem("yummy_local_kot_stations");
                if (localStationsRaw !== null) {
                    const localStations: string[] = JSON.parse(localStationsRaw).map((s: string) => normalizeStation(s));
                    if (!localStations.includes(targetStation)) {
                        console.log(`[GlobalKotPrinter] Skipping auto-print for station "${stationName}": not enabled for THIS device.`);
                        return null;
                    }
                }
            } catch (err) {
                console.error("[GlobalKotPrinter] Error reading local device stations config", err);
            }

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

            const now = Date.now();
            const incomingKeys = buildDedupeKeys(data);
            const isDuplicate = incomingKeys.some((key) => {
                const lastSeen = recentPrintsRef.current.get(key) || 0;
                return now - lastSeen < 5000;
            });
            if (isDuplicate) {
                console.log("[GlobalKotPrinter] Skipping duplicate KOT print event:", incomingKeys);
                return;
            }
            
            // Mark incoming keys as seen immediately to prevent async race conditions
            // during the subsequent API fetch call.
            incomingKeys.forEach((key) => recentPrintsRef.current.set(key, now));
            
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

            const resolvedKeys = buildDedupeKeys(data);
            resolvedKeys.forEach((key) => recentPrintsRef.current.set(key, now));
            for (const [key, ts] of recentPrintsRef.current.entries()) {
                if (now - ts > 30000) {
                    recentPrintsRef.current.delete(key);
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
                    console.log("🚀 [GlobalKotPrinter] Printing rendered KOT template via Electron IPC.");
                    const targetPrinter = cfg?.printer_name;
                    
                    // Always prefer the rendered backend-template design.
                    // Do not use the old raw-text network KOT path, because it bypasses the template.
                    if (targetPrinter && winAny.electronAPI.getPrinters) {
                        winAny.electronAPI.getPrinters().then((printers: any[]) => {
                            console.log(`[GlobalKotPrinter] OS Printers found:`, printers.map(p => p.name));
                            console.log(`[GlobalKotPrinter] Looking for target printer: "${targetPrinter}"`);
                            
                            const exists = printers.find((p: any) => p.name === targetPrinter);
                            const isNetworkPrinter = cfg?.printer_type === 'network' || /^\d{1,3}(\.\d{1,3}){3}$/.test(String(cfg?.address || '').trim());
                            
                            if (exists) {
                                // Prefer the beautiful HTML template via Windows Spooler if installed
                                console.log(`[GlobalKotPrinter] ✅ Printer found in Windows. Sending silent print job to: ${targetPrinter}`);
                                winAny.electronAPI.printSilent({ printerName: targetPrinter });
                            } else if (isNetworkPrinter && cfg?.address && winAny.electronAPI.printNetworkRaw) {
                                // Fallback to raw TCP ESC/POS if not installed in Windows but IP is provided
                                console.log(`[GlobalKotPrinter] 🌐 Network Printer not in Windows. Falling back to raw TCP KOT at: ${cfg.address}:${cfg.port || 9100}`);
                                
                                const order = printJob.kotData?.order || printJob.kotData;
                                const items = printJob.kotData?.items || order?.items || [];
                                const lines: string[] = [];
                                
                                lines.push(`\x1B\x40`); // Initialize printer
                                lines.push(`\x1B\x61\x01`); // Center align
                                lines.push(`*** KITCHEN ORDER ***\n`);
                                lines.push(`\x1B\x61\x00`); // Left align
                                lines.push(`--------------------------------`);
                                lines.push(`KOT: #${printJob.kotData.id || order?.id || '-'}`);
                                if (printJob.kotData.station) lines.push(`STATION: ${printJob.kotData.station}`);
                                if (order?.table_name || order?.table) lines.push(`TABLE: ${order?.table_name || order?.table}`);
                                lines.push(`DATE: ${new Date().toLocaleString()}`);
                                lines.push(`--------------------------------`);
                                lines.push(`ITEM                         QTY`);
                                lines.push(`--------------------------------`);
                                
                                items.forEach((item: any) => {
                                    const name = String(item.name_snapshot || item.item_name || item.name || "Item").substring(0, 24).padEnd(24, ' ');
                                    const qty = String(item.qty || 1).padStart(8, ' ');
                                    lines.push(`${name}${qty}`);
                                });
                                
                                lines.push(`--------------------------------`);
                                lines.push(`\r\n\r\n\r\n\x1B\x69`); // Cut paper
                                
                                // Padding for cheap TCP FIN drops
                                for (let i = 0; i < 50; i++) lines.push(`\x00`);
                                
                                const payload = lines.join('\r\n');
                                winAny.electronAPI.printNetworkRaw({
                                    host: cfg.address.trim(),
                                    port: Number(cfg.port || 9100),
                                    payload: payload
                                }).then((res: any) => console.log("[GlobalKotPrinter] Raw response:", res))
                                  .catch((err: any) => console.error("[GlobalKotPrinter] Raw error:", err));
                            } else {
                                console.warn(`[GlobalKotPrinter] ❌ Printer "${targetPrinter}" not found on this machine, and not a network printer. Ignoring job.`);
                            }
                        }).catch((err: any) => {
                            console.error(`[GlobalKotPrinter] ❌ Error getting OS printers:`, err);
                            winAny.electronAPI.printSilent({ printerName: targetPrinter });
                        });
                    } else {
                        winAny.electronAPI.printSilent({ printerName: targetPrinter });
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
