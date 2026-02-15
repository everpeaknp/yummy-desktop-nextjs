"use client";

import { useState } from "react";
import { 
    Download, 
    FileJson, 
    FileText, 
    Loader2, 
    Database, 
    Users, 
    ShoppingBag, 
    Menu as MenuIcon,
    ArrowRight,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { MenuApis, OrderApis, AdminManagementApis } from "@/lib/api/endpoints";

interface DataExporterProps {
    restaurantId: number;
}

export function DataExporter({ restaurantId }: DataExporterProps) {
    const [exporting, setExporting] = useState<string | null>(null);

    const downloadFile = (data: any, filename: string, type: 'json' | 'csv') => {
        let blob;
        if (type === 'json') {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        } else {
            // Very basic CSV conversion
            if (!Array.isArray(data) || data.length === 0) return;
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
            blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${type}`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleExport = async (type: 'menu' | 'orders' | 'staff', format: 'json' | 'csv') => {
        try {
            setExporting(`${type}-${format}`);
            let data: any[] = [];
            let endpoint = "";

            switch (type) {
                case 'menu':
                    endpoint = MenuApis.getMenusByRestaurant(restaurantId);
                    break;
                case 'orders':
                    endpoint = OrderApis.ordersSummaryPaginated({ restaurantId, limit: 1000 });
                    break;
                case 'staff':
                    endpoint = AdminManagementApis.restaurantAdmins(restaurantId);
                    break;
            }

            const response = await apiClient.get(endpoint);
            if (response.data.status === 'success') {
                data = response.data.data;
                downloadFile(data, `${type}_export_${new Date().toISOString().split('T')[0]}`, format);
                toast.success(`${type.toUpperCase()} data exported successfully`);
            }
        } catch (err) {
            toast.error(`Failed to export ${type} data`);
        } finally {
            setExporting(null);
        }
    };

    const exportOptions = [
        {
            id: 'menu',
            title: 'Menu Items',
            description: 'Full list of categories, items, and pricing',
            icon: MenuIcon,
            color: 'text-orange-500',
            bg: 'bg-orange-50 dark:bg-orange-900/20'
        },
        {
            id: 'orders',
            title: 'Recent Orders',
            description: 'Last 1000 orders with totals and status',
            icon: ShoppingBag,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20'
        },
        {
            id: 'staff',
            title: 'Staff Registry',
            description: 'List of administrators and identifiers',
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/20'
        }
    ];

    return (
        <div className="space-y-6 py-4">
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-500/20">
                <Database className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-tight text-blue-700 dark:text-blue-400">Data Portability</p>
                    <p className="text-[10px] text-blue-600/70 font-medium">Export your restaurant records for backups or external analysis.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {exportOptions.map((opt) => (
                    <Card key={opt.id} className="border-border/40 overflow-hidden group">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${opt.bg} ${opt.color}`}>
                                <opt.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm uppercase tracking-tight">{opt.title}</h4>
                                <p className="text-[10px] text-muted-foreground font-medium opacity-60 leading-tight">{opt.description}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-9 text-[10px] font-bold uppercase tracking-widest px-4"
                                    onClick={() => handleExport(opt.id as any, 'json')}
                                    disabled={!!exporting}
                                >
                                    {exporting === `${opt.id}-json` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5 mr-1.5" />}
                                    JSON
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 text-[10px] font-bold uppercase tracking-widest px-4 border-border/40"
                                    onClick={() => handleExport(opt.id as any, 'csv')}
                                    disabled={!!exporting}
                                >
                                    {exporting === `${opt.id}-csv` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                                    CSV
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground font-medium italic opacity-40">
                    * Large datasets may take a few seconds to process.
                </p>
            </div>
        </div>
    );
}
