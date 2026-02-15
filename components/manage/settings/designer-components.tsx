"use client";

import React from "react";
import { 
    Plus, 
    Trash2, 
    GripVertical, 
    Type, 
    Printer, 
    Table as TableIcon, 
    Receipt, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    Bold, 
    Maximize2, 
    Minus,
    Store,
    Info,
    User,
    Calculator,
    CreditCard,
    Banknote,
    ArrowDown,
    QrCode,
    Settings,
    Split,
    Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Types ---

export type BlockType = 
    | 'header' 
    | 'bill_info' 
    | 'customer' 
    | 'items' 
    | 'totals' 
    | 'payments' 
    | 'partial_pay' 
    | 'footer' 
    | 'text' 
    | 'divider' 
    | 'qr' 
    | 'global_settings';

export interface ReceiptBlock {
    id: string;
    type: BlockType;
    config: Record<string, any>;
    isVisible: boolean;
    showOnBill: boolean;
    showOnReceipt: boolean;
}

export interface GlobalConfig {
    global_font_type: 'A' | 'B';
    global_font_size: number;
    line_spacing: number;
    paper_size: '58mm' | '80mm';
    column_capacity: number;
}

// --- Icons Mapping ---

export const BLOCK_METADATA: Record<BlockType, { title: string; icon: any; description: string }> = {
    header: { title: "Header", icon: Store, description: "Branding & address" },
    bill_info: { title: "Bill Info", icon: Info, description: "Bill #, Table, Date" },
    customer: { title: "Customer Info", icon: User, description: "Name and phone" },
    items: { title: "Items Table", icon: TableIcon, description: "List of items & qty" },
    totals: { title: "Totals", icon: Calculator, description: "Subtotal, Tax, Total" },
    payments: { title: "Payments", icon: CreditCard, description: "Payment breakdown" },
    partial_pay: { title: "Partial Payments", icon: Banknote, description: "Split pay details" },
    footer: { title: "Footer", icon: ArrowDown, description: "Thank you message" },
    text: { title: "Custom Text", icon: Type, description: "Custom message" },
    divider: { title: "Divider", icon: Minus, description: "Separator line" },
    qr: { title: "QR Code", icon: QrCode, description: "Payment QR" },
    global_settings: { title: "Global Settings", icon: Settings, description: "Printer-wide config" },
};

// --- Config Widgets ---

export const FontSizeSlider = ({ value, onChange, label = "Font Size" }: { value: number; onChange: (v: number) => void; label?: string }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</Label>
            <span className="text-[10px] font-bold">{value}px</span>
        </div>
        <Slider 
            value={[value]} 
            min={8} 
            max={48} 
            step={1} 
            onValueChange={([v]) => onChange(v)} 
            className="py-1"
        />
    </div>
);

export const LineSpacingSlider = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Line Spacing</Label>
            <span className="text-[10px] font-bold">{value.toFixed(1)}x</span>
        </div>
        <Slider 
            value={[value]} 
            min={0.5} 
            max={3.0} 
            step={0.1} 
            onValueChange={([v]) => onChange(v)} 
            className="py-1"
        />
    </div>
);

export const MultiplierSlider = ({ value, onChange, label, max = 8 }: { value: number; onChange: (v: number) => void; label: string; max?: number }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</Label>
            <span className="text-[10px] font-bold">{value}x</span>
        </div>
        <Slider 
            value={[value]} 
            min={1} 
            max={max} 
            step={1} 
            onValueChange={([v]) => onChange(v)} 
            className="py-1"
        />
    </div>
);

export const FontSelector = ({ value, onChange }: { value: 'A' | 'B'; onChange: (v: 'A' | 'B') => void }) => (
    <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Font Type</Label>
        <div className="grid grid-cols-2 gap-2">
            <Button 
                variant={value === 'A' ? 'secondary' : 'outline'} 
                size="sm" 
                onClick={() => onChange('A')}
                className="h-8 text-[10px] font-bold"
            >
                Font A
            </Button>
            <Button 
                variant={value === 'B' ? 'secondary' : 'outline'} 
                size="sm" 
                onClick={() => onChange('B')}
                className="h-8 text-[10px] font-bold"
            >
                Font B
            </Button>
        </div>
    </div>
);

