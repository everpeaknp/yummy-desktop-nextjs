"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { KotApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChefHat, Clock, CheckCircle, XCircle, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KitchenPage() {
  const [kots, setKots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration
  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        if (!user && !token) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch KOTs
  useEffect(() => {
    const fetchKots = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);
      
      try {
        const url = KotApis.getKotUpdatesByRestaurant(user.restaurant_id);
        const response = await apiClient.get(url);
        if (response.data.status === "success") {
          setKots(response.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch KOTs:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchKots();
        const interval = setInterval(fetchKots, 10000); // Poll for new KOTs
        return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6 h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Kitchen Display System</h1>
            <p className="text-muted-foreground">Manage incoming kitchen order tickets.</p>
         </div>
      </div>

      {loading && kots.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : kots.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <ChefHat className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">No active KOTs</p>
            <p className="text-sm">Kitchen is clear!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-6">
            {kots.map((kot) => (
                <KotCard key={kot.id} kot={kot} />
            ))}
        </div>
      )}
    </div>
  );
}

function KotCard({ kot }: { kot: any }) {
    const statusColor = kot.status === 'pending' ? 'bg-yellow-100 border-yellow-200 text-yellow-600 dark:bg-yellow-950/20 dark:border-yellow-900/50 dark:text-yellow-500' 
        : kot.status === 'preparing' ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-500'
        : 'bg-green-100 border-green-200 text-green-600 dark:bg-green-950/20 dark:border-green-900/50 dark:text-green-500';

    return (
        <Card className="bg-card border-border flex flex-col shadow-sm">
            <CardHeader className="p-4 bg-muted/50 border-b border-border flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-base font-bold">KOT #{kot.id}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Table: {kot.table_name || "N/A"}</p>
                </div>
                <Badge variant="outline" className={cn("uppercase text-[10px]", statusColor)}>
                    {kot.status}
                </Badge>
            </CardHeader>
            <CardContent className="p-4 flex-1">
                <div className="space-y-3">
                    {kot.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start text-sm border-b border-border pb-2 last:border-0">
                            <div className="flex gap-2">
                                <span className="font-bold text-primary">{item.qty}x</span>
                                <span className="text-foreground">{item.name}</span>
                            </div>
                            {item.notes && <p className="text-xs text-muted-foreground italic mt-1 w-full">{item.notes}</p>}
                        </div>
                    ))}
                </div>
            </CardContent>
            <div className="p-3 border-t border-border bg-muted/30 flex justify-between gap-2">
                 <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-foreground">
                     <Printer className="w-4 h-4" />
                 </Button>
                 <div className="flex gap-2">
                     <Button size="sm" variant="outline" className="h-8 border-destructive/50 hover:bg-destructive/10 text-destructive">
                         Reject
                     </Button>
                     <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                         Accept
                     </Button>
                 </div>
            </div>
        </Card>
    )
}
