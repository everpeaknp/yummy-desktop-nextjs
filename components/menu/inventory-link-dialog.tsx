"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Plus, Box } from "lucide-react";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface InventoryLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: any | null;
}

export function InventoryLinkDialog({ open, onOpenChange, menuItem }: InventoryLinkDialogProps) {
  const [links, setLinks] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [adding, setAdding] = useState(false);

  const user = useAuth((state) => state.user);

  useEffect(() => {
    if (open && menuItem && user?.restaurant_id) {
      fetchData();
    } else {
      setLinks([]);
      setInventoryItems([]);
      setSelectedInventoryId("");
      setQuantity("1");
    }
  }, [open, menuItem, user?.restaurant_id]);

  const fetchData = async () => {
    if (!menuItem || !user?.restaurant_id) return;
    setLoading(true);
    try {
      // Fetch available inventory items
      const invRes = await apiClient.get(
        InventoryApis.listInventoryWithQuery({ restaurantId: Number(user.restaurant_id), isActive: true })
      );
      if (invRes.data?.status === "success") {
        setInventoryItems(invRes.data.data.items || []);
      }

      // Fetch existing links for this menu item
      const linkRes = await apiClient.get(InventoryApis.getMenuInventory(menuItem.id));
      if (linkRes.data?.status === "success") {
        setLinks(linkRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory data:", err);
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!menuItem || !selectedInventoryId) return;
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    setAdding(true);
    try {
      const payload = {
        menu_item_id: menuItem.id,
        inventory_item_id: parseInt(selectedInventoryId, 10),
        quantity_required: qtyNum,
      };

      const res = await apiClient.post(InventoryApis.linkMenuInventory, payload);
      if (res.data?.status === "success") {
        toast.success("Inventory item linked");
        setSelectedInventoryId("");
        setQuantity("1");
        fetchData(); // Refresh list
      }
    } catch (err: any) {
      console.error("Link failed:", err);
      toast.error(err.response?.data?.detail || "Failed to link inventory item");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveLink = async (linkId: number) => {
    try {
      await apiClient.delete(InventoryApis.unlinkMenuInventory(linkId));
      toast.success("Link removed");
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error("Unlink failed:", err);
      toast.error("Failed to remove link");
    }
  };

  // Helper to get inventory item details
  const getInventoryRef = (invId: number) => inventoryItems.find((i) => i.id === invId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inventory Recipe Link</DialogTitle>
          <DialogDescription>
            Map inventory items required to prepare <strong>{menuItem?.name}</strong>. These will automatically deduct from stock when the item is KOT marked as ready or completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Add New Ingredient Link</h4>
             <div className="grid grid-cols-[1fr_100px] gap-2">
                <div className="space-y-2">
                  <Label>Inventory Item</Label>
                  <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select raw material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((inv) => {
                        const isAlreadyLinked = links.some((l) => l.inventory_item_id === inv.id);
                        return (
                          <SelectItem key={inv.id} value={String(inv.id)} disabled={isAlreadyLinked}>
                            {inv.name} ({inv.unit})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number" 
                    min="0.01" 
                    step="0.01" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                  />
                </div>
             </div>
             <Button 
                type="button" 
                className="w-full" 
                disabled={!selectedInventoryId || adding}
                onClick={handleAddLink}
              >
               {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
               Add Recipe Link
             </Button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-sm">Current Recipe Requirements</h4>
            
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : links.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center justify-center p-4 border rounded-md border-dashed bg-muted/30">
                <Box className="w-4 h-4 mr-2" /> No inventory items linked.
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => {
                  const invInfo = getInventoryRef(link.inventory_item_id);
                  return (
                    <div key={link.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-sm">
                      <div className="flex flex-col">
                         <span className="font-medium">{invInfo ? invInfo.name : `Unknown Ingredient #${link.inventory_item_id}`}</span>
                         <span className="text-xs text-muted-foreground">
                            Requires: {link.quantity_required} {invInfo?.unit || "units"} per order
                         </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveLink(link.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
