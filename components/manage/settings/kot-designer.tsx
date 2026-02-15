"use client";

import { useState, useEffect } from "react";
import { 
    Plus, 
    Save, 
    Loader2,
    Eye,
    ChevronUp,
    ChevronDown,
    Trash2,
    Settings,
    UtensilsCrossed,
    Smartphone,
    Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { 
    BlockType, 
    ReceiptBlock, 
    GlobalConfig, 
    BLOCK_METADATA,
    BlockPalette,
    ThermalPreview,
    ConfigPanel 
} from "./designer-components";
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
    global_font_type: 'A',
    global_font_size: 14, // KOTs usually use larger fonts
    line_spacing: 1.5,
    paper_size: '80mm',
    column_capacity: 42
};

const DEFAULT_KOT_BLOCKS: ReceiptBlock[] = [
    { id: 'k1', type: 'text', config: { text: '*** NEW ORDER ***', bold: true, align: 'center', font_size: 18 }, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k2', type: 'divider', config: {}, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k3', type: 'bill_info', config: { show_kot_number: true, show_table: true, show_station: true, kot_label: 'KOT', table_label: 'TABLE' }, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k4', type: 'divider', config: {}, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k5', type: 'items', config: { show_serial: false, show_amount: false, item_label: 'ITEM (MODIFIERS)', qty_label: 'QTY' }, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k6', type: 'divider', config: {}, isVisible: true, showOnBill: true, showOnReceipt: true },
    { id: 'k7', type: 'footer', config: { message: 'STATION: MAIN KITCHEN', align: 'center', bold: true }, isVisible: true, showOnBill: true, showOnReceipt: true },
];

interface KOTDesignerProps {
    restaurantId: number;
    initialTemplate?: any[];
}

export function KOTDesigner({ restaurantId, initialTemplate }: KOTDesignerProps) {
    const { restaurant } = useRestaurant();
    const [blocks, setBlocks] = useState<ReceiptBlock[]>([]);
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialTemplate && Array.isArray(initialTemplate) && initialTemplate.length > 0) {
            const potentialGlobal = initialTemplate.find(b => b.type === 'global_settings');
            if (potentialGlobal) {
                setGlobalConfig({
                    global_font_type: potentialGlobal.global_font_type || 'A',
                    global_font_size: potentialGlobal.global_font_size || 14,
                    line_spacing: potentialGlobal.line_spacing || 1.5,
                    paper_size: potentialGlobal.paper_size || '80mm',
                    column_capacity: potentialGlobal.column_capacity || (potentialGlobal.paper_size === '58mm' ? 32 : 42)
                });
            }

            const mappedBlocks = initialTemplate
                .filter(b => b.type !== 'global_settings')
                .map(b => {
                    // Extract everything into config except meta fields
                    const { id, type, is_visible, isVisible, show_on_bill, show_on_receipt, ...rest } = b;
                    return {
                        id: id || uuidv4(),
                        type: type as BlockType,
                        isVisible: is_visible ?? isVisible ?? true,
                        showOnBill: show_on_bill ?? true,
                        showOnReceipt: show_on_receipt ?? true,
                        config: { ...rest, ...(b.config || {}) }
                    };
                });
            
            setBlocks(mappedBlocks);
        } else {
            setBlocks(DEFAULT_KOT_BLOCKS);
        }
    }, [initialTemplate]);

    const handleAddBlock = (type: BlockType) => {
        if (type === 'global_settings') {
            setSelectedBlockId('global');
            return;
        }
        const newBlock: ReceiptBlock = {
            id: uuidv4(),
            type,
            config: {},
            isVisible: true,
            showOnBill: true,
            showOnReceipt: true
        };
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
        toast.info(`Added ${BLOCK_METADATA[type].title} to KOT`);
    };

    const handleUpdateBlock = (id: string, updates: Partial<ReceiptBlock>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const handleDeleteBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    };

    const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= blocks.length) return;
        
        [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
        setBlocks(newBlocks);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            
            const templateData = [
                {
                    type: 'global_settings',
                    id: 'metadata',
                    ...globalConfig
                },
                ...blocks.map(b => ({
                    id: b.id,
                    type: b.type,
                    is_visible: b.isVisible,
                    isVisible: b.isVisible, // Keep both for safety
                    show_on_bill: b.showOnBill,
                    show_on_receipt: b.showOnReceipt,
                    ...b.config
                }))
            ];

            const response = await apiClient.put(RestaurantApis.updateTemplates(restaurantId), {
                kot_template: templateData
            });

            if (response.data.status === 'success') {
                toast.success("Professional KOT layout saved");
            }
        } catch (err) {
            toast.error("Failed to save KOT template");
        } finally {
            setIsSaving(false);
        }
    };

    const selectedBlock = blocks.find(b => b.id === selectedBlockId);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-background border border-border/40 p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-black uppercase tracking-tight text-orange-600">KOT Designer Pro</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        size="sm" 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] px-6 h-9 transition-all hover:scale-105"
                    >
                        {isSaving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                        Publish KOT Layout
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
                {/* Left Side: Palette */}
                <div className="w-[280px] flex flex-col gap-4">
                    <div className="bg-background border border-border/40 rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-border/40 bg-muted/30">
                            <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">KOT Components</h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-3">
                                <BlockPalette onAdd={handleAddBlock} />
                            </div>
                        </ScrollArea>
                    </div>

                    <Card className="border-border/40 bg-orange-500/5 shadow-none overflow-hidden">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Settings className="w-5 h-5 text-orange-600" />
                            <div className="flex-1">
                                <h4 className="text-[11px] font-black uppercase tracking-widest">Global KOT Setup</h4>
                                <Button 
                                    variant="link" 
                                    className="p-0 h-auto text-[10px] font-black text-orange-600 uppercase"
                                    onClick={() => setSelectedBlockId('global')}
                                >
                                    Font & Paper Size &rarr;
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Center: Preview */}
                <div className="flex-1 bg-muted/40 rounded-xl border border-border/20 flex flex-col relative overflow-hidden shadow-inner p-8">
                    <div className="absolute top-4 left-4 z-10 font-black text-[10px] uppercase bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-border/40">
                        Kitchen Display Mockup
                    </div>

                    <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
                        <ThermalPreview 
                            blocks={blocks} 
                            globalConfig={globalConfig} 
                            mode="kot"
                            selectedId={selectedBlockId}
                            onSelect={setSelectedBlockId}
                            context={{
                                restaurant_name: restaurant?.name,
                                address: restaurant?.address,
                                phone: restaurant?.phone
                            }}
                        />
                    </div>
                </div>

                {/* Right Side: Config */}
                <div className="w-[320px] bg-background border border-border/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border/40 bg-muted/30">
                        <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">Inspector</h3>
                    </div>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-4">
                            {selectedBlockId === 'global' ? (
                                <ConfigPanel 
                                    block={{
                                        id: 'global',
                                        type: 'global_settings',
                                        config: globalConfig,
                                        isVisible: true,
                                        showOnBill: true,
                                        showOnReceipt: true
                                    }}
                                    onUpdate={(u) => setGlobalConfig(prev => ({ ...prev, ...(u.config as GlobalConfig) }))}
                                    onDelete={() => {}}
                                />
                            ) : selectedBlock ? (
                                <ConfigPanel 
                                    block={selectedBlock} 
                                    onUpdate={(u) => handleUpdateBlock(selectedBlock.id, u)}
                                    onDelete={() => handleDeleteBlock(selectedBlock.id)}
                                />
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
                                    <h4 className="text-[11px] font-black uppercase opacity-60">Design KOT</h4>
                                    <p className="text-[10px] text-muted-foreground mt-2">Select a block to adjust typography and spacing for kitchen printers.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Quick Reorder Controls */}
                    {selectedBlock && selectedBlockId !== 'global' && (
                        <div className="p-3 bg-muted/30 border-t border-border/40 grid grid-cols-2 gap-2">
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[10px] font-black uppercase gap-2 border-orange-500/20 text-orange-600"
                                onClick={() => handleMoveBlock(blocks.findIndex(b => b.id === selectedBlockId), 'up')}
                                disabled={blocks.findIndex(b => b.id === selectedBlockId) === 0}
                             >
                                <ChevronUp className="w-3 h-3" /> Up
                             </Button>
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[10px] font-black uppercase gap-2 border-orange-500/20 text-orange-600"
                                onClick={() => handleMoveBlock(blocks.findIndex(b => b.id === selectedBlockId), 'down')}
                                disabled={blocks.findIndex(b => b.id === selectedBlockId) === blocks.length - 1}
                             >
                                <ChevronDown className="w-3 h-3" /> Down
                             </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
