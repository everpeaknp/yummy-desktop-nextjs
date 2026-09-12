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
    Wallet,
    Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { SupplierApis } from "@/lib/api/endpoints";
import { SupplierDialog } from "@/components/manage/suppliers/supplier-dialog";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { MetricCard } from "@/components/cards/metric-card";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState, LoadingState } from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";

export function SuppliersWorkspace({
    financeMode = false,
    showBackToManage = true,
}: {
    financeMode?: boolean;
    showBackToManage?: boolean;
} = {}) {
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
        <AppPage width="wide" className="p-4 sm:p-6">
            <div className="hidden md:block">
                <PageHeader
                    backHref={showBackToManage && !financeMode ? "/manage" : undefined}
                    title={financeMode ? "Supplier payables" : "Suppliers"}
                    description="Manage vendors and track outstanding balances."
                    actions={<>
                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={fetchSuppliers} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        <Button className="h-11 rounded-xl" onClick={() => { setSelectedSupplier(null); setIsDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Supplier
                        </Button>
                    </>}
                />
            </div>

            <div className="flex min-w-0 items-center gap-2 md:hidden">
                <SearchField
                    placeholder="Search suppliers"
                    className="min-w-0"
                    containerClassName="flex-1"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Button size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Add supplier" onClick={() => { setSelectedSupplier(null); setIsDialogOpen(true); }}>
                    <Plus className="h-5 w-5" />
                </Button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 md:hidden">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Total payable</p>
                    <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{formatCurrency(totalPayable)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{suppliers.filter((supplier) => supplier.is_active).length} active</p>
            </div>

            <div className="hidden grid-cols-2 gap-3 md:grid-cols-3 md:grid">
                <MetricCard label="Suppliers" value={suppliers.length} icon={<RefreshCw className="h-4 w-4" />} tone="brand" />
                <MetricCard label="Total payable" value={formatCurrency(totalPayable)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
                <MetricCard label="Active vendors" value={suppliers.filter(s => s.is_active).length} icon={<RefreshCw className="h-4 w-4" />} tone="success" className="col-span-2 md:col-span-1" />
            </div>

            <SearchField containerClassName="hidden max-w-md md:block" placeholder="Search suppliers" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />

            {loading ? <LoadingState label="Loading suppliers..." /> : filteredSuppliers.length === 0 ? <EmptyState title="No suppliers found" description="Add a supplier to start tracking purchases and payables." /> : <>
                <DataList className="md:hidden">
                    {filteredSuppliers.map((supplier) => (
                        <ListRow
                            key={supplier.id}
                            interactive
                            onClick={() => router.push(`/suppliers/${supplier.id}`)}
                            leading={<span className="font-semibold">{supplier.name?.charAt(0) || "S"}</span>}
                            title={supplier.name}
                            description={supplier.contact_name || supplier.phone || supplier.email || "No contact details"}
                            meta={supplier.payable_amount > 0 ? formatCurrency(supplier.payable_amount) : "No debt"}
                            trailing={<Badge variant={supplier.is_active ? "default" : "secondary"}>{supplier.is_active ? "Active" : "Inactive"}</Badge>}
                        />
                    ))}
                </DataList>
                <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
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
                        {filteredSuppliers.map((supplier) => (
                                <TableRow key={supplier.id} className="cursor-pointer" onClick={() => router.push(`/suppliers/${supplier.id}`)}>
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
                                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={supplier.payable_amount > 0 ? "default" : "outline"}
                                                onClick={() => router.push(`/suppliers/${supplier.id}`)}
                                            >
                                                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                                                {supplier.payable_amount > 0 ? "Pay supplier" : "View ledger"}
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/suppliers/${supplier.id}`)}>
                                                        <Eye className="w-4 h-4 mr-2" />
                                                        View Ledger
                                                    </DropdownMenuItem>
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
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
                </div>
            </>}

            <SupplierDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                supplier={selectedSupplier}
                onSuccess={fetchSuppliers}
            />
        </AppPage>
    );
}

export default function SuppliersPage() {
    return <SuppliersWorkspace />;
}
