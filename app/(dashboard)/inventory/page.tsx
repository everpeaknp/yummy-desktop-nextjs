"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { InventoryApis, SupplierApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Package, AlertTriangle, ArrowUpDown, Loader2, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState<any>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: "add",
    quantity: "",
    reason: "",
    cost: "",
  });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Add/Edit Modal State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: "",
    station: "general",
    description: "",
    unit: "",
    current_stock: "",
    min_stock_level: "",
    opening_stock_total_cost: "",
    opening_stock_payment_status: "paid",
    supplier_id: "",
    location: "",
    cost_per_unit: "",
    is_active: true,
  });
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);


  const { toast } = useToast();

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

  // 2. Fetch Data
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

  const fetchSuppliers = async () => {
    if (!user?.restaurant_id) return;
    try {
      const response = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id));
      if (response.data.status === "success") {
        const supplierData = response.data.data?.suppliers || [];
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
      setSuppliers([]);
    }
  };


  useEffect(() => {
    if (user?.restaurant_id) {
      fetchInventory();
      fetchSuppliers();
    }
  }, [user, activeTab]);


  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || !adjustForm.quantity) return;

    setAdjustSubmitting(true);
    try {
      const payload: any = {
        adjustment_type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason.trim() || undefined,
        cost: adjustForm.cost ? Number(adjustForm.cost) : undefined,
      };

      if (adjustForm.type === 'add') {
        payload.payment_status = (adjustForm as any).payment_status || 'pending';
        if ((adjustForm as any).supplier_id && (adjustForm as any).supplier_id !== "none") {
            payload.supplier_id = Number((adjustForm as any).supplier_id);
        }
      }

      await apiClient.post(InventoryApis.adjustInventory(adjustingItem.id), payload);
      
      toast({
        title: "Success",
        description: `Successfully adjusted stock for ${adjustingItem.name}`,
      });
      
      setAdjustingItem(null);
      setAdjustForm({ type: "add", quantity: "", reason: "", cost: "" });
      
      // Refresh inventory
      if (user?.restaurant_id) {
        const url = InventoryApis.listInventoryWithQuery({
          restaurantId: user.restaurant_id,
          lowStockOnly: activeTab === 'low_stock'
        });
        const response = await apiClient.get(url);
        if (response.data.status === "success") {
          setItems(response.data.data.items || response.data.data || []);
        }
      }
    } catch (err: any) {
      toast({
        title: "Adjustment Failed",
        description: err.response?.data?.detail || "Could not adjust stock level.",
        variant: "destructive",
      });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;

    setItemSubmitting(true);
    try {
      if (editingItem) {
        const updatePayload = {
          name: itemForm.name,
          unit: itemForm.unit,
          description: itemForm.description || null,
          current_stock: Number(itemForm.current_stock),
          min_stock_level: Number(itemForm.min_stock_level),
          cost_per_unit: itemForm.cost_per_unit ? Number(itemForm.cost_per_unit) : null,
          supplier_id: (itemForm.supplier_id && itemForm.supplier_id !== "none") ? Number(itemForm.supplier_id) : null,
          location: itemForm.location || null,
          station: itemForm.station,
          is_active: itemForm.is_active,
        };
        await apiClient.patch(InventoryApis.updateInventoryItem(editingItem.id), updatePayload);
      } else {
        const createPayload = {
          restaurant_id: user.restaurant_id,
          name: itemForm.name,
          station: itemForm.station,
          description: itemForm.description || null,
          unit: itemForm.unit,
          current_stock: Number(itemForm.current_stock),
          min_stock_level: Number(itemForm.min_stock_level),
          opening_stock_total_cost: itemForm.opening_stock_total_cost ? Number(itemForm.opening_stock_total_cost) : null,
          opening_stock_payment_status: itemForm.opening_stock_payment_status,
          supplier_id: (itemForm.supplier_id && itemForm.supplier_id !== "none") ? Number(itemForm.supplier_id) : null,
          location: itemForm.location || null,
          is_active: itemForm.is_active,
        };
        await apiClient.post(InventoryApis.createInventoryItem, createPayload);
      }
      
      toast({
        title: "Success",
        description: `Successfully ${editingItem ? 'updated' : 'added'} ${itemForm.name}`,
      });
      
      setIsAddDialogOpen(false);
      setEditingItem(null);
      fetchInventory();
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.detail || `Could not ${editingItem ? 'update' : 'add'} item.`,
        variant: "destructive",
      });
    } finally {
      setItemSubmitting(false);
    }
  };

  const openAdjust = (item: any) => {
    setAdjustingItem(item);
    setAdjustForm({ 
        type: "add", 
        quantity: "", 
        reason: "", 
        cost: "",
        ...({ payment_status: "pending", supplier_id: item.supplier_id?.toString() || "none" } as any)
    });
  };

  const openAdd = () => {
    setEditingItem(null);
    setItemForm({
      name: "",
      station: "general",
      description: "",
      unit: "",
      current_stock: "",
      min_stock_level: "",
      opening_stock_total_cost: "",
      opening_stock_payment_status: "paid",
      supplier_id: "",
      location: "",
      cost_per_unit: "",
      is_active: true,
    });
    setIsAddDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name || "",
      station: item.station || "general",
      description: item.description || "",
      unit: item.unit || "",
      current_stock: item.current_stock?.toString() || "0",
      min_stock_level: item.min_stock_level?.toString() || "0",
      cost_per_unit: item.cost_per_unit?.toString() || "",
      supplier_id: item.supplier_id?.toString() || "none",
      location: item.location || "",
      is_active: item.is_active ?? true,
    });
    setIsAddDialogOpen(true);
  };



  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels and manage supplies.</p>
        </div>
        <Button 
          className="bg-orange-600 hover:bg-orange-700 text-white"
          onClick={openAdd}
        >
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
                <th className="px-6 py-4">Station</th>
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
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        {item.name}
                        {item.is_low_stock && (
                          <Badge variant="outline" className="ml-2 border-red-500/50 bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-500 text-[10px] px-1 py-0 h-auto">
                            LOW
                          </Badge>
                        )}
                        {!item.is_active && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0 h-auto">
                            INACTIVE
                          </Badge>
                        )}
                      </div>
                      {item.location && (
                        <span className="text-[10px] text-muted-foreground">Loc: {item.location}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{item.station || "General"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{item.unit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        item.is_low_stock ? "text-red-500" : "text-emerald-500"
                      )}>
                        {item.current_stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">Rs. {item.cost_per_unit || 0}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-primary hover:text-primary/80"
                      onClick={() => openAdjust(item)}
                    >
                      Adjust
                    </Button>
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAdjust}>
            <DialogHeader>
              <DialogTitle>Adjust Stock: {adjustingItem?.name}</DialogTitle>
              <DialogDescription>
                Update stock level and record the reason for this change.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Current Stock:</span>
                  <span className="text-sm font-bold">{adjustingItem?.current_stock} {adjustingItem?.unit}</span>
                </div>
                {adjustForm.quantity && (
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">New Total:</span>
                    <span className={cn(
                      "text-sm font-bold",
                      (adjustForm.type === 'correction' 
                        ? Number(adjustForm.quantity) 
                        : (Number(adjustingItem?.current_stock) + (adjustForm.type === 'add' ? Number(adjustForm.quantity) : -Number(adjustForm.quantity)))) >= (adjustingItem?.min_stock_level || 0) 
                        ? "text-emerald-600" 
                        : "text-red-500"
                    )}>
                      {adjustForm.type === 'correction' 
                        ? Number(adjustForm.quantity) 
                        : (Number(adjustingItem?.current_stock) + (adjustForm.type === 'add' ? Number(adjustForm.quantity) : -Number(adjustForm.quantity)))} {adjustingItem?.unit}
                    </span>
                  </div>
                )}
              </div>


              <div className="grid gap-2">
                <Label htmlFor="type">Adjustment Type</Label>
                <Select 
                  value={adjustForm.type} 
                  onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Stock (Purchase)</SelectItem>
                    <SelectItem value="waste">Waste / Damage</SelectItem>
                    <SelectItem value="return">Return to Supplier</SelectItem>
                    <SelectItem value="correction">Set New Total (Correction)</SelectItem>
                  </SelectContent>
                </Select>
                {adjustForm.type === 'correction' && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Use this to set the exact physical count if system count is wrong.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">
                  {adjustForm.type === 'correction' ? 'New Total Count' : 'Adjust Quantity'} ({adjustingItem?.unit})
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                />
              </div>
              {adjustForm.type === 'add' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="cost">Total Cost (NPR)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={adjustForm.cost}
                      onChange={(e) => setAdjustForm({ ...adjustForm, cost: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="adjust_supplier">Supplier</Label>
                        <Select 
                            value={(adjustForm as any).supplier_id || "none"} 
                            onValueChange={(v) => setAdjustForm({ ...adjustForm, supplier_id: v } as any)}
                        >
                            <SelectTrigger id="adjust_supplier">
                                <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Supplier</SelectItem>
                                {Array.isArray(suppliers) && suppliers.map((s) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payment_status">Payment Status</Label>
                        <Select 
                            value={(adjustForm as any).payment_status || "pending"} 
                            onValueChange={(v) => setAdjustForm({ ...adjustForm, payment_status: v } as any)}
                        >
                            <SelectTrigger id="payment_status">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason / Note</Label>
                <Input
                  id="reason"
                  placeholder="e.g. Monthly restock, broken bottle..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setAdjustingItem(null)}
                disabled={adjustSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={adjustSubmitting}
              >
                {adjustSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  adjustForm.type === 'add' ? 'Receive Stock' : 'Save Adjustment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Add/Edit Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveItem}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</DialogTitle>
              <DialogDescription>
                Fill in the details for the inventory item. All fields with * are required.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g. Tomato, Olive Oil..."
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="station">Station *</Label>
                <Select 
                  value={itemForm.station} 
                  onValueChange={(v) => setItemForm({ ...itemForm, station: v })}
                >
                  <SelectTrigger id="station">
                    <SelectValue placeholder="Select station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="cafe">Cafe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details about the item..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input
                  id="unit"
                  required
                  placeholder="e.g. kg, liters, pieces..."
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                />
              </div>
              
              {!editingItem && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="opening_stock_total_cost">Opening Stock Total Cost (NPR)</Label>
                    <Input
                      id="opening_stock_total_cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={itemForm.opening_stock_total_cost}
                      onChange={(e) => setItemForm({ ...itemForm, opening_stock_total_cost: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="opening_payment_status">Opening Stock Payment</Label>
                    <Select 
                      value={itemForm.opening_stock_payment_status} 
                      onValueChange={(v) => setItemForm({ ...itemForm, opening_stock_payment_status: v })}
                    >
                      <SelectTrigger id="opening_payment_status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid (Cash/Purchase)</SelectItem>
                        <SelectItem value="pending">Pending (Awaiting Payment)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="current_stock">Current Stock *</Label>
                <Input
                  id="current_stock"
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={itemForm.current_stock}
                  onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock_level">Minimum Stock Level *</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  step="0.001"
                  required
                  placeholder="0.000"
                  value={itemForm.min_stock_level}
                  onChange={(e) => setItemForm({ ...itemForm, min_stock_level: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Select 
                  value={itemForm.supplier_id || "none"} 
                  onValueChange={(v) => setItemForm({ ...itemForm, supplier_id: v })}
                >
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Supplier</SelectItem>
                    {Array.isArray(suppliers) && suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Shelf A1, Cooler..."
                  value={itemForm.location}
                  onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                />
              </div>
              {editingItem && (
                <div className="grid gap-2">
                  <Label htmlFor="cost_per_unit">Cost per Unit (NPR)</Label>
                  <Input
                    id="cost_per_unit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={itemForm.cost_per_unit}
                    onChange={(e) => setItemForm({ ...itemForm, cost_per_unit: e.target.value })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-4 md:col-span-2 border-t border-border mt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active Status</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Inactive items won't show in the POS system.
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={itemForm.is_active}
                  onCheckedChange={(checked) => setItemForm({ ...itemForm, is_active: checked })}
                />
              </div>

            </div>
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setIsAddDialogOpen(false)}
                disabled={itemSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={itemSubmitting}
              >
                {itemSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? 'Update Item' : 'Add Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

  );
}
