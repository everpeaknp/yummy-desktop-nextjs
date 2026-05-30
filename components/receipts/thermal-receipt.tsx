"use client";

import React from "react";
import { ReceiptData } from "@/types/order";
import { numberToWords } from "@/lib/utils/number-to-words";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThermalReceiptProps {
    data: ReceiptData;
    template: any[];
    mode?: 'bill' | 'receipt';
}

export function ThermalReceipt({ data, template, mode = 'receipt' }: ThermalReceiptProps) {
    const { order, restaurant } = data;

    const globalBlock = template.find(b => b.type === 'global_settings');
    const globalConfig = {
        global_font_type: globalBlock?.global_font_type || globalBlock?.config?.global_font_type || 'A',
        global_font_size: globalBlock?.global_font_size || globalBlock?.config?.global_font_size || 12,
        line_spacing: globalBlock?.line_spacing || globalBlock?.config?.line_spacing || 1.6,
        paper_size: globalBlock?.paper_size || globalBlock?.config?.paper_size || '80mm',
    };

    const blocks = template
        .filter(b => b.type !== 'global_settings')
        .map(b => ({
            id: b.id || Math.random().toString(),
            type: b.type,
            isVisible: b.is_visible ?? b.isVisible ?? true,
            showOnBill: b.show_on_bill ?? b.showOnBill ?? true,
            showOnReceipt: b.show_on_receipt ?? b.showOnReceipt ?? true,
            config: b.config ? { ...b, ...b.config } : b,
        }));

    const filteredBlocks = blocks.filter(b => {
        if (!b.isVisible) return false;
        if (mode === 'bill' && !b.showOnBill) return false;
        if (mode === 'receipt' && !b.showOnReceipt) return false;
        return true;
    });

    const is58mm = globalConfig.paper_size === '58mm';
    const paperWidth = is58mm ? "220px" : "300px";

    return (
        <div 
            className="thermal-receipt bg-white text-black font-mono leading-tight p-4 relative overflow-hidden transition-all duration-500 ease-in-out origin-top border-x-4 border-white group"
            style={{ 
                width: paperWidth,
                maxWidth: paperWidth,
                minWidth: paperWidth,
                fontSize: `${globalConfig.global_font_size}px`,
                lineHeight: globalConfig.line_spacing,
                boxSizing: 'border-box'
            }}
        >
            <div className="space-y-4">
                {filteredBlocks.map((block) => (
                    <div 
                        key={block.id}
                        style={{ 
                            paddingTop: `${block.config.padding_top || 0}px`,
                            paddingBottom: `${block.config.padding_bottom || 0}px`,
                            textAlign: block.config.align as any || 'center',
                            width: '100%'
                        }}
                    >
                        {renderBlock(block, globalConfig, data)}
                    </div>
                ))}
            </div>
            {/* Bottom edge indicator like preview */}
            <div className="mt-8 border-t border-dashed border-gray-300 w-full" />
        </div>
    );
}

