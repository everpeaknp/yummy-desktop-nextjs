"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import type { GuestBillSession, GuestBillSessionOrder } from "@/types/guest-bill";
import { parseGuestBillSession } from "@/types/guest-bill";
import { extractApiDetail } from "@/lib/table-ops";

function formatMoney(amount: number) {
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type GuestBillsPanelProps = {
  orderId: number;
  splitGroupId?: string | null;
  isSplitParent?: boolean;
  isSplitChild?: boolean;
  refreshKey?: number;
};

export function GuestBillsPanel({
  orderId,
  splitGroupId,
  isSplitParent,
  isSplitChild,
  refreshKey = 0,
}: GuestBillsPanelProps) {
  const [session, setSession] = useState<GuestBillSession | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldLoad =
    Boolean(splitGroupId) || Boolean(isSplitParent) || Boolean(isSplitChild);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(OrderApis.getGuestBills(orderId));
      if (res.data?.status === "success") {
        setSession(parseGuestBillSession(res.data?.data));
      } else {
        setSession(null);
      }
    } catch (err: unknown) {
      if (shouldLoad) toast.error(extractApiDetail(err));
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) {
      setSession(null);
      return;
    }
    void load();
  }, [shouldLoad, load, refreshKey]);

  if (!shouldLoad && !session?.orders?.length) return null;

  const bills: GuestBillSessionOrder[] = session?.orders ?? [];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Guest bills
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading guest bills…</p>
        ) : bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guest bills in this session yet.</p>
        ) : (
          bills.map((bill) => (
            <div
              key={bill.order_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 bg-muted/20"
            >
              <div>
                <p className="font-semibold text-sm">
                  {bill.split_label || `Bill #${bill.order_id}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bill.items_count} item{bill.items_count === 1 ? "" : "s"} • {bill.status}
                </p>
                <p className="text-sm font-bold mt-1">{formatMoney(bill.grand_total)}</p>
                {bill.balance_due > 0.01 && (
                  <p className="text-xs text-amber-600 font-medium">
                    Due {formatMoney(bill.balance_due)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {bill.is_fully_paid ? (
                  <Badge variant="secondary" className="text-emerald-700 bg-emerald-500/10">
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline">Open</Badge>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={`/orders/${bill.order_id}/checkout`}>
                    <Receipt className="h-3.5 w-3.5" />
                    Pay
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/orders/${bill.order_id}`}>View</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
