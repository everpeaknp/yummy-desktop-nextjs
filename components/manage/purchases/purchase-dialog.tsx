"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import type { FinanceReportingHeadRead } from "@/types/finance-reporting";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { GeneralPurchaseApis, SupplierApis } from "@/lib/api/endpoints";
import { Loader2 } from "lucide-react";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { PurchaseAmountFields } from "./purchase-amount-fields";

interface PurchaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchase?: any;
    businessLine: "restaurant" | "hotel";
    dualBusinessLines?: boolean;
    initialKind?: "operating_expense" | "fixed_asset";
    onSuccess: () => void;
}

const STATUS_OPTIONS = [
    { label: "Save for review", value: "draft" },
    { label: "Record purchase", value: "received" },
];

const PAYMENT_STATUS_OPTIONS = [
    { label: "Unpaid", value: "pending" },
    { label: "Paid", value: "paid" },
];

export function PurchaseDialog({ open, onOpenChange, purchase, businessLine, dualBusinessLines = false, initialKind = "operating_expense", onSuccess }: PurchaseDialogProps) {
    const user = useAuth(state => state.user);
    const canReviewAccounting = hasPermission(user, "finance.coa.manage");
    const [loading, setLoading] = useState(false);
    const [amountRevision, setAmountRevision] = useState(0);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<FinanceReportingHeadRead[]>([]);
    const [showAccounting, setShowAccounting] = useState(false);
    const [paymentAccount, setPaymentAccount] = useState<CashBankAccountOption | null>(null);
    const [purchaseBusinessLine, setPurchaseBusinessLine] = useState<"restaurant" | "hotel" | "">(dualBusinessLines ? "" : businessLine);
    const [formData, setFormData] = useState({
        purchase_name: "",
        unit: "",
        total_cost: "",
        purchase_kind: "operating_expense",
        reporting_head_id: "",
        vat_amount: "",
        claim_input_vat: false,
        invoice_number: "",
        supplier_vat_number: "",
        supplier_id: "",
        payment_status: "pending",
        payment_method: "cash",
        status: "received",
        notes: "",
        purchased_date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        const fetchSuppliers = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id, true));
                if (res.data.status === "success") {
                    setSuppliers(res.data.data.suppliers);
                }
            } catch (err) {
                console.error("Failed to load suppliers", err);
            }
        };

        const fetchAccounts = async () => {
            if (!user?.restaurant_id || !canReviewAccounting) return;
            try {
                setAccounts(await financeReportingApi.listHeads(user.restaurant_id, { is_postable: true, is_active: true }));
            } catch (error) {
                console.error("Failed to load purchase accounts", error);
            }
        };

        if (open) {
            setAmountRevision((value) => value + 1);
            setPaymentAccount(null);
            setPurchaseBusinessLine(purchase?.business_line || (dualBusinessLines ? "" : businessLine));
            fetchSuppliers();
            fetchAccounts();
            if (purchase) {
                setFormData({
                    purchase_name: purchase.purchase_name || "",
                    unit: purchase.unit || "",
                    total_cost: purchase.total_cost?.toString() || "",
                    purchase_kind: purchase.purchase_kind || "operating_expense",
                    reporting_head_id: purchase.reporting_head_id?.toString() || "",
                    vat_amount: purchase.vat_amount?.toString() || "",
                    claim_input_vat: !!purchase.claim_input_vat,
                    invoice_number: purchase.invoice_number || "",
                    supplier_vat_number: purchase.supplier_vat_number || "",
                    supplier_id: purchase.supplier_id?.toString() || "",
                    payment_status: purchase.payment_status || "pending",
                    payment_method: purchase.payment_method || "cash",
                    status: purchase.status || "draft",
                    notes: purchase.notes || "",
                    purchased_date: purchase.purchased_date ? new Date(purchase.purchased_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                });
            } else {
                setFormData({
                    purchase_name: "",
                    unit: "",
                    total_cost: "",
                    purchase_kind: initialKind,
                    reporting_head_id: "",
                    vat_amount: "",
                    claim_input_vat: false,
                    invoice_number: "",
                    supplier_vat_number: "",
                    supplier_id: "",
                    payment_status: "pending",
                    payment_method: "cash",
                    status: "received",
                    notes: "",
                    purchased_date: new Date().toISOString().split('T')[0],
                });
            }
        }
    }, [purchase, open, user?.restaurant_id, canReviewAccounting, businessLine, dualBusinessLines, initialKind]);

    const locked = !!purchase && purchase.status !== "draft";
    const eligibleAccounts = accounts.filter((head) => {
        if (formData.purchase_kind === "operating_expense") return head.head_type === "expense";
        if (head.head_type !== "asset") return false;
        const byId = new Map(accounts.map((candidate) => [candidate.id, candidate]));
        let cursor: FinanceReportingHeadRead | undefined = head;
        while (cursor) {
            if (cursor.code === "ASSETS-FA") return true;
            cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
        }
        return false;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.restaurant_id) return;
        if (!purchase && dualBusinessLines && !purchaseBusinessLine) {
            document.getElementById("purchase_business_line")?.focus();
            toast.error("Choose Restaurant or Hotel for this purchase.");
            return;
        }

        if (!formData.supplier_id) {
            document.getElementById("supplier_id")?.focus();
            toast.error("Supplier is required for every purchase.");
            return;
        }
        const total = Number(formData.total_cost);
        const vat = Number(formData.vat_amount || 0);
        if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(vat) || vat < 0 || vat >= total) {
            document.getElementById("purchase-entered-amount")?.focus();
            toast.error("Enter a bill total greater than the VAT amount.");
            return;
        }
        if (formData.claim_input_vat && (!formData.invoice_number.trim() || !formData.supplier_vat_number.trim())) {
            document.getElementById(!formData.invoice_number.trim() ? "invoice_number" : "supplier_vat_number")?.focus();
            toast.error("Enter the invoice number and supplier VAT/PAN number to claim VAT.");
            return;
        }
        if (!locked && formData.payment_status === "paid" && !paymentAccount) {
            toast.error("Choose the cash or bank account used to pay this bill.");
            return;
        }

        setLoading(true);
        try {
            const resolvedBusinessLine =
                purchase?.business_line === "hotel" || purchase?.business_line === "restaurant"
                    ? purchase.business_line
                    : purchaseBusinessLine || businessLine;

            const payload = locked ? {
                purchase_name: formData.purchase_name,
                unit: formData.unit,
                notes: formData.notes,
            } : {
                ...formData,
                restaurant_id: user.restaurant_id,
                business_line: resolvedBusinessLine,
                total_cost: total,
                vat_amount: vat,
                claim_input_vat: canReviewAccounting && formData.claim_input_vat,
                reporting_head_id: canReviewAccounting && formData.reporting_head_id ? Number(formData.reporting_head_id) : null,
                supplier_id: parseInt(formData.supplier_id),
                payment_method: formData.payment_status === "paid" ? (paymentAccount?.account_type === "drawer" ? "cash" : "bank_transfer") : null,
                payment_account_type: formData.payment_status === "paid" ? paymentAccount?.account_type : null,
                payment_account_id: formData.payment_status === "paid" ? paymentAccount?.id : null,
                purchased_date: formData.purchased_date,
                status: vat > 0 && !canReviewAccounting ? "draft" : formData.status,
            };

            if (purchase) {
                const res = await apiClient.patch(
                    GeneralPurchaseApis.update(purchase.id), 
                    payload
                );
                if (res.data.status === "success") {
                    toast.success("Purchase updated successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            } else {
                const res = await apiClient.post(GeneralPurchaseApis.create, payload);
                if (res.data.status === "success") {
                    toast.success("Purchase recorded successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            }
        } catch (error: any) {
            console.error("Failed to save purchase:", error);
            toast.error(error.response?.data?.detail || "Failed to save purchase");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[500px] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:w-full">
                <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
                    <DialogTitle>{purchase ? "Purchase details" : "Record a purchase"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
                    {dualBusinessLines && !locked ? <div className="space-y-2">
                        <Label htmlFor="purchase_business_line">For *</Label>
                        <Select value={purchaseBusinessLine || undefined} onValueChange={(value: "restaurant" | "hotel") => setPurchaseBusinessLine(value)}>
                            <SelectTrigger id="purchase_business_line"><SelectValue placeholder="Choose Restaurant or Hotel" /></SelectTrigger>
                            <SelectContent><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent>
                        </Select>
                    </div> : null}
                    <div className="space-y-2">
                        <Label htmlFor="purchase_kind">What did you buy?</Label>
                        <Select
                            value={formData.purchase_kind}
                            onValueChange={(value) => setFormData({ ...formData, purchase_kind: value, reporting_head_id: "" })}
                            disabled={locked}
                        >
                            <SelectTrigger id="purchase_kind"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {formData.purchase_kind === "unclassified" && <SelectItem value="unclassified" disabled>Recorded before classification</SelectItem>}
                                <SelectItem value="operating_expense">A running cost or service</SelectItem>
                                <SelectItem value="fixed_asset">Equipment or another long-term asset</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Food and stock for recipes belong in Inventory purchases.</p>
                        {formData.purchase_kind === "fixed_asset" ? <p className="text-xs text-muted-foreground">Record each long-term asset separately so it has its own depreciation schedule.</p> : null}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="purchase_name">What was it? *</Label>
                        <Input 
                            id="purchase_name" 
                            name="purchase_name"
                            autoComplete="off"
                            value={formData.purchase_name} 
                            onChange={(e) => setFormData({ ...formData, purchase_name: e.target.value })} 
                            placeholder="e.g. New Blender, Rent, Repairs"
                            required
                        />
                    </div>

                    <PurchaseAmountFields key={amountRevision} initialTotal={formData.total_cost} initialVat={formData.vat_amount} disabled={locked}
                        onChange={(amounts) => setFormData((previous) => ({ ...previous, total_cost: amounts?.total || "", vat_amount: amounts?.vat || "", claim_input_vat: !!amounts && Number(amounts.vat) > 0 && previous.claim_input_vat }))} />
                        <div className="space-y-2">
                            <Label htmlFor="unit">Unit (Optional)</Label>
                            <Input 
                                id="unit" 
                                value={formData.unit} 
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })} 
                                placeholder="e.g. 2 pieces, 1 month"
                            />
                        </div>

                    <div className="space-y-3 border-t pt-4">
                        {Number(formData.vat_amount) > 0 && (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="invoice_number">Invoice number</Label>
                                        <Input id="invoice_number" name="invoice_number" autoComplete="off" value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} disabled={locked} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="supplier_vat_number">Supplier VAT/PAN number</Label>
                                        <Input id="supplier_vat_number" name="supplier_vat_number" autoComplete="off" value={formData.supplier_vat_number} onChange={(e) => setFormData({ ...formData, supplier_vat_number: e.target.value })} disabled={locked} />
                                    </div>
                                </div>
                                {canReviewAccounting ? (
                                    <div className="flex items-start gap-3 rounded-md border p-3">
                                        <Checkbox id="claim_input_vat" checked={formData.claim_input_vat} disabled={locked} onCheckedChange={(checked) => setFormData({ ...formData, claim_input_vat: checked === true })} />
                                        <div className="space-y-1">
                                            <Label htmlFor="claim_input_vat">Claim this VAT as input VAT</Label>
                                            <p className="text-xs text-muted-foreground">Select after checking the invoice and whether this purchase is eligible. Otherwise VAT stays in the purchase cost.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">This will be saved for finance review before the purchase is recorded.</p>
                                )}
                            </>
                        )}
                    </div>

                    {canReviewAccounting && !locked && (
                        <div className="space-y-2 border-t pt-4">
                            <Button type="button" variant="ghost" className="h-auto px-0 text-sm" onClick={() => setShowAccounting(!showAccounting)} aria-expanded={showAccounting}>
                                Accounting details {showAccounting ? "−" : "+"}
                            </Button>
                            {showAccounting && (
                                <div className="space-y-2">
                                    <Label htmlFor="reporting_head_id">Account for this purchase</Label>
                                    <Select value={formData.reporting_head_id || "automatic"} onValueChange={(value) => setFormData({ ...formData, reporting_head_id: value === "automatic" ? "" : value })}>
                                        <SelectTrigger id="reporting_head_id"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="automatic">Use the standard account</SelectItem>
                                            {eligibleAccounts.map((head) => <SelectItem key={head.id} value={String(head.id)}>{head.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="purchased_date">Date</Label>
                            <Input 
                                id="purchased_date" 
                                name="purchased_date"
                                type="date"
                                value={formData.purchased_date} 
                                onChange={(e) => setFormData({ ...formData, purchased_date: e.target.value })} 
                                required
                                disabled={locked}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supplier_id">Supplier*</Label>
                            <Select 
                                value={formData.supplier_id} 
                                onValueChange={(val) => { if (val) setFormData((previous) => ({ ...previous, supplier_id: val })); }}
                                disabled={locked}
                            >
                                <SelectTrigger id="supplier_id">
                                    <SelectValue placeholder="Select vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="payment_status">Payment Status</Label>
                            <Select 
                                value={formData.payment_status} 
                                onValueChange={(val) => setFormData({ ...formData, payment_status: val })}
                                disabled={locked}
                            >
                                <SelectTrigger id="payment_status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">When to record it</Label>
                            <Select 
                                value={Number(formData.vat_amount) > 0 && !canReviewAccounting ? "draft" : formData.status}
                                onValueChange={(val) => setFormData({ ...formData, status: val })}
                                disabled={locked || (Number(formData.vat_amount) > 0 && !canReviewAccounting)}
                            >
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {formData.payment_status === "paid" && !locked ? (
                        <CashBankAccountSelect
                            value={paymentAccount}
                            onChange={setPaymentAccount}
                            businessLine={purchaseBusinessLine || businessLine}
                            label="Paid from cash or bank"
                            accountFilter={(account) => account.bank_type !== "owner_equity"}
                        />
                    ) : locked && formData.payment_status === "paid" ? (
                        <p className="text-sm text-muted-foreground">Paid via {formData.payment_method.replaceAll("_", " ")}</p>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea 
                            id="notes" 
                            value={formData.notes} 
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                            placeholder="Reason for purchase, warranty info, etc."
                            rows={2}
                        />
                    </div>

                  </div>
                    <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-6">
                        <Button type="button" className="h-11 flex-1 sm:flex-none" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="h-11 flex-[1.3] sm:min-w-[140px] sm:flex-none">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (locked ? "Save notes" : (Number(formData.vat_amount) > 0 && !canReviewAccounting) || formData.status === "draft" ? "Save for review" : "Record purchase")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
