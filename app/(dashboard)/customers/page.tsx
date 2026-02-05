"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, User, Phone, Mail, Award, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        
        const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && !updatedToken) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Customers
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!user?.restaurant_id) return;
      
      try {
        const response = await apiClient.get(CustomerApis.listCustomers);
        if (response.data.status === "success") {
          setCustomers(response.data.data.data || response.data.data); // Handle pagination structure if any
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchCustomers();
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">Manage your customer base and loyalty.</p>
         </div>
         <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Customer
         </Button>
      </div>

      <div className="relative w-full max-w-sm">
         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
         <Input className="pl-8 bg-muted/50 border-border" placeholder="Search customers..." />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : customers.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <User className="w-12 h-12 mb-4 opacity-20" />
            <p>No customers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {customers.map((customer) => (
                <Card key={customer.id} className="bg-card border-border hover:shadow-md transition-all shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                                    {customer.full_name?.charAt(0) || <User className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground truncate">{customer.full_name || "Guest"}</h3>
                                    <p className="text-xs text-muted-foreground">ID: #{customer.id}</p>
                                </div>
                            </div>
                            {customer.loyalty_points > 0 && (
                                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-500">
                                    <Award className="w-3 h-3 mr-1" /> {customer.loyalty_points}
                                </Badge>
                            )}
                        </div>
                        
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{customer.phone || "No phone"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5" />
                                <span className="truncate">{customer.email || "No email"}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-xs">
                           <span className="text-muted-foreground">Visits: {customer.visits || 0}</span>
                           <Button variant="ghost" size="sm" className="h-auto p-0 text-primary hover:text-primary/80">
                               View Details
                           </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      )}
    </div>
  );
}
