"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { DiscountApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Percent, Calendar, Loader2, Trash2, Edit, Tag, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DiscountDialog } from "@/components/discounts/discount-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Discount {
  id: number;
  name: string;
  code?: string;
  type: string;
  value: number;
  description?: string;
  min_order_amount?: number;
  start_date?: string;
  end_date?: string;
  max_discount_amount?: number;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<Discount | null>(null);

  // 1. Session Restoration
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Discounts
  const fetchDiscounts = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);

    try {
      const url = DiscountApis.listDiscountsForRestaurant(user.restaurant_id);
      const response = await apiClient.get(url);
      if (response.data.status === "success") {
        setDiscounts(response.data.data.discounts || response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch discounts:", err);
      toast({ title: "Error", description: "Failed to load discounts.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchDiscounts();
    }
  }, [user]);

  const handleCreate = async (data: any) => {
    if (!user?.restaurant_id) return;
    try {
      await apiClient.post(DiscountApis.createDiscount, {
        ...data,
        restaurant_id: user.restaurant_id
      });
      toast({ title: "Success", description: "Discount created successfully." });
      fetchDiscounts();
    } catch (error: any) {
        console.error(error);
        const msg = error.response?.data?.message || "Failed to create discount.";
        toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingDiscount) return;
    try {
      await apiClient.patch(DiscountApis.updateDiscount(editingDiscount.id), data);
      toast({ title: "Success", description: "Discount updated successfully." });
      fetchDiscounts();
    } catch (error: any) {
        console.error(error);
        const msg = error.response?.data?.message || "Failed to update discount.";
        toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!discountToDelete) return;
    try {
      await apiClient.delete(DiscountApis.deleteDiscount(discountToDelete.id));
      toast({ title: "Success", description: "Discount deleted successfully." });
      fetchDiscounts();
    } catch (error) {
        toast({ title: "Error", description: "Failed to delete discount.", variant: "destructive" });
    } finally {
        setDeleteDialogOpen(false);
        setDiscountToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setEditingDiscount(null);
    setDialogOpen(true);
  };

  const openEditDialog = (discount: Discount) => {
    setEditingDiscount(discount);
    setDialogOpen(true);
  };

  const openDeleteDialog = (discount: Discount) => {
      setDiscountToDelete(discount);
      setDeleteDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discounts</h1>
          <p className="text-muted-foreground">Manage promo codes and offers.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Discount
        </Button>
      </div>

      <div className="relative w-full md:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8 " placeholder="Search discounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : discounts.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Percent className="w-12 h-12 mb-4 opacity-20" />
          <p>No active discounts found.</p>
          <Button variant="link" onClick={openCreateDialog}>Create your first discount</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {discounts.filter((d) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (d.code || "").toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q);
          }).map((discount) => (
            <Card key={discount.id} className="group relative overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                        <Tag className="h-5 w-5" />
                     </div>
                     <div>
                        <h3 className="font-bold text-lg">{discount.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{discount.code || "No code"}</p>
                     </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900">
                    {discount.type === 'percentage' ? `${discount.value}% OFF` : `Rs. ${discount.value} OFF`}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 opacity-70" />
                    <span>Expires: {discount.end_date ? new Date(discount.end_date).toLocaleDateString() : 'Never'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <span className="opacity-70">Min Order:</span>
                     <span className="font-medium text-foreground">Rs. {discount.min_order_amount || 0}</span>
                  </div>
                  {discount.max_discount_amount && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-70">Max Cap:</span>
                        <span className="font-medium text-foreground">Rs. {discount.max_discount_amount}</span>
                     </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dashed">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(discount)}>
                        <Edit className="w-3 h-3 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openDeleteDialog(discount)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DiscountDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSubmit={editingDiscount ? handleUpdate : handleCreate}
        initialData={editingDiscount}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discount?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-bold">{discountToDelete?.code}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
