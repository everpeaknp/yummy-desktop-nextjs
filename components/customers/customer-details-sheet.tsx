"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Award, Calendar, History, Wallet, DollarSign } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RepayCreditDialog } from "./repay-credit-dialog";

interface CustomerDetailsSheetProps {
    customer: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

export function CustomerDetailsSheet({ customer, open, onOpenChange, onUpdate }: CustomerDetailsSheetProps) {
    const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);

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
        </>
    );
}
