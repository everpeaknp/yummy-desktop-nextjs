"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { ModifierApis } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";

interface ModifierGroup {
  id: number;
  name: string;
  selection_type?: string;
  is_required?: boolean;
  min_selections?: number;
  max_selections?: number;
  options?: any[];
}

export default function ModifiersPage() {
  const { user, me } = useAuth();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      await me();
    };
    init();
  }, [me]);

  useEffect(() => {
    const fetchGroups = async () => {
      // Assuming listGroups filters by the authenticated user's restaurant context
      try {
        const response = await apiClient.get(ModifierApis.listGroups);
        if (response.data.status === 'success') {
          setGroups(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch modifier groups", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchGroups();
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modifiers</h1>
          <p className="text-muted-foreground">Create options like toppings, sizes, and variations.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90">
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
                <TableHead>Requirement</TableHead>
                <TableHead>Constraints</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No modifier groups found.
                  </TableCell>
                </TableRow>
              ) : (
                groups.filter((g) => {
                  if (!searchQuery.trim()) return true;
                  return g.name.toLowerCase().includes(searchQuery.toLowerCase());
                }).map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.selection_type || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={group.is_required ? 'default' : 'secondary'} className="font-normal">
                        {group.is_required ? 'Required' : 'Optional'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {group.min_selections} - {group.max_selections}
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
