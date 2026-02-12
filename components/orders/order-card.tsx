import { Badge } from "@/components/ui/badge";
import { Order, OrderStatus } from "@/types/order";
import { Clock, Utensils, Hash, MapPin, ShoppingBag, Zap, Calendar, Truck, User, ArrowRight } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
}

export const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  switch (s) {
    case 'pending': return 'bg-blue-500 border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400';
    case 'confirmed': return 'bg-blue-600 border-blue-200 text-blue-700 dark:border-blue-900/50 dark:text-blue-400';
    case 'preparing': return 'bg-amber-500 border-amber-200 text-amber-600 dark:border-amber-900/50 dark:text-amber-400';
    case 'ready': return 'bg-emerald-500 border-emerald-200 text-emerald-600 dark:border-emerald-900/50 dark:text-emerald-400';
    case 'completed': return 'bg-gray-500 border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400';
    case 'canceled': return 'bg-red-500 border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400';
    default: return 'bg-gray-500 border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400';
  }
};

export const getStatusBadgeColor = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'pending': return 'bg-blue-500 text-white';
      case 'confirmed': return 'bg-blue-600 text-white';
      case 'preparing': return 'bg-amber-500 text-white';
      case 'ready': return 'bg-emerald-500 text-white';
      case 'completed': return 'bg-gray-500 text-white';
      case 'canceled': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

export const getChannelIcon = (channel: string) => {
  switch (channel.toLowerCase()) {
    case 'table': return MapPin;
    case 'pickup': return ShoppingBag;
    case 'quick_billing': return Zap;
    case 'delivery': return Truck;
    case 'reservation': return Calendar;
    default: return Hash;
  }
};

export function OrderCard({ order, onClick }: OrderCardProps) {
  const { restaurant } = useRestaurant();
  const statusClass = getStatusColor(order.status);
  const badgeClass = getStatusBadgeColor(order.status);
  const ChannelIcon = getChannelIcon(order.channel);
  
  // Format Title
  let title = `Order #${order.restaurant_order_id || order.id}`;
  if (order.table_name) {
    title = order.table_category_name 
      ? `${order.table_category_name} - ${order.table_name}`
      : order.table_name;
  }

  // Format Subtitle
  let subtitle = order.channel.toUpperCase().replace('_', ' ');
  if (order.channel === 'table') subtitle = 'DINE-IN';
  if (order.table_name && order.channel === 'quick_billing') subtitle = 'QUICK BILL'; // Fallback
  
  const customerInfo = order.customer_name || (order.channel === 'table' ? 'Guest' : 'Walk-in');

  // Time
  const timeLabel = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const itemsCount = order.items.reduce((acc, item) => acc + item.qty, 0);

  // Extract just the left border color for the card container style
  const s = order.status.toLowerCase();
  const leftBorderColor = 
      s === 'pending' ? 'border-l-blue-500' :
      s === 'confirmed' ? 'border-l-blue-600' :
      s === 'preparing' ? 'border-l-amber-500' :
      s === 'ready' ? 'border-l-emerald-500' :
      s === 'completed' ? 'border-l-gray-500' : 
      s === 'canceled' ? 'border-l-red-500' : 'border-l-gray-400';

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-xl border shadow-sm transition-all hover:shadow-md cursor-pointer overflow-hidden border-l-[4px]",
        leftBorderColor
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header Row */}
        <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                     <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", badgeClass)}>
                        {order.status}
                     </span>
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeLabel}
                     </span>
                </div>
                <h3 className="font-bold text-base text-foreground leading-tight truncate pr-2">
                    {title}
                </h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ChannelIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        </div>

        {/* Customer & Type */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium border-t border-dashed border-border/60 pt-2.5">
            <div className="flex items-center gap-1.5 min-w-0 max-w-[50%]">
                <User className="h-3.5 w-3.5" />
                <span className="truncate">{customerInfo}</span>
            </div>
            <div className="h-3 w-[1px] bg-border" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="uppercase tracking-wider text-[10px] font-bold">{subtitle}</span>
            </div>
        </div>

        {/* Footer: Items & Total */}
        <div className="flex items-center justify-between pt-2 mt-1">
             <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                 <Utensils className="h-3.5 w-3.5" />
                 <span>{itemsCount} items</span>
             </div>
             <div className="flex items-center gap-1 text-sm font-black text-foreground">
                  <span className="text-xs font-bold text-muted-foreground/70 uppercase mr-1">Total</span>
                  {restaurant?.currency || "Rs."} {order.grand_total.toLocaleString()}
             </div>
        </div>
      </div>
    
      {/* Hover Effect: Subtle Highlight */}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/[0.02] transition-colors pointer-events-none" />
    </div>
  );
}
