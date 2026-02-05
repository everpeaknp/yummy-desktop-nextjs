"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, Trash2, ChefHat, ShoppingBag, Loader2, Utensils } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  image?: string;
  category_name_snapshot?: string;
  category_type?: string;
}

interface Category {
  id: number;
  name: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
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
      if (!user?.restaurant_id) {
        if (user) setLoading(false);
        return;
      }
      try {
        const promises: Promise<any>[] = [
          apiClient.get(`/item-categories/restaurant/${user.restaurant_id}`),
          apiClient.get(`/menus/restaurant/${user.restaurant_id}`)
        ];

        if (tableIdFromQuery) {
          promises.push(apiClient.get(`/restaurants/tables/${tableIdFromQuery}`));
        }

        if (orderId && orderId !== 'create') {
          promises.push(apiClient.get(`/orders/${orderId}`));
        }

        const [catRes, itemRes, tableRes, orderRes] = await Promise.all(promises);

        if (catRes.data.status === "success") {
          setCategories(catRes.data.data);
        }
        if (itemRes.data.status === "success") {
          setMenuItems(itemRes.data.data);
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
        console.error("Failed to fetch POS data:", err);
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
        // Use bulk-update for items when editing an existing order
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
    const matchesCategory = activeCategory === "All" || item.category_type === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
          <Button 
            variant={activeCategory === "All" ? "default" : "outline"}
            onClick={() => setActiveCategory("All")}
            className="rounded-full"
          >
            All
          </Button>
          {loading ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full" />)
          ) : categories.map(cat => (
            <Button 
              key={cat.id} 
              variant={activeCategory === cat.name ? "default" : "outline"}
              onClick={() => setActiveCategory(cat.name)}
              className="rounded-full"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search menu items..." 
            className="pl-9" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20">
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
                <div className="h-12 w-12 flex items-center justify-center bg-muted rounded-full group-hover:scale-110 transition-transform duration-200">
                    {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover rounded-full" />
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
        </div>
      </Card>
    </div>
  );
}
