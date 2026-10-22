"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Edit, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import apiClient from "@/lib/api-client";
import { DiscountApis } from "@/lib/api/endpoints";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DiscountDialog } from "@/components/discounts/discount-dialog";
import {
  discountApplicabilityLabel,
  discountTypeLabel,
  discountValueLabel,
  type DiscountRecord,
} from "@/components/discounts/discount-presentation";
import { SearchField } from "@/components/patterns/controls/search-field";
import { MobileRegisterToolbar } from "@/components/patterns/controls/mobile-register-toolbar";
import { MobileCreateFab } from "@/components/patterns/actions/mobile-create-fab";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRecord | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] =
    useState<DiscountRecord | null>(null);
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const restaurant = useRestaurant((state) => state.restaurant);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  const fetchDiscounts = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        DiscountApis.listDiscountsForRestaurant(user.restaurant_id),
      );
      if (response.data.status === "success") {
        setDiscounts(response.data.data.discounts || response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch discounts:", error);
      toast({
        title: "Error",
        description: "Failed to load discounts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) fetchDiscounts();
  }, [fetchDiscounts, user?.restaurant_id]);

  const handleCreate = async (data: Omit<DiscountRecord, "id">) => {
    if (!user?.restaurant_id) return;
    try {
      await apiClient.post(DiscountApis.createDiscount, {
        ...data,
        restaurant_id: user.restaurant_id,
      });
      toast({ title: "Discount created" });
      fetchDiscounts();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Failed to create discount.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: Omit<DiscountRecord, "id">) => {
    if (!editingDiscount) return;
    try {
      await apiClient.patch(
        DiscountApis.updateDiscount(editingDiscount.id),
        data,
      );
      toast({ title: "Discount updated" });
      fetchDiscounts();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Failed to update discount.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!discountToDelete) return;
    try {
      await apiClient.delete(DiscountApis.deleteDiscount(discountToDelete.id));
      toast({ title: "Discount deleted" });
      fetchDiscounts();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete discount.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDiscountToDelete(null);
    }
  };

  const filteredDiscounts = discounts.filter((discount) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [discount.name, discount.code, discount.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? discount.is_active !== false
        : discount.is_active === false);
    return matchesSearch && matchesStatus;
  });

  const openCreateDialog = () => {
    setEditingDiscount(null);
    setDialogOpen(true);
  };

  return (
    <AppPage width="standard">
      <PageHeader
        className="hidden lg:flex"
        title="Discounts"
        description="Configure customer offers, eligibility, and pricing rules."
        actions={
          <Button onClick={openCreateDialog} className="h-11 rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> New discount
          </Button>
        }
      />

      <MobileRegisterToolbar
        search={
          <SearchField
            placeholder="Search discounts"
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
                  htmlFor="discount-status-filter-mobile"
                >
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger
                    id="discount-status-filter-mobile"
                    className="h-11 rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All discounts</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        }
      />

      <FilterBar className="hidden lg:block" responsiveAt="lg">
        <SearchField
          containerClassName="max-w-sm"
          placeholder="Search discounts"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="h-11 w-44 rounded-xl"
            aria-label="Discount status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All discounts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {loading ? (
        <LoadingState label="Loading discounts..." />
      ) : filteredDiscounts.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-5 w-5" />}
          title={
            discounts.length
              ? "No discounts match these filters"
              : "No discounts yet"
          }
          description={
            discounts.length
              ? "Try another name, code, or status."
              : "Create an offer for all menu items, selected items, or categories."
          }
          actionLabel={discounts.length ? undefined : "New discount"}
          onAction={discounts.length ? undefined : openCreateDialog}
        />
      ) : (
        <DataList>
          {filteredDiscounts.map((discount) => {
            const period = discount.valid_until
              ? `Ends ${formatDate(discount.valid_until)}`
              : "No end date";
            return (
              <ListRow
                key={discount.id}
                interactive
                onClick={() => {
                  setEditingDiscount(discount);
                  setDialogOpen(true);
                }}
                leading={<Tag className="h-4 w-4" />}
                title={discount.name}
                description={`${discount.code ? `Code: ${discount.code}` : "Automatic"} · ${discountApplicabilityLabel(discount)} · ${period}`}
                meta={
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        discount.is_active === false ? "outline" : "secondary"
                      }
                    >
                      {discount.is_active === false ? "Inactive" : "Active"}
                    </Badge>
                    <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                      {discountValueLabel(discount, restaurant?.currency)}
                    </span>
                  </div>
                }
                trailing={
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-xl"
                      aria-label={`Edit ${discount.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingDiscount(discount);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-xl text-destructive hover:text-destructive"
                      aria-label={`Delete ${discount.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDiscountToDelete(discount);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            );
          })}
        </DataList>
      )}

      <MobileCreateFab label="New discount" onClick={openCreateDialog} />

      <DiscountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={editingDiscount ? handleUpdate : handleCreate}
        initialData={editingDiscount}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete discount?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes
              <span className="font-semibold text-foreground">
                {` ${discountToDelete?.name || "this discount"}`}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}
