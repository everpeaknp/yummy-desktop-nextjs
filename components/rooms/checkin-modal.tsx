import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { type TableData } from "@/components/tables/room-container";

interface CheckinModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: TableData | null;
  restaurantId: number | undefined;
  onSuccess: () => void;
  onEditRoomRequested?: (room: TableData) => void;
}

export function CheckinModal({
  isOpen,
  onOpenChange,
  room,
  restaurantId,
  onSuccess,
  onEditRoomRequested,
}: CheckinModalProps) {
  const [stayNights, setStayNights] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pricePerNight, setPricePerNight] = useState("0");
  const [saving, setSaving] = useState(false);

  // Reset state when opening for a new room
  useEffect(() => {
    if (isOpen && room) {
      setStayNights("1");
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setPricePerNight(room.price_per_night?.toString() || "0");
    }
  }, [isOpen, room]);

  const handleCheckin = async () => {
    if (!room || !restaurantId) return;
    setSaving(true);
    try {
      await apiClient.post(OrderApis.checkinRoom, {
        restaurant_id: restaurantId,
        table_id: room.id,
        stay_nights: parseInt(stayNights) || 1,
        customer_name: customerName,
        customer_phone: customerPhone,
        notes: notes,
        price_per_night: parseFloat(pricePerNight) || 0,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Checkin failed:", err);
      alert(err?.response?.data?.detail || "Failed to check in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in: {room?.table_name}</DialogTitle>
          <DialogDescription>
            Enter guest details to start the room folio.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Guest Name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="grid gap-2">
            <Label>Phone Number</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone"
            />
          </div>
          <div className="flex gap-4">
            <div className="grid gap-2 flex-1">
              <Label>Stay Nights</Label>
              <Input
                type="number"
                min="1"
                value={stayNights}
                onChange={(e) => setStayNights(e.target.value)}
              />
            </div>
            <div className="grid gap-2 flex-1">
              <Label>Nightly Rate</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pricePerNight}
                onChange={(e) => setPricePerNight(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {onEditRoomRequested && (
            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                if (room) onEditRoomRequested(room);
              }}
              disabled={saving}
            >
              Edit Room Details
            </Button>
          )}
          <Button onClick={handleCheckin} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
