"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { MetricCard } from "@/components/cards/metric-card";
import { SearchField } from "@/components/patterns/controls/search-field";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { MobileRegisterToolbar } from "@/components/patterns/controls/mobile-register-toolbar";
import { MobileCreateFab } from "@/components/patterns/actions/mobile-create-fab";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { CustomerApis, OrderApis } from "@/lib/api/endpoints";
import { presentCustomerBalance } from "@/lib/presentation/customer-balance";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomerRecord {
  id: number;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  credit?: number | null;
  visits?: number | null;
  loyalty_points?: number | null;
  is_active?: boolean | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const restaurant = useRestaurant((state) => state.restaurant);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    const timer = window.setTimeout(checkAuth, 500);
    return () => window.clearTimeout(timer);
  }, [me, router, user]);

  const fetchCustomers = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        CustomerApis.listCustomers(user.restaurant_id),
      );
      if (response.data.status === "success") {
        setCustomers(response.data.data.customers ?? []);
        setIsFallbackMode(false);
        return;
      }
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 403) {
        try {
          const ordersResponse = await apiClient.get(OrderApis.listOrders, {
            params: { restaurant_id: user.restaurant_id, limit: 1000, skip: 0 },
          });
          if (ordersResponse.data?.status === "success") {
            const customersById = new Map<number, CustomerRecord>();
            for (const order of ordersResponse.data?.data?.orders ?? []) {
              const customerId = Number(order?.customer_id ?? 0);
              if (customerId <= 0) continue;
              const existing = customersById.get(customerId);
              if (existing) {
                existing.visits = (existing.visits ?? 0) + 1;
                if (!existing.phone && order.customer_phone)
                  existing.phone = order.customer_phone;
                continue;
              }
              const name = order?.customer_name || "Guest";
              customersById.set(customerId, {
                id: customerId,
                name,
                full_name: name,
                phone: order?.customer_phone || "",
                email: "",
                visits: 1,
                is_active: true,
              });
            }
            setCustomers(Array.from(customersById.values()));
            setIsFallbackMode(true);
            return;
          }
        } catch (fallbackError) {
          console.error("Customer order fallback failed:", fallbackError);
        }
      }
      console.error("Failed to fetch customers:", error);
      setCustomers([]);
      setIsFallbackMode(false);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        [
          customer.name,
          customer.full_name,
          customer.phone,
          customer.email,
        ].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? customer.is_active !== false
          : customer.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const totalReceivable = customers.reduce(
    (sum, customer) => sum + Number(customer.credit ?? 0),
    0,
  );
  const openDetails = (customerId: number) =>
    router.push(`/customers/${customerId}`);
  const customerName = (customer: CustomerRecord) =>
    customer.full_name || customer.name || "Guest";
  const contact = (customer: CustomerRecord) =>
    customer.phone || customer.email || "No contact details";

  return (
    <AppPage width="register">
      <div className="hidden lg:block">
        <PageHeader
          title="Customers"
          description="Manage customer relationships, sales history, and settlements."
          actions={
            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={() => setAddCustomerOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add customer
            </Button>
          }
        />
      </div>

      <MobileRegisterToolbar
        search={
          <SearchField
            placeholder="Search customers"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onClear={() => setSearchQuery("")}
          />
        }
        filter={
          <FilterBar
            title="Filters"
            activeCount={statusFilter === "all" ? 0 : 1}
            responsiveAt="lg"
            mobileTriggerVariant="icon"
            mobileContent={
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="customer-status-filter-mobile"
                >
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger
                    id="customer-status-filter-mobile"
                    className="h-11 rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Total receivable
          </p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
            {isFallbackMode
              ? "Unavailable"
              : formatCurrency(totalReceivable, restaurant?.currency)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {customers.length} customers
        </p>
      </div>

      <div className="hidden max-w-2xl grid-cols-2 gap-3 lg:grid">
        <MetricCard
          label="Customers"
          value={customers.length}
          icon={<User className="h-4 w-4" />}
          tone="brand"
        />
        <MetricCard
          label="Total receivable"
          value={
            isFallbackMode
              ? "Unavailable"
              : formatCurrency(totalReceivable, restaurant?.currency)
          }
          icon={<User className="h-4 w-4" />}
          tone="neutral"
        />
      </div>

      {isFallbackMode ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Customer profiles are unavailable for this account. Showing customers
          linked to orders only.
        </p>
      ) : null}

      <FilterBar className="hidden lg:block" responsiveAt="lg">
        <SearchField
          containerClassName="max-w-md"
          placeholder="Search name, phone, or email"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="h-11 w-44 rounded-xl"
            aria-label="Customer status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {loading ? (
        <LoadingState label="Loading customers..." />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<User className="h-5 w-5" />}
          title="No customers found"
          description="Add a customer to track their sales and settlements."
        />
      ) : (
        <>
          <DataList className="lg:hidden">
            {filteredCustomers.map((customer) => {
              const balance = presentCustomerBalance({
                isAvailable: !isFallbackMode,
                legacyReceivable: customer.credit,
              });
              return (
                <ListRow
                  key={customer.id}
                  interactive
                  onClick={() => openDetails(customer.id)}
                  leading={
                    <span className="font-semibold">
                      {customerName(customer).charAt(0)}
                    </span>
                  }
                  title={customerName(customer)}
                  description={contact(customer)}
                  meta={
                    balance.amount === null
                      ? balance.label
                      : `${balance.label} ${formatCurrency(balance.amount, restaurant?.currency)}`
                  }
                />
              );
            })}
          </DataList>

          <DataList className="hidden lg:block">
            {filteredCustomers.map((customer) => {
              const balance = presentCustomerBalance({
                isAvailable: !isFallbackMode,
                legacyReceivable: customer.credit,
              });
              return (
                <ListRow
                  key={customer.id}
                  interactive
                  onClick={() => openDetails(customer.id)}
                  leading={
                    <span className="font-semibold">
                      {customerName(customer).charAt(0)}
                    </span>
                  }
                  title={customerName(customer)}
                  description={contact(customer)}
                  meta={
                    customer.loyalty_points
                      ? `${customer.loyalty_points} loyalty points`
                      : customer.is_active === false
                        ? "Inactive"
                        : "Active"
                  }
                  trailing={
                    <div className="hidden min-w-40 text-right text-xs text-muted-foreground lg:block">
                      {balance.amount === null
                        ? balance.label
                        : `${balance.label} ${formatCurrency(balance.amount, restaurant?.currency)}`}
                    </div>
                  }
                />
              );
            })}
          </DataList>
        </>
      )}

      <MobileCreateFab
        label="Add customer"
        onClick={() => setAddCustomerOpen(true)}
      />
      <AddCustomerDialog
        hideTrigger
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onCustomerAdded={fetchCustomers}
      />
    </AppPage>
  );
}
