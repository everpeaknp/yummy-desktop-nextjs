"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, Trash2, ChefHat, ShoppingBag, Loader2, Utensils, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  image?: string;
  category_name?: string;
  category_type?: string;
}

interface CartItem {
  id: number;
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function POSSystem({
  orderId,
  defaultTableId,
  defaultChannel
}: {
  orderId?: string;
  defaultTableId?: number;
  defaultChannel?: string;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderData, setOrderData] = useState<any>(null);
  const [tableData, setTableData] = useState<any>(null);

  const user = useAuth(state => state.user);
  const { restaurant } = useRestaurant();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tableIdFromQuery = defaultTableId?.toString() || searchParams.get("table");
  const channelFromQuery = defaultChannel || searchParams.get("channel") || "table";

  useEffect(() => {
    const fetchData = async () => {
      console.log("[POS] fetchData called", { userId: user?.id, restaurantId: user?.restaurant_id, orderId, tableIdFromQuery });
      if (!user?.restaurant_id) {
        console.log("[POS] No restaurant_id, user:", user);
        if (user) setLoading(false);
        return;
      }
      try {
        const url = `/menus/restaurant/${user.restaurant_id}/grouped`;
        console.log("[POS] Fetching:", url);
        const itemPromise = apiClient.get(url).catch(err => { console.error("[POS] Menu fetch failed:", err); return null; });
        const tablePromise = tableIdFromQuery
          ? apiClient.get(`/restaurants/tables/single/${tableIdFromQuery}`).catch(err => { console.error("[POS] Table fetch failed:", err); return null; })
          : Promise.resolve(null);
        const orderPromise = (orderId && orderId !== 'create')
          ? apiClient.get(`/orders/${orderId}`).catch(err => { console.error("[POS] Order fetch failed:", err); return null; })
          : Promise.resolve(null);

        const [itemRes, tableRes, orderRes] = await Promise.all([
          itemPromise,
          tablePromise,
          orderPromise
        ]);

        if (itemRes && itemRes.data.status === "success") {
          const groups = itemRes.data.data;
          const allItems: MenuItem[] = [];
          const categorySet = new Set<string>();
          for (const group of groups) {
            const categoryName = group.category_name || "Uncategorized";
            categorySet.add(categoryName);
            if (Array.isArray(group.items)) {
              for (const item of group.items) {
                allItems.push({ ...item, category_name: categoryName });
              }
            }
          }
          console.log("[POS] Parsed:", allItems.length, "items,", categorySet.size, "categories:", Array.from(categorySet));
          setMenuItems(allItems);
          const sorted = Array.from(categorySet).sort();
          setCategories(sorted);
        }
        if (tableRes && tableRes.data.status === "success") {
          setTableData(tableRes.data.data);
        }
        if (orderRes && orderRes.data.status === "success") {
          const order = orderRes.data.data;
          setOrderData(order);
          setCart(order.items.map((item: any) => ({
            id: item.id,
            menu_item_id: item.menu_item_id,
            name: item.name_snapshot,
            price: item.unit_price,
            quantity: item.qty
          })));
        }
      } catch (err) {
        console.error("[POS] Failed to fetch POS data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, orderId, tableIdFromQuery]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id);
      if (existing) {
        return prev.map(i => i.menu_item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now(), menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.menu_item_id === menuItemId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const isEditing = orderId && orderId !== 'create';
      const payload = {
        restaurant_id: user?.restaurant_id,
        channel: orderData?.channel || channelFromQuery,
        table_id: tableData?.id || orderData?.table_id || (tableIdFromQuery ? parseInt(tableIdFromQuery) : null),
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          qty: item.quantity
        }))
      };

      let response;
      if (isEditing) {
        response = await apiClient.post(`/orders/${orderId}/items/bulk-update`, {
          items: cart.map(item => ({
            menu_item_id: item.menu_item_id,
            qty: item.quantity
          }))
        });
      } else {
        response = await apiClient.post('/orders/', payload);
      }

      if (response.data.status === "success") {
        router.push('/orders/active');
      }
    } catch (err) {
      console.error("Failed to place/update order:", err);
    } finally {
      setProcessing(false);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0.13;
  const total = subtotal + tax;

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === "All" || item.category_name === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-6 p-2">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Search Bar Refined */}
        <div className="relative group flex-shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search menu items..."
            className="pl-12 h-14 bg-white dark:bg-[#1a1a1a] border-border/40 rounded-2xl shadow-sm focus-visible:ring-primary/20 transition-all text-base font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories Repositioned Below Search */}
        <div className="flex gap-2.5 pb-2 overflow-x-auto no-scrollbar scroll-smooth flex-shrink-0">
          <button
            onClick={() => setActiveCategory("All")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95",
              activeCategory === "All"
                ? "bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] shadow-lg"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All
          </button>
          {loading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-28 rounded-xl" />)
          ) : categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95",
                activeCategory === cat
                  ? "bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20">
          {loading ? (
            [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Card key={i} className="h-32">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </CardContent>
              </Card>
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Utensils className="h-12 w-12 mb-2 opacity-20" />
              <p>No items found</p>
            </div>
          ) : filteredItems.map(item => (
            <Card
              key={item.id}
              className="cursor-pointer hover:border-primary transition-all hover:shadow-md group"
              onClick={() => addToCart(item)}
            >
              <div className="p-4 flex flex-col items-center text-center gap-2">
                <div className="relative h-12 w-12 flex items-center justify-center bg-muted rounded-full group-hover:scale-110 transition-transform duration-200 overflow-hidden">
                  {item.image ? (
                    <Image 
                      src={item.image} 
                      alt={item.name} 
                      className="object-cover"
                      fill
                      sizes="48px"
                    />
                  ) : (
                    <Utensils className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{item.name}</h3>
                <p className="text-primary font-bold">{restaurant?.currency || "$"}{item.price.toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="w-96 flex flex-col shadow-xl border-l h-full">
        <div className="p-4 border-b bg-muted/20">
          <h2 className="font-semibold flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {!orderId || orderId === 'create' ? 'New Order' : `Order #${orderData?.restaurant_order_id || orderId}`}
          </h2>
          <p className="text-xs text-muted-foreground capitalize">
            {tableData?.table_name || orderData?.table_name || 'No Table'} • {orderData?.channel || channelFromQuery.replace('_', ' ')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
              <ShoppingBag className="h-12 w-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs">Select items from the menu to start ordering</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.menu_item_id} className="flex gap-2 items-start animate-in slide-in-from-right-5 fade-in duration-300">
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{item.name}</h4>
                  <p className="text-xs text-muted-foreground">{restaurant?.currency || "$"}{item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-sm"
                    onClick={() => updateQuantity(item.menu_item_id, -1)}
                    disabled={processing}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm w-4 text-center">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-sm"
                    onClick={() => updateQuantity(item.menu_item_id, 1)}
                    disabled={processing}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-sm font-medium w-16 text-right">
                  {restaurant?.currency || "$"}{(item.price * item.quantity).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{restaurant?.currency || "$"}{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (13% VAT)</span>
              <span>{restaurant?.currency || "$"}{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t text-foreground">
              <span>Total</span>
              <span>{restaurant?.currency || "$"}{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setCart([])} disabled={processing}>Clear</Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handlePlaceOrder}
              disabled={processing || cart.length === 0}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!orderId || orderId === 'create' ? 'Place Order' : 'Update Order'}
            </Button>
          </div>
          {orderId && orderId !== 'create' && (
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => router.push(`/orders/${orderId}/checkout`)}
            >
              <Receipt className="h-4 w-4" />
              Checkout / Bill
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
