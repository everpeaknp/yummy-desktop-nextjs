"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, Link as LinkIcon, Loader2, Plus, Trash2 } from "lucide-react";

import apiClient from "@/lib/api-client";
import { ModifierApis } from "@/lib/api/endpoints";
import { formatCurrency } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState } from "@/components/patterns/feedback/feedback-state";
import { ModifierInventoryLinker } from "@/components/inventory/modifier-inventory-linker";
import { ModifierGroup } from "./modifier-group-dialog";
import {
  ModifierItem,
  ModifierItemDialog,
  type ModifierItemFormValues,
} from "./modifier-item-dialog";

interface ModifierOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ModifierGroup | null;
}

export function ModifierOptionsSheet({
  open,
  onOpenChange,
  group,
}: ModifierOptionsSheetProps) {
  const [items, setItems] = useState<ModifierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ModifierItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ModifierItem | null>(null);
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [linkerItem, setLinkerItem] = useState<ModifierItem | null>(null);
  const restaurant = useRestaurant((state) => state.restaurant);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        ModifierApis.listItemsByGroup(group.id),
      );
      if (response.data.status === "success") setItems(response.data.data);
    } catch (error) {
      console.error("Failed to fetch modifier items:", error);
      toast({
        title: "Error",
        description: "Failed to load options.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [group, toast]);

  useEffect(() => {
    if (open && group) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [fetchItems, open, group]);

  const handleCreateItem = async (data: ModifierItemFormValues) => {
    if (!group) return;
    try {
      await apiClient.post(ModifierApis.createItem, {
        ...data,
        modifier_group_id: group.id,
      });
      toast({ title: "Option added" });
      fetchItems();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to add option.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateItem = async (data: ModifierItemFormValues) => {
    if (!editingItem) return;
    try {
      await apiClient.patch(ModifierApis.updateItem(editingItem.id), data);
      toast({ title: "Option updated" });
      fetchItems();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update option.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await apiClient.delete(ModifierApis.deleteItem(itemToDelete.id));
      toast({ title: "Option deleted" });
      fetchItems();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete option.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const optionAmount = (item: ModifierItem) => {
    const amount = formatCurrency(
      Math.abs(item.price_adjustment || 0),
      restaurant?.currency,
    );
    if (!item.price_adjustment) return "No price change";
    return `${item.price_adjustment > 0 ? "+" : "−"}${amount}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-[100dvh] w-full max-w-none flex-col p-0 sm:w-[600px] sm:max-w-[600px]">
        <SheetHeader className="border-b px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle>Options</SheetTitle>
              <SheetDescription className="mt-1 truncate">
                {group?.name || "Option group"}
              </SheetDescription>
            </div>
            <Button
              size="sm"
              className="h-10 shrink-0 rounded-xl"
              onClick={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add option
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <DataList>
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex min-h-16 items-center gap-3 px-4 py-3"
                >
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </DataList>
          ) : items.length === 0 ? (
            <EmptyState
              title="No options yet"
              description="Add the choices customers can select for this group."
              actionLabel="Add option"
              onAction={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
            />
          ) : (
            <DataList>
              {items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  description={optionAmount(item)}
                  meta={
                    <Badge variant={item.is_active ? "secondary" : "outline"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                  trailing={
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl"
                        title="Link inventory"
                        aria-label={`Link inventory for ${item.name}`}
                        onClick={() => {
                          setLinkerItem(item);
                          setLinkerOpen(true);
                        }}
                      >
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => {
                          setEditingItem(item);
                          setItemDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl text-destructive hover:text-destructive"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => {
                          setItemToDelete(item);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
              ))}
            </DataList>
          )}
        </div>

        <ModifierItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          onSubmit={editingItem ? handleUpdateItem : handleCreateItem}
          initialData={editingItem}
          groupName={group?.name || ""}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete option?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes
                <span className="font-semibold text-foreground">
                  {` ${itemToDelete?.name || "this option"}`}
                </span>
                from the group.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleDeleteItem}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ModifierInventoryLinker
          open={linkerOpen}
          onOpenChange={(isOpen) => {
            setLinkerOpen(isOpen);
            if (!isOpen) setLinkerItem(null);
          }}
          modifierId={linkerItem?.id ?? null}
          modifierName={linkerItem?.name}
        />
      </SheetContent>
    </Sheet>
  );
}
