"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    Plus, 
    Search, 
    MoreVertical, 
    Edit, 
    Trash2, 
    ChevronLeft,
    RefreshCw,
    ShoppingCart,
    CheckCircle2,
    XCircle,
    Undo2,
    Calendar,
    User,
    Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { GeneralPurchaseApis } from "@/lib/api/endpoints";
import { PurchaseDialog } from "@/components/manage/purchases/purchase-dialog";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function PurchasesPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

    const fetchPurchases = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const res = await apiClient.get(GeneralPurchaseApis.list({ restaurantId: user.restaurant_id }));
            if (res.data.status === "success") {
                setPurchases(res.data.data.purchases);
            }
        } catch (error) {
            console.error("Failed to fetch purchases:", error);
            toast.error("Failed to load purchases");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        fetchPurchases();
    }, [fetchPurchases]);

    const handleAction = async (id: number, action: 'receive' | 'cancel' | 'delete') => {
        if (!confirm(`Are you sure you want to ${action} this purchase?`)) return;
        
        try {
            let res;
            if (action === 'receive') res = await apiClient.post(GeneralPurchaseApis.receive(id));
            else if (action === 'cancel') res = await apiClient.post(GeneralPurchaseApis.cancel(id));
            else res = await apiClient.delete(GeneralPurchaseApis.delete(id));
            
            if (res.data.status === "success") {
                toast.success(`Purchase ${action}d successfully`);
                fetchPurchases();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || `Failed to ${action} purchase`);
        }
    };

    const handleReturn = async (id: number) => {
        const reason = prompt("Reason for returning this item?");
        if (reason === null) return;
        
        try {
            const res = await apiClient.post(GeneralPurchaseApis.return(id), { reason });
            if (res.data.status === "success") {
                toast.success("Purchase marked as returned");
                fetchPurchases();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to return purchase");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft': return <Badge variant="secondary" className="capitalize">Draft</Badge>;
            case 'received': return <Badge variant="default" className="bg-green-600 hover:bg-green-700 capitalize">Received</Badge>;
            case 'returned': return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 capitalize">Returned</Badge>;
            case 'cancelled': return <Badge variant="destructive" className="capitalize">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPaymentBadge = (status: string) => {
        return status === 'paid' 
            ? <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Paid</Badge>
            : <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">Unpaid</Badge>;
    };

    const filteredPurchases = purchases.filter(p => 
        p.purchase_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalSpent = purchases
        .filter(p => p.status === 'received' && p.payment_status === 'paid')
        .reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

    const pendingPayables = purchases
        .filter(p => p.status === 'received' && p.payment_status === 'unpaid')
        .reduce((acc, curr) => acc + (curr.total_cost || 0), 0);

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <button 
                        onClick={() => router.push('/manage')}
                        className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Manage
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight">General Purchases</h1>
                    <p className="text-muted-foreground text-sm">
                        Track non-inventory expenses like equipment, repairs, and utilities.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchPurchases} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={() => { setSelectedPurchase(null); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Record Purchase
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Orders</p>
                            <h3 className="text-2xl font-bold">{purchases.length}</h3>
                        </div>
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Paid (Received)</p>
                            <h3 className="text-2xl font-bold text-green-600">{formatCurrency(totalSpent)}</h3>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Unpaid (Received)</p>
                            <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(pendingPayables)}</h3>
                        </div>
                        <div className="p-2 bg-rose-50 rounded-lg">
                            <Calculator className="w-5 h-5 text-rose-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">Returns</p>
                            <h3 className="text-2xl font-bold text-orange-600">
                                {purchases.filter(p => p.status === 'returned').length}
                            </h3>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <Undo2 className="w-5 h-5 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <Card>
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search items or suppliers..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date / Item</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading purchases...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredPurchases.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                    No purchases recorded yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPurchases.map((purchase) => (
                                <TableRow key={purchase.id} className={cn(purchase.status === 'cancelled' && "opacity-60")}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{purchase.purchase_name}</span>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(purchase.purchased_date)}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                                                <User className="w-3.5 h-3.5 text-slate-500" />
                                            </div>
                                            <span className="text-sm font-medium">
                                                {purchase.supplier?.name || "No Supplier"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold">{formatCurrency(purchase.total_cost)}</span>
                                            {purchase.unit && (
                                                <span className="text-[10px] text-muted-foreground">{purchase.unit}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getPaymentBadge(purchase.payment_status)}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(purchase.status)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {purchase.status === 'draft' && (
                                                    <DropdownMenuItem onClick={() => handleAction(purchase.id, 'receive')}>
                                                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                                                        Mark as Received
                                                    </DropdownMenuItem>
                                                )}
                                                {purchase.status === 'received' && (
                                                    <DropdownMenuItem onClick={() => handleReturn(purchase.id)}>
                                                        <Undo2 className="w-4 h-4 mr-2 text-orange-600" />
                                                        Return Item
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                <DropdownMenuSeparator />
                                                
                                                <DropdownMenuItem 
                                                    onClick={() => { setSelectedPurchase(purchase); setIsDialogOpen(true); }}
                                                    disabled={purchase.status === 'cancelled' || purchase.status === 'returned'}
                                                >
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Edit Record
                                                </DropdownMenuItem>

                                                {purchase.status === 'draft' && (
                                                    <DropdownMenuItem 
                                                        onClick={() => handleAction(purchase.id, 'delete')}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete Draft
                                                    </DropdownMenuItem>
                                                )}

                                                {(purchase.status === 'draft' || (purchase.status === 'received' && purchase.payment_status !== 'paid')) && (
                                                    <DropdownMenuItem 
                                                        onClick={() => handleAction(purchase.id, 'cancel')}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                        Cancel Purchase
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <PurchaseDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                purchase={selectedPurchase}
                onSuccess={fetchPurchases}
            />
        </div>
    );
}
