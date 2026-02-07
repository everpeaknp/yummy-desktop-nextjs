"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Package, AlertTriangle, ArrowUpDown, Loader2, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();

      const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && !updatedToken) router.push('/');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Inventory
  useEffect(() => {
    const fetchInventory = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);

      try {
        const url = InventoryApis.listInventoryWithQuery({
          restaurantId: user.restaurant_id,
          lowStockOnly: activeTab === 'low_stock'
        });

        const response = await apiClient.get(url);
        if (response.data.status === "success") {
          setItems(response.data.data.items || response.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch inventory:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
      fetchInventory();
    }
  }, [user, activeTab]);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels and manage supplies.</p>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="low_stock" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950 dark:data-[state=active]:text-red-500">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Low Stock
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 bg-muted/50 border-border" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <Package className="w-12 h-12 mb-4 opacity-20" />
          <p>No inventory items found.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4">Stock Level</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.filter((item) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (item.name || "").toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q);
              }).map((item) => (
                <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {item.name}
                    {item.is_low_stock && (
                      <Badge variant="outline" className="ml-2 border-red-500/50 bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-500 text-[10px] px-1 py-0 h-auto">
                        LOW
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{item.category || "General"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{item.unit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        item.current_stock <= (item.low_stock_threshold || 5) ? "text-red-500" : "text-emerald-500"
                      )}>
                        {item.current_stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">Rs. {item.cost_per_unit || 0}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary/80">
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
