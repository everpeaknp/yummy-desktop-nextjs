"use client";

import { useMemo, useState, useEffect } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { AwaitingPaymentApis } from "@/lib/api/endpoints";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CASH_OUT_PAYMENT_METHOD_OPTIONS as PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method-options";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
    buildPaymentInstrument,
    extractPaymentInstruments,
    paymentMethodNeedsInstrument,
} from "@/lib/payment-instruments";

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: any;
    onSuccess: () => void;
    mode: 'pay' | 'reject';
}

export function PaymentDialog({ open, onOpenChange, record, onSuccess, mode }: PaymentDialogProps) {
    const restaurant = useRestaurant((s) => s.restaurant);
    const [loading, setLoading] = useState(false);
    const [selectedStaticQrIndex, setSelectedStaticQrIndex] = useState(0);
    const [selectedCardIndex, setSelectedCardIndex] = useState(0);
    const [formData, setFormData] = useState({
        paid_amount: "",
        payment_method: "cash",
        reference: "",
        note: "",
    });
    const { staticPaymentQrs, staticPaymentCards } = useMemo(
        () => extractPaymentInstruments(restaurant),
        [restaurant],
    );

    useEffect(() => {
        if (record && mode === 'pay') {
            const remaining = (record.amount || 0) - (record.paid_amount || 0);
            setFormData({
                paid_amount: remaining.toString(),
                payment_method: "cash",
                reference: "",
                note: "",
            });
            setSelectedStaticQrIndex(0);
            setSelectedCardIndex(0);
        }
    }, [record, mode, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record?.restaurant_id) return;

        setLoading(true);
        try {
            if (mode === 'pay') {
                const instrument = buildPaymentInstrument(
                    formData.payment_method,
                    staticPaymentQrs,
                    staticPaymentCards,
                    selectedStaticQrIndex,
                    selectedCardIndex,
                );
                const res = await apiClient.post(
                    AwaitingPaymentApis.markPaid(record.id, record.restaurant_id), 
                    {
                        paid_amount: parseFloat(formData.paid_amount),
                        payment_method: formData.payment_method,
                        reference: formData.reference,
                        instrument: instrument,
                    }
                );
                if (res.data.status === "success") {
                    toast.success("Payment recorded successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            } else {
                const res = await apiClient.post(
                    AwaitingPaymentApis.reject(record.id, record.restaurant_id), 
                    {
                        note: formData.note || "Rejected by user",
                    }
                );
                if (res.data.status === "success") {
                    toast.success("Bill rejected and stock/purchase reverted");
                    onSuccess();
                    onOpenChange(false);
                }
            }
        } catch (error: any) {
            console.error("Failed to process payment:", error);
            toast.error(error.response?.data?.detail || "Failed to process request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{mode === 'pay' ? "Record Payment" : "Reject Bill"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {mode === 'pay' ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="paid_amount">Amount to Pay (Remaining: {formatCurrency((record?.amount || 0) - (record?.paid_amount || 0))})</Label>
                                <Input 
                                    id="paid_amount" 
                                    type="number"
                                    step="0.01"
                                    value={formData.paid_amount} 
                                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })} 
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="payment_method">Payment Method</Label>
                                <Select 
                                    value={formData.payment_method} 
                                    onValueChange={(val) => {
                                        setFormData({ ...formData, payment_method: val });
                                        setSelectedStaticQrIndex(0);
                                        setSelectedCardIndex(0);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_METHOD_OPTIONS.map(m => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {paymentMethodNeedsInstrument(formData.payment_method) && (
                                <div className="space-y-2">
                                    <Label>
                                        Payment Instrument
                                    </Label>
                                    {formData.payment_method === "card" ? (
                                        staticPaymentCards.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {staticPaymentCards.map((card, idx) => (
                                                    <button
                                                        key={`${card.name}-${idx}`}
                                                        type="button"
                                                        onClick={() => setSelectedCardIndex(idx)}
                                                        className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                                            selectedCardIndex === idx
                                                                ? "border-primary bg-primary/10 text-primary"
                                                                : "border-border bg-background hover:bg-muted"
                                                        }`}
                                                    >
                                                        <span className="font-medium">{card.name}</span>
                                                        {card.identifier && (
                                                            <span className="block text-xs text-muted-foreground">{card.identifier}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                                No card instruments configured.
                                            </p>
                                        )
                                    ) : staticPaymentQrs.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {staticPaymentQrs.map((qr, idx) => (
                                                <button
                                                    key={`${qr.name}-${idx}`}
                                                    type="button"
                                                    onClick={() => setSelectedStaticQrIndex(idx)}
                                                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                                        selectedStaticQrIndex === idx
                                                            ? "border-primary bg-primary/10 text-primary"
                                                            : "border-border bg-background hover:bg-muted"
                                                    }`}
                                                >
                                                    <span className="font-medium">{qr.name}</span>
                                                    <span className="block truncate text-xs text-muted-foreground">{qr.payload}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                            No QR instruments configured.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="reference">Reference / Transaction ID</Label>
                                <Input 
                                    id="reference" 
                                    value={formData.reference} 
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })} 
                                    placeholder="e.g. Bank slip #, Check #"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="note">Reason for Rejection*</Label>
                            <Input 
                                id="note" 
                                value={formData.note} 
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })} 
                                placeholder="e.g. Incorrect quantity, Wrong item"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-2 italic">
                                Note: Rejecting will automatically revert stock additions or cancel the purchase entry.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading} 
                            variant={mode === 'pay' ? 'default' : 'destructive'}
                            className="min-w-[100px]"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'pay' ? "Confirm Payment" : "Reject Bill")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
