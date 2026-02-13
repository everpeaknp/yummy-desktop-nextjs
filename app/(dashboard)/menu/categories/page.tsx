"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCategoryApis } from "@/lib/api/endpoints";
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
  type: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, me } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    const init = async () => {
      await me();
    };
    init();
  }, [me]);

  const fetchCategories = async () => {
    if (!user?.restaurant_id) {
      if (user) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get(ItemCategoryApis.getItemCategories(user.restaurant_id));
      if (response.data.status === "success") {
        setCategories(response.data.data);
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
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const handleCreate = async (data: { name: string; type: string }) => {
    if (!user?.restaurant_id) return;
    try {
      await apiClient.post(ItemCategoryApis.createItemCategory(user.restaurant_id), data);
      toast({ title: "Success", description: "Category created successfully." });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create category.", variant: "destructive" });
    }
  };

  const handleUpdate = async (data: { name: string; type: string }) => {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">Organize your menu items into categories.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card>
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
                <TableHead>Type</TableHead>
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
                       <p>No categories found. Click 'Add Category' to create one.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.filter((c) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
                }).map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="capitalize">
                      <Badge variant="secondary" className="font-normal">{category.type}</Badge>
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

      <CategoryDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSubmit={editingCategory ? handleUpdate : handleCreate}
        initialData={editingCategory}
      />

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
