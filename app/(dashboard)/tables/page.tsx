"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { TableApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Armchair, Users, Loader2, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Table {
  id: number;
  table_name: string;
  capacity: number;
  status: string;
  table_type_name?: string;
  table_type_id?: number;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        if (!user && !token) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  useEffect(() => {
    const fetchTables = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);
      
      try {
        const url = TableApis.getTables(user.restaurant_id);
        const response = await apiClient.get(url);
        if (response.data.status === "success") {
          setTables(response.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch tables:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchTables();
    }
  }, [user]);

  // Group tables by area
  const tablesByArea = tables.reduce((acc, table) => {
     const area = table.table_type_name || "Main Hall";
     if (!acc[area]) acc[area] = [];
     acc[area].push(table);
     return acc;
  }, {} as Record<string, Table[]>);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Table Management</h1>
            <p className="text-muted-foreground">Configure your floor plan and tables.</p>
         </div>
         <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Table
         </Button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tables.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <Armchair className="w-12 h-12 mb-4 opacity-20" />
            <p>No tables configured.</p>
        </div>
      ) : (
        <div className="space-y-8">
            {Object.entries(tablesByArea).map(([area, areaTables]) => (
                <div key={area} className="space-y-4">
                    <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        {area} <span className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">{areaTables.length}</span>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {areaTables.map((table) => (
                            <Card key={table.id} className="bg-card border-border hover:shadow-md transition-all group relative shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-40">
                                    <div className="p-3 rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <Armchair className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg">{table.table_name}</h3>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Capacity: {table.capacity}
                                    </p>
                                    
                                    {/* Action Overlay */}
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-background/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2 rounded-b-lg border-t border-border">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-950/30">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-red-100 dark:hover:bg-red-950/30">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}
