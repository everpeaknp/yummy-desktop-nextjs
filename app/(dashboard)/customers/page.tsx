"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, User, Phone, Mail, Award, Loader2, DollarSign } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { CustomerDetailsSheet } from "@/components/customers/customer-details-sheet";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();

      const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && !updatedToken) router.push('/');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Fetch Customers
  const fetchCustomers = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(CustomerApis.listCustomers(user.restaurant_id));
      if (response.data.status === "success") {
        setCustomers(response.data.data.customers || []);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchCustomers();
    }
  }, [user]);

  const handleCreateSuccess = () => {
    fetchCustomers();
  };

  const openDetails = (customer: any) => {
    setSelectedCustomer(customer);
    setIsSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer base and loyalty.</p>
        </div>
        <AddCustomerDialog onCustomerAdded={handleCreateSuccess} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
              <h3 className="text-2xl font-bold">{customers.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground text-emerald-800 dark:text-emerald-400">Total Credit Balance</p>
              <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
                Rs. {customers.reduce((acc, c) => acc + (c.credit || 0), 0).toLocaleString()}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8 bg-muted/50 border-border" placeholder="Search customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
          {customers.filter((c) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (c.full_name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
          }).map((customer) => (
            <Card key={customer.id} className="bg-card border-border hover:shadow-md transition-all shadow-sm cursor-pointer" onClick={() => openDetails(customer)}>
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
                  <span className="text-muted-foreground font-medium">
                    {customer.credit > 0 ? (
                      <span className="text-red-600 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Credit: Rs. {customer.credit.toLocaleString()}
                      </span>
                    ) : (
                      <span>Visits: {customer.visits || 0}</span>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-primary hover:text-primary/80" onClick={(e) => { e.stopPropagation(); openDetails(customer); }}>
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerDetailsSheet
        customer={selectedCustomer}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onUpdate={fetchCustomers}
      />
    </div>
  );
}
