"use client";

import React from "react";
import { KOTUpdate } from "@/types/order";
import { getKotDisplayOrderId, getKotPrintContext, getKotTableName } from "@/components/receipts/kot-print-context";

interface ThermalKOTProps {
    data: any; // Using any to accommodate the KOT data structure which might include order info
    template?: any[];
}

export function ThermalKOT({ data, template }: ThermalKOTProps) {
    const { kot, order, restaurant, activeItems, cancelledItems, title } = getKotPrintContext(data);
    const tableName = getKotTableName(data);
    const orderId = getKotDisplayOrderId(data);

    const row = (a: React.ReactNode, b: React.ReactNode, style?: React.CSSProperties): React.ReactNode => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style }}>{a}{b}</div>
    );

    // If no template is provided, we could fallback, but the user expects dynamic exact template.
    const activeTemplate = Array.isArray(template) && template.length > 0 ? template : [];
    const globalBlock = activeTemplate.find(b => b.type === 'global_settings');
    const globalConfig = {
        global_font_type: globalBlock?.global_font_type || globalBlock?.config?.global_font_type || 'A',
        global_font_size: globalBlock?.global_font_size || globalBlock?.config?.global_font_size || 14, // KOT defaults to larger
        line_spacing: globalBlock?.line_spacing || globalBlock?.config?.line_spacing || 1.6,
        paper_size: globalBlock?.paper_size || globalBlock?.config?.paper_size || '80mm',
    };

    const blocks = activeTemplate
        .filter(b => b.type !== 'global_settings')
        .map(b => ({
            id: b.id || Math.random().toString(),
            type: b.type,
            isVisible: b.is_visible ?? b.isVisible ?? true,
            config: b.config ? { ...b, ...b.config } : b,
        }));

    const filteredBlocks = blocks.filter(b => b.isVisible);

    const paperWidth = globalConfig.paper_size === '58mm' ? '58mm' : '80mm';
    const baseFontSize = globalConfig.global_font_size || 14;
    const ff = "monospace";

    const wrap: React.CSSProperties = {
        width: paperWidth,
        maxWidth: paperWidth,
        minWidth: paperWidth,
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: ff,
        fontSize: `${baseFontSize}px`,
        lineHeight: String(globalConfig.line_spacing),
        padding: '5mm 5mm 8mm 5mm',
        boxSizing: 'border-box',
    };

    // If template is completely empty, fallback to the basic hardcoded design
    if (filteredBlocks.length === 0) {
        return (
            <div className="thermal-kot" style={wrap}>
                <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px dashed #000', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 900, fontSize: `${baseFontSize + 12}px` }}>KOT</div>
                    <div style={{ fontWeight: 800, fontSize: `${baseFontSize + 4}px` }}>{title}</div>
                    <div style={{ fontWeight: 700, fontSize: `${baseFontSize}px` }}>Station: {kot.station}</div>
                </div>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                    {row(<span style={{ fontWeight: 600 }}>KOT No:</span>, <span style={{ fontWeight: 800 }}>{kot.kot_number || kot.id}</span>)}
                    {row(<span style={{ fontWeight: 600 }}>Table:</span>, <span style={{ fontWeight: 800 }}>{tableName}</span>)}
                    {row(<span style={{ fontWeight: 600 }}>Time:</span>, <span>{new Date(kot.created_at || new Date()).toLocaleTimeString()}</span>)}
                </div>
                <div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '6px' }}>
                        <span style={{ width: '25px', fontWeight: 700 }}>SN</span>
                        <span style={{ flex: 1, fontWeight: 700 }}>Item</span>
                        <span style={{ width: '40px', textAlign: 'center', fontWeight: 700 }}>Qty</span>
                    </div>
                    {activeItems.map((item: any, idx: number) => (
                        <div key={item.id || idx} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{ width: '25px', fontWeight: 600, paddingTop: '2px' }}>{idx + 1}</span>
                            <span style={{ flex: 1, paddingRight: '8px' }}>
                                <div style={{ fontWeight: 800, fontSize: `${baseFontSize + 2}px` }}>{item.item_name || item.name_snapshot}</div>
                                {item.modifiers && item.modifiers.length > 0 && (
                                    <div style={{ fontSize: `${baseFontSize - 2}px`, fontStyle: 'italic' }}>+ {item.modifiers.map((m: any) => m.modifier_name_snapshot).join(', ')}</div>
                                )}
                                {item.notes && <div style={{ fontSize: `${baseFontSize - 1}px`, fontWeight: 700, marginTop: '3px', border: '1px dashed #000', display: 'inline-block' }}>Note: {item.notes}</div>}
                            </span>
                            <span style={{ width: '40px', textAlign: 'center', fontWeight: 900, fontSize: `${baseFontSize + 4}px` }}>{item.qty_change !== undefined ? item.qty_change : item.qty}</span>
                        </div>
                    ))}
                    {cancelledItems.length > 0 && (
                        <>
                            <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '6px', marginBottom: '6px', fontWeight: 800 }}>
                                CANCELLED ITEMS
                            </div>
                            {cancelledItems.map((item: any, idx: number) => (
                                <div key={`cancelled-${item.id || idx}`} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <span style={{ width: '25px', fontWeight: 600, paddingTop: '2px' }}>-</span>
                                    <span style={{ flex: 1, paddingRight: '8px' }}>
                                        <div style={{ fontWeight: 800, fontSize: `${baseFontSize + 2}px` }}>{item.item_name || item.name_snapshot} (CXL)</div>
                                        {item.modifiers && item.modifiers.length > 0 && (
                                            <div style={{ fontSize: `${baseFontSize - 2}px`, fontStyle: 'italic' }}>+ {item.modifiers.map((m: any) => m.modifier_name_snapshot).join(', ')}</div>
                                        )}
                                    </span>
                                    <span style={{ width: '40px', textAlign: 'center', fontWeight: 900, fontSize: `${baseFontSize + 4}px` }}>-{item.qty_for_print}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="thermal-kot" style={wrap}>
            {filteredBlocks.map((block) => (
                <div 
                    key={block.id} 
                    style={{ 
                        width: '100%', 
                        paddingTop: `${block.config.padding_top || 0}px`,
                        paddingBottom: `${block.config.padding_bottom || 0}px`,
                        textAlign: block.config.align as any || 'center'
                    }}
                >
                    {renderKotBlock(block, globalConfig, kot, order, restaurant, ff, baseFontSize)}
                </div>
            ))}
        </div>
    );
}

function renderKotBlock(block: any, global: any, kot: any, order: any, restaurant: any, ff: string, baseFs: number) {
    const { config, type } = block;
    const { activeItems, cancelledItems } = getKotPrintContext({ kot, order, restaurant });
    const tableName = getKotTableName({ kot, order });
    const orderId = getKotDisplayOrderId({ kot, order });
    
    // Exact mapping from designer-components.tsx style block
    const effectiveFontType = config.font_type || global.global_font_type || 'A';
    const effectiveFontSize = config.font_size || global.global_font_size || baseFs;
    const isFontB = effectiveFontType === 'B';
    
    const style: React.CSSProperties = {
        fontWeight: (config.bold || config.is_bold) ? 'bold' : 'normal',
        fontSize: `${effectiveFontSize}px`,
        transform: `scale(${isFontB ? (config.width_mult || 1) * 0.8 : (config.width_mult || 1)}, ${config.height_mult || 1})`,
        transformOrigin: config.align === 'center' ? 'center' : config.align === 'right' ? 'right' : 'left',
        display: 'inline-block',
        width: isFontB ? '125%' : '100%', 
        marginLeft: isFontB && config.align === 'center' ? '-12.5%' : isFontB && config.align === 'right' ? '-25%' : '0',
        fontFamily: 'monospace',
        letterSpacing: isFontB ? '-0.5px' : 'normal',
        opacity: block.isVisible === false ? 0.3 : 1,
        lineHeight: '1.2',
        boxSizing: 'border-box'
    };

    switch (type) {
        case 'header':
            return (
                <div style={style}>
                    <div className="font-black truncate">
                        {resolvePlaceholders(config.title || restaurant?.name || "YUMMY RESTAURANT", kot, order, restaurant).toUpperCase()}
                    </div>
                    {config.show_address !== false && (
                        <div className="text-[0.8em] truncate">
                            {resolvePlaceholders(config.address || restaurant?.address || "KATHMANDU, NEPAL", kot, order, restaurant).toUpperCase()}
                        </div>
                    )}
                    {config.show_phone !== false && (
                        <div className="text-[0.8em]">
                            {config.phone_label || 'Phone'}: {resolvePlaceholders(config.phone || restaurant?.phone || "9800000000", kot, order, restaurant)}
                        </div>
                    )}
                    {config.show_pan === true && (
                        <div className="text-[0.8em]">
                            {config.pan_label || 'PAN No'}: {resolvePlaceholders(config.pan || restaurant?.pan_number || "N/A", kot, order, restaurant)}
                        </div>
                    )}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );

        case 'divider':
            return (
                <div className="w-full overflow-hidden border-t border-dashed border-black my-1" />
            );

        case 'bill_info': {
            const date = kot.created_at ? new Date(kot.created_at) : new Date();
            const dateStr = date.toLocaleDateString('en-GB');
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            
            const showTable = config.show_table ?? true;
            const showOrderId = config.show_order_id ?? true;
            const showStation = config.show_station === true;
            const showKotNum = config.show_kot_number === true;
            const showType = config.show_kot_type === true;
            const showDate = config.show_date === true;
            const showUser = config.show_user === true;
            const showTime = config.show_time === true;
            
            const hasDetailFlags = showKotNum || showStation || showType || showDate || showUser || showTime;

            const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' };
            const labelStyle: React.CSSProperties = { textTransform: 'uppercase' };

            return (
                <div style={style} className="space-y-0.5 text-left">
                    {hasDetailFlags ? (
                        <>
                            {(showKotNum || showStation) && (
                                <div className="flex justify-between">
                                    {showKotNum && <span>{config.kot_label || 'KOT'}: #{kot.kot_number || kot.id}</span>}
                                    {showStation && <span className="text-right">{config.station_label || 'STATION'}: {kot.station || 'KITCHEN'}</span>}
                                </div>
                            )}
                            {(showType || showTable) && (
                                <div className="flex justify-between">
                                    {showType && <span>{config.type_label || 'TYPE'}: {kot.type || 'INITIAL'}</span>}
                                    {showTable && <span className="text-right">{config.table_label || 'TABLE'}: {tableName}</span>}
                                </div>
                            )}
                            {(showOrderId || showDate) && (
                                <div className="flex justify-between">
                                    {showOrderId && <span>{config.order_label || 'Ref'}: #{orderId}</span>}
                                    {showDate && <span className="text-right">{config.date_label || 'DATE'}: {dateStr}</span>}
                                </div>
                            )}
                            {(showUser || showTime) && (
                                <div className="flex justify-between">
                                    {showUser && <span>{config.user_label || 'USER'}: {order.waiter_name || kot.created_by_staff_name || 'N/A'}</span>}
                                    {showTime && <span className="text-right">{config.time_label || 'TIME'}: {timeStr}</span>}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between">
                                <span>{config.bill_label || 'BILL'} #{orderId}</span>
                                <span className="text-right">{dateStr}</span>
                            </div>
                            {showOrderId && (
                                <div>
                                    <span>{config.order_label || 'Order'} #{orderId}</span>
                                </div>
                            )}
                            {showTable && (
                                <div>
                                    <span>{config.table_label || 'Table'}: {tableName}</span>
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
                    {activeItems.length > 0 && (
                        <>
                            <div className="flex justify-between border-b border-dashed border-black pb-0.5 mb-1 font-bold">
                                {config.show_serial !== false && <span className="w-8">{config.sn_label || 'S.N'}</span>}
                                <span className="flex-1 text-left px-2">{config.item_label || 'ITEM'}</span>
                                {config.show_rate !== false && <span className="w-12 text-right">{config.rate_label || 'RATE'}</span>}
                                <span className="w-8 text-right">{config.qty_label || 'QTY'}</span>
                                {config.show_amount !== false && <span className="w-12 text-right">{config.amount_label || 'AMT'}</span>}
                            </div>

                            {activeItems.map((item: any, idx: number) => (
                                <div key={item.id || idx} className="flex justify-between items-start mb-1">
                                    {config.show_serial !== false && <span className="w-8 pt-0.5">{idx + 1}</span>}

                                    <span className="flex-1 text-left px-2 flex flex-col">
                                        <span className="font-bold">{item.item_name || item.name_snapshot}</span>
                                        {item.modifiers && item.modifiers.length > 0 && (
                                            <span className="text-[0.8em] italic mt-0.5">
                                                + {item.modifiers.map((m: any) => m.modifier_name_snapshot).join(', ')}
                                            </span>
                                        )}
                                        {item.notes && (
                                            <span className="text-[0.8em] font-bold mt-0.5 px-1 border border-dashed border-black self-start">
                                                Note: {item.notes}
                                            </span>
                                        )}
                                    </span>

                                    {config.show_rate !== false && (
                                        <span className="w-12 text-right pt-0.5">
                                            {item.rate !== undefined ? item.rate : (item.price || 0)}
                                        </span>
                                    )}

                                    <span className="w-8 text-right font-bold pt-0.5">
                                        {item.qty_change !== undefined ? item.qty_change : item.qty}
                                    </span>

                                    {config.show_amount !== false && (
                                        <span className="w-12 text-right pt-0.5">
                                            {item.amount !== undefined ? item.amount : ((item.qty_change !== undefined ? item.qty_change : item.qty) * (item.price || 0))}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                    {config.show_cancelled_items !== false && cancelledItems.length > 0 && (
                        <>
                            <div className="w-full overflow-hidden border-t border-dashed border-black mt-1 mb-1" />
                            <div className="font-bold mb-1">{config.cancelled_section_title || "CANCELLED ITEMS"}</div>
                            {cancelledItems.map((item: any, idx: number) => (
                                <div key={`cancelled-${item.id || idx}`} className="flex justify-between items-start mb-1">
                                    {config.show_serial !== false && <span className="w-8 pt-0.5">-</span>}

                                    <span className="flex-1 text-left px-2 flex flex-col">
                                        <span className="font-bold">{item.item_name || item.name_snapshot} (CXL)</span>
                                        {item.modifiers && item.modifiers.length > 0 && (
                                            <span className="text-[0.8em] italic mt-0.5">
                                                + {item.modifiers.map((m: any) => m.modifier_name_snapshot).join(', ')}
                                            </span>
                                        )}
                                    </span>

                                    {config.show_rate !== false && <span className="w-12 text-right pt-0.5" />}

                                    <span className="w-8 text-right font-bold pt-0.5">
                                        -{item.qty_for_print}
                                    </span>

                                    {config.show_amount !== false && <span className="w-12 text-right pt-0.5" />}
                                </div>
                            ))}
                        </>
                    )}
                    {(activeItems.length > 0 || cancelledItems.length > 0) && (
                        <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                    )}
                </div>
            );

        case 'text':
        case 'custom_text':
            return (
                <div style={style}>
                    {resolvePlaceholders(config.text || config.content || "", kot, order, restaurant)}
                </div>
            );

        case 'footer':
            return (
                <div style={style} className="py-1">
                    <div className="w-full overflow-hidden border-t border-dashed border-black mb-2" />
                    <div className="text-center text-[0.9em]">
                        {resolvePlaceholders(config.message || 'End of Ticket', kot, order, restaurant)}
                    </div>
                </div>
            );

        default:
            return null;
    }
}

function resolvePlaceholders(text: string, kot: any, order: any, restaurant: any) {
    if (!text || typeof text !== 'string') return text;
    
    const date = kot?.created_at ? new Date(kot.created_at) : new Date();
    const dateStr = date.toLocaleDateString('en-GB');
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const tableName = getKotTableName({ kot, order });
    const orderId = getKotDisplayOrderId({ kot, order });

    return text
        .replace(/\{\{station_ticket_title\}\}/g, kot?.station || kot?.station_name || "KITCHEN")
        .replace(/\{\{station\}\}/g, kot?.station || "KITCHEN")
        .replace(/\{\{kot_number\}\}/g, String(kot?.kot_number || kot?.id || ""))
        .replace(/\{\{table\}\}/g, tableName)
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{time\}\}/g, timeStr)
        .replace(/\{\{order_id\}\}/g, String(orderId))
        .replace(/\{\{type\}\}/g, kot?.type || 'INITIAL')
        .replace(/\{\{restaurant_name\}\}/g, restaurant?.name || "YUMMY RESTAURANT")
        .replace(/\{\{restaurant_address\}\}/g, restaurant?.address || "")
        .replace(/\{\{restaurant_phone\}\}/g, restaurant?.phone || "")
        .replace(/\{\{restaurant_pan\}\}/g, restaurant?.pan_number || "");
}
