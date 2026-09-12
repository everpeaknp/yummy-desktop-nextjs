"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { CustomerApis, OrderApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Award, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { MetricCard } from "@/components/cards/metric-card";
import { OperationalCard } from "@/components/cards/operational-card";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState, LoadingState } from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
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
        setIsFallbackMode(false);
        return;
      }
    } catch (err: any) {
      // Keep page usable when /customers is blocked for this token on web.
      // Build a read-only customer list from order snapshots as fallback.
      if (err?.response?.status === 403) {
        try {
          console.error("Customers endpoint returned 403:", err?.response?.data);
          const ordersRes = await apiClient.get(OrderApis.listOrders, {
            params: {
              restaurant_id: user.restaurant_id,
              limit: 1000,
              skip: 0,
            },
          });
          if (ordersRes.data?.status === "success") {
            const orders = ordersRes.data?.data?.orders || [];
            const byId = new Map<number, any>();

            for (const o of orders) {
              const cid = Number(o?.customer_id || 0);
              if (cid <= 0) continue; // keep only real linked customers
              const name = o?.customer_name || "Guest";
              const phone = o?.customer_phone || "";
              if (!byId.has(cid)) {
                byId.set(cid, {
                  id: cid,
                  name,
                  full_name: name,
                  phone,
                  email: "",
                  loyalty_points: 0,
                  // Unknown in fallback mode; avoid fake totals.
                  credit: undefined,
                  visits: 1,
                  is_active: true,
                  is_vip: false,
                });
              } else {
                const existing = byId.get(cid);
                existing.visits = (existing.visits || 0) + 1;
                if (!existing.phone && phone) existing.phone = phone;
                if (!existing.name && name) {
                  existing.name = name;
                  existing.full_name = name;
                }
              }
            }

            setCustomers(Array.from(byId.values()));
            setIsFallbackMode(true);
            return;
          }
        } catch (fallbackErr) {
          console.error("Fallback customers from orders failed:", fallbackErr);
        }
      }
      console.error("Failed to fetch customers:", err);
      setCustomers([]);
      setIsFallbackMode(false);
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
    router.push(`/customers/${customer.id}`);
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (customer.name || "").toLowerCase().includes(query)
      || (customer.phone || "").toLowerCase().includes(query)
      || (customer.email || "").toLowerCase().includes(query);
  });

  const creditBalance = customers.reduce((sum, customer) => sum + (customer.credit || 0), 0);

  return (
    <AppPage width="wide" className="p-4 sm:p-6">
      <div className="hidden md:block">
        <PageHeader
          title="Customers"
          description="Manage customer details, loyalty, visits, and credit."
          actions={<AddCustomerDialog onCustomerAdded={handleCreateSuccess} />}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <SearchField
          placeholder="Search customers"
          className="min-w-0"
          containerClassName="flex-1"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <AddCustomerDialog onCustomerAdded={handleCreateSuccess} iconOnly triggerClassName="h-11 w-11 shrink-0 rounded-xl" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 md:hidden">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Credit balance</p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
            {isFallbackMode ? "Unavailable" : `Rs. ${creditBalance.toLocaleString()}`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{customers.length} customers</p>
      </div>

      <div className="hidden grid-cols-2 gap-3 md:grid md:max-w-2xl">
        <MetricCard label="Customers" value={customers.length} icon={<User className="h-4 w-4" />} tone="brand" />
        <MetricCard
          label="Credit balance"
          value={isFallbackMode ? "Unavailable" : `Rs. ${creditBalance.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4" />}
          tone="success"
        />
      </div>
      {isFallbackMode && (
        <p className="text-xs text-amber-600">
          Customer API is plan-locked on web for this restaurant; showing linked order customers only.
        </p>
      )}

      <SearchField containerClassName="hidden max-w-md md:block" placeholder="Search customers" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />

      {loading ? (
        <LoadingState label="Loading customers..." />
      ) : customers.length === 0 ? (
        <EmptyState icon={<User className="h-5 w-5" />} title="No customers found" description="Add a customer to start tracking loyalty, visits, and credit." />
      ) : (
        <>
        <DataList className="md:hidden">
          {filteredCustomers.map((customer) => (
            <ListRow
              key={customer.id}
              interactive
              onClick={() => openDetails(customer)}
              leading={<span className="font-semibold">{customer.name?.charAt(0) || <User className="h-4 w-4" />}</span>}
              title={customer.name || "Guest"}
              description={customer.phone || customer.email || "No contact details"}
              meta={typeof customer.credit === "number" && customer.credit > 0 ? `Rs. ${customer.credit.toLocaleString()}` : `${customer.visits || 0} visits`}
              trailing={customer.loyalty_points > 0 ? <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-500">{customer.loyalty_points}</Badge> : undefined}
            />
          ))}
        </DataList>
        <div className="hidden grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:grid">
          {filteredCustomers.map((customer) => (
            <OperationalCard
              key={customer.id}
              title={customer.name || "Guest"}
              status={customer.loyalty_points > 0 ? <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-500"><Award className="mr-1 h-3 w-3" />{customer.loyalty_points}</Badge> : null}
              meta={`Customer #${customer.id}`}
              className="cursor-pointer"
              onClick={() => openDetails(customer)}
              footer={
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {typeof customer.credit === "number" && customer.credit > 0 ? <span className="text-destructive">Credit: Rs. {customer.credit.toLocaleString()}</span> : `Visits: ${customer.visits || 0}`}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8 shrink-0 rounded-lg px-2 text-primary" onClick={(event) => { event.stopPropagation(); openDetails(customer); }}>Details</Button>
                </div>
              }
            >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground">
                    {customer.name?.charAt(0) || <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">Customer profile</div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{customer.phone || "No phone"}</span></div>
                  <div className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{customer.email || "No email"}</span></div>
                </div>
            </OperationalCard>
          ))}
        </div>
        </>
      )}

    </AppPage>
  );
}