function renderBlock(block: any, global: any, data: ReceiptData) {
    const { config, type } = block;
    const { order, restaurant } = data;
    
    const effectiveFontType = config.font_type || global.global_font_type || 'A';
    const effectiveFontSize = config.font_size || global.global_font_size || 12;
    const isFontB = effectiveFontType === 'B';
    
    const style: React.CSSProperties = {
        fontWeight: config.bold ? 'bold' : 'normal',
        fontSize: `${effectiveFontSize}px`,
        transform: `scale(${isFontB ? (config.width_mult || 1) * 0.8 : (config.width_mult || 1)}, ${config.height_mult || 1})`,
        transformOrigin: config.align === 'center' ? 'center' : config.align === 'right' ? 'right' : 'left',
        display: 'inline-block',
        width: isFontB ? '125%' : '100%',
        marginLeft: isFontB && config.align === 'center' ? '-12.5%' : isFontB && config.align === 'right' ? '-25%' : '0',
        fontFamily: 'monospace',
        letterSpacing: isFontB ? '-0.5px' : 'normal',
        opacity: block.isVisible === false ? 0.3 : 1,
        lineHeight: '1.2'
    };

    const computedDiscount = Math.max(
        0,
        Number(((order.subtotal || 0) + (order.tax_total || 0) + (order.service_charge || 0) - (order.grand_total || 0)).toFixed(2))
    );

    switch (type) {
        case 'header':
            return (
                <div style={style}>
                    <div className="font-black truncate">
                        {(config.title || restaurant.name || "YUMMY").toUpperCase()}
                    </div>
                    {config.show_address !== false && restaurant.address && (
                        <div className="text-[0.8em] truncate">
                            {restaurant.address.toUpperCase()}
                        </div>
                    )}
                    {config.show_phone !== false && restaurant.phone && (
                        <div className="text-[0.8em]">
                            {config.phone_label || 'Phone'}: {restaurant.phone}
                        </div>
                    )}
                    {config.show_email === true && (restaurant as any).email && (
                        <div className="text-[0.8em]">
                            Email: {(restaurant as any).email}
                        </div>
                    )}
                    {config.show_pan === true && restaurant.pan_number && (
                        <div className="text-[0.8em]">
                            {config.pan_label || 'PAN No'}: {restaurant.pan_number}
                        </div>
                    )}
                    {config.tagline && <div className="text-[0.7em] italic mt-1">{config.tagline}</div>}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
            
        case 'divider':
            return (
                <div className="w-full overflow-hidden border-t border-dashed border-black/80 my-1 py-0.5" />
            );
            
        case 'bill_info': {
            const dateObj = new Date(order.created_at);
            const dateStr = dateObj.toLocaleDateString('en-GB');
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            
            const showTable = config.show_table ?? true;
            const showOrderId = config.show_order_id ?? true;
            const showStation = config.show_station === true;
            const showKotNum = config.show_kot_number === true;
            const showType = config.show_kot_type === true;
            const showDate = config.show_date === true;
            const showUser = config.show_user === true;
            const showTime = config.show_time === true;
            const showCategory = config.show_category === true;

            const hasDetailFlags = showKotNum || showStation || showType || showDate || showUser || showTime || showCategory;

            return (
                <div style={style} className="space-y-0.5 text-left">
                    {hasDetailFlags ? (
                        <>
                            {(showKotNum || showStation) && (
                                <div className="flex justify-between">
                                    {showKotNum && <span>{config.kot_label || 'KOT'}: #{order.id}</span>}
                                    {showStation && <span className="text-right">{config.station_label || 'STATION'}: {(order as any).station_name || '-'}</span>}
                                </div>
                            )}
                            {(showType || showTable) && (
                                <div className="flex justify-between">
                                    {showType && <span>{config.type_label || 'TYPE'}: {order.channel || 'INITIAL'}</span>}
                                    {showTable && <span className="text-right">{config.table_label || 'TABLE'}: {order.table_name || '-'}</span>}
                                </div>
                            )}
                            {(showOrderId || showDate) && (
                                <div className="flex justify-between">
                                    {showOrderId && <span>{config.order_label || 'Ref'}: #{order.restaurant_order_id || order.id}</span>}
                                    {showDate && <span className="text-right">{config.date_label || 'DATE'}: {dateStr}</span>}
                                </div>
                            )}
                            {(showUser || showTime) && (
                                <div className="flex justify-between">
                                    {showUser && <span>{config.user_label || 'USER'}: {order.created_by_name || '-'}</span>}
                                    {showTime && <span className="text-right">{config.time_label || 'TIME'}: {timeStr}</span>}
                                </div>
                            )}
                            {showCategory && (
                                <div>
                                    <span>{config.category_label || 'CATEGORY'}: -</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between">
                                <span>{config.bill_label || 'BILL'} #{order.restaurant_order_id || order.id}</span>
                                <span className="text-right">{dateStr}</span>
                            </div>
                            {showOrderId && (
                                <div>
                                    <span>{config.order_label || 'Order'} #{order.id}</span>
                                </div>
                            )}
                            {showTable && (
                                <div>
                                    <span>{config.table_label || 'Table'}: {order.table_name || '-'}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
        }
        
        case 'customer':
            if (!order.customer_name) return null;
            return (
                <div style={style} className="text-left py-0.5">
                    <div className="font-bold">{order.customer_name}</div>
                    {config.show_phone !== false && order.customer_phone && <div>{order.customer_phone}</div>}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
            
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
                    {order.items.map((item, idx) => (
                        <div key={item.id} className="flex justify-between mb-1 items-start">
                            {config.show_serial !== false && <span className="w-8">{idx + 1}</span>}
                            <span className="flex-1 text-left px-2">
                                {item.name_snapshot || item.item_name}
                                {item.notes && <div className="text-[0.8em] italic">({item.notes})</div>}
                            </span>
                            {config.show_rate !== false && <span className="w-12 text-right">{Number(item.unit_price).toFixed(2)}</span>}
                            <span className="w-8 text-right">{item.qty}</span>
                            {config.show_amount !== false && <span className="w-12 text-right">{Number(item.line_total).toFixed(2)}</span>}
                        </div>
                    ))}
                    <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
                </div>
            );
            
        case 'totals':
            return (
                <div style={style} className="space-y-0.5">
                    {config.show_discount !== false && computedDiscount > 0 && (
                        <div className="flex justify-between">
                            <span>{config.discount_label || 'Discount'}</span>
                            <span>-Rs. {computedDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="border-t-2 border-double border-black pt-0.5 mt-0.5" />
                    <div className="flex justify-between font-black">
                        <span>{config.total_label || 'TOTAL'}</span>
                        <span>Rs. {Number(order.grand_total).toFixed(2)}</span>
                    </div>
                </div>
            );
            
        case 'payments':
            const hasPayments = order.payments && order.payments.length > 0;
            const totalPaid = Number(data.total_paid || 0);
            const balanceDue = Number(data.balance_due || 0);
            
            if (!hasPayments && totalPaid === 0 && balanceDue === 0) return null;
            
            return (
                <div style={style} className="space-y-0.5">
                    <div className="w-full overflow-hidden border-t border-dashed border-black" />
                    
                    {hasPayments && (
                        <>
                            <div className="font-black mt-1">
                                <span>{config.header_label || 'PAYMENTS'}</span>
                            </div>
                            {order.payments?.map(p => (
                                <div key={p.id} className="flex justify-between">
                                    <span className="capitalize">{p.method}</span>
                                    <span>Rs. {Number(p.amount).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="w-full overflow-hidden border-t border-dashed border-black mt-1 mb-1" />
                        </>
                    )}
                    
                    <div className="flex justify-between font-bold">
                        <span>Paid:</span>
                        <span>Rs. {totalPaid.toFixed(2)}</span>
                    </div>
                    {balanceDue > 0 && (
                        <div className="flex justify-between font-bold text-[1.1em]">
                            <span>Due:</span>
                            <span>Rs. {balanceDue.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            );
            
        case 'qr':
            return (
                <div style={style} className="flex flex-col items-center gap-1 py-2">
                    <div className="w-20 h-20 border border-black flex items-center justify-center p-2 rounded">
                        <QrCode className="w-full h-full" />
                    </div>
                    {config.label && <div className="font-bold text-[0.8em]">{config.label}</div>}
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
                    {config.text || ""}
                </div>
            );
            
        default:
            return null;
    }
}
