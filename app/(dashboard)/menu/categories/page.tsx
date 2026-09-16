"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, FolderTree, Plus, Trash2 } from "lucide-react";

import apiClient from "@/lib/api-client";
import { ItemCategoryApis, StationApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
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
import { CategoryDialog } from "@/components/menu/category-dialog";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState } from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";

interface Category {
  id: number;
  name: string;
  station_id?: number | null;
}

function stationLabel(
  category: Category,
  stationNames: Record<number, string>,
) {
  if (category.station_id == null) return "No station assigned";
  return stationNames[category.station_id] || "Station unavailable";
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stationNames, setStationNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );

  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [categoriesRes, stationsRes] = await Promise.all([
        apiClient.get(ItemCategoryApis.getItemCategories(restaurantId)),
        apiClient.get(
          StationApis.list({ restaurantId, isActive: true, limit: 200 }),
        ),
      ]);
      if (categoriesRes.data.status === "success") {
        setCategories(categoriesRes.data.data);
      }
      if (stationsRes.data.status === "success") {
        const stations = stationsRes.data.data?.stations || [];
        setStationNames(
          Object.fromEntries(
            stations.map((station: { id: number; name: string }) => [
              station.id,
              station.name,
            ]),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (data: { name: string; station_id: number }) => {
    if (!restaurantId) return;
    try {
      await apiClient.post(
        ItemCategoryApis.createItemCategory(restaurantId),
        data,
      );
      toast({ title: "Category created" });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create category.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (data: { name: string; station_id: number }) => {
    if (!editingCategory) return;
    try {
      await apiClient.put(
        ItemCategoryApis.updateItemCategory(editingCategory.id),
        data,
      );
      toast({ title: "Category updated" });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update category.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await apiClient.delete(
        ItemCategoryApis.deleteItemCategory(categoryToDelete.id),
      );
      toast({ title: "Category deleted" });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete category.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = categories.filter((category) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [category.name, stationLabel(category, stationNames)].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  const openCreateDialog = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  return (
    <AppPage width="standard">
      <PageHeader
        className="hidden lg:flex"
        title="Categories"
        description="Organize menu items and their preparation station."
        actions={
          <Button onClick={openCreateDialog} className="h-11 rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Add category
          </Button>
        }
      />

      <div className="flex items-center gap-2 lg:hidden">
        <SearchField
          containerClassName="flex-1"
          placeholder="Search categories"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <Button
          onClick={openCreateDialog}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Add category"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <SearchField
        containerClassName="hidden max-w-sm lg:block"
        placeholder="Search categories"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onClear={() => setSearchQuery("")}
      />

      {loading ? (
        <DataList>
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="flex min-h-16 items-center gap-3 px-4 py-3"
            >
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          ))}
        </DataList>
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-5 w-5" />}
          title={searchQuery ? "No matching categories" : "No categories yet"}
          description={
            searchQuery
              ? "Try another category or station name."
              : "Create a category to organize the menu and preparation routing."
          }
          actionLabel={searchQuery ? undefined : "Add category"}
          onAction={searchQuery ? undefined : openCreateDialog}
        />
      ) : (
        <DataList>
          {filteredCategories.map((category) => (
            <ListRow
              key={category.id}
              leading={<FolderTree className="h-4 w-4" />}
              title={category.name}
              description={stationLabel(category, stationNames)}
              trailing={
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                    onClick={() => {
                      setEditingCategory(category);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${category.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl text-destructive hover:text-destructive"
                    onClick={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
          ))}
        </DataList>
      )}

      <div className="hidden lg:block">
        <p className="text-xs text-muted-foreground">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          {searchQuery ? ` · ${filteredCategories.length} shown` : ""}
        </p>
      </div>

      {restaurantId ? (
        <CategoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={editingCategory ? handleUpdate : handleCreate}
          initialData={editingCategory}
          restaurantId={restaurantId}
        />
      ) : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes
              <span className="font-semibold text-foreground">
                {` ${categoryToDelete?.name || "this category"}`}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}
