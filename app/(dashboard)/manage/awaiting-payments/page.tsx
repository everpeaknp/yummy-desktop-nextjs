"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    Search, 
    MoreVertical, 
    CheckCircle2, 
    XCircle, 
    ChevronLeft,
    RefreshCw,
    Clock,
    User,
    Calendar,
    ArrowUpRight,
    Package,
    ShoppingCart,
    Filter
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
import { AwaitingPaymentApis, SupplierApis } from "@/lib/api/endpoints";
import { PaymentDialog } from "@/components/manage/payments/payment-dialog";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function AwaitingPaymentsPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [records, setRecords] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [supplierFilter, setSupplierFilter] = useState("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [dialogMode, setDialogMode] = useState<'pay' | 'reject'>('pay');

    const fetchRecords = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const params: any = { status: 'active' };
            if (supplierFilter !== 'all') params.supplier_id = supplierFilter;
            
            const res = await apiClient.get(AwaitingPaymentApis.list(user.restaurant_id, params));
            if (res.data.status === "success") {
                setRecords(res.data.data.items);
            }
        } catch (error) {
            console.error("Failed to fetch awaiting payments:", error);
            toast.error("Failed to load records");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id, supplierFilter]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id));
                if (res.data.status === "success") {
                    setSuppliers(res.data.data.suppliers);
                }
            } catch (err) { console.error(err); }
        };
        fetchSuppliers();
        fetchRecords();
    }, [fetchRecords, user?.restaurant_id]);

    const handleAction = (record: any, mode: 'pay' | 'reject') => {
        setSelectedRecord(record);
        setDialogMode(mode);
        setIsDialogOpen(true);
    };

    const getSourceIcon = (type: string) => {
        switch (type) {
            case 'opening_stock':
                return <Package className="w-3.5 h-3.5 text-emerald-500" />;
            case 'inventory_adjustment':
                return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
            case 'general_purchase':
                return <ShoppingCart className="w-3.5 h-3.5 text-violet-500" />;
            default:
                return <Package className="w-3.5 h-3.5 text-muted-foreground" />;
        }
    };

    const getPaymentBadge = (status: string) => {
        switch (status) {
            case 'unpaid': return <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">Unpaid</Badge>;
            case 'partial': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Partial</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const filteredRecords = records.filter(r => 
        r.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalOutstanding = records.reduce((acc, curr) => acc + ((curr.amount || 0) - (curr.paid_amount || 0)), 0);

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
                    <h1 className="text-3xl font-bold tracking-tight">Awaiting Payments</h1>
                    <p className="text-muted-foreground text-sm">
                        Queue of unpaid invoices from inventory and general purchases.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchRecords} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Outstanding Summary */}
            <Card className="bg-rose-500/5 border-rose-500/10">
                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-100 rounded-full">
                            <Clock className="w-8 h-8 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-rose-600/70 uppercase tracking-wider">Total Outstanding Debt</p>
                            <h2 className="text-4xl font-black mt-1 text-rose-700">{formatCurrency(totalOutstanding)}</h2>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-white/50 py-1 px-3 border-rose-200 text-rose-700">
                           {records.length} Bills Pending
                        </Badge>
                        <Badge variant="outline" className="bg-white/50 py-1 px-3 border-rose-200 text-rose-700 font-bold italic">
                            Action Required
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search bills..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-[250px]">
                    <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Suppliers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Vendors</SelectItem>
                            {suppliers.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Bills List */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Source / Date</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Paid So Far</TableHead>
                            <TableHead>Remaining</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading queue...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredRecords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                    All clear! No pending payments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRecords.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 font-semibold text-sm">
                                                {getSourceIcon(record.source_type)}
                                                <span>
                                                    {record.source_type === 'opening_stock' ? 'Opening Stock' :
                                                     record.source_type === 'inventory_adjustment' ? 'Receive Stock' : 
                                                     record.source_type === 'general_purchase' ? 'General Purchase' : record.source_type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(record.created_at)}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                                                <User className="w-3.5 h-3.5 text-slate-500" />
                                            </div>
                                            <span className="text-sm font-medium">
                                                {record.supplier?.name || "No Vendor"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {formatCurrency(record.amount)}
                                    </TableCell>
                                    <TableCell className="text-emerald-600 font-medium">
                                        {formatCurrency(record.paid_amount || 0)}
                                    </TableCell>
                                    <TableCell className="text-rose-600 font-bold bg-rose-50/50">
                                        {formatCurrency((record.amount || 0) - (record.paid_amount || 0))}
                                    </TableCell>
                                    <TableCell>
                                        {getPaymentBadge(record.payment_status)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => handleAction(record, 'pay')}>
                                                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                                                    Mark as Paid
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => handleAction(record, 'reject')}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <XCircle className="w-4 h-4 mr-2" />
                                                    Reject / Revert
                                                </DropdownMenuItem>
                                                
                                                <DropdownMenuSeparator />
                                                
                                                <DropdownMenuItem onClick={() => {
                                                    if (record.source_type === 'inventory') router.push('/inventory');
                                                    else router.push('/manage/purchases');
                                                }}>
                                                    <ArrowUpRight className="w-4 h-4 mr-2" />
                                                    View Source
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <PaymentDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                record={selectedRecord}
                mode={dialogMode}
                onSuccess={fetchRecords}
            />
        </div>
    );
}
