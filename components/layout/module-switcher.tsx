"use client";

import { useRestaurant } from "@/hooks/use-restaurant";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Bed, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ModuleSwitcher() {
  const { restaurant, selectedModule, setSelectedModule } = useRestaurant();
  const router = useRouter();

  if (!restaurant || (!restaurant.hotel_enabled && !restaurant.restaurant_enabled)) {
    return null;
  }

  // If only one is enabled, don't show switcher
  if (restaurant.hotel_enabled !== restaurant.restaurant_enabled) {
    return null;
  }

  const handleSwitch = (module: 'restaurant' | 'hotel') => {
    setSelectedModule(module);
    if (module === 'restaurant') {
      router.push('/dashboard');
    } else {
      router.push('/rooms');
    }
  };

  const isRestaurant = selectedModule === 'restaurant';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-8 gap-2 px-3 transition-all duration-300 rounded-full border-2",
            isRestaurant 
              ? "border-orange-500/20 hover:border-orange-500/40 bg-orange-500/5 text-orange-600" 
              : "border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5 text-blue-600"
          )}
        >
          {isRestaurant ? (
            <>
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Restaurant</span>
            </>
          ) : (
            <>
              <Bed className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Hotel</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px] p-1.5 rounded-xl border-2">
        <DropdownMenuItem 
          onClick={() => handleSwitch('restaurant')}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
            isRestaurant ? "bg-orange-500/10 text-orange-600 font-bold" : "hover:bg-muted"
          )}
        >
          <UtensilsCrossed className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Restaurant POS</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleSwitch('hotel')}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mt-1",
            !isRestaurant ? "bg-blue-500/10 text-blue-600 font-bold" : "hover:bg-muted"
          )}
        >
          <Bed className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Hotel Management</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
