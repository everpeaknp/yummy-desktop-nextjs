"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, Percent, DollarSign } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { addExternalPromoCode } from "@/lib/promo-storage";

interface AddExternalPromoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddExternalPromoDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddExternalPromoDialogProps) {
  const [promoCode, setPromoCode] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promoCode.trim()) {
      toast({
        title: "Code required",
        description: "Please enter the promo code.",
        variant: "destructive",
      });
      return;
    }

    if (!restaurantName.trim()) {
      toast({
        title: "Restaurant name required",
        description: "Please enter the restaurant name.",
        variant: "destructive",
      });
      return;
    }

    if (!discountValue || parseFloat(discountValue) <= 0) {
      toast({
        title: "Invalid discount",
        description: "Please enter a valid discount value.",
        variant: "destructive",
      });
      return;
    }

    if (!expiryDate) {
      toast({
        title: "Expiry date required",
        description: "Please select an expiry date.",
        variant: "destructive",
      });
      return;
    }

    if (discountType === "percentage" && parseFloat(discountValue) > 100) {
      toast({
        title: "Invalid percentage",
        description: "Percentage discount cannot exceed 100%.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      addExternalPromoCode({
        code: promoCode.trim().toUpperCase(),
        restaurantName: restaurantName.trim(),
        discountType,
        discountValue: parseFloat(discountValue),
        expiryDate: expiryDate.toISOString(),
        restaurantId: `ext_${restaurantName.toLowerCase().replace(/\s+/g, "_")}`,
      });

      toast({
        title: "Promo code saved!",
        description: `${promoCode.toUpperCase()} from ${restaurantName} has been added to your collection.`,
      });

      // Reset form
      setPromoCode("");
      setRestaurantName("");
      setDiscountValue("");
      setExpiryDate(undefined);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to save promo code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Promo Code</DialogTitle>
          <DialogDescription>
            Save a promo code from another restaurant
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promo-code">Promo Code</Label>
              <Input
                id="promo-code"
                placeholder="e.g., WELCOME20"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Restaurant Name</Label>
              <Input
                id="restaurant-name"
                placeholder="e.g., Pizza Palace"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-type">Discount Type</Label>
              <Select
                value={discountType}
                onValueChange={(v: "percentage" | "fixed") => setDiscountType(v)}
              >
                <SelectTrigger id="discount-type" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Percentage
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Fixed Amount
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-value">
                Discount Value {discountType === "percentage" ? "(%)" : "(Rs.)"}
              </Label>
              <Input
                id="discount-value"
                type="number"
                placeholder={discountType === "percentage" ? "e.g., 20" : "e.g., 100"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="h-11 rounded-xl"
                min="0"
                step={discountType === "percentage" ? "1" : "0.01"}
                max={discountType === "percentage" ? "100" : undefined}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 rounded-xl justify-start text-left font-normal",
                      !expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-11 rounded-xl">
              {loading ? "Saving..." : "Save Code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
