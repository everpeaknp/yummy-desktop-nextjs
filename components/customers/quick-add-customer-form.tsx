"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import apiClient from "@/lib/api-client";
import { CustomerApis, GrowthApis } from "@/lib/api/endpoints";
import {
  customerPanValidationMessage,
  optionalCustomerText,
} from "@/lib/customer-fiscal";

// WhatsApp Icon Component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

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
    whatsapp: false,
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
        if (customerId && (marketingConsent.email || marketingConsent.whatsapp)) {
          try {
            console.log("Capturing marketing consent for customer:", customerId, {
              email: marketingConsent.email,
              whatsapp: marketingConsent.whatsapp,
              restaurantId
            });
            
            const consentResponse = await apiClient.post(
              GrowthApis.staffConsentCapture,
              {},
              {
                params: {
                  customer_id: customerId,
                  email_opted_in: marketingConsent.email,
                  whatsapp_opted_in: marketingConsent.whatsapp,
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
        setMarketingConsent({ email: false, whatsapp: false });
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
                      checked={marketingConsent.whatsapp}
                      onChange={(e) => setMarketingConsent(prev => ({ ...prev, whatsapp: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <WhatsAppIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">WhatsApp</span>
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
