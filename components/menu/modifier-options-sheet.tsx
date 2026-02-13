"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { ModifierApis } from "@/lib/api/endpoints";
import { ModifierItem, ModifierItemDialog } from "./modifier-item-dialog";
import { useToast } from "@/components/ui/use-toast";
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
import { ModifierGroup } from "./modifier-group-dialog";

interface ModifierOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ModifierGroup | null;
}

export function ModifierOptionsSheet({ open, onOpenChange, group }: ModifierOptionsSheetProps) {
  const [items, setItems] = useState<ModifierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ModifierItem | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ModifierItem | null>(null);

  useEffect(() => {
    if (open && group) {
      fetchItems();
    } else {
        setItems([]);
    }
  }, [open, group]);

  const fetchItems = async () => {
    if (!group) return;
    setLoading(true);
    try {
      const response = await apiClient.get(ModifierApis.listItemsByGroup(group.id));
      if (response.data.status === "success") {
        setItems(response.data.data);
      }
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
  };

  const handleCreateItem = async (data: any) => {
    if (!group) return;
    try {
      await apiClient.post(ModifierApis.createItem, {
        ...data,
        modifier_group_id: group.id
      });
      toast({ title: "Success", description: "Option added." });
      fetchItems();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add option.", variant: "destructive" });
    }
  };

  const handleUpdateItem = async (data: any) => {
    if (!editingItem) return;
    try {
      await apiClient.patch(ModifierApis.updateItem(editingItem.id), data);
      toast({ title: "Success", description: "Option updated." });
      fetchItems();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update option.", variant: "destructive" });
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await apiClient.delete(ModifierApis.deleteItem(itemToDelete.id));
      toast({ title: "Success", description: "Option deleted." });
      fetchItems();
    } catch (error) {
        toast({ title: "Error", description: "Failed to delete option.", variant: "destructive" });
    } finally {
        setDeleteDialogOpen(false);
        setItemToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const openEditDialog = (item: ModifierItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const openDeleteDialog = (item: ModifierItem) => {
     setItemToDelete(item);
     setDeleteDialogOpen(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col p-6">
        <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
                <div>
                     <SheetTitle>Manage Options</SheetTitle>
                    <SheetDescription>
                        For group: <span className="font-bold text-foreground">{group?.name}</span>
                    </SheetDescription>
                </div>
                <Button size="sm" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-1" /> Add Option
                </Button>
            </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Option Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        [1,2,3].map(i => (
                             <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                             </TableRow>
                        ))
                    ) : items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                No options found in this group.
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.price_adjustment >= 0 ? "+" : ""}{item.price_adjustment}</TableCell>
                                <TableCell>
                                    <Badge variant={item.is_active ? "default" : "destructive"} className={item.is_active ? "bg-green-600" : ""}>
                                        {item.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => openDeleteDialog(item)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
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
                    <AlertDialogTitle>Delete Option?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will delete <span className="font-bold">{itemToDelete?.name}</span> from this group.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteItem}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </SheetContent>
    </Sheet>
  );
}
