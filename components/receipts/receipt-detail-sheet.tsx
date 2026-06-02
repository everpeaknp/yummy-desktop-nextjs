"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Printer, 
  Share2, 
  AlertCircle
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ThermalReceipt } from "@/components/receipts/thermal-receipt";
import { ReceiptApis, RestaurantApis, PrinterApis } from "@/lib/api/endpoints";
import { ReceiptData } from "@/types/order";
import { useAuth } from "@/hooks/use-auth";

// Types matching ReceiptModel.dart
interface ReceiptDetailSheetProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { numberToWords } from "@/lib/utils/number-to-words";

export function ReceiptDetailSheet({ 
  orderId, 
  open, 
  onOpenChange 
}: ReceiptDetailSheetProps) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [template, setTemplate] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const user = useAuth((state) => state.user);

  useEffect(() => {
    if (open && orderId) {
      fetchData();
    } else {
      setReceipt(null);
      setTemplate(null);
      setError(null);
    }
  }, [open, orderId]);

  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(ReceiptApis.getReceiptData(orderId));
      if (response.data.status === "success") {
        const receiptData = response.data.data;
        setReceipt(receiptData);

        // Fetch template
        const restaurantId = receiptData.restaurant?.id || user?.restaurant_id;
        if (restaurantId) {
           try {
             const tempRes = await apiClient.get(RestaurantApis.getTemplates(restaurantId));
             if (tempRes.data.status === "success" && tempRes.data.data?.receipt_template?.length > 0) {
               setTemplate(tempRes.data.data.receipt_template);
             } else {
               setTemplate(defaultTemplate);
             }
           } catch {
             setTemplate(defaultTemplate);
           }
        } else {
           setTemplate(defaultTemplate);
        }
      } else {
        setError("Failed to load receipt data");
      }
    } catch (err: any) {
      console.error("Failed to fetch receipt data:", err);
      setError(err.response?.data?.message || "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  };

  // Default template if none found
  const defaultTemplate = [
    { type: 'global_settings', id: 'metadata', global_font_type: 'A', global_font_size: 11, line_spacing: 1.4, paper_size: '80mm' },
    { id: '1', type: 'header', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '2', type: 'bill_info', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '3', type: 'customer', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '4', type: 'items', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '5', type: 'totals', is_visible: true, show_on_bill: true, show_on_receipt: true },
    { id: '6', type: 'payments', is_visible: true, show_on_bill: false, show_on_receipt: true },
    { id: '7', type: 'footer', is_visible: true, show_on_bill: true, show_on_receipt: true },
  ];

  const buildRawPayload = (r: ReceiptData, t: any[]) => {
    const order = r?.order as any;
    const restaurant = r?.restaurant as any;
    const blocks = (t || [])
      .filter((b: any) => b?.type !== "global_settings")
      .map((b: any) => ({ ...b, cfg: b?.config ? { ...b, ...b.config } : b }))
      .filter((b: any) => (b?.is_visible ?? b?.isVisible ?? true) && (b?.show_on_receipt ?? b?.showOnReceipt ?? true));

    const lines: string[] = [];
    const header = blocks.find((b: any) => b.type === "header")?.cfg || {};
    lines.push(String(header.title || restaurant?.name || "YUMMY RECEIPT"));
    if (header.show_address !== false && restaurant?.address) lines.push(String(restaurant.address));
    if (header.show_phone !== false && restaurant?.phone) lines.push(`${header.phone_label || "Contact"}: ${restaurant.phone}`);
    lines.push("---------------------------");
    lines.push(`Order: #${order?.restaurant_order_id || order?.id || orderId}`);
    lines.push(`Table: ${order?.table_name || "-"}`);
    lines.push(`Date: ${new Date(order?.created_at || Date.now()).toLocaleString()}`);
    lines.push("---------------------------");
    (order?.items || []).forEach((item: any, idx: number) => {
      lines.push(`${idx + 1}. ${(item?.name_snapshot || item?.item_name || "Item")} x${item?.qty ?? 1} @${Number(item?.unit_price || 0).toFixed(2)} = ${Number(item?.line_total || 0).toFixed(2)}`);
    });
    lines.push("---------------------------");
    const subtotal = Number(order?.subtotal || 0);
    const tax = Number(order?.tax_total || 0);
    const total = Number(order?.grand_total || 0);
    const serviceCharge = Number(order?.service_charge || 0);
    const discount = Math.max(0, Number((subtotal + tax + serviceCharge - total).toFixed(2)));
    const discountReason =
      order?.discount_reason ||
      order?.manual_discount_reason ||
      order?.discount_note ||
      order?.discount_code ||
      null;
    lines.push(`Subtotal: Rs.${subtotal.toFixed(2)}`);
    lines.push(`Tax: Rs.${tax.toFixed(2)}`);
    if (discount > 0) {
      lines.push(`Discount: -Rs.${discount.toFixed(2)}`);
      if (discountReason) lines.push(`Reason: ${String(discountReason)}`);
    }
    lines.push(`Grand Total: Rs.${total.toFixed(2)}`);
    (order?.payments || []).forEach((p: any) => {
      lines.push(`${String(p?.method || "payment").toUpperCase()}: Rs.${Number(p?.amount || 0).toFixed(2)}`);
    });
    lines.push("\n\n\n");
    return lines.join("\n");
  };

  const tryElectronNetworkPrint = async (): Promise<boolean> => {
    try {
      // @ts-ignore
      if (typeof window === "undefined" || !window.electronAPI?.printNetworkRaw || !receipt) return false;
      const restaurantId = receipt?.restaurant?.id;
      if (!restaurantId) return false;

      const listRes = await apiClient.get(PrinterApis.list(restaurantId));
      const printers = listRes?.data?.data || [];
      const printer = printers.find((p: any) => p?.enabled && p?.is_default) || printers.find((p: any) => p?.enabled);
      if (!printer) return false;

      const host = String(printer?.connection_config?.ip_address || printer?.address || "").trim();
      const port = Number(printer?.connection_config?.port || 9100);
      if (!host) return false;

      const payload = buildRawPayload(receipt, template || defaultTemplate);
      // @ts-ignore
      const res = await window.electronAPI.printNetworkRaw({ host, port, payload });
      return !!res?.success;
    } catch {
      return false;
    }
  };

  const handlePrint = async () => {
    const sent = await tryElectronNetworkPrint();
    if (sent) return;

    window.print();
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0 print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Header - Hidden in Print */}
        <SheetHeader className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b print:hidden">
          <SheetTitle className="text-lg font-bold">Receipt Details</SheetTitle>
          <SheetDescription>
            Order #{receipt?.restaurant_order_id || receipt?.order_id || orderId}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/50 print:p-0 print:overflow-visible">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading receipt...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-red-500">
              <AlertCircle className="h-8 w-8" />
              <p className="font-medium">{error}</p>
              <Button variant="outline" onClick={fetchData}>Retry</Button>
            </div>
          ) : receipt ? (
            <div className="flex flex-col items-center gap-6">
               <div ref={receiptRef} id="receipt-content" className="shadow-2xl rounded-sm overflow-hidden scale-[0.85] origin-top md:scale-100 transition-transform duration-300">
                  <ThermalReceipt 
                    data={receipt} 
                    template={template || defaultTemplate} 
                  />
               </div>
               
               <div className="text-center pb-12 opacity-40">
                 <p className="text-[10px] font-mono tracking-tighter">TRANS ID: {receipt.order?.restaurant_order_id || receipt.order?.id}</p>
                 <p className="text-[9px] uppercase font-bold mt-1">Digital Receipt Record</p>
               </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions - Hidden in Print */}
        <SheetFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/50 print:hidden shrink-0">
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1 py-6 bg-white dark:bg-slate-950 font-bold uppercase tracking-widest text-xs h-12" onClick={handlePrint} disabled={!receipt}>
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
            <Button variant="outline" className="w-12 h-12 p-0 bg-white dark:bg-slate-950 font-bold" disabled={!receipt}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
