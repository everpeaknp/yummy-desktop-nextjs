"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Award, Calendar, History, Wallet, DollarSign, Loader2, CreditCard, Clock, Receipt, ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RepayCreditDialog } from "./repay-credit-dialog";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { format } from "date-fns";

interface CustomerDetailsSheetProps {
    customer: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

export function CustomerDetailsSheet({ customer, open, onOpenChange, onUpdate }: CustomerDetailsSheetProps) {
    const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const user = useAuth((state) => state.user);

    useEffect(() => {
        if (open && customer?.id && user?.restaurant_id) {
            const fetchOrders = async () => {
                setLoadingOrders(true);
                try {
                    const response = await apiClient.get(OrderApis.listOrders, {
                        params: {
                            restaurant_id: user.restaurant_id,
                            customer_id: customer.id,
                        }
                    });
                    if (response.data.status === "success") {
                        const allOrders = response.data.data.orders || [];
                        const creditOrders = allOrders.filter((o: any) => 
                            o.payments?.some((p: any) => p.method === 'credit')
                        );
                        setOrders(creditOrders);
                    }
                } catch (error) {
                    console.error("Failed to fetch customer orders:", error);
                } finally {
                    setLoadingOrders(false);
                }
            };
            fetchOrders();
        } else if (!open) {
            setOrders([]);
        }
    }, [open, customer?.id, user?.restaurant_id]);

    const openReceipt = (orderId: number) => {
        setSelectedOrderId(orderId);
        setDetailsOpen(true);
    };

    if (!customer) return null;

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Customer Profile</SheetTitle>
                        <SheetDescription>View customer details and history.</SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-4xl font-bold text-muted-foreground">
                            {(customer.full_name || customer.name || "G")?.charAt(0).toUpperCase() || <User className="w-12 h-12" />}
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">{customer.full_name || customer.name || "Guest User"}</h2>
                            <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
                                <span className="text-sm">ID: #{customer.id}</span>
                                <span>•</span>
                                <Badge variant="outline" className={customer.is_active ? "text-emerald-600 border-emerald-200" : "text-gray-500"}>
                                    {customer.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {customer.is_vip && (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">VIP</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {/* Credit Balance Alert if exists */}
                        {(customer.credit || 0) > 0 && (
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                                        <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-red-900 dark:text-red-200">Credit Balance Due</p>
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">Rs. {(customer.credit || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => setIsRepayDialogOpen(true)}>
                                    Repay Credit
                                </Button>
                            </div>
                        )}

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Contact Information</h3>
                            <div className="grid gap-3 p-4 border rounded-lg bg-card/50">
                                <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{customer.phone || "N/A"}</span>
                                </div>
                                <Separator />
                                <div className="flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{customer.email || "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Loyalty & Stats */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Loyalty & Statistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Award className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                                        <span className="text-sm font-medium text-orange-900 dark:text-orange-200">Loyalty Points</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{customer.loyalty_points || 0}</p>
                                </div>
                                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <History className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Visits</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{customer.visits || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Account Details */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Account Status</h3>
                            <div className="p-4 border rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-md">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Total Spent</p>
                                        <p className="text-xs text-muted-foreground">Lifetime value</p>
                                    </div>
                                </div>
                                <span className="font-bold text-lg">Rs. {(customer.total_spent || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-4 border rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-md">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Joined On</p>
                                        <p className="text-xs text-muted-foreground">Registration date</p>
                                    </div>
                                </div>
                                <span className="text-sm">{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "Unknown"}</span>
                            </div>
                        </div>

                        {/* Credit Orders History */}
                        <div className="space-y-4 pt-2">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                Credit Orders History
                                <Badge variant="secondary" className="rounded-full">{orders.length}</Badge>
                            </h3>
                            
                            {loadingOrders ? (
                                <div className="h-32 flex flex-col items-center justify-center gap-2 border rounded-lg bg-slate-50/50 dark:bg-slate-900/10 border-dashed">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground font-medium">Loading orders...</p>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center gap-2 border rounded-lg bg-slate-50/50 dark:bg-slate-900/10 border-dashed">
                                    <Receipt className="h-6 w-6 text-muted-foreground/50" />
                                    <p className="text-xs text-muted-foreground font-medium">No credit orders found</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {orders.map((order) => (
                                        <div 
                                            key={order.id}
                                            onClick={() => openReceipt(order.id)}
                                            className="group relative bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-border rounded-xl p-3 sm:p-4 transition-all hover:shadow-md cursor-pointer flex flex-col gap-3"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center shrink-0">
                                                        <Receipt className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sm">Order #{order.restaurant_order_id || order.id}</h4>
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[9px] tracking-wider font-bold mt-1">
                                                            {order.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] uppercase text-muted-foreground font-bold mb-0.5">Date</span>
                                                    <span className="font-semibold flex items-center gap-1.5 opacity-90">
                                                        <Clock className="h-3 w-3 opacity-70" />
                                                        {format(new Date(order.created_at || order.started_at), "MMM d, h:mm a")}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] uppercase text-muted-foreground font-bold mb-0.5">Amount</span>
                                                    <span className="font-bold text-primary flex items-center gap-1">
                                                        <CreditCard className="h-3 w-3 opacity-70" />
                                                        {parseFloat(order.grand_total || order.total_amount || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-end mt-1">
                                                <div className="text-[11px] text-muted-foreground font-medium">
                                                    {order.items?.length || 0} items • {order.table?.table_name || order.table_name || order.channel}
                                                </div>
                                                <div className="bg-primary/10 text-primary p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-2">
                        <Button variant="outline">Edit Profile</Button>
                        <Button>New Order</Button>
                    </div>
                </SheetContent>
            </Sheet>

            <RepayCreditDialog
                customer={customer}
                open={isRepayDialogOpen}
                onOpenChange={setIsRepayDialogOpen}
                onSuccess={() => {
                    if (onUpdate) onUpdate();
                }}
            />

            <ReceiptDetailSheet 
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </>
    );
}
