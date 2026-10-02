"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import apiClient from "@/lib/api-client";
import { ItemCategoryApis, MenuApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { DiscountRecord } from "./discount-presentation";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().gt(0, "Value must be greater than 0"),
  min_order_amount: z.coerce.number().min(0).optional().default(0),
  max_discount_amount: z.coerce.number().min(0).optional().default(0),
  applicable_items: z.array(z.number()).nullable().default(null),
  applicable_categories: z.array(z.number()).nullable().default(null),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  usage_limit: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type DiscountFormValues = z.infer<typeof formSchema>;

interface SelectableMenuItem {
  id: number;
  name: string;
  categoryName?: string;
}

interface SelectableCategory {
  id: number;
  name: string;
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DiscountFormValues) => Promise<void>;
  initialData?: DiscountRecord | null;
}

function dateTimeInputValue(value?: string | null) {
  return value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : "";
}

export function DiscountDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: DiscountDialogProps) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const restaurant = useRestaurant((state) => state.restaurant);
  const [items, setItems] = useState<SelectableMenuItem[]>([]);
  const [categories, setCategories] = useState<SelectableCategory[]>([]);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const form = useForm<DiscountFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "percentage",
      value: 0,
      min_order_amount: 0,
      max_discount_amount: 0,
      applicable_items: null,
      applicable_categories: null,
      valid_from: "",
      valid_until: "",
      usage_limit: null,
      is_active: true,
    },
  });
  const type = form.watch("type");
  const itemIds = form.watch("applicable_items") || [];
  const categoryIds = form.watch("applicable_categories") || [];

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        code: initialData.code || "",
        type: initialData.type,
        value: Number(initialData.value),
        min_order_amount: Number(initialData.min_order_amount || 0),
        max_discount_amount: Number(initialData.max_discount_amount || 0),
        applicable_items: initialData.applicable_items ?? null,
        applicable_categories: initialData.applicable_categories ?? null,
        valid_from: dateTimeInputValue(initialData.valid_from),
        valid_until: dateTimeInputValue(initialData.valid_until),
        usage_limit: initialData.usage_limit ?? null,
        is_active: initialData.is_active ?? true,
      });
    } else {
      form.reset({
        name: "",
        code: "",
        type: "percentage",
        value: 0,
        min_order_amount: 0,
        max_discount_amount: 0,
        applicable_items: null,
        applicable_categories: null,
        valid_from: "",
        valid_until: "",
        usage_limit: null,
        is_active: true,
      });
    }
  }, [form, initialData, open]);

  useEffect(() => {
    if (!open || !restaurantId) return;
    let active = true;
    const loadEligibility = async () => {
      setEligibilityLoading(true);
      try {
        const [categoryResponse, menuResponse] = await Promise.all([
          apiClient.get(ItemCategoryApis.getItemCategories(restaurantId)),
          apiClient.get(MenuApis.getMenusGroupedByRestaurant(restaurantId)),
        ]);
        if (!active) return;
        if (categoryResponse.data.status === "success") {
          setCategories(categoryResponse.data.data || []);
        }
        if (menuResponse.data.status === "success") {
          const menuItems = (menuResponse.data.data || []).flatMap(
            (group: { category_name?: string; items?: SelectableMenuItem[] }) =>
              (group.items || []).map((item) => ({
                ...item,
                categoryName: group.category_name,
              })),
          );
          setItems(menuItems);
        }
      } catch (error) {
        console.error("Failed to load discount eligibility choices", error);
      } finally {
        if (active) setEligibilityLoading(false);
      }
    };
    loadEligibility();
    return () => {
      active = false;
    };
  }, [open, restaurantId]);

  const selectedSummary = useMemo(() => {
    if (!itemIds.length && !categoryIds.length) return "All menu items";
    const parts: string[] = [];
    if (itemIds.length)
      parts.push(`${itemIds.length} item${itemIds.length === 1 ? "" : "s"}`);
    if (categoryIds.length) {
      parts.push(
        `${categoryIds.length} categor${categoryIds.length === 1 ? "y" : "ies"}`,
      );
    }
    return parts.join(" · ");
  }, [categoryIds.length, itemIds.length]);

  const toggleSelection = (
    field: "applicable_items" | "applicable_categories",
    id: number,
    checked: boolean,
  ) => {
    const selected = form.getValues(field) || [];
    form.setValue(
      field,
      checked
        ? [...selected, id]
        : selected.filter((selectedId) => selectedId !== id),
      { shouldDirty: true },
    );
  };

  const handleSubmit = async (values: DiscountFormValues) => {
    await onSubmit({
      ...values,
      code: values.code?.trim() || undefined,
      valid_from: values.valid_from || null,
      valid_until: values.valid_until || null,
      usage_limit: values.usage_limit || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit discount" : "New discount"}
          </DialogTitle>
          <DialogDescription>
            Define the offer, the order conditions, and where it applies.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 py-2"
          >
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Offer details
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Customer-facing name and discount value.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Summer special" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Optional, e.g. SUMMER20"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank for automatic application.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {type === "percentage"
                          ? "Percentage off"
                          : `Amount off (${restaurant?.currency || "NPR"})`}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Eligibility
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedSummary}. Selecting both an item and a category
                  requires both conditions at checkout.
                </p>
              </div>
              {eligibilityLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading menu eligibility…
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormLabel>Categories</FormLabel>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                      {categories.length ? (
                        categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={categoryIds.includes(category.id)}
                              onCheckedChange={(checked) =>
                                toggleSelection(
                                  "applicable_categories",
                                  category.id,
                                  checked === true,
                                )
                              }
                            />
                            <span className="truncate">{category.name}</span>
                          </label>
                        ))
                      ) : (
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                          No categories available.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Specific items</FormLabel>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                      {items.length ? (
                        items.map((item) => (
                          <label
                            key={item.id}
                            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={itemIds.includes(item.id)}
                              onCheckedChange={(checked) =>
                                toggleSelection(
                                  "applicable_items",
                                  item.id,
                                  checked === true,
                                )
                              }
                            />
                            <span className="min-w-0 truncate">
                              {item.name}
                              {item.categoryName ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {item.categoryName}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                          No menu items available.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Order and time rules
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional thresholds and validity period.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="min_order_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Minimum order ({restaurant?.currency || "NPR"})
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Maximum discount ({restaurant?.currency || "NPR"})
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>0 means no cap.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valid_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid from</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid until</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usage_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usage limit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="No limit"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex min-h-11 flex-row items-center justify-between rounded-xl border px-3 py-2.5 sm:mt-6">
                      <div className="space-y-0.5 pr-4">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Available at checkout.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {initialData ? "Save changes" : "Create discount"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
