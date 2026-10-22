"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { optionalCustomerText } from "@/lib/customer-fiscal";

export interface EditableCustomer {
  id: number;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface EditCustomerDialogProps {
  customer: EditableCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSaved,
}: EditCustomerDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customer) return;
    setName(customer.full_name || customer.name || "");
    setPhone(customer.phone || "");
    setEmail(customer.email || "");
    setError(null);
  }, [customer, open]);

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customer) return;
    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.patch(
        CustomerApis.updateCustomer(customer.id),
        {
          name: name.trim(),
          phone: optionalCustomerText(phone),
          email: optionalCustomerText(email),
        },
      );
      if (response.data?.status !== "success") {
        throw new Error(response.data?.message || "Failed to update customer.");
      }
      onOpenChange(false);
      onSaved();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.response?.data?.message ||
          requestError?.message ||
          "Failed to update customer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>
            Update the contact details used by this restaurant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveCustomer} className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="edit-customer-name">Name</Label>
            <Input
              id="edit-customer-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-customer-phone">Phone</Label>
              <Input
                id="edit-customer-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-customer-email">Email</Label>
              <Input
                id="edit-customer-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
