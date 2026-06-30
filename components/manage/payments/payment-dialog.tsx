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
import { AccountingApis, AwaitingPaymentApis, DrawerSessionApis } from "@/lib/api/endpoints";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CASH_OUT_PAYMENT_METHOD_OPTIONS as PAYMENT_METHOD_OPTIONS } from "@/lib/payment-method-options";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
    buildPaymentInstrument,
    extractPaymentInstruments,
    paymentMethodNeedsInstrument,
} from "@/lib/payment-instruments";
import type { PaymentInstrument } from "@/types/accounting";

type BaseResponse<T> = {
    status?: string;
    data?: T;
    message?: string;
};

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
    const [activePaymentInstruments, setActivePaymentInstruments] = useState<PaymentInstrument[]>([]);
    const [cashDrawerControlsEnabled, setCashDrawerControlsEnabled] = useState(false);
    const [cashDrawerSessions, setCashDrawerSessions] = useState<any[]>([]);
    const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState("");
    const [formData, setFormData] = useState({
        paid_amount: "",
        payment_method: "cash",
        reference: "",
        note: "",
    });
    const { staticPaymentQrs: legacyPaymentQrs, staticPaymentCards: legacyPaymentCards } = useMemo(
        () => extractPaymentInstruments(restaurant),
        [restaurant],
    );
    const staticPaymentQrs = useMemo(
        () => {
            const activeDigital = activePaymentInstruments.filter((instrument) => (
                instrument.is_active &&
                String(instrument.payment_method || "").toLowerCase() === "digital"
            ));
            if (activeDigital.length === 0) {
                return legacyPaymentQrs;
            }
            return activeDigital
                .map((instrument) => {
                    const legacyMatch = legacyPaymentQrs.find((qr) => qr.name === instrument.name);
                    const metadataPayload = typeof instrument.metadata_json?.payload === "string"
                        ? instrument.metadata_json.payload
                        : null;
                    const payload = legacyMatch?.payload || metadataPayload || "";
                    if (!payload.trim()) return null;
                    return {
                        name: instrument.name,
                        payload,
                        instrumentType: instrument.instrument_type || "static_qr",
                    };
                })
                .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument));
        },
        [activePaymentInstruments, legacyPaymentQrs],
    );
    const staticPaymentCards = useMemo(
        () => {
            const activeCards = activePaymentInstruments.filter((instrument) => (
                instrument.is_active &&
                String(instrument.payment_method || "").toLowerCase() === "card"
            ));
            if (activeCards.length === 0) {
                return legacyPaymentCards;
            }
            return activeCards.map((instrument) => {
                const legacyMatch = legacyPaymentCards.find((card) => card.name === instrument.name);
                return {
                    name: instrument.name,
                    identifier: legacyMatch?.identifier || null,
                    instrumentType: instrument.instrument_type || "card",
                };
            });
        },
        [activePaymentInstruments, legacyPaymentCards],
    );
    const cardConfigHelpText = activePaymentInstruments.some((instrument) => (
        instrument.is_active && String(instrument.payment_method || "").toLowerCase() === "card"
    ))
        ? "No active card instrument available for this payment. Align Finance / Accounting / Setup with card settings."
        : "No card instruments configured.";
    const qrConfigHelpText = activePaymentInstruments.some((instrument) => (
        instrument.is_active && String(instrument.payment_method || "").toLowerCase() === "digital"
    ))
        ? "No active QR instrument with payload is available for this payment. Align Finance / Accounting / Setup with QR settings."
        : "No QR instruments configured.";

    useEffect(() => {
        const loadInstruments = async () => {
            if (!record?.restaurant_id) {
                setActivePaymentInstruments([]);
                return;
            }
            try {
                const res = await apiClient.get<BaseResponse<PaymentInstrument[]>>(
                    AccountingApis.paymentInstruments({
                        restaurantId: Number(record.restaurant_id),
                        businessLine: "restaurant",
                        activeOnly: true,
                    }),
                );
                setActivePaymentInstruments(res.data?.data ?? []);
            } catch (error) {
                console.error("Failed to load active payment instruments", error);
                setActivePaymentInstruments([]);
            }
        };
        void loadInstruments();
    }, [record?.restaurant_id]);

    useEffect(() => {
        const loadCashDrawers = async () => {
            if (!record?.restaurant_id) {
                setCashDrawerControlsEnabled(false);
                setCashDrawerSessions([]);
                setSelectedCashDrawerSessionId("");
                return;
            }
            try {
                const res = await apiClient.get(DrawerSessionApis.active({
                    restaurantId: Number(record.restaurant_id),
                    businessLine: "restaurant",
                }));
                const message = String(res.data?.message || "").toLowerCase();
                if (message.includes("controls are disabled")) {
                    setCashDrawerControlsEnabled(false);
                    setCashDrawerSessions([]);
                    setSelectedCashDrawerSessionId("");
                    return;
                }
                const sessions = (Array.isArray(res.data?.data) ? res.data.data : []).filter((session: any) =>
                    ["opened", "closing_count_required", "reopened"].includes(String(session.status || "").toLowerCase())
                );
                setCashDrawerControlsEnabled(true);
                setCashDrawerSessions(sessions);
                setSelectedCashDrawerSessionId((current) => {
                    if (current && sessions.some((session: any) => String(session.id) === current)) return current;
                    return sessions[0]?.id ? String(sessions[0].id) : "";
                });
            } catch (error) {
                console.error("Failed to load active cash drawers", error);
                setCashDrawerControlsEnabled(true);
                setCashDrawerSessions([]);
                setSelectedCashDrawerSessionId("");
            }
        };
        void loadCashDrawers();
    }, [record?.restaurant_id]);

    const isInventoryRecord = ["opening_stock", "inventory_adjustment"].includes(String(record?.source_type || ""));
    const selectedDrawerPayload = () => {
        if (!isInventoryRecord || formData.payment_method !== "cash" || !cashDrawerControlsEnabled) return {};
        if (!selectedCashDrawerSessionId) {
            toast.error("Select an open cash drawer before recording this cash inventory payment.");
            return null;
        }
        return { drawer_session_id: Number(selectedCashDrawerSessionId) };
    };

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
                const drawerPayload = selectedDrawerPayload();
                if (drawerPayload === null) return;
                const res = await apiClient.post(
                    AwaitingPaymentApis.markPaid(record.id, record.restaurant_id), 
                    {
                        paid_amount: parseFloat(formData.paid_amount),
                        payment_method: formData.payment_method,
                        reference: formData.reference,
                        instrument: instrument,
                        ...drawerPayload,
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

                            {isInventoryRecord && formData.payment_method === "cash" && cashDrawerControlsEnabled && (
                                <div className="space-y-2">
                                    <Label htmlFor="cash_drawer">Cash Drawer</Label>
                                    <Select
                                        value={selectedCashDrawerSessionId}
                                        onValueChange={setSelectedCashDrawerSessionId}
                                    >
                                        <SelectTrigger id="cash_drawer">
                                            <SelectValue placeholder="Select open cash drawer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cashDrawerSessions.length === 0 ? (
                                                <SelectItem value="none" disabled>No open cash drawers</SelectItem>
                                            ) : cashDrawerSessions.map((session) => (
                                                <SelectItem key={session.id} value={String(session.id)}>
                                                    {`${session.name || session.drawer_key || "Drawer"} · ${session.station || "general"} · ${session.business_date || ""}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {cashDrawerSessions.length === 0 && (
                                        <p className="text-xs text-destructive">
                                            Open a cash drawer before recording cash inventory payments.
                                        </p>
                                    )}
                                </div>
                            )}

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
                                                {cardConfigHelpText}
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
                                            {qrConfigHelpText}
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
