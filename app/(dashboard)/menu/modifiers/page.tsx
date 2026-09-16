"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Edit,
  ListChecks,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { ModifierApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ModifierGroup,
  ModifierGroupDialog,
  type ModifierGroupFormValues,
} from "@/components/menu/modifier-group-dialog";
import { ModifierOptionsSheet } from "@/components/menu/modifier-options-sheet";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList } from "@/components/patterns/data/data-list";
import { EmptyState } from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";

function selectionLabel(group: ModifierGroup) {
  return group.selection_type === "single" ? "One choice" : "Multiple choices";
}

function selectionLimits(group: ModifierGroup) {
  const maximum =
    group.max_selections == null
      ? "No maximum"
      : `Up to ${group.max_selections}`;
  return `${group.is_required ? "Required" : "Optional"} · Min ${group.min_selections} · ${maximum}`;
}

export default function ModifiersPage() {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ModifierGroup | null>(
    null,
  );
  const { toast } = useToast();

  const fetchGroups = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get(
        ModifierApis.listGroups(restaurantId),
      );
      if (response.data.status === "success") {
        setGroups(response.data.data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch modifier groups", error);
      toast({
        title: "Error",
        description: "Failed to load option groups.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = async (data: ModifierGroupFormValues) => {
    if (!restaurantId) return;
    try {
      await apiClient.post(ModifierApis.createGroup, {
        ...data,
        restaurant_id: restaurantId,
      });
      toast({ title: "Option group created" });
      fetchGroups();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create option group.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroup = async (data: ModifierGroupFormValues) => {
    if (!editingGroup) return;
    try {
      await apiClient.patch(ModifierApis.updateGroup(editingGroup.id), data);
      toast({ title: "Option group updated" });
      fetchGroups();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update option group.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await apiClient.delete(ModifierApis.deleteGroup(groupToDelete.id));
      toast({ title: "Option group deleted" });
      fetchGroups();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete option group.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const filteredGroups = groups.filter(
    (group) =>
      !searchQuery.trim() ||
      group.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const openCreateDialog = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  return (
    <AppPage width="standard">
      <PageHeader
        className="hidden lg:flex"
        title="Options & add-ons"
        description="Configure customer choices, selection rules, and price adjustments."
        actions={
          <Button onClick={openCreateDialog} className="h-11 rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Add option group
          </Button>
        }
      />

      <div className="flex items-center gap-2 lg:hidden">
        <SearchField
          containerClassName="flex-1"
          placeholder="Search option groups"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <Button
          onClick={openCreateDialog}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Add option group"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <SearchField
        containerClassName="hidden max-w-sm lg:block"
        placeholder="Search option groups"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onClear={() => setSearchQuery("")}
      />

      {loading ? (
        <DataList>
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="flex min-h-[72px] items-center gap-3 px-4 py-3"
            >
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          ))}
        </DataList>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title={
            searchQuery ? "No matching option groups" : "No option groups yet"
          }
          description={
            searchQuery
              ? "Try another group name."
              : "Create choices such as sizes, toppings, or preparation preferences."
          }
          actionLabel={searchQuery ? undefined : "Add option group"}
          onAction={searchQuery ? undefined : openCreateDialog}
        />
      ) : (
        <DataList>
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="flex min-h-[84px] min-w-0 items-center gap-3 px-3 py-3 sm:px-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {group.name}
                </p>
                <p className="mt-0.5 text-xs font-medium leading-4 text-muted-foreground">
                  {selectionLabel(group)}
                </p>
                <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                  {selectionLimits(group)}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                onClick={() => {
                  setSelectedGroup(group);
                  setOptionsSheetOpen(true);
                }}
                aria-label={`Manage ${group.name} options`}
                title="Manage options"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    aria-label={`More actions for ${group.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingGroup(group);
                      setGroupDialogOpen(true);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Edit group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setGroupToDelete(group);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </DataList>
      )}

      <ModifierGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
        initialData={editingGroup}
      />

      <ModifierOptionsSheet
        open={optionsSheetOpen}
        onOpenChange={(open) => {
          setOptionsSheetOpen(open);
          if (!open) setSelectedGroup(null);
        }}
        group={selectedGroup}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete option group?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes
              <span className="font-semibold text-foreground">
                {` ${groupToDelete?.name || "this group"}`}
              </span>
              and all of its options. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}
