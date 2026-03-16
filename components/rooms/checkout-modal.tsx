import { useRouter } from "next/navigation";
import { Loader2, Bed, Utensils } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type TableData } from "@/components/tables/room-container";

interface CheckoutModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: TableData | null;
  onSuccess: () => void;
  onEditRoomRequested?: (room: TableData) => void;
}

export function CheckoutModal({
  isOpen,
  onOpenChange,
  room,
  onSuccess,
  onEditRoomRequested,
}: CheckoutModalProps) {
  const router = useRouter();

  const handleCheckout = () => {
    if (!room || !room.active_order_ids?.length) {
      alert("No active order found for this room.");
      return;
    }
    const orderId = room.active_order_ids[0];
    onOpenChange(false);
    
    // Check if we are physically on the /rooms/checkin page to return there,
    // otherwise return to the floorplan /rooms
    const returnTo = window.location.pathname.includes('/rooms/checkin') ? '/rooms/checkin' : '/rooms';
    router.push(`/orders/${orderId}/checkout?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage: {room?.table_name}</DialogTitle>
          <DialogDescription>
            Room is currently occupied.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex flex-col items-center justify-center space-y-4">
          <Bed className="w-16 h-16 text-blue-500" />
          <div className="text-center">
            <h3 className="text-lg font-medium">Folio Active</h3>
            <p className="text-sm text-muted-foreground">
              Add incidental charges or meals to this room's folio.
            </p>
          </div>
          <Button 
            className="w-full gap-2 rounded-xl h-11 bg-orange-600 hover:bg-orange-700 font-bold"
            onClick={() => {
              const orderId = room?.active_order_ids?.[0];
              onOpenChange(false);
              router.push(`/orders/${orderId}/edit`);
            }}
          >
            <Utensils className="h-4 w-4" /> Place Order / Add Item
          </Button>
        </div>
        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <div className="flex gap-2">
            {onEditRoomRequested && (
              <Button
                variant="secondary"
                onClick={() => {
                  onOpenChange(false);
                  if (room) onEditRoomRequested(room);
                }}
              >
                Edit Room Details
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleCheckout}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Review Bill & Check-out
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
