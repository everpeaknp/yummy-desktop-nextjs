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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  selection_type: z.enum(["single", "multiple"]),
  is_required: z.boolean().default(false),
  min_selections: z.coerce.number().min(0).default(0),
  max_selections: z.preprocess(
    (val) => (val === "" || val === null ? null : Number(val)),
    z.number().min(1).nullable().default(1),
  ),
});

export type ModifierGroupFormValues = z.infer<typeof formSchema>;

export interface ModifierGroup {
  id: number;
  name: string;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
}

interface ModifierGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ModifierGroupFormValues) => Promise<void>;
  initialData?: ModifierGroup | null;
}

export function ModifierGroupDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: ModifierGroupDialogProps) {
  const form = useForm<ModifierGroupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      selection_type: "single",
      is_required: false,
      min_selections: 0,
      max_selections: 1,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        selection_type: initialData.selection_type as "single" | "multiple",
        is_required: initialData.is_required,
        min_selections: initialData.min_selections,
        max_selections: initialData.max_selections,
      });
    } else {
      form.reset({
        name: "",
        selection_type: "single",
        is_required: false,
        min_selections: 0,
        max_selections: 1,
      });
    }
  }, [initialData, form, open]);

  const handleSubmit = async (values: ModifierGroupFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit option group" : "Create option group"}
          </DialogTitle>
          <DialogDescription>
            Define how customers select options (e.g., &quot;Choose 1&quot; or
            &quot;Choose up to 3&quot;).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Option group name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Size, Extra toppings" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 border-t pt-5">
              <p className="text-sm font-medium text-foreground">
                Selection rules
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="selection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selection Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">
                            Single Select (Choose 1)
                          </SelectItem>
                          <SelectItem value="multiple">
                            Multi Select (Choose Many)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Determines if the customer can pick one or multiple
                        options.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_required"
                  render={({ field }) => (
                    <FormItem className="flex min-h-11 flex-row items-center justify-between rounded-xl border px-3 py-2.5">
                      <div className="space-y-0.5 pr-3">
                        <FormLabel>Required</FormLabel>
                        <FormDescription>
                          Customers must make a choice before adding the item.
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="min_selections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Selections</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_selections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Selections</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>Leave empty for unlimited</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {initialData ? "Save Changes" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
