"use client";

import { useRestaurant } from "@/hooks/use-restaurant";
import { KOTDesigner } from "@/components/manage/settings/kot-designer";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";

export default function KOTDesignerPage() {
    const restaurant = useRestaurant((s) => s.restaurant);
    const loading = useRestaurant((s) => s.loading);
    const router = useRouter();
    const [template, setTemplate] = useState<any[] | undefined>(undefined);
    const [templateLoading, setTemplateLoading] = useState(true);

    // Fetch templates from the correct endpoint
    useEffect(() => {
        if (restaurant?.id) {
            setTemplateLoading(true);
            apiClient.get(`/restaurants/${restaurant.id}/templates`)
                .then(response => {
                    if (response.data.status === 'success') {
                        const kotTemplate = response.data.data?.kot_template;
                        setTemplate(kotTemplate || []);
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch templates:', error);
                    setTemplate([]);
                })
                .finally(() => {
                    setTemplateLoading(false);
                });
        }
    }, [restaurant?.id]);

    if (loading || templateLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground font-bold">Restaurant not found</p>
                <Button onClick={() => router.push('/manage/additional-settings')}>
                    Back to Settings
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="min-h-0 flex-1 p-4 pb-24 sm:p-6">
                <KOTDesigner 
                    restaurantId={restaurant.id} 
                    initialTemplate={template} 
                />
            </div>
        </div>
    );
}
