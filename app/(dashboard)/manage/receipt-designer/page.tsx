"use client";

import { useRestaurant } from "@/hooks/use-restaurant";
import { ReceiptDesigner } from "@/components/manage/settings/receipt-designer";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";

export default function ReceiptDesignerPage() {
    const { restaurant, loading } = useRestaurant();
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
                        const receiptTemplate = response.data.data?.receipt_template;
                        setTemplate(receiptTemplate || []);
                    }
                })
                .catch(error => {
                    console.error('❌ [Receipt Designer Page] Failed to fetch templates:', error);
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
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* Minimal Header */}
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.push('/manage/additional-settings')}
                        className="rounded-full h-8 w-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-black tracking-tight uppercase italic">Receipt Designer</h1>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Immersive Layout Workspace</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-6">
                <ReceiptDesigner 
                    restaurantId={restaurant.id} 
                    initialTemplate={template} 
                />
            </div>
        </div>
    );
}
