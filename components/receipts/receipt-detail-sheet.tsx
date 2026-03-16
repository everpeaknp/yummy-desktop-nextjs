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
import { ReceiptApis, RestaurantApis } from "@/lib/api/endpoints";
import { ReceiptData } from "@/types/order";

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
        const restaurantId = receiptData.restaurant?.id;
        if (restaurantId) {
           const tempRes = await apiClient.get(RestaurantApis.getTemplates(restaurantId));
           if (tempRes.data.status === "success" && tempRes.data.data?.receipt_template) {
             setTemplate(tempRes.data.data.receipt_template);
           }
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

  const handlePrint = async () => {
    if (!receiptRef.current) return;

    const globalBlock = template?.find((b: any) => b.type === 'global_settings');
    const paperSizeStr = globalBlock?.config?.paper_size || globalBlock?.paper_size || '80mm';
    const paperWidthMm = paperSizeStr === '58mm' ? 58 : 80;

    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture the receipt element as a canvas image
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // High resolution for thermal printer quality
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;

      // Calculate page height proportionally to match 80mm width
      const pageHeightMm = (imgHeightPx / imgWidthPx) * paperWidthMm;

      // Create a PDF with exact thermal dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [paperWidthMm, pageHeightMm],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, paperWidthMm, pageHeightMm);

      // Open as blob URL for printing
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const pdfWindow = window.open(blobUrl, '_blank');
      if (pdfWindow) {
        pdfWindow.addEventListener('load', () => {
          pdfWindow.print();
        });
      }
    } catch (err) {
      console.error('PDF print failed, falling back to window.print()', err);
      window.print();
    }
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