export const AlignmentSelector = ({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) => (
    <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Alignment</Label>
        <div className="flex bg-muted p-1 rounded-lg border border-border/40">
            {(['left', 'center', 'right'] as const).map((align) => (
                <Button 
                    key={align}
                    variant={value === align ? 'secondary' : 'ghost'} 
                    size="icon" 
                    onClick={() => onChange(align)}
                    className="h-7 w-full"
                >
                    {align === 'left' && <AlignLeft className="w-3 h-3" />}
                    {align === 'center' && <AlignCenter className="w-3 h-3" />}
                    {align === 'right' && <AlignRight className="w-3 h-3" />}
                </Button>
            ))}
        </div>
    </div>
);

export const SpacingControls = ({ top, bottom, onChange }: { top: number; bottom: number; onChange: (key: 'padding_top' | 'padding_bottom', v: number) => void }) => (
    <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Pad Top</Label>
            <Input 
                type="number" 
                value={top} 
                onChange={(e) => onChange('padding_top', parseInt(e.target.value) || 0)}
                className="h-8 text-[10px] font-bold"
            />
        </div>
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Pad Bottom</Label>
            <Input 
                type="number" 
                value={bottom} 
                onChange={(e) => onChange('padding_bottom', parseInt(e.target.value) || 0)}
                className="h-8 text-[10px] font-bold"
            />
        </div>
    </div>
);

// --- Blocks Palette ---

export const BlockPalette = ({ onAdd }: { onAdd: (type: BlockType) => void }) => {
    return (
        <div className="grid grid-cols-1 gap-2 p-1">
            {(Object.entries(BLOCK_METADATA) as [BlockType, any][]).map(([type, meta]) => (
                <Card 
                    key={type} 
                    className="border border-border/40 hover:border-primary/40 cursor-pointer transition-all hover:bg-muted/50 group"
                    onClick={() => onAdd(type)}
                >
                    <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-2 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
                            <meta.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[12px] font-black leading-tight uppercase tracking-tight">{meta.title}</h4>
                            <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{meta.description}</p>
                        </div>
                        <Plus className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

// --- Thermal Preview ---

export const ThermalPreview = ({ 
    blocks, 
    globalConfig, 
    mode = 'receipt',
    selectedId,
    onSelect,
    context
}: { 
    blocks: ReceiptBlock[]; 
    globalConfig: GlobalConfig;
    mode?: 'bill' | 'receipt' | 'kot';
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    context?: PreviewContext;
}) => {
    const is58mm = globalConfig.paper_size === '58mm';
    const paperWidth = is58mm ? "220px" : "300px";

    const filteredBlocks = blocks.filter(b => {
        if (!b.isVisible) return false;
        if (mode === 'bill' && !b.showOnBill) return false;
        if (mode === 'receipt' && !b.showOnReceipt) return false;
        return true;
    });

    return (
        <div 
            className="bg-white text-black shadow-2xl mx-auto min-h-[500px] font-mono leading-tight p-4 relative overflow-hidden transition-all duration-500 ease-in-out origin-top border-x-8 border-white group"
            style={{ 
                width: paperWidth,
                fontSize: `${globalConfig.global_font_size}px`,
                lineHeight: globalConfig.line_spacing
            }}
        >
            {/* Paper Texture Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
            
            {/* Edge Shadow */}
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />

            <div className="space-y-4">
                {filteredBlocks.map((block) => {
                    const isSelected = selectedId === block.id;
                    return (
                        <div 
                            key={block.id} 
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect?.(block.id);
                            }}
                            className={cn(
                                "relative group cursor-pointer border-2 border-transparent transition-all",
                                isSelected ? "border-primary ring-4 ring-primary/10 bg-primary/5 -mx-1 px-1 rounded-sm scale-[1.02] z-10" : "hover:border-primary/20"
                            )}
                            style={{ 
                                paddingTop: `${block.config.padding_top || 0}px`,
                                paddingBottom: `${block.config.padding_bottom || 0}px`,
                                textAlign: block.config.align as any || 'center'
                            }}
                        >
                            {isSelected && (
                                <div className="absolute -top-3 -right-3 bg-primary text-white p-1 rounded-full shadow-lg z-20">
                                    <Settings className="w-3 h-3" />
                                </div>
                            )}
                            {renderBlockPreview(block, globalConfig, context)}
                        </div>
                    );
                })}
            </div>

            {/* Bottom edge indicator */}
            <div className="mt-8 border-t border-dashed border-gray-300 w-full" />
        </div>
    );
};

// --- Config Panel ---

export const ConfigPanel = ({ 
    block, 
    onUpdate, 
    onDelete 
}: { 
    block: ReceiptBlock; 
    onUpdate: (updates: Partial<ReceiptBlock>) => void;
    onDelete: () => void;
}) => {
    const meta = BLOCK_METADATA[block.type];

    const updateConfig = (key: string, value: any) => {
        onUpdate({ config: { ...block.config, [key]: value } });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <meta.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight leading-none">{meta.title}</h3>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest opacity-60">Block Configuration</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {block.type !== 'global_settings' && (
                        <div className="flex items-center gap-2 mr-2 bg-muted/50 px-2 py-1 rounded-md border border-border/40">
                            <Label className="text-[9px] font-black uppercase opacity-60">Active</Label>
                            <Switch 
                                className="scale-75"
                                checked={block.isVisible} 
                                onCheckedChange={(val) => onUpdate({ isVisible: val })} 
                            />
                        </div>
                    )}
                    {block.type !== 'global_settings' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full" onClick={onDelete}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Visibility Toggles */}
            {block.type !== 'global_settings' && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                        <Label className="text-[10px] uppercase font-black opacity-60">On Bill</Label>
                        <Switch 
                            checked={block.showOnBill} 
                            onCheckedChange={(val) => onUpdate({ showOnBill: val })} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                        <Label className="text-[10px] uppercase font-black opacity-60">On Receipt</Label>
                        <Switch 
                            checked={block.showOnReceipt} 
                            onCheckedChange={(val) => onUpdate({ showOnReceipt: val })} 
                        />
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Specific Configs */}
                {renderConfigFields(block, updateConfig)}

                {/* Common Styling (except for global_settings and divider) */}
                {block.type !== 'global_settings' && block.type !== 'divider' && (
                    <div className="space-y-6 pt-4 border-t border-border/40">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Block Styling</h4>
                        <FontSelector 
                            value={block.config.font_type || 'A'} 
                            onChange={(v) => updateConfig('font_type', v)} 
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FontSizeSlider 
                                value={block.config.font_size || 12} 
                                onChange={(v) => updateConfig('font_size', v)} 
                            />
                            <div className="flex items-center gap-4 pt-6">
                                <Label className="flex items-center gap-2 cursor-pointer">
                                    <Switch 
                                        checked={block.config.bold || false} 
                                        onCheckedChange={(val) => updateConfig('bold', val)} 
                                    />
                                    <Bold className="w-4 h-4" />
                                </Label>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <MultiplierSlider 
                                label="Width Mult" 
                                value={block.config.width_mult || 1} 
                                onChange={(v) => updateConfig('width_mult', v)} 
                            />
                            <MultiplierSlider 
                                label="Height Mult" 
                                value={block.config.height_mult || 1} 
                                onChange={(v) => updateConfig('height_mult', v)} 
                            />
                        </div>
                        <AlignmentSelector 
                            value={block.config.align || 'center'} 
                            onChange={(v) => updateConfig('align', v)} 
                        />
                    </div>
                )}

                {/* Spacing */}
                {block.type !== 'global_settings' && (
                    <div className="space-y-4 pt-4 border-t border-border/40">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Layout Spacing</h4>
                        <SpacingControls 
                            top={block.config.padding_top || 0} 
                            bottom={block.config.padding_bottom || 0} 
                            onChange={updateConfig} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Block Renderers (Simulated) ---

export interface PreviewContext {
    restaurant_name?: string;
    address?: string;
    phone?: string;
    pan?: string;
    email?: string;
    // Bill info sample data
    bill_no?: string;
    order_id?: string;
    kot_no?: string;
    date?: string;
    time?: string;
    table_name?: string;
    station?: string;
    type?: string;
    user?: string;
    category?: string;
    // Customer sample data
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
}

function renderBlockPreview(block: ReceiptBlock, global: GlobalConfig, context?: PreviewContext) {
    const { config, type } = block;
    const effectiveFontType = config.font_type || global.global_font_type;
    const effectiveFontSize = config.font_size || global.global_font_size;
    const isFontB = effectiveFontType === 'B';
    
    const style = {
        fontWeight: config.bold ? 'bold' : 'normal',
        fontSize: `${effectiveFontSize}px`,
        transform: `scale(${isFontB ? (config.width_mult || 1) * 0.8 : (config.width_mult || 1)}, ${config.height_mult || 1})`,
        transformOrigin: config.align === 'center' ? 'center' : config.align === 'right' ? 'right' : 'left',
        display: 'inline-block',
        width: isFontB ? '125%' : '100%', // Compensate for scaleX shrinking width
        marginLeft: isFontB && config.align === 'center' ? '-12.5%' : isFontB && config.align === 'right' ? '-25%' : '0',
        fontFamily: 'monospace',
        letterSpacing: isFontB ? '-0.5px' : 'normal',
        opacity: block.isVisible === false ? 0.3 : 1,
        lineHeight: '1.2'
    };

    switch (type) {
        case 'header':
            return (
                <div style={style}>
                    <div className="font-black truncate">
                        {(config.title || context?.restaurant_name || "YUMMY RESTAURANT").toUpperCase()}
                    </div>
                    {config.show_address !== false && (
                        <div className="text-[0.8em] truncate">
                            {(config.address || context?.address || "KATHMANDU, NEPAL").toUpperCase()}
                        </div>
                    )}
                    {config.show_phone !== false && (
                        <div className="text-[0.8em]">
                            {config.phone_label || 'Phone'}: {config.phone || context?.phone || "9800000000"}
                        </div>
                    )}
                    {config.show_email === true && (
                        <div className="text-[0.8em]">
                            Email: {context?.email || 'contact@yummy.com'}
                        </div>
                    )}
                    {config.show_pan === true && (
                        <div className="text-[0.8em]">
                            {config.pan_label || 'PAN No'}: {config.pan || context?.pan || "PAN-987654321"}
                        </div>
                    )}
                    {config.tagline && <div className="text-[0.7em] italic mt-1">{config.tagline}</div>}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
        case 'divider':
            return (
                <div className="w-full overflow-hidden border-t border-dashed border-black my-1" />
            );
        case 'bill_info': {
            // Match Flutter's visibility defaults exactly
            const showTable = config.show_table ?? true;          // default true
            const showOrderId = config.show_order_id ?? true;     // default true
            const showStation = config.show_station === true;     // default false
            const showKotNum = config.show_kot_number === true;   // default false
            const showType = config.show_kot_type === true;       // default false
            const showDate = config.show_date === true;           // default false
            const showUser = config.show_user === true;           // default false
            const showTime = config.show_time === true;           // default false
            const showCategory = config.show_category === true;   // default false

            // Legacy fallback: if no KOT/detail flags are set, show simple bill format
            const hasDetailFlags = showKotNum || showStation || showType || showDate || showUser || showTime || showCategory;

            return (
                <div style={style} className="space-y-0.5 text-left">
                    {hasDetailFlags ? (
                        <>
                            {/* Row 1: KOT # & Station */}
                            {(showKotNum || showStation) && (
                                <div className="flex justify-between">
                                    {showKotNum && (
                                        <span>{config.kot_label || 'KOT'}: #{context?.kot_no || '10-1'}</span>
                                    )}
                                    {showStation && (
                                        <span className="text-right">{config.station_label || 'STATION'}: {context?.station || 'KITCHEN'}</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Row 2: Type & Table */}
                            {(showType || showTable) && (
                                <div className="flex justify-between">
                                    {showType && (
                                        <span>{config.type_label || 'TYPE'}: {context?.type || 'INITIAL'}</span>
                                    )}
                                    {showTable && (
                                        <span className="text-right">{config.table_label || 'TABLE'}: {context?.table_name || '4'}</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Row 3: Ref (Order ID) & Date */}
                            {(showOrderId || showDate) && (
                                <div className="flex justify-between">
                                    {showOrderId && (
                                        <span>{config.order_label || 'Ref'}: #{context?.order_id || '10'}</span>
                                    )}
                                    {showDate && (
                                        <span className="text-right">{config.date_label || 'DATE'}: {context?.date || '03/02/2026'}</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Row 4: User & Time */}
                            {(showUser || showTime) && (
                                <div className="flex justify-between">
                                    {showUser && (
                                        <span>{config.user_label || 'USER'}: {context?.user || 'BHAVANA THAPALIYA'}</span>
                                    )}
                                    {showTime && (
                                        <span className="text-right">{config.time_label || 'TIME'}: {context?.time || '15:30'}</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Row 5: Category */}
                            {showCategory && (
                                <div>
                                    <span>{config.category_label || 'CATEGORY'}: {context?.category || 'GARDEN'}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Legacy/simple bill format - when no detail KOT flags set */}
                            <div className="flex justify-between">
                                <span>{config.bill_label || 'BILL'} #{context?.bill_no || 'REC-000869'}</span>
                                <span className="text-right">{context?.date || '03/02/2026'}</span>
                            </div>
                            {showOrderId && (
                                <div>
                                    <span>{config.order_label || 'Order'} #{context?.order_id || '10'}</span>
                                </div>
                            )}
                            {showTable && (
                                <div>
                                    <span>{config.table_label || 'Table'}: {context?.table_name || '4'}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
        }
        case 'items':
            return (
                <div style={style}>
                    <div className="flex justify-between border-b border-dashed border-black pb-0.5 mb-1 font-bold">
                        {config.show_serial !== false && <span className="w-8">{config.sn_label || 'S.N'}</span>}
                        <span className="flex-1 text-left px-2">{config.item_label || 'ITEM'}</span>
                        {config.show_rate !== false && <span className="w-12 text-right">{config.rate_label || 'RATE'}</span>}
                        <span className="w-8 text-right">{config.qty_label || 'QTY'}</span>
                        {config.show_amount !== false && <span className="w-12 text-right">{config.amount_label || 'AMT'}</span>}
                    </div>
                    {/* Sample item 1: Margherita Pizza */}
                    <div className="flex justify-between">
                        {config.show_serial !== false && <span className="w-8">1</span>}
                        <span className="flex-1 text-left px-2">Margherita Pizza</span>
                        {config.show_rate !== false && <span className="w-12 text-right">12.99</span>}
                        <span className="w-8 text-right">2</span>
                        {config.show_amount !== false && <span className="w-12 text-right">25.98</span>}
                    </div>
                    {/* Sample item 2: Coke */}
                    <div className="flex justify-between">
                        {config.show_serial !== false && <span className="w-8">2</span>}
                        <span className="flex-1 text-left px-2">Coke</span>
                        {config.show_rate !== false && <span className="w-12 text-right">2.50</span>}
                        <span className="w-8 text-right">3</span>
                        {config.show_amount !== false && <span className="w-12 text-right">7.50</span>}
                    </div>
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
        case 'totals':
            return (
                <div style={style} className="space-y-0.5">
                    {config.show_discount !== false && (
                        <div className="flex justify-between">
                            <span>{config.discount_label || 'Discount'}</span>
                            <span>-Rs. 5.00</span>
                        </div>
                    )}
                    <div className="border-t-2 border-double border-black pt-0.5 mt-0.5" />
                    <div className="flex justify-between font-black">
                        <span>{config.total_label || 'TOTAL'}</span>
                        <span>Rs. 32.83</span>
                    </div>
                </div>
            );
        case 'qr':
            return (
                <div style={style} className="flex flex-col items-center gap-1 py-2">
                    <div className="w-20 h-20 border border-black flex items-center justify-center p-2 rounded">
                        <QrCode className="w-full h-full" />
                    </div>
                </div>
            );
        case 'customer':
            return (
                <div style={style} className="text-left py-0.5">
                    <div className="font-bold">{context?.customer_name || 'John Doe'}</div>
                    {config.show_phone !== false && <div>{context?.customer_phone || '987-654-3210'}</div>}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
        case 'payments':
            return (
                <div style={style} className="space-y-0.5">
                    <div className="w-full overflow-hidden border-t border-dashed border-black" />
                    <div className="font-black">
                        <span>{config.header_label || 'PAID'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Cash</span>
                        <span>Rs. 32.83</span>
                    </div>
                </div>
            );
        case 'partial_pay':
            return (
                <div style={style} className="space-y-0.5">
                    <div className="w-full overflow-hidden border-t border-dashed border-black" />
                    <div className="font-bold text-[0.9em]">
                        PARTIAL PAYMENTS
                    </div>
                    <div className="flex justify-between">
                        <span>Cash</span>
                        <span>Rs. 10.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Card</span>
                        <span>Rs. 22.83</span>
                    </div>
                    <div className="flex justify-between font-bold mt-1">
                        <span>Due</span>
                        <span>Rs. 0.00</span>
                    </div>
                </div>
            );
        case 'footer':
            return (
                <div style={style} className="py-1">
                    <div className="w-full overflow-hidden border-t border-dashed border-black mb-2" />
                    <div className="text-center text-[0.9em]">
                        {config.message || "THANK YOU"}
                    </div>
                </div>
            );
        case 'text':
            return (
                <div style={style}>
                    {config.text || "Your custom text here"}
                </div>
            );
        case 'divider':
            return (
                <div className="w-full overflow-hidden border-t border-dashed border-black/80 my-1 py-0.5" />
            );
        case 'global_settings':
            return (
                <div className="text-[10px] italic bg-primary/5 p-2 rounded-md border border-primary/20 text-primary uppercase font-bold text-center">
                    [ Printer: {global.paper_size} | Font: {global.global_font_type} ]
                </div>
            );
        default:
            return <div className="text-[10px] italic opacity-40">[{type}]</div>;
    }
}

function renderConfigFields(block: ReceiptBlock, update: (k: string, v: any) => void) {
    const { config, type } = block;

    switch (type) {
        case 'header':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleItem label="Show Logo" value={config.show_logo} onChange={(v) => update('show_logo', v)} />
                        <ToggleItem label="Show Address" value={config.show_address} onChange={(v) => update('show_address', v)} />
                        <ToggleItem label="Show Phone" value={config.show_phone} onChange={(v) => update('show_phone', v)} />
                        <ToggleItem label="Show PAN" value={config.show_pan} onChange={(v) => update('show_pan', v)} />
                    </div>
                </div>
            );
        case 'bill_info':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleItem label="KOT #" value={config.show_kot_number} onChange={(v) => update('show_kot_number', v)} />
                        <ToggleItem label="Station" value={config.show_station} onChange={(v) => update('show_station', v)} />
                        <ToggleItem label="Table" value={config.show_table} onChange={(v) => update('show_table', v)} />
                        <ToggleItem label="Date" value={config.show_date} onChange={(v) => update('show_date', v)} />
                        <ToggleItem label="User" value={config.show_user} onChange={(v) => update('show_user', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <LabelInput label="KOT Label" value={config.kot_label || 'KOT'} onChange={(v) => update('kot_label', v)} />
                        <LabelInput label="Table Label" value={config.table_label || 'TABLE'} onChange={(v) => update('table_label', v)} />
                    </div>
                </div>
            );
        case 'items':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleItem label="Show S.N" value={config.show_serial} onChange={(v) => update('show_serial', v)} />
                        <ToggleItem label="Show Rate" value={config.show_rate} onChange={(v) => update('show_rate', v)} />
                        <ToggleItem label="Show Amount" value={config.show_amount} onChange={(v) => update('show_amount', v)} />
                    </div>
                </div>
            );
        case 'totals':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleItem label="Show Tax" value={config.show_tax} onChange={(v) => update('show_tax', v)} />
                        <ToggleItem label="Show Service" value={config.show_service} onChange={(v) => update('show_service', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <LabelInput label="Subtotal" value={config.subtotal_label || 'Subtotal'} onChange={(v) => update('subtotal_label', v)} />
                        <LabelInput label="Tax Label" value={config.tax_label || 'Tax (13%)'} onChange={(v) => update('tax_label', v)} />
                        <LabelInput label="Total Label" value={config.total_label || 'TOTAL'} onChange={(v) => update('total_label', v)} />
                    </div>
                </div>
            );
        case 'customer':
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleItem label="Phone" value={config.show_phone} onChange={(v) => update('show_phone', v)} />
                        <ToggleItem label="Address" value={config.show_address} onChange={(v) => update('show_address', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <LabelInput label="CUST Label" value={config.customer_label || 'CUST'} onChange={(v) => update('customer_label', v)} />
                        <LabelInput label="Phone Label" value={config.phone_label || 'PH'} onChange={(v) => update('phone_label', v)} />
                    </div>
                </div>
            );
        case 'partial_pay':
            return (
                <div className="grid grid-cols-2 gap-2">
                    <LabelInput label="Split Label" value={config.split_label || 'Split'} onChange={(v) => update('split_label', v)} />
                    <LabelInput label="Paid Label" value={config.paid_label || 'Paid'} onChange={(v) => update('paid_label', v)} />
                </div>
            );
        case 'qr':
            return (
                <div className="space-y-4">
                    <LabelInput label="QR Content" value={config.content || ''} onChange={(v) => update('content', v)} hint="UPI ID or URL" />
                    <LabelInput label="QR Label" value={config.label || 'SCAN TO PAY'} onChange={(v) => update('label', v)} />
                </div>
            );
        case 'text':
            return (
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Custom Text Content</Label>
                    <Input value={config.text || ''} onChange={(e) => update('text', e.target.value)} placeholder="Type here..." className="text-xs font-bold" />
                </div>
            );
        case 'footer':
            return (
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Footer Message</Label>
                    <Input value={config.message || ''} onChange={(e) => update('message', e.target.value)} placeholder="THANK YOU!" className="text-xs font-bold" />
                </div>
            );
        case 'global_settings':
            return (
                <div className="space-y-6">
                    <FontSelector value={config.global_font_type || 'A'} onChange={(v) => update('global_font_type', v)} />
                    <FontSizeSlider label="Global Font Size" value={config.global_font_size || 12} onChange={(v) => update('global_font_size', v)} />
                    <LineSpacingSlider value={config.line_spacing || 1.2} onChange={(v) => update('line_spacing', v)} />
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Paper Size</Label>
                        <Select value={config.paper_size || '80mm'} onValueChange={(v) => update('paper_size', v)}>
                            <SelectTrigger className="h-8 text-[10px] font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="80mm">80mm (Standard)</SelectItem>
                                <SelectItem value="58mm">58mm (Condensed)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        default:
            return null;
    }
}

// --- Internal Helper Components ---

const ToggleItem = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-1.5 rounded-md border border-border/20 bg-muted/20">
        <span className="text-[10px] font-bold opacity-80">{label}</span>
        <Switch checked={value !== false} onCheckedChange={onChange} className="scale-75" />
    </div>
);

const LabelInput = ({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) => (
    <div className="space-y-1.5">
        <Label className="text-[9px] font-black uppercase tracking-wider opacity-60">{label}</Label>
        <Input 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            placeholder={hint}
            className="h-7 text-[10px] font-bold"
        />
    </div>
);
