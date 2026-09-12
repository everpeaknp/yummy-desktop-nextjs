"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2, GripVertical, AlertCircle, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { ModifierApis } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { 
    ModifierGroup, 
    ModifierGroupDialog 
} from "@/components/menu/modifier-group-dialog";
import { ModifierOptionsSheet } from "@/components/menu/modifier-options-sheet";
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

export default function ModifiersPage() {
  const restaurantId = useAuth((s) => s.user?.restaurant_id);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Dialog States
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ModifierGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get(ModifierApis.listGroups(restaurantId));
      if (response.data.status === 'success') {
        setGroups(response.data.data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch modifier groups", error);
      toast({ title: "Error", description: "Failed to fetch existing groups.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Create Group
  const handleCreateGroup = async (data: any) => {
    if (!restaurantId) return;
    try {
      await apiClient.post(ModifierApis.createGroup, { 
          ...data,
          restaurant_id: restaurantId 
      });
      toast({ title: "Success", description: "Option group created." });
      fetchGroups();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create group.", variant: "destructive" });
    }
  };

  // Update Group
  const handleUpdateGroup = async (data: any) => {
    if (!editingGroup) return;
    try {
      await apiClient.patch(ModifierApis.updateGroup(editingGroup.id), data);
      toast({ title: "Success", description: "Option group updated." });
      fetchGroups();
    } catch (error) {
       toast({ title: "Error", description: "Failed to update group.", variant: "destructive" });
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await apiClient.delete(ModifierApis.deleteGroup(groupToDelete.id));
      toast({ title: "Success", description: "Option group deleted." });
      fetchGroups();
    } catch (error) {
        toast({ title: "Error", description: "Failed to delete group.", variant: "destructive" });
    } finally {
        setDeleteDialogOpen(false);
        setGroupToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const openEditDialog = (group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const openOptionsSheet = (group: ModifierGroup) => {
    setSelectedGroup(group);
    setOptionsSheetOpen(true);
  };

  const openDeleteDialog = (group: ModifierGroup) => {
      setGroupToDelete(group);
      setDeleteDialogOpen(true);
  };

  const filteredGroups = groups.filter((group) =>
    !searchQuery.trim() || group.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search option groups"
            className="h-11 rounded-xl pl-10"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Button onClick={openCreateDialog} size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Add option group">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card md:hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{searchQuery ? "No matching option groups" : "No option groups yet"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{searchQuery ? "Try a different search." : "Add choices such as sizes or toppings."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredGroups.map((group) => {
              const selection = group.min_selections === 1 && group.max_selections === 1 ? "Single choice" : "Multiple choices";
              return (
                <div key={group.id} className="flex min-w-0 items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selection} {group.is_required ? "· Required" : "· Optional"}
                    </p>
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => openOptionsSheet(group)} aria-label={`Manage ${group.name} options`}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => openEditDialog(group)} aria-label={`Edit ${group.name}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-lg text-destructive hover:text-destructive" onClick={() => openDeleteDialog(group)} aria-label={`Delete ${group.name}`}>
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
          <h1 className="text-2xl font-bold tracking-tight">Options & add-ons</h1>
          <p className="text-muted-foreground">Create choices such as size, toppings, and variations for menu items.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add option group
        </Button>
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All option groups</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search option groups..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Option group</TableHead>
                <TableHead>Selection Type</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                         <AlertCircle className="h-8 w-8 opacity-50" />
                         <p>No option groups found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="capitalize">
                        <Badge variant="outline">{group.min_selections === 1 && group.max_selections === 1 ? 'single' : 'multiple'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                          <Badge variant={group.is_required ? 'default' : 'secondary'} className="font-normal text-xs">
                            {group.is_required ? 'Required' : 'Optional'}
                          </Badge>
                          <span className="text-muted-foreground text-xs my-auto">
                             Min: {group.min_selections} / Max: {group.max_selections}
                          </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openOptionsSheet(group)}>
                             <Settings2 className="h-3 w-3 mr-1" /> Options
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(group)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => openDeleteDialog(group)}>
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

      <ModifierGroupDialog 
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
        initialData={editingGroup}
      />

      <ModifierOptionsSheet 
        open={optionsSheetOpen}
        onOpenChange={setOptionsSheetOpen}
        group={selectedGroup}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Modifier Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <span className="font-bold">{groupToDelete?.name}</span> and ALL its options. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteGroup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
