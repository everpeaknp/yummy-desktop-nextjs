"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { DiscountApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Percent, Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration
  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        if (!user && !token) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Discounts
  useEffect(() => {
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
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchDiscounts();
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Discounts</h1>
            <p className="text-muted-foreground">Manage promo codes and offers.</p>
         </div>
         <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> New Discount
         </Button>
      </div>

      <div className="relative w-full md:w-64">
         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
         <Input className="pl-8 bg-slate-950/20 border-slate-800" placeholder="Search discounts..." />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : discounts.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-slate-800 rounded-lg">
            <Percent className="w-12 h-12 mb-4 opacity-20" />
            <p>No active discounts found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {discounts.map((discount) => (
                <Card key={discount.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-white text-lg">{discount.code}</h3>
                                <p className="text-sm text-slate-400">{discount.description || "No description"}</p>
                            </div>
                            <Badge className="bg-emerald-950/20 text-emerald-500 border-emerald-900/50">
                                {discount.type === 'percentage' ? `${discount.value}% OFF` : `Rs. ${discount.value} OFF`}
                            </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm text-slate-500">
                             <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>Expires: {discount.end_date ? new Date(discount.end_date).toLocaleDateString() : 'Never'}</span>
                             </div>
                             <div>
                                 Min Order: Rs. {discount.min_order_value || 0}
                             </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
