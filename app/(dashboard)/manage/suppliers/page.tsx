"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    Plus, 
    Search, 
    MoreVertical, 
    Edit, 
    Trash2, 
    Phone, 
    Mail, 
    MapPin, 
    ChevronLeft,
    RefreshCw,
    Wallet
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
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { SupplierApis } from "@/lib/api/endpoints";
import { SupplierDialog } from "@/components/manage/suppliers/supplier-dialog";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

export default function SuppliersPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [totalPayable, setTotalPayable] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

    const fetchSuppliers = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const res = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id));
            if (res.data.status === "success") {
                setSuppliers(res.data.data.suppliers);
                setTotalPayable(res.data.data.total_payable || 0);
            }
        } catch (error) {
            console.error("Failed to fetch suppliers:", error);
            toast.error("Failed to load suppliers");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const handleEdit = (supplier: any) => {
        setSelectedSupplier(supplier);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!user?.restaurant_id || !confirm("Are you sure you want to deactivate this supplier?")) return;
        
        try {
            const res = await apiClient.delete(SupplierApis.deleteSupplier(id, user.restaurant_id));
            if (res.data.status === "success") {
                toast.success("Supplier deactivated");
                fetchSuppliers();
            }
        } catch (error) {
            toast.error("Failed to deactivate supplier");
        }
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
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
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage your vendors and track outstanding balances.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchSuppliers} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={() => { setSelectedSupplier(null); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Supplier
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/10">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider">Total Suppliers</p>
                            <h2 className="text-3xl font-bold mt-1">{suppliers.length}</h2>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-full">
                            <RefreshCw className="w-6 h-6 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-orange-500/5 border-orange-500/10">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-orange-500/60 uppercase tracking-wider">Total Payable</p>
                            <h2 className="text-3xl font-bold mt-1 text-orange-600">{formatCurrency(totalPayable)}</h2>
                        </div>
                        <div className="p-3 bg-orange-500/10 rounded-full">
                            <Wallet className="w-6 h-6 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-green-500/5 border-green-500/10">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-green-500/60 uppercase tracking-wider">Active Vendors</p>
                            <h2 className="text-3xl font-bold mt-1 text-green-600">{suppliers.filter(s => s.is_active).length}</h2>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-full">
                            <RefreshCw className="w-6 h-6 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Card>
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search suppliers..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Contact Info</TableHead>
                            <TableHead>Payable</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading suppliers...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredSuppliers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                    No suppliers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSuppliers.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{supplier.name}</span>
                                            <span className="text-xs text-muted-foreground flex items-center mt-1">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                {supplier.address || "No address"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm space-y-1">
                                            {supplier.contact_name && (
                                                <span className="font-medium">{supplier.contact_name}</span>
                                            )}
                                            <div className="flex items-center gap-3 text-muted-foreground">
                                                {supplier.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {supplier.phone}
                                                    </span>
                                                )}
                                                {supplier.email && (
                                                    <span className="flex items-center gap-1 text-xs truncate max-w-[150px]">
                                                        <Mail className="w-3 h-3" />
                                                        {supplier.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {supplier.payable_amount > 0 ? (
                                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold">
                                                {formatCurrency(supplier.payable_amount)}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">No debt</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={supplier.is_active ? "default" : "secondary"}>
                                            {supplier.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                                    <Edit className="w-4 h-4 mr-2 text-primary" />
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => handleDelete(supplier.id)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Deactivate
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

            <SupplierDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                supplier={selectedSupplier}
                onSuccess={fetchSuppliers}
            />
        </div>
    );
}
