"use client";

import { useEffect, useState } from "react";
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
import { ReceiptApis } from "@/lib/api/endpoints";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Types matching ReceiptModel.dart
interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  pre_tax_unit_price?: number;
  total: number;
  modifiers: any[];
}

interface ReceiptTotals {
  subtotal: number;
  subtotal_pre_tax?: number;
  tax: number;
  discount: number;
  total: number;
}

interface ReceiptRestaurantInfo {
  name: string;
  address: string;
  phone: string;
  email?: string;
  tax_id?: string;
  pan_number?: string;
}

interface Receipt {
  order_id: number;
  restaurant_order_id?: number;
  receipt_number: string;
  receipt_date: string;
  restaurant_info: ReceiptRestaurantInfo;
  customer_info?: {
    name: string;
    phone?: string;
    email?: string;
  };
  table_name?: string;
  items: ReceiptItem[];
  totals: ReceiptTotals;
  notes?: string;
}

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
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && orderId) {
      fetchReceipt();
    } else {
      setReceipt(null);
      setError(null);
    }
  }, [open, orderId]);

  const fetchReceipt = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(ReceiptApis.getReceiptData(orderId));
      if (response.data.status === "success" || response.data.data) {
        const rawData = response.data.data || response.data;
        const parsedReceipt = parseReceiptData(rawData);
        setReceipt(parsedReceipt);
      } else {
        setError("Failed to load receipt data");
      }
    } catch (err: any) {
      console.error("Failed to fetch receipt:", err);
      setError(err.response?.data?.message || "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse data similar to Flutter's ReceiptModel.fromJson
  const parseReceiptData = (json: any): Receipt => {
    const data = json.data || json;
    const orderData = data.order || data;
    const restaurantData = data.restaurant || data.restaurant_info || {};
    
    // Extract totals
    const subtotal = parseFloat(orderData.subtotal || json.subtotal || 0);
    const tax = parseFloat(orderData.tax_total || json.tax || json.tax_total || 0);
    const discount = parseFloat(orderData.discount_total || json.discount || json.discount_total || 0);
    const total = parseFloat(orderData.grand_total || json.total || json.grand_total || 0);
    const subtotalPreTax = orderData.subtotal_pre_tax ? parseFloat(orderData.subtotal_pre_tax) : undefined;
    // Extract items
    const itemsData = orderData.items || [];
    const items: ReceiptItem[] = Array.isArray(itemsData) ? itemsData.map((item: any) => {
      // Robust modifier parsing
      let modifiers: any[] = [];
      if (Array.isArray(item.modifiers)) {
        modifiers = item.modifiers;
      } else if (Array.isArray(item.selected_modifiers)) {
         modifiers = item.selected_modifiers;
      } else if (Array.isArray(item.addons)) {
         modifiers = item.addons;
      }
      
      // Filter out invalid modifiers if necessary, though strict typing might be an issue if we don't know the exact shape.
      // Assuming they have at least a name.

      return {
        name: item.name || item.name_snapshot || "",
        quantity: parseInt(item.quantity || item.qty || 0),
        unit_price: parseFloat(item.unit_price || 0),
        pre_tax_unit_price: item.pre_tax_unit_price ? parseFloat(item.pre_tax_unit_price) : undefined,
        total: parseFloat(item.total || item.line_total || 0),
        modifiers: modifiers
      };
    }) : [];
    
    // Robust Note extraction
    const notes = orderData.notes || json.notes || orderData.order_notes || orderData.description || "";
    
    // Debugging logs to help identify structure issues
    console.log("Parsed Receipt Items:", items);
    console.log("Parsed Notes:", notes);
    
    return {
      order_id: orderData.id || orderData.order_id || 0,
      receipt_number: json.receipt_number || orderData.receipt_number || `REC-${(orderData.id || 0).toString().padStart(6, '0')}`,
      receipt_date: json.receipt_date || orderData.created_at || new Date().toISOString(),
      restaurant_info: {
        name: restaurantData.name || "",
        address: restaurantData.address || "",
        phone: restaurantData.phone || "",
        email: restaurantData.email,
        pan_number: restaurantData.pan_number
      },
      customer_info: {
        name: orderData.customer_name || "Guest",
        phone: orderData.customer_phone,
        email: orderData.customer_email
      },
      table_name: orderData.table_name,
      items: items,
      totals: {
        subtotal,
        subtotal_pre_tax: subtotalPreTax,
        tax,
        discount,
        total
      },
      notes: notes
    };
  };

  const handlePrint = () => {
    const printContent = document.getElementById("receipt-content");
    if (printContent) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>Print Receipt</title>
              <style>
                @page { 
                  size: 80mm auto; 
                  margin: 0mm; 
                }
                body {
                  font-family: 'Courier New', Courier, monospace; 
                  margin: 0;
                  padding: 4mm;
                  width: 80mm;
                  font-size: 10px;
                  color: black;
                  background: white;
                  line-height: 1.2;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .font-bold { font-weight: bold; }
                .uppercase { text-transform: uppercase; }
                .text-xs { font-size: 8px; }
                .text-sm { font-size: 10px; }
                .text-base { font-size: 12px; }
                .text-lg { font-size: 14px; }
                .text-xl { font-size: 16px; }
                .italic { font-style: italic; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 9px; text-align: left; }
                td { padding: 2px 0; vertical-align: top; font-size: 10px; }
                
                .divider { border-top: 1px dashed #000; margin: 4px 0; width: 100%; }
                .divider-double { border-top: 3px double #000; margin: 4px 0; width: 100%; }
                
                .grid { display: grid; }
                .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .justify-between { justify-content: space-between; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                
                /* Reset colors for print */
                * { color: black !important; background: transparent !important; border-color: black !important; }
                .print\\:hidden { display: none !important; }
                
                /* Specific Column Widths from Flutter PdfService */
                .col-sn { width: 18px; text-align: center; }
                .col-qty { width: 22px; text-align: center; }
                .col-rate { width: 32px; text-align: right; }
                .col-amount { width: 36px; text-align: right; }
                .col-particular { flex: 1; padding-left: 4px; }
              </style>
            </head>
            <body>
              <div class="receipt-print-wrapper">
                ${printContent.innerHTML}
              </div>
            </body>
          </html>
        `);
        doc.close();
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    } else {
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

        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-950 print:p-0 print:overflow-visible text-black dark:text-white print:text-black">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading receipt...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-red-500">
              <AlertCircle className="h-8 w-8" />
              <p className="font-medium">{error}</p>
              <Button variant="outline" onClick={fetchReceipt}>Retry</Button>
            </div>
          ) : receipt ? (
            <div className="flex flex-col gap-0 font-mono text-black print:text-black" id="receipt-content">
              {/* Restaurant Header */}
              <div className="text-center space-y-0.5 mb-2">
                <h2 className="text-lg font-bold uppercase leading-tight">{receipt.restaurant_info?.name}</h2>
                <p className="text-[10px] leading-tight">{receipt.restaurant_info?.address?.toUpperCase()}</p>
                <p className="text-[10px] leading-tight">CONTACT NO: {receipt.restaurant_info?.phone}</p>
                {receipt.restaurant_info?.pan_number && (
                  <p className="text-[10px] leading-tight">PAN NO: {receipt.restaurant_info.pan_number}</p>
                )}
                <div className="pt-2">
                  <h3 className="text-[14px] font-bold uppercase tracking-[0.1em]">Bill Receipt</h3>
                </div>
              </div>

              <div className="divider border-t border-dashed border-black my-1" />

              {/* Order Info Row - 3 Columns */}
              <div className="grid grid-cols-3 text-[9px] mb-2">
                <div className="text-left flex flex-col">
                  <span className="opacity-60 font-bold uppercase">Date</span>
                  <span>{receipt.receipt_date ? format(new Date(receipt.receipt_date), "dd/MM/yyyy") : "-"}</span>
                  <span>{receipt.receipt_date ? format(new Date(receipt.receipt_date), "HH:mm") : "-"}</span>
                </div>
                <div className="text-center flex flex-col">
                   <span className="opacity-60 font-bold uppercase">Order No.</span>
                   <span className="text-[11px] font-bold">{receipt.restaurant_order_id || receipt.order_id}</span>
                </div>
                <div className="text-right flex flex-col">
                   <span className="opacity-60 font-bold uppercase">Table</span>
                   <span className="text-[11px] font-bold">{receipt.table_name || "A!"}</span>
                </div>
              </div>

              <div className="divider border-t border-dashed border-black my-1" />

              {/* Items Table Header */}
              <div className="flex text-[9px] font-bold uppercase py-1">
                <div className="col-sn" style={{ width: '18px', textAlign: 'center' }}>SN</div>
                <div className="flex-1 px-1">Particular</div>
                <div className="col-qty" style={{ width: '22px', textAlign: 'center' }}>Qty</div>
                <div className="col-rate" style={{ width: '32px', textAlign: 'right' }}>Rate</div>
                <div className="col-amount" style={{ width: '36px', textAlign: 'right' }}>Amount</div>
              </div>

              <div className="divider border-t border-dashed border-black mb-1" />

              {/* Items List */}
              <div className="flex flex-col gap-1.5 mb-2">
                {receipt.items?.map((item, idx) => {
                  const showTax = receipt.totals.tax > 0;
                  const displayRate = showTax ? (item.pre_tax_unit_price ?? item.unit_price) : item.unit_price;
                  const displayTotal = displayRate * item.quantity;
                  
                  return (
                    <div key={idx} className="flex flex-col">
                      <div className="flex text-[10px] leading-tight">
                        <div className="col-sn" style={{ width: '18px', textAlign: 'center' }}>{idx + 1}</div>
                        <div className="flex-1 px-1 uppercase font-bold">{item.name}</div>
                        <div className="col-qty" style={{ width: '22px', textAlign: 'center' }}>{item.quantity}</div>
                        <div className="col-rate" style={{ width: '32px', textAlign: 'right' }}>{displayRate.toFixed(0)}</div>
                        <div className="col-amount" style={{ width: '36px', textAlign: 'right' }}>{displayTotal.toFixed(0)}</div>
                      </div>
                      {/* Modifiers */}
                      {item.modifiers?.length > 0 && (
                        <div className="pl-6 flex flex-col mt-0.5">
                          {item.modifiers.map((m, i) => (
                            <div key={i} className="text-[9px] italic flex items-center justify-between opacity-80">
                              <span>+ {m.name}</span>
                              {m.price > 0 && <span>(+{m.price.toFixed(0)})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="divider border-t border-dashed border-black my-1" />

              {/* Totals Section */}
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span>{receipt.totals.tax > 0 ? 'SUBTOTAL (PRE-TAX):' : 'SUBTOTAL:'}</span>
                  <span className="font-bold">Rs. {receipt.totals.subtotal.toFixed(2)}</span>
                </div>
                
                {receipt.totals.tax > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span>TAX:</span>
                    <span>Rs. {receipt.totals.tax.toFixed(2)}</span>
                  </div>
                )}
                
                {receipt.totals.discount > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold">DISCOUNT:</span>
                    <span className="font-bold">- Rs. {receipt.totals.discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="divider-double border-t-2 border-double border-black my-1" />
                
                <div className="flex justify-between items-center text-[14px] font-bold">
                  <span>GRAND TOTAL:</span>
                  <span>Rs. {receipt.totals.total.toFixed(2)}</span>
                </div>

                <div className="text-[9px] italic mt-1 pt-1 opacity-70">
                  TOTAL IN WORDS: {numberToWords(receipt.totals.total)}
                </div>
              </div>

               {/* Notes Section */}
               {receipt.notes && (
                 <div className="text-[9px] mt-2 border-t border-dashed border-black pt-1">
                   <span className="font-bold">NOTES:</span> <span>{receipt.notes}</span>
                 </div>
               )}

               <div className="divider border-t border-dashed border-black my-2" />

               {/* Footer Info */}
               <div className="flex justify-between text-[9px] opacity-70">
                  <div className="flex flex-col">
                    <span className="font-bold text-black">PRINTED BY:</span>
                    <span>default</span>
                  </div>
                   <div className="text-right flex flex-col">
                    <span className="font-bold text-black">PRINT TIME:</span>
                    <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                  </div>
               </div>

               <div className="text-center text-[9px] italic mt-4 px-2 opacity-80 leading-tight">
                This bill is provided for estimation purposes only.<br />
                Kindly collect the original invoice from the counter.
               </div>

               <div className="text-center font-bold text-[12px] tracking-[0.2em] mt-4 uppercase">
                  THANK YOU....
               </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions - Hidden in Print */}
        <SheetFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900/50 print:hidden">
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-2 py-6 bg-white dark:bg-slate-950 font-bold uppercase tracking-widest text-xs" onClick={handlePrint} disabled={!receipt}>
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
            <Button variant="outline" className="flex-1 py-6 bg-white dark:bg-slate-950 font-bold uppercase tracking-widest text-xs" disabled={!receipt}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
