"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    Plus, 
    MoreVertical, 
    Edit, 
    Trash2, 
    ChevronLeft,
    RefreshCw,
    Percent,
    FileText,
    Receipt,
    Info
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { TaxConfigApis } from "@/lib/api/endpoints";
import { TaxDialog } from "@/components/manage/taxes/tax-dialog";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TaxesPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [taxes, setTaxes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedTax, setSelectedTax] = useState<any>(null);

    const fetchTaxes = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setLoading(true);
        try {
            const res = await apiClient.get(TaxConfigApis.list(user.restaurant_id));
            if (res.data.status === "success") {
                setTaxes(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch taxes:", error);
            toast.error("Failed to load tax configuration");
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id]);

    useEffect(() => {
        fetchTaxes();
    }, [fetchTaxes]);

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to remove this tax? This will affect future receipts.")) return;
        try {
            await apiClient.delete(TaxConfigApis.delete(id));
            toast.success("Tax configuration removed");
            fetchTaxes();
        } catch (error) {
            toast.error("Failed to delete tax");
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
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
                    <h1 className="text-3xl font-bold tracking-tight">Taxes & Fees</h1>
                    <p className="text-muted-foreground text-sm">
                        Define VAT, Service Charges, and other local fees.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchTaxes} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={() => { setSelectedTax(null); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Tax
                    </Button>
                </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Tax Calculation Logic</AlertTitle>
                <AlertDescription className="text-blue-700 text-sm">
                    Taxes marked as **Service Charge** are calculated on the Subtotal. **VAT/Standard Tax** is calculated on the (Subtotal + Service Charge).
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Active Fees</CardTitle>
                    <CardDescription>
                        These fees will be automatically applied to new POS orders.
                    </CardDescription>
                </CardHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Charge Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Loading tax settings...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : taxes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No taxes configured.
                                </TableCell>
                            </TableRow>
                        ) : (
                            taxes.map((tax) => (
                                <TableRow key={tax.id}>
                                    <TableCell className="font-semibold">
                                        <div className="flex items-center gap-2">
                                            {tax.is_service_charge ? <Receipt className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                                            {tax.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={tax.is_service_charge ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"}>
                                            {tax.is_service_charge ? "Service Charge" : "Standard Tax"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-bold text-lg">
                                        {tax.percentage}%
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={tax.is_active ? "default" : "secondary"}>
                                            {tax.is_active ? "Active" : "Inactive"}
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
                                                <DropdownMenuItem onClick={() => { setSelectedTax(tax); setIsDialogOpen(true); }}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(tax.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Remove
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

            {user?.restaurant_id && (
                <TaxDialog 
                    open={isDialogOpen} 
                    onOpenChange={setIsDialogOpen} 
                    tax={selectedTax}
                    restaurantId={user.restaurant_id}
                    onSuccess={fetchTaxes}
                />
            )}
        </div>
    );
}
