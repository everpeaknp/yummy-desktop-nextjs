"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import apiClient from "@/lib/api-client";
import { CustomerApis, GrowthApis } from "@/lib/api/endpoints";
import {
  customerPanValidationMessage,
  optionalCustomerText,
} from "@/lib/customer-fiscal";

interface QuickAddCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerAdded: (customerId?: number) => void;
  restaurantId: number;
}

export function QuickAddCustomerForm({ 
  open, 
  onOpenChange, 
  onCustomerAdded,
  restaurantId 
}: QuickAddCustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    business_name: "",
    pan_number: "",
    billing_address: "",
  });

  const [marketingConsent, setMarketingConsent] = useState({
    email: false,
    sms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    
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
        restaurant_id: restaurantId,
        is_active: true
      };

      const res = await apiClient.post(CustomerApis.createCustomer, payload);
      if (res.data.status === "success") {
        const customerId = res.data.data?.id;
        
        // Capture marketing consent if customer was created successfully
        if (customerId && (marketingConsent.email || marketingConsent.sms)) {
          try {
            console.log("Capturing marketing consent for customer:", customerId, {
              email: marketingConsent.email,
              sms: marketingConsent.sms,
              restaurantId
            });
            
            const consentResponse = await apiClient.post(
              GrowthApis.staffConsentCapture,
              {},
              {
                params: {
                  customer_id: customerId,
                  email_opted_in: marketingConsent.email,
                  sms_opted_in: marketingConsent.sms,
                  restaurant_id: restaurantId,
                },
              }
            );
            
            console.log("Marketing consent captured successfully:", consentResponse.data);
          } catch (consentError: any) {
            console.error("Failed to capture marketing consent:", {
              error: consentError,
              response: consentError?.response?.data,
              status: consentError?.response?.status,
            });
            // Don't block customer creation if consent capture fails
          }
        }
        
        onOpenChange(false);
        setFormData({
          name: "",
          phone: "",
          email: "",
          business_name: "",
          pan_number: "",
          billing_address: "",
        });
        setMarketingConsent({ email: false, sms: false });
        onCustomerAdded(customerId);
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
        onOpenChange(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Quick Add Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive mb-4">
              {error}
            </p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Info & Marketing */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="qa-name">Full Name</Label>
                <Input
                  id="qa-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qa-phone">Phone Number</Label>
                <div className="phone-input-field">
                  <PhoneInput
                    id="qa-phone"
                    international
                    defaultCountry="NP"
                    value={formData.phone}
                    onChange={(value) => setFormData(prev => ({ ...prev, phone: value || "" }))}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qa-email">Email (Optional)</Label>
                <Input
                  id="qa-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                />
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-3 text-sm font-semibold">
                  Marketing Offers (Optional)
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Ask customer: "Would you like to receive special offers?"
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingConsent.email}
                      onChange={(e) => setMarketingConsent(prev => ({ ...prev, email: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingConsent.sms}
                      onChange={(e) => setMarketingConsent(prev => ({ ...prev, sms: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">SMS</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column - Business Billing */}
            <div className="rounded-lg border p-4">
              <p className="mb-4 text-sm font-semibold">
                Business billing (optional)
              </p>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qa-business-name">Business Name</Label>
                  <Input
                    id="qa-business-name"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleChange}
                    placeholder="Customer business or legal name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qa-pan-number">PAN Number</Label>
                  <Input
                    id="qa-pan-number"
                    name="pan_number"
                    inputMode="numeric"
                    maxLength={9}
                    value={formData.pan_number}
                    onChange={handleChange}
                    placeholder="9 digits"
                    aria-describedby="qa-pan-number-help"
                  />
                  <p
                    id="qa-pan-number-help"
                    className="text-xs text-muted-foreground"
                  >
                    Required on the tax invoice when billing a VAT/PAN customer.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qa-billing-address">Billing Address</Label>
                  <Input
                    id="qa-billing-address"
                    name="billing_address"
                    value={formData.billing_address}
                    onChange={handleChange}
                    placeholder="Registered billing address"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
             <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
               {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
               Add Customer
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
