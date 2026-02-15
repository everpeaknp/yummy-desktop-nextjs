"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    Building2, 
    Check, 
    Loader2, 
    ExternalLink,
    Store,
    MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { AdminManagementApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface UserRestaurant {
    id: number;
    name: string;
    address: string;
    profile_picture: string | null;
}

export function SwitchRestaurant() {
    const { restaurant: currentRestaurant, setRestaurant } = useRestaurant();
    const [restaurants, setRestaurants] = useState<UserRestaurant[]>([]);
    const [loading, setLoading] = useState(true);
    const [switchingTo, setSwitchingTo] = useState<number | null>(null);
    const router = useRouter();

    const fetchRestaurants = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(AdminManagementApis.userRestaurants);
            if (response.data.status === 'success') {
                setRestaurants(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch restaurants:', err);
            toast.error("Failed to load your restaurants");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

    const handleSwitch = async (targetRestaurant: UserRestaurant) => {
        if (targetRestaurant.id === currentRestaurant?.id) return;
        
        try {
            setSwitchingTo(targetRestaurant.id);
            // In a real app, switching might involve a backend call to set session or just updating local state/context
            // and refreshing data.
            
            // For now, we update the Zustand store which holds the current restaurant
            // @ts-ignore
            setRestaurant(targetRestaurant);
            
            toast.success(`Switched to ${targetRestaurant.name}`);
            
            // Redirect to dashboard to reload all data
            setTimeout(() => {
                window.location.href = '/manage';
            }, 500);
        } catch (err) {
            toast.error("Failed to switch restaurant");
        } finally {
            setSwitchingTo(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Loading restaurants...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground font-medium px-1">
                Select a restaurant to manage. Your current active restaurant is highlighted.
            </p>

            <div className="grid grid-cols-1 gap-3">
                {restaurants.map((res) => (
                    <button 
                        key={res.id}
                        className="group text-left w-full"
                        onClick={() => handleSwitch(res)}
                        disabled={switchingTo !== null}
                    >
                        <Card className={cn(
                            "transition-all duration-200 border-border/40 hover:shadow-md",
                            res.id === currentRestaurant?.id ? "ring-2 ring-primary bg-primary/5" : "hover:border-primary/50"
                        )}>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className={cn(
                                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                    res.id === currentRestaurant?.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                )}>
                                    <Store className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold truncate">{res.name}</h3>
                                        {res.id === currentRestaurant?.id && (
                                            <Badge variant="default" className="h-4 text-[9px] px-1.5 font-bold uppercase tracking-wider">
                                                Active
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                                        <MapPin className="w-3 h-3" />
                                        <span className="text-[11px] truncate">{res.address}</span>
                                    </div>
                                </div>
                                {res.id === currentRestaurant?.id ? (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-primary" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {switchingTo === res.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </button>
                ))}
            </div>
        </div>
    );
}

import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
