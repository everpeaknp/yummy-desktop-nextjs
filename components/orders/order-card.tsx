import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order, OrderStatus } from "@/types/order";
import { Clock, Users, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRestaurant } from "@/hooks/use-restaurant";

interface OrderCardProps {
  order: Order;
  onAction?: (action: string, orderId: number) => void;
}

const statusColorMap: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  pending: "secondary",
  running: "info",
  scheduled: "outline",
  preparing: "warning",
  ready: "success",
  out_for_delivery: "warning",
  ready_for_pickup: "success",
  completed: "default",
  canceled: "destructive",
};

export function OrderCard({ order, onAction }: OrderCardProps) {
  const { restaurant } = useRestaurant();
  const timeAgo = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });

  return (
    <Card className="w-full transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col">
            <CardTitle className="text-base font-bold">
            {order.channel === 'table' ? `Table ${order.table_name}` : `${order.channel.replace('_', ' ').toUpperCase()} #${order.restaurant_order_id || order.id}`}
            </CardTitle>
            <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeAgo}
            </span>
        </div>
        <Badge variant={statusColorMap[order.status]}>
          {order.status.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
             {order.number_of_guests && (
                <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {order.number_of_guests} Guests
                </div>
             )}
        </div>
        <div className="space-y-1">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="flex gap-2">
                <span className="font-medium text-primary">x{item.quantity}</span>
                <span>{item.item_name}</span>
              </span>
              <span>{restaurant?.currency || "$"}{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-xs text-muted-foreground pt-1">+ {order.items.length - 3} more items...</p>
          )}
        </div>
        
        <div className="mt-4 pt-2 border-t flex justify-between items-center font-bold">
            <span>Total</span>
            <span className="text-lg">{restaurant?.currency || "$"}{order.grand_total.toLocaleString()}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex gap-2">
        <Button 
            className="w-full" 
            size="sm" 
            variant="outline"
            onClick={() => onAction?.('view', order.id)}
        >
            View Details
        </Button>
        <Button 
            className="w-full bg-primary text-white hover:bg-primary/90" 
            size="sm"
            onClick={() => onAction?.('process', order.id)}
        >
            Process <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}
