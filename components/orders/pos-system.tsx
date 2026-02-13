"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, Trash2, ChefHat, ShoppingBag, Loader2, Utensils, Receipt, ImageIcon, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { cn, getImageUrl } from "@/lib/utils";
import Image from "next/image";


interface MenuItem {
  id: number;
  name: string;
  item_name?: string;
  price: number;
  item_price?: number;
  image?: string;
  category_name?: string;
  item_category_id?: number;
  category_type?: string;
}

interface CartItem {
  id: number;
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
}

const CartContent = ({ 
    cart, 
    orderId, 
    orderData, 
    tableData, 
    channelFromQuery, 
    restaurant, 
    processing, 
    updateQuantity, 
    setCart, 
    handlePlaceOrder, 
    router 
}: any) => {
  const subtotal = cart.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0.13;
  const total = subtotal + tax;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b bg-muted/20">
        <h2 className="font-semibold flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          {!orderId || orderId === 'create' ? 'New Order' : `Order #${orderData?.restaurant_order_id || orderId}`}
        </h2>
        <p className="text-xs text-muted-foreground capitalize">
          {tableData?.table_name || orderData?.table_name || 'No Table'} • {orderData?.channel || channelFromQuery.replace('_', ' ')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
            <ShoppingBag className="h-12 w-12 mb-2 opacity-20" />
            <p>Cart is empty</p>
            <p className="text-xs">Select items from the menu to start ordering</p>
          </div>
        ) : (
          cart.map((item: any) => (
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
    </div>
  );
};

export default function POSSystem({
  orderId,
  defaultTableId,
  defaultChannel
}: {
  orderId?: string;
  defaultTableId?: number;
  defaultChannel?: string;
}) {
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

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
          const categoryList: { id: number; name: string }[] = [];
          for (const group of groups) {
            const categoryName = group.category_name || "Uncategorized";
            categoryList.push({ id: group.category_id, name: categoryName });
            const items = group.items || group.menu_items || [];
            if (Array.isArray(items)) {
              for (const item of items) {
                allItems.push({ ...item, category_name: categoryName, item_category_id: group.category_id });
              }
            }
          }
          console.log("[POS] Parsed:", allItems.length, "items,", categoryList.length, "categories");
          setMenuItems(allItems);
          setCategories(categoryList);
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
      const itemName = item.name || item.item_name || "Unknown Item";
      const itemPrice = item.price || item.item_price || 0;
      return [...prev, { id: Date.now(), menu_item_id: item.id, name: itemName, price: itemPrice, quantity: 1 }];
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

  const filteredItems = useMemo(() => {
    const query = (searchQuery || "").toLowerCase();
    return menuItems.filter(item => {
      const matchesCategory = activeCategory === null || item.item_category_id === activeCategory;
      const itemName = String(item.name || item.item_name || "").toLowerCase();
      const matchesSearch = itemName.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, activeCategory, searchQuery]);

  console.log("[POS] Render:", { 
    filteredCount: filteredItems.length, 
    totalCount: menuItems.length, 
    activeCategory, 
    searchQuery 
  });






  return (
    <div className="flex flex-1 min-h-0 min-w-0 gap-6 relative">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-4">

        {/* Search Bar */}
        <div className="relative group shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search menu items..."
            className="pl-12 h-12 bg-card border-border/40 rounded-xl shadow-sm focus-visible:ring-primary/20 transition-all text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories Carousel */}
        <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border",
              activeCategory === null
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
            )}
          >
            All {!loading && `(${menuItems.length})`}
          </button>
          {!loading && categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
              )}
            >
              {cat.name} ({menuItems.filter(i => i.item_category_id === cat.id).length})
            </button>
          ))}
        </div>

        {/* Menu Items Grid - FIXED SCROLLING & COLLAPSE */}
        <div className="flex-1 overflow-y-auto no-scrollbar pr-2 pb-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card key={`skeleton-${i}`} className="overflow-hidden border-border bg-card">
                  <Skeleton className="h-28 sm:h-32 w-full rounded-none" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-muted/5">
              <Search className="h-10 w-10 mb-2 opacity-20" />
              <p className="font-semibold text-sm">No items found</p>
              <Button variant="link" size="sm" onClick={() => { setActiveCategory(null); setSearchQuery(""); }} className="mt-2 text-primary">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 auto-rows-max">
              {filteredItems.map((item: MenuItem, idx: number) => (
                <Card
                  key={`${item.id}-${idx}`}
                  className="group flex flex-col h-full overflow-hidden cursor-pointer hover:shadow-md transition-all border-border bg-card active:scale-95"
                  onClick={() => addToCart(item)}
                >
                  <div className="relative h-28 sm:h-32 bg-muted/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {item.image ? (
                      <Image 
                        src={getImageUrl(item.image)} 
                        alt={item.name || item.item_name || "item"} 
                        className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {item.category_name && (
                      <Badge className="absolute top-1.5 left-1.5 bg-black/60 text-white border-0 text-[10px] font-medium backdrop-blur-sm px-1.5 py-0.5">
                        {item.category_name}
                      </Badge>
                    )}
                    
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-1 rounded-full bg-primary/90 text-white shadow-lg">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-2.5 sm:p-3 flex flex-col gap-1 flex-1 min-w-0">
                    <h3 className="font-semibold text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                      {item.name || item.item_name}
                    </h3>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-sm sm:text-base font-bold text-foreground">
                        {restaurant?.currency || "Rs."} {(item.price || item.item_price || 0).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart Sidebar */}
      <Card className="hidden lg:flex w-80 xl:w-96 flex-col shadow-xl border-l h-full overflow-hidden shrink-0">
        <CartContent 
            cart={cart}
            orderId={orderId}
            orderData={orderData}
            tableData={tableData}
            channelFromQuery={channelFromQuery}
            restaurant={restaurant}
            processing={processing}
            updateQuantity={updateQuantity}
            setCart={setCart}
            handlePlaceOrder={handlePlaceOrder}
            router={router}
        />
      </Card>

      {/* Mobile Floating Cart Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground relative p-0 overflow-hidden">
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 border-2 border-white text-white">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-full sm:max-w-md border-l-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Order Cart</SheetTitle>
            </SheetHeader>
            <CartContent 
                cart={cart}
                orderId={orderId}
                orderData={orderData}
                tableData={tableData}
                channelFromQuery={channelFromQuery}
                restaurant={restaurant}
                processing={processing}
                updateQuantity={updateQuantity}
                setCart={setCart}
                handlePlaceOrder={handlePlaceOrder}
                router={router}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

