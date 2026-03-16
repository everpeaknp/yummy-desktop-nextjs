"use client";

import React from "react";
import { ReceiptData } from "@/types/order";
import { numberToWords } from "@/lib/utils/number-to-words";

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
            // Config is spread at root by the designer, so we use the whole block as config
            config: b.config ? { ...b, ...b.config } : b,
        }));

    const filteredBlocks = blocks.filter(b => {
        if (!b.isVisible) return false;
        if (mode === 'bill' && !b.showOnBill) return false;
        if (mode === 'receipt' && !b.showOnReceipt) return false;
        return true;
    });

    const paperWidth = globalConfig.paper_size === '58mm' ? '58mm' : '80mm';
    const baseFontSize = globalConfig.global_font_size || 12;
    const ff = "'Helvetica Neue', Helvetica, Arial, sans-serif";

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

    return (
        <div className="thermal-receipt" style={wrap}>
            {filteredBlocks.map((block, idx) => (
                <div key={block.id} style={{ width: '100%', marginBottom: idx < filteredBlocks.length - 1 ? '12px' : '0' }}>
                    {renderBlock(block, globalConfig, data, ff, baseFontSize)}
                </div>
            ))}
        </div>
    );
}

function renderBlock(block: any, global: any, data: ReceiptData, ff: string, baseFs: number) {
    const { config, type } = block;
    const { order, restaurant } = data;
    const fs = config.font_size || baseFs;

    const base: React.CSSProperties = { fontFamily: ff, fontSize: `${fs}px`, width: '100%', boxSizing: 'border-box' };
    const row = (a: React.ReactNode, b: React.ReactNode, style?: React.CSSProperties): React.ReactNode => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...style }}>{a}{b}</div>
    );

    switch (type) {
        case 'header':
            return (
                <div style={{ ...base, textAlign: 'center', paddingBottom: '8px' }}>
                    {/* Restaurant Name */}
                    <div style={{ fontWeight: 700, fontSize: `${fs + 8}px`, lineHeight: 1.1, marginBottom: '6px' }}>
                        {config.title || restaurant.name}
                    </div>
                    {/* Address */}
                    {config.show_address !== false && restaurant.address && (
                        <div style={{ fontSize: `${fs - 1}px`, lineHeight: 1.5, marginBottom: '4px', color: '#1a1a1a' }}>
                            {restaurant.address}
                        </div>
                    )}
                    {/* Phone */}
                    {config.show_phone !== false && restaurant.phone && (
                        <div style={{ fontSize: `${fs - 1}px`, marginBottom: '3px' }}>
                            {config.phone_label || 'Contact No'}: {restaurant.phone}
                        </div>
                    )}
                    {/* PAN */}
                    {restaurant.pan_number && (
                        <div style={{ fontSize: `${fs - 1}px`, marginBottom: '8px' }}>
                            PAN No: {restaurant.pan_number}
                        </div>
                    )}
                    {/* Title divider */}
                    <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />
                    <div style={{ fontWeight: 700, fontSize: `${fs + 3}px`, letterSpacing: '0.2px', paddingTop: '4px' }}>
                        Bill Receipt
                    </div>
                </div>
            );

        case 'divider':
            return <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '4px 0' }} />;

        case 'bill_info': {
            const date = new Date(order.created_at);
            const dateStr = date.toLocaleDateString('en-GB');
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            return (
                <div style={{ ...base, marginTop: '4px' }}>
                    <div style={{ borderTop: '1px solid #000', marginBottom: '8px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: `${fs - 3}px`, color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Date</div>
                            <div style={{ fontWeight: 500, fontSize: `${fs}px` }}>{dateStr}</div>
                            <div style={{ fontWeight: 500, fontSize: `${fs}px` }}>{timeStr}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: `${fs - 3}px`, color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Order No.</div>
                            <div style={{ fontWeight: 500, fontSize: `${fs}px` }}>{order.restaurant_order_id || order.id}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: `${fs - 3}px`, color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Table</div>
                            <div style={{ fontWeight: 600, fontSize: `${fs + 2}px` }}>{order.table_name || 'N/A'}</div>
                        </div>
                    </div>
                    <div style={{ borderBottom: '1px solid #000' }} />
                </div>
            );
        }

        case 'customer':
            if (!order.customer_name) return null;
            return (
                <div style={{ ...base, fontSize: `${fs - 1}px`, padding: '4px 0', borderBottom: '1px solid #eee' }}>
                    <strong>{config.customer_label || 'Customer'}:</strong> {order.customer_name}
                    {config.show_phone !== false && order.customer_phone && (
                        <span style={{ color: '#666', marginLeft: '6px' }}>({order.customer_phone})</span>
                    )}
                </div>
            );

        case 'items': {
            const showSN  = config.show_serial  !== false;
            const showRate = config.show_rate   !== false;
            const showAmt  = config.show_amount !== false;

            // Column widths optimized for spacing
            const snW    = '24px';
            const qtyW   = '32px';
            const rateW  = showRate ? '50px' : '0';
            const amtW   = showAmt  ? '54px' : '0';

            const cellH: React.CSSProperties = { fontWeight: 700, fontSize: `${fs - 2}px`, textTransform: 'uppercase', flexShrink: 0, letterSpacing: '0.5px' };
            const cellB: React.CSSProperties = { fontSize: `${fs}px`, flexShrink: 0 };

            return (
                <div style={{ ...base, marginTop: '4px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
                        {showSN && <span style={{ ...cellH, width: snW, textAlign: 'left' }}>SN</span>}
                        <span style={{ ...cellH, flex: 1, paddingLeft: '6px', textAlign: 'left' }}>{config.item_label || 'Particular'}</span>
                        <span style={{ ...cellH, width: qtyW, textAlign: 'center' }}>{config.qty_label || 'Qty'}</span>
                        {showRate && <span style={{ ...cellH, width: rateW, textAlign: 'right' }}>{config.rate_label || 'Rate'}</span>}
                        {showAmt  && <span style={{ ...cellH, width: amtW,  textAlign: 'right', paddingLeft: '8px' }}>{config.amount_label || 'Amt'}</span>}
                    </div>

                    {/* Rows */}
                    {order.items.map((item, idx) => (
                        <div key={item.id} style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                {showSN && <span style={{ ...cellB, width: snW, flexShrink: 0, fontWeight: 500 }}>{idx + 1}</span>}
                                <span style={{ flex: 1, paddingLeft: '6px' }}>
                                    <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{item.name_snapshot}</div>
                                    {item.notes && <div style={{ fontSize: `${fs - 2}px`, color: '#666', fontStyle: 'italic', marginTop: '2px' }}>({item.notes})</div>}
                                </span>
                                <span style={{ ...cellB, width: qtyW, textAlign: 'center', fontWeight: 500 }}>{item.qty}</span>
                                {showRate && <span style={{ ...cellB, width: rateW, textAlign: 'right' }}>{item.unit_price.toFixed(0)}</span>}
                                {showAmt  && <span style={{ ...cellB, width: amtW, textAlign: 'right', paddingLeft: '8px', fontWeight: 800 }}>{item.line_total.toFixed(0)}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        case 'totals':
            return (
                <div style={{ ...base, marginTop: '8px' }}>
                    <div style={{ border: '1.5px solid #000', padding: '12px 14px' }}>
                        {/* Subtotal */}
                        {row(
                            <span style={{ fontWeight: 500, fontSize: `${fs + 1}px` }}>{config.subtotal_label || 'Subtotal'}:</span>,
                            <span style={{ fontWeight: 500, fontSize: `${fs + 1}px` }}>Rs. {order.subtotal.toFixed(2)}</span>
                        )}

                        {/* Tax */}
                        {config.show_tax !== false && order.tax_total > 0 && (
                            <div style={{ marginTop: '5px' }}>
                                {row(
                                    <span style={{ fontSize: `${fs}px`, color: '#333' }}>{config.tax_label || 'Tax (13%)'}:</span>,
                                    <span style={{ fontSize: `${fs}px`, color: '#333' }}>Rs. {order.tax_total.toFixed(2)}</span>
                                )}
                            </div>
                        )}

                        {/* Separator */}
                        <div style={{ borderTop: '1px solid #000', margin: '10px 0', opacity: 0.8 }} />

                        {/* Grand Total */}
                        {row(
                            <span style={{ fontWeight: 900, fontSize: `${fs + 5}px`, letterSpacing: '-0.5px' }}>{config.total_label || 'Grand Total'}:</span>,
                            <span style={{ fontWeight: 900, fontSize: `${fs + 5}px`, letterSpacing: '-0.5px' }}>Rs. {order.grand_total.toFixed(2)}</span>
                        )}

                        {/* Amount in words */}
                        <div style={{ borderTop: '1px solid #eee', marginTop: '8px', paddingTop: '8px', fontSize: `${fs - 1}px`, fontStyle: 'italic', lineHeight: 1.4, color: '#1a1a1a', fontWeight: 500 }}>
                            Total in Words: {numberToWords(order.grand_total)} Only
                        </div>
                    </div>
                </div>
            );

        case 'payments':
            if (!order.payments || order.payments.length === 0) return null;
            return (
                <div style={{ ...base, marginTop: '8px', padding: '0 4px' }}>
                    {order.payments.map(p => (
                        <div key={p.id} style={{ marginBottom: '5px' }}>
                            {row(
                                <span style={{ fontSize: `${fs}px`, fontWeight: 700, textTransform: 'capitalize' }}>{p.method} Received:</span>,
                                <span style={{ fontSize: `${fs}px`, fontWeight: 600 }}>Rs. {p.amount.toFixed(2)}</span>
                            )}
                        </div>
                    ))}
                </div>
            );

        case 'qr':
            return (
                <div style={{ ...base, textAlign: 'center', padding: '12px 0', borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', margin: '8px 0' }}>
                    <div style={{ width: '85px', height: '85px', border: '1px solid #000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px', background: '#fff', padding: '5px' }}>
                        <svg width="65" height="65" viewBox="0 0 100 100" fill="#000">
                            <rect x="10" y="10" width="30" height="30" /><rect x="60" y="10" width="30" height="30" />
                            <rect x="10" y="60" width="30" height="30" /><rect x="50" y="50" width="10" height="10" />
                            <rect x="65" y="65" width="10" height="10" />
                        </svg>
                    </div>
                    {config.label && <div style={{ fontSize: `${fs - 1}px`, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{config.label}</div>}
                </div>
            );

        case 'footer':
            return (
                <div style={{ ...base, marginTop: '10px' }}>
                    {/* Printed By / Print Time */}
                    <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginBottom: '8px' }}>
                        {row(
                            <div>
                                <div style={{ fontSize: `${fs - 3}px`, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Printed By</div>
                                <div style={{ fontSize: `${fs}px`, fontWeight: 500 }}>{order.created_by_name || 'default'}</div>
                            </div>,
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: `${fs - 3}px`, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Print Time</div>
                                <div style={{ fontSize: `${fs}px`, fontWeight: 500 }}>
                                    {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Disclaimer */}
                    <div style={{ fontSize: `${fs - 2}px`, fontStyle: 'italic', color: '#444', textAlign: 'center', lineHeight: 1.6, marginTop: '12px', marginBottom: '15px', padding: '0 8px' }}>
                        {config.message_hint || 'This bill is provided for estimation purposes only. Kindly collect the original invoice from the counter.'}
                    </div>

                    {/* Thank You */}
                    <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: `${fs + 4}px`, letterSpacing: '5px', textTransform: 'uppercase' }}>
                        {config.message || 'THANK YOU'}
                    </div>
                </div>
            );

        case 'text':
            return <div style={{ ...base, padding: '4px 0', lineHeight: 1.6 }}>{config.text}</div>;

        default:
            return null;
    }
}
