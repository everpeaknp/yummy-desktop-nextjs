"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().gt(0, "Value must be greater than 0"),
  min_order_amount: z.coerce.number().optional().default(0),
  max_discount_amount: z.coerce.number().optional().default(0),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

interface Discount {
  id: number;
  name: string;
  code?: string;
  type: string;
  value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: z.infer<typeof formSchema>) => Promise<void>;
  initialData?: Discount | null;
}

export function DiscountDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: DiscountDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "percentage",
      value: 0,
      min_order_amount: 0,
      max_discount_amount: 0,
      valid_from: "",
      valid_until: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        code: initialData.code || "",
        type: initialData.type as any,
        value: Number(initialData.value),
        min_order_amount: Number(initialData.min_order_amount || 0),
        max_discount_amount: Number(initialData.max_discount_amount || 0),
        valid_from: initialData.valid_from ? format(new Date(initialData.valid_from), "yyyy-MM-dd'T'HH:mm") : "",
        valid_until: initialData.valid_until ? format(new Date(initialData.valid_until), "yyyy-MM-dd'T'HH:mm") : "",
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
        valid_from: "",
        valid_until: "",
        is_active: true,
      });
    }
  }, [initialData, form, open]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    // Convert empty strings to null for backend
    const payload = {
      ...values,
      valid_from: values.valid_from || null,
      valid_until: values.valid_until || null,
    };
    await onSubmit(payload as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Discount" : "Add Discount"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update your discount details here."
              : "Create a new discount code or offer for your customers."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Summer Special" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SUMMER20" {...field} />
                    </FormControl>
                    <FormDescription>Leave blank for automatic application.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Discount Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_order_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Order Amount</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="max_discount_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Discount Amount</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>0 for no limit.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid From</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} value={field.value || ""} />
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
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {initialData ? "Save Changes" : "Create Discount"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
