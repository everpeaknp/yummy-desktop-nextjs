"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { useCallback, useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCategoryApis, StationApis } from "@/lib/api/endpoints";
import { CategoryDialog } from "@/components/menu/category-dialog";
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

interface Category {
  id: number;
  name: string;
  station_id?: number | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stationNames, setStationNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const restaurantId = useAuth((s) => s.user?.restaurant_id);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const [categoriesRes, stationsRes] = await Promise.all([
        apiClient.get(ItemCategoryApis.getItemCategories(restaurantId)),
        apiClient.get(StationApis.list({ restaurantId, isActive: true, limit: 200 })),
      ]);
      if (categoriesRes.data.status === "success") {
        setCategories(categoriesRes.data.data);
      }
      if (stationsRes.data.status === "success") {
        const stations = stationsRes.data.data?.stations || [];
        setStationNames(
          Object.fromEntries(stations.map((s: { id: number; name: string }) => [s.id, s.name])),
        );
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (data: { name: string; station_id: number }) => {
    if (!restaurantId) return;
    try {
      await apiClient.post(ItemCategoryApis.createItemCategory(restaurantId), data);
      toast({ title: "Success", description: "Category created successfully." });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create category.", variant: "destructive" });
    }
  };

  const handleUpdate = async (data: { name: string; station_id: number }) => {
    if (!editingCategory) return;
    try {
      await apiClient.put(ItemCategoryApis.updateItemCategory(editingCategory.id), data);
      toast({ title: "Success", description: "Category updated successfully." });
      fetchCategories();
    } catch (error) {
       console.error(error);
       toast({ title: "Error", description: "Failed to update category.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await apiClient.delete(ItemCategoryApis.deleteItemCategory(categoryToDelete.id));
      toast({ title: "Success", description: "Category deleted successfully." });
      fetchCategories();
    } catch (error) {
       console.error(error);
       toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const filteredCategories = categories.filter((category) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const stationName = category.station_id != null ? stationNames[category.station_id] : undefined;
    return category.name.toLowerCase().includes(query) || (stationName || "").toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories"
            className="h-11 rounded-xl pl-10"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Button onClick={openCreateDialog} size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Add category">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card md:hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{searchQuery ? "No matching categories" : "No categories yet"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{searchQuery ? "Try a different search." : "Add a category to organize your menu."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredCategories.map((category) => {
              const stationName = category.station_id != null ? stationNames[category.station_id] : undefined;
              return (
                <div key={category.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{stationName || "Unassigned station"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => openEditDialog(category)} aria-label={`Edit ${category.name}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg text-destructive hover:text-destructive" onClick={() => openDeleteDialog(category)} aria-label={`Delete ${category.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden md:flex md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">Organize your menu items into categories.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Categories</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search categories..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <CardDescription>
            Manage your menu structure here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right flex justify-end gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                       <AlertCircle className="h-8 w-8 opacity-50" />
                       <p>No categories found. Click &apos;Add Category&apos; to create one.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {category.station_id != null
                          ? stationNames[category.station_id] || `Station #${category.station_id}`
                          : "Unassigned"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal border-green-500 text-green-500">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => openDeleteDialog(category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {restaurantId && (
        <CategoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={editingCategory ? handleUpdate : handleCreate}
          initialData={editingCategory}
          restaurantId={restaurantId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category
              <span className="font-bold text-foreground"> {categoryToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
