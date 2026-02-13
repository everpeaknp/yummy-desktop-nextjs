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
      // Create a hidden iframe to print only the receipt content
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
                @page { size: auto; margin: 0mm; }
                body {
                  font-family: 'Courier New', Courier, monospace; 
                  margin: 0;
                  padding: 10px;
                  width: 80mm; /* Standard POS Width */
                  font-size: 12px;
                  color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .font-bold { font-weight: bold; }
                .uppercase { text-transform: uppercase; }
                .text-xs { font-size: 10px; }
                .text-sm { font-size: 12px; }
                .text-xl { font-size: 16px; }
                .text-2xl { font-size: 18px; }
                .italic { font-style: italic; }
                .text-muted { color: #666; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th { border-bottom: 1px dashed #000; padding: 2px 0; font-size: 10px; text-align: left; }
                td { padding: 2px 0; vertical-align: top; font-size: 12px; }
                
                .border-box { 
                  border: 1px solid #000; 
                  padding: 5px; 
                  margin: 10px 0; 
                }
                
                .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
                .divider-solid { border-bottom: 1px solid #000; margin: 5px 0; }
                
                /* Hide screen-only utilities */
                .print\\:hidden { display: none !important; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
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
        <SheetHeader className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b print:hidden">
          <SheetTitle className="text-xl font-bold">Receipt Details</SheetTitle>
          <SheetDescription>
            Order #{orderId}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 print:p-0 print:overflow-visible text-black dark:text-white print:text-black">
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
            <div className="flex flex-col gap-4 text-sm font-medium" id="receipt-content">
              {/* Restaurant Header */}
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-2xl font-bold">{receipt.restaurant_info?.name}</h2>
                <p className="text-sm">{receipt.restaurant_info?.address}</p>
                <p className="text-sm">Contact No: {receipt.restaurant_info?.phone}</p>
                {receipt.restaurant_info?.pan_number && (
                  <p className="text-sm font-bold">PAN No: {receipt.restaurant_info.pan_number}</p>
                )}
                <h3 className="text-xl font-bold mt-3 uppercase tracking-wide">Bill Receipt</h3>
              </div>

              {/* Order Info Row */}
              <div className="flex justify-between items-start text-xs uppercase tracking-wide border-b-2 border-transparent pb-2">
                <div className="text-left">
                  <div className="text-muted-foreground font-bold">Date</div>
                  <div>{receipt.receipt_date ? format(new Date(receipt.receipt_date), "dd/MM/yyyy") : "-"}</div>
                  <div>{receipt.receipt_date ? format(new Date(receipt.receipt_date), "HH:mm") : "-"}</div>
                </div>
                <div className="text-center">
                   <div className="text-muted-foreground font-bold">Order No.</div>
                   <div className="text-base font-bold">{receipt.restaurant_order_id || receipt.order_id}</div>
                </div>
                <div className="text-right">
                   <div className="text-muted-foreground font-bold">Table</div>
                   <div>{receipt.table_name || "A!"}</div>
                </div>
              </div>


              {/* Items Table Header */}
              <div className="border-b-2 border-black pb-1 mb-1 mt-2">
                 <div className="grid grid-cols-12 gap-1 text-xs font-bold uppercase">
                    <div className="col-span-1 text-center">SN</div>
                    <div className="col-span-6">Particular</div>
                    <div className="col-span-1 text-center">Qty</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right">Amount</div>
                 </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 min-h-[50px]">
                {receipt.items?.map((item, idx) => {
                  const showTax = receipt.totals.tax > 0;
                  const displayRate = showTax ? (item.pre_tax_unit_price ?? item.unit_price) : item.unit_price;
                  const displayTotal = displayRate * item.quantity;
                  
                  return (
                    <div key={idx} className="text-sm">
                      <div className="grid grid-cols-12 gap-1">
                        <div className="col-span-1 text-center">{idx + 1}</div>
                        <div className="col-span-6 font-medium">
                          {item.name}
                          {item.modifiers?.length > 0 && (
                            <div className="pl-4 pt-1 flex flex-col gap-0.5">
                              {item.modifiers.map((m, i) => (
                                <div key={i} className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                                  <span>+</span>
                                  <span>{m.name}</span>
                                  {m.price > 0 && <span>(+{m.price})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-1 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-right">{displayRate.toFixed(0)}</div>
                        <div className="col-span-2 text-right font-bold">{displayTotal.toFixed(0)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Boxed Totals Section */}
              <div className="border-2 border-black p-3 space-y-2 mt-4 border-box">
                <div className="flex justify-between items-center text-base">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-medium">Rs. {receipt.totals.subtotal.toFixed(2)}</span>
                </div>
                
                {receipt.totals.tax > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span>Tax:</span>
                    <span>Rs. {receipt.totals.tax.toFixed(2)}</span>
                  </div>
                )}
                
                {receipt.totals.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span>Discount:</span>
                    <span>- Rs. {receipt.totals.discount.toFixed(2)}</span>
                  </div>
                )}

                <Separator className="bg-black my-1" />
                
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Grand Total:</span>
                  <span>Rs. {receipt.totals.total.toFixed(2)}</span>
                </div>

                <div className="text-xs italic mt-1 pt-1 border-t border-transparent">
                  Total in Words: {numberToWords(receipt.totals.total)}
                </div>
              </div>

               {/* Notes Section */}
               {receipt.notes && (
                 <div className="text-xs mt-2 border-t pt-2 border-dashed border-black">
                   <span className="font-bold">Notes:</span> <span>{receipt.notes}</span>
                 </div>
               )}

               {/* Footer Info */}
               <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                  <div>
                    <span className="font-bold block text-black dark:text-white">Printed By:</span>
                    <span>default</span>
                  </div>
                   <div className="text-right">
                    <span className="font-bold block text-black dark:text-white">Print Time:</span>
                    <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                  </div>
               </div>

               <div className="text-center text-[10px] italic mt-2 text-muted-foreground">
                This bill is provided for estimation purposes only.<br />
                Kindly collect the original invoice from the counter.
               </div>

               <div className="text-center font-bold text-lg tracking-[0.2em] mt-2 uppercase">
                  Thank You....
               </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions - Hidden in Print */}
        <SheetFooter className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 print:hidden">
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={handlePrint} disabled={!receipt}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {/* Share functionality would typically use Web Share API */}
            <Button variant="outline" className="flex-1" disabled={!receipt}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
