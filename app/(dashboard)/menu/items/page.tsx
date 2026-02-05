"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { MenuApis } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category_type?: string;
  image?: string;
}

export default function MenuItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, me } = useAuth();
  const { restaurant } = useRestaurant();

  useEffect(() => {
    const init = async () => {
      await me();
    };
    init();
  }, [me]);

  useEffect(() => {
    const fetchItems = async () => {
      if (!user?.restaurant_id) {
        if (user) setLoading(false);
        return;
      }
      try {
        const response = await apiClient.get(MenuApis.getMenusByRestaurant(user.restaurant_id));
        if (response.data.status === "success") {
          setItems(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch menu items:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [user]);

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Menu Items</h1>
            <p className="text-muted-foreground">Manage your restaurant's food and beverage offerings.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
             <div className="flex items-center justify-between">
                <CardTitle>All Items</CardTitle>
                 <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search items..." className="pl-8" />
                </div>
            </div>
          <CardDescription>
            Manage your menu items, prices, and availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No menu items found. Click 'Add Item' to create one.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="h-8 w-8 rounded-md object-cover" />
                        )}
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{item.category_type || "Uncategorized"}</TableCell>
                    <TableCell>{restaurant?.currency || "$"} {(item.price || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="success" className="font-normal">In Stock</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
