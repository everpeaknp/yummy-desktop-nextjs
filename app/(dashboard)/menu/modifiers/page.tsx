"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2, GripVertical, AlertCircle, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const { user, me } = useAuth();
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

  useEffect(() => {
    const init = async () => {
      await me();
    };
    init();
  }, [me]);

  const fetchGroups = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(ModifierApis.listGroups(user.restaurant_id));
      if (response.data.status === 'success') {
        setGroups(response.data.data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch modifier groups", error);
      toast({ title: "Error", description: "Failed to fetch existing groups.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  // Create Group
  const handleCreateGroup = async (data: any) => {
    if (!user?.restaurant_id) return;
    try {
      await apiClient.post(ModifierApis.createGroup, { 
          ...data,
          restaurant_id: user.restaurant_id 
      });
      toast({ title: "Success", description: "Modifier group created." });
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
      toast({ title: "Success", description: "Modifier group updated." });
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
      toast({ title: "Success", description: "Modifier group deleted." });
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifiers</h1>
          <p className="text-muted-foreground">Create options like toppings, sizes, and variations.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Group
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Groups</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search groups..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
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
                         <p>No modifier groups found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.filter((g) => {
                  if (!searchQuery.trim()) return true;
                  return g.name.toLowerCase().includes(searchQuery.toLowerCase());
                }).map((group) => (
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
