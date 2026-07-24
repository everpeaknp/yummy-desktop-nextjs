"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import {
  customerPanValidationMessage,
  optionalCustomerText,
} from "@/lib/customer-fiscal";

interface AddCustomerDialogProps {
  onCustomerAdded: () => void;
}

export function AddCustomerDialog({ onCustomerAdded }: AddCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuth((state) => state.user);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    business_name: "",
    pan_number: "",
    billing_address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;
    const panError = customerPanValidationMessage(formData.pan_number);
    if (panError) {
      setError(panError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: optionalCustomerText(formData.email),
        business_name: optionalCustomerText(formData.business_name),
        pan_number: optionalCustomerText(formData.pan_number),
        billing_address: optionalCustomerText(formData.billing_address),
        restaurant_id: user.restaurant_id,
        is_active: true
      };

      const res = await apiClient.post(CustomerApis.createCustomer, payload);
      if (res.data.status === "success") {
        setOpen(false);
        setFormData({
          name: "",
          phone: "",
          email: "",
          business_name: "",
          pan_number: "",
          billing_address: "",
        });
        onCustomerAdded();
      }
    } catch (requestError: any) {
      console.error("Failed to create customer:", requestError);
      setError(
        requestError?.response?.data?.detail ||
          requestError?.response?.data?.message ||
          "Failed to create customer.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+977 98..."
              required
            />
          </div>
          <div className="grid gap-2">
             <Label htmlFor="email">Email (Optional)</Label>
             <Input
               id="email"
               name="email"
               type="email"
               value={formData.email}
               onChange={handleChange}
               placeholder="john@example.com"
             />
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-4 text-sm font-semibold">
              Business billing (optional)
            </p>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  placeholder="Customer business or legal name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pan_number">PAN Number</Label>
                <Input
                  id="pan_number"
                  name="pan_number"
                  inputMode="numeric"
                  maxLength={9}
                  value={formData.pan_number}
                  onChange={handleChange}
                  placeholder="9 digits"
                  aria-describedby="pan-number-help"
                />
                <p
                  id="pan-number-help"
                  className="text-xs text-muted-foreground"
                >
                  Required on the tax invoice when billing a VAT/PAN customer.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="billing_address">Billing Address</Label>
                <Input
                  id="billing_address"
                  name="billing_address"
                  value={formData.billing_address}
                  onChange={handleChange}
                  placeholder="Registered billing address"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
               {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
               Create Customer
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
