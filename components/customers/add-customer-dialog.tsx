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

interface AddCustomerDialogProps {
  onCustomerAdded: () => void;
}

export function AddCustomerDialog({ onCustomerAdded }: AddCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = useAuth((state) => state.user);
  
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurant_id) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        restaurant_id: user.restaurant_id,
        is_active: true
      };

      const res = await apiClient.post(CustomerApis.createCustomer, payload);
      if (res.data.status === "success") {
        setOpen(false);
        setFormData({ full_name: "", phone: "", email: "" });
        onCustomerAdded();
      }
    } catch (error) {
      console.error("Failed to create customer:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              value={formData.full_name}
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
