"use client";

import React, { useEffect, useRef, useState } from "react";
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
  Languages,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Types ---

export type BlockType =
  | "header"
  | "bill_info"
  | "customer"
  | "items"
  | "totals"
  | "payments"
  | "partial_pay"
  | "footer"
  | "text"
  | "divider"
  | "qr"
  | "global_settings";

export interface ReceiptBlock {
  id: string;
  type: BlockType;
  config: Record<string, any>;
  isVisible: boolean;
  showOnBill: boolean;
  showOnReceipt: boolean;
}

export interface GlobalConfig {
  global_font_type: "A" | "B";
  global_font_size: number;
  line_spacing: number;
  paper_size: "58mm" | "80mm";
  column_capacity: number;
  bill_copies?: number;
  receipt_copies?: number;
  print_copies?: number;
}

// --- Icons Mapping ---

export const BLOCK_METADATA: Record<
  BlockType,
  { title: string; icon: any; description: string }
> = {
  header: { title: "Header", icon: Store, description: "Branding & address" },
  bill_info: {
    title: "Bill Info",
    icon: Info,
    description: "Bill #, Table, Date",
  },
  customer: {
    title: "Customer Info",
    icon: User,
    description: "Name and phone",
  },
  items: {
    title: "Items Table",
    icon: TableIcon,
    description: "List of items & qty",
  },
  totals: {
    title: "Totals",
    icon: Calculator,
    description: "Subtotal, Tax, Total",
  },
  payments: {
    title: "Payments",
    icon: CreditCard,
    description: "Payment breakdown",
  },
  partial_pay: {
    title: "Partial Payments",
    icon: Banknote,
    description: "Split pay details",
  },
  footer: {
    title: "Footer",
    icon: ArrowDown,
    description: "Thank you message",
  },
  text: { title: "Custom Text", icon: Type, description: "Custom message" },
  divider: { title: "Divider", icon: Minus, description: "Separator line" },
  qr: { title: "QR Code", icon: QrCode, description: "Payment QR" },
  global_settings: {
    title: "Global Settings",
    icon: Settings,
    description: "Printer-wide config",
  },
};

// --- Config Widgets ---

export const FontSizeSlider = ({
  value,
  onChange,
  label = "Font Size",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
        {label}
      </Label>
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

export const LineSpacingSlider = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
        Line Spacing
      </Label>
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

export const MultiplierSlider = ({
  value,
  onChange,
  label,
  max = 8,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  max?: number;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
        {label}
      </Label>
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

export const FontSelector = ({
  value,
  onChange,
}: {
  value: "A" | "B";
  onChange: (v: "A" | "B") => void;
}) => (
  <div className="space-y-2">
    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
      Font Type
    </Label>
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant={value === "A" ? "secondary" : "outline"}
        size="sm"
        onClick={() => onChange("A")}
        className="h-8 text-[10px] font-bold"
      >
        Font A
      </Button>
      <Button
        variant={value === "B" ? "secondary" : "outline"}
        size="sm"
        onClick={() => onChange("B")}
        className="h-8 text-[10px] font-bold"
      >
        Font B
      </Button>
    </div>
  </div>
);

export const AlignmentSelector = ({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (v: "left" | "center" | "right") => void;
}) => (
  <div className="space-y-2">
    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
      Alignment
    </Label>
    <div className="flex bg-muted p-1 rounded-lg border border-border/40">
      {(["left", "center", "right"] as const).map((align) => (
        <Button
          key={align}
          variant={value === align ? "secondary" : "ghost"}
          size="icon"
          onClick={() => onChange(align)}
          className="h-7 w-full"
        >
          {align === "left" && <AlignLeft className="w-3 h-3" />}
          {align === "center" && <AlignCenter className="w-3 h-3" />}
          {align === "right" && <AlignRight className="w-3 h-3" />}
        </Button>
      ))}
    </div>
  </div>
);

export const SpacingControls = ({
  top,
  bottom,
  onChange,
}: {
  top: number;
  bottom: number;
  onChange: (key: "padding_top" | "padding_bottom", v: number) => void;
}) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
        Pad Top
      </Label>
      <Input
        type="number"
        value={top}
        onChange={(e) => onChange("padding_top", parseInt(e.target.value) || 0)}
        className="h-8 text-[10px] font-bold"
      />
    </div>
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
        Pad Bottom
      </Label>
      <Input
        type="number"
        value={bottom}
        onChange={(e) =>
          onChange("padding_bottom", parseInt(e.target.value) || 0)
        }
        className="h-8 text-[10px] font-bold"
      />
    </div>
  </div>
);

// --- Blocks Palette ---

export const BlockPalette = ({
  onAdd,
  blocks = [],
  onSelect,
}: {
  onAdd: (type: BlockType) => void;
  blocks?: ReceiptBlock[];
  onSelect?: (id: string) => void;
}) => {
  return (
    <div className="divide-y divide-border">
      {(Object.entries(BLOCK_METADATA) as [BlockType, any][])
        .filter(([type]) => type !== "global_settings")
        .map(([type, meta]) => {
          const existingBlock = blocks.find((block) => block.type === type);
          const enabled = Boolean(existingBlock?.isVisible);
          return (
            <button
              type="button"
              key={type}
              className="group flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              onClick={() =>
                existingBlock ? onSelect?.(existingBlock.id) : onAdd(type)
              }
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:text-primary">
                <meta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium">{meta.title}</h4>
                <p className="truncate text-xs text-muted-foreground">
                  {existingBlock
                    ? enabled
                      ? meta.description
                      : "Disabled"
                    : meta.description}
                </p>
              </div>
              {existingBlock ? (
                <Check
                  className={cn(
                    "h-4 w-4",
                    enabled ? "text-emerald-600" : "text-muted-foreground",
                  )}
                />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              )}
            </button>
          );
        })}
    </div>
  );
};

// --- Thermal Preview ---

export const ThermalPreview = ({
  blocks,
  globalConfig,
  mode = "receipt",
  selectedId,
  onSelect,
  context,
}: {
  blocks: ReceiptBlock[];
  globalConfig: GlobalConfig;
  mode?: "bill" | "receipt" | "kot";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  context?: PreviewContext;
}) => {
  const is58mm = globalConfig.paper_size === "58mm";
  const paperWidth = is58mm ? "220px" : "300px";
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const hasInitialSelection = useRef(false);

  const filteredBlocks = blocks.filter((b) => {
    if (!b.isVisible) return false;
    if (mode === "bill" && !b.showOnBill) return false;
    if (mode === "receipt" && !b.showOnReceipt) return false;
    return true;
  });
  const documentNotice = previewDocumentNotice(mode, context);
  const staffConfig =
    blocks.find((block) => block.type === "bill_info")?.config || {};

  useEffect(() => {
    if (!selectedId) return;
    if (!hasInitialSelection.current) {
      hasInitialSelection.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      blockRefs.current.get(selectedId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, mode]);

  return (
    <div
      className="bg-white text-black shadow-2xl mx-auto min-h-[500px] font-mono leading-tight p-4 relative overflow-hidden transition-all duration-500 ease-in-out origin-top border-x-8 border-white group"
      style={{
        width: paperWidth,
        fontSize: `${globalConfig.global_font_size}px`,
        lineHeight: globalConfig.line_spacing,
      }}
    >
      {/* Paper Texture Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />

      {/* Edge Shadow */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />

      <div className="space-y-4">
        {documentNotice.length > 0 ? (
          <div className="border-b border-dashed border-black pb-3 text-center">
            {documentNotice.map((line, index) => (
              <div
                key={line}
                className={cn(
                  index === 0
                    ? "font-black"
                    : "text-[0.85em] font-normal normal-case",
                )}
              >
                {line}
              </div>
            ))}
            <div className="mt-1 text-[0.75em]">LAYOUT PREVIEW</div>
          </div>
        ) : null}
        {filteredBlocks.map((block) => {
          const isSelected = selectedId === block.id;
          return (
            <div
              key={block.id}
              ref={(node) => {
                if (node) blockRefs.current.set(block.id, node);
                else blockRefs.current.delete(block.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(block.id);
              }}
              title={`Click to edit ${BLOCK_METADATA[block.type].title}`}
              aria-label={`Edit ${BLOCK_METADATA[block.type].title}`}
              className={cn(
                "relative group cursor-pointer rounded-sm border-2 border-transparent transition-colors",
                isSelected
                  ? "-mx-1 border-primary bg-primary/10 px-1 ring-2 ring-primary/20 z-10"
                  : "hover:border-primary/40 hover:bg-primary/5",
              )}
              style={{
                paddingTop: `${block.config.padding_top || 0}px`,
                paddingBottom: `${block.config.padding_bottom || 0}px`,
                textAlign: (block.config.align as any) || "center",
              }}
            >
              {isSelected && (
                <div className="absolute -top-3 -right-3 bg-primary text-white p-1 rounded-full shadow-lg z-20">
                  <Settings className="w-3 h-3" />
                </div>
              )}
              {renderBlockPreview(block, globalConfig, context, staffConfig)}
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
  onDelete,
  mode = "receipt",
  protectedBlock = false,
}: {
  block: ReceiptBlock;
  onUpdate: (updates: Partial<ReceiptBlock>) => void;
  onDelete: () => void;
  mode?: "receipt" | "kot";
  protectedBlock?: boolean;
}) => {
  const meta = BLOCK_METADATA[block.type];
  const [stylingOpen, setStylingOpen] = useState(false);

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
            <h3 className="text-sm font-semibold leading-none">{meta.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {meta.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {block.type !== "global_settings" && (
            <div className="flex items-center gap-2 mr-2 bg-muted/50 px-2 py-1 rounded-md border border-border/40">
              <Label className="text-xs text-muted-foreground">Enabled</Label>
              <Switch
                className="scale-75"
                checked={protectedBlock ? true : block.isVisible}
                onCheckedChange={(val) => onUpdate({ isVisible: val })}
                disabled={protectedBlock}
              />
            </div>
          )}
          {block.type !== "global_settings" && !protectedBlock && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Visibility Toggles */}
      {block.type !== "global_settings" && mode === "receipt" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
            <Label className="text-[10px] uppercase font-black opacity-60">
              On Bill
            </Label>
            <Switch
              checked={block.showOnBill}
              onCheckedChange={(val) => onUpdate({ showOnBill: val })}
              disabled={protectedBlock}
            />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
            <Label className="text-[10px] uppercase font-black opacity-60">
              On Receipt
            </Label>
            <Switch
              checked={protectedBlock ? true : block.showOnReceipt}
              onCheckedChange={(val) => onUpdate({ showOnReceipt: val })}
              disabled={protectedBlock}
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Specific Configs */}
        {renderConfigFields(block, updateConfig, mode)}

        {/* Advanced styling stays available without dominating routine editing. */}
        {block.type !== "global_settings" && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between text-left text-sm font-medium"
              onClick={() => setStylingOpen((open) => !open)}
              aria-expanded={stylingOpen}
            >
              <span>Block styling</span>
              {stylingOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {stylingOpen ? (
              <div className="space-y-6 pb-2 pt-3">
                {block.type !== "divider" ? (
                  <>
                    <FontSelector
                      value={block.config.font_type || "A"}
                      onChange={(v) => updateConfig("font_type", v)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FontSizeSlider
                        value={block.config.font_size || 12}
                        onChange={(v) => updateConfig("font_size", v)}
                      />
                      <div className="flex items-center gap-4 pt-6">
                        <Label className="flex cursor-pointer items-center gap-2">
                          <Switch
                            checked={block.config.bold || false}
                            onCheckedChange={(val) => updateConfig("bold", val)}
                          />
                          <Bold className="h-4 w-4" />
                        </Label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MultiplierSlider
                        label="Width multiplier"
                        value={block.config.width_mult || 1}
                        onChange={(v) => updateConfig("width_mult", v)}
                      />
                      <MultiplierSlider
                        label="Height multiplier"
                        value={block.config.height_mult || 1}
                        onChange={(v) => updateConfig("height_mult", v)}
                      />
                    </div>
                    <AlignmentSelector
                      value={block.config.align || "center"}
                      onChange={(v) => updateConfig("align", v)}
                    />
                  </>
                ) : null}
                <SpacingControls
                  top={block.config.padding_top || 0}
                  bottom={block.config.padding_bottom || 0}
                  onChange={updateConfig}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export const MobileDesignerEditorSheet = ({
  open,
  onOpenChange,
  block,
  globalConfig,
  mode,
  position,
  blockCount,
  onUpdateBlock,
  onUpdateGlobal,
  onMove,
  onDelete,
  onCancel,
  onSave,
  protectedBlock = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: ReceiptBlock | null;
  globalConfig: GlobalConfig | null;
  mode: "receipt" | "kot";
  position: number | null;
  blockCount: number;
  onUpdateBlock: (updates: Partial<ReceiptBlock>) => void;
  onUpdateGlobal: (updates: GlobalConfig) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  protectedBlock?: boolean;
}) => {
  const isGlobal = globalConfig !== null;
  const title = isGlobal
    ? "Print defaults"
    : block
      ? BLOCK_METADATA[block.type].title
      : "Layout settings";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 xl:hidden"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">
          Edit the selected print layout settings.
        </SheetDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-10 sm:px-6">
          {isGlobal && globalConfig ? (
            <ConfigPanel
              block={{
                id: "global",
                type: "global_settings",
                config: globalConfig,
                isVisible: true,
                showOnBill: true,
                showOnReceipt: true,
              }}
              onUpdate={(updates) =>
                onUpdateGlobal(updates.config as GlobalConfig)
              }
              onDelete={() => {}}
              mode={mode}
            />
          ) : block ? (
            <>
              <ConfigPanel
                block={block}
                onUpdate={onUpdateBlock}
                onDelete={onDelete}
                mode={mode}
                protectedBlock={protectedBlock}
              />
              <div className="mt-6 border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium">Position</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2"
                    onClick={() => onMove("up")}
                    disabled={position === null || position === 0}
                  >
                    <ArrowDown className="h-4 w-4 rotate-180" />
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-2"
                    onClick={() => onMove("down")}
                    disabled={position === null || position === blockCount - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                    Move down
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" className="h-11" onClick={onSave}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
  opened_by?: string;
  handled_by?: string[];
  settled_by?: string;
  service_duration_minutes?: number;
  category?: string;
  // Customer sample data
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_pan?: string;
  fiscal_registration_type?: "unverified" | "pan_only" | "vat";
  fiscal_billing_mode?:
    "legacy_flexible" | "pan_invoice" | "vat_external" | "vat_ebilling";
  document_family?:
    "pre_bill" | "payment_receipt" | "tax_invoice" | "credit_note";
  document_title?: string;
  document_message?: string;
  station_ticket_title?: string;
  subtotal?: string;
  tax?: string;
  service_charge?: string;
  discount?: string;
  total?: string;
  amount_in_words?: string;
  total_paid?: string;
  balance_due?: string;
  change_returned?: string;
  settlement?: string;
  items?: Array<{
    name: string;
    qty: string;
    rate?: string;
    amount?: string;
    fiscal_code?: string;
    unit?: string;
    notes?: string;
    modifiers?: string[];
  }>;
  payments?: Array<{ method: string; amount: string; reference?: string }>;
}

function previewDocumentNotice(
  mode: "bill" | "receipt" | "kot",
  context?: PreviewContext,
): string[] {
  if (mode === "kot") return [];
  if (context?.document_family === "tax_invoice") return ["TAX INVOICE"];
  if (context?.document_family === "credit_note") return ["CREDIT NOTE"];
  if (mode === "bill") {
    return [
      context?.document_title || "PRE-BILL",
      context?.document_message || "",
    ].filter(Boolean);
  }
  if (context?.document_family === "payment_receipt") {
    const registration = context?.fiscal_registration_type ?? "unverified";
    const billingMode = context?.fiscal_billing_mode ?? "legacy_flexible";
    const defaultMessage =
      registration === "vat" && billingMode === "vat_external"
        ? "Tax invoice issued separately"
        : "Not a tax invoice";
    return [
      context?.document_title || "PAYMENT RECEIPT",
      context?.document_message ?? defaultMessage,
    ].filter(Boolean);
  }
  const registration = context?.fiscal_registration_type ?? "unverified";
  const billingMode = context?.fiscal_billing_mode ?? "legacy_flexible";
  if (registration !== "vat") {
    return ["PAYMENT RECEIPT", "Not a tax invoice"];
  }
  if (billingMode === "vat_external") {
    return ["PAYMENT RECEIPT", "Tax invoice issued separately"];
  }
  if (billingMode !== "vat_ebilling") {
    return ["PAYMENT RECEIPT", "Not a tax invoice"];
  }
  return ["TAX INVOICE"];
}

function renderPreviewStaffAttribution(
  config: Record<string, any>,
  context?: PreviewContext,
) {
  const explicitMode = config.staff_attribution_mode;
  const showUser = explicitMode
    ? explicitMode !== "hidden"
    : (config.show_user ?? true);
  const mode = String(explicitMode || (showUser ? "compact" : "hidden"));
  if (!showUser || mode === "hidden") return null;

  const handlers = context?.handled_by || [
    context?.user || "BHAVANA",
    "MANDEEP",
    "SITA",
  ];
  const staff = handlers.join(", ");

  return (
    <div className="mt-1 space-y-0.5 border-t border-dashed border-black pt-1 text-left">
      {mode === "opened_settled" ? (
        <>
          <div>
            Opened by: {context?.opened_by || context?.user || "BHAVANA"}
          </div>
          <div>Handled by: {staff}</div>
          <div>Settled by: {context?.settled_by || "MANDEEP"}</div>
        </>
      ) : (
        <div>Served by: {staff}</div>
      )}
      {config.show_service_duration === true ? (
        <div>
          Service duration:{" "}
          {formatPreviewDuration(context?.service_duration_minutes ?? 100)}
        </div>
      ) : null}
    </div>
  );
}

function formatPreviewDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.trunc(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(
      `${remainingMinutes} ${remainingMinutes === 1 ? "min" : "mins"}`,
    );
  }
  return parts.join(" ");
}

function renderBlockPreview(
  block: ReceiptBlock,
  global: GlobalConfig,
  context?: PreviewContext,
  staffConfig: Record<string, any> = {},
) {
  const { config, type } = block;
  const effectiveFontType = config.font_type || global.global_font_type;
  const effectiveFontSize = config.font_size || global.global_font_size;
  const isFontB = effectiveFontType === "B";

  const style = {
    fontWeight: config.bold ? "bold" : "normal",
    fontSize: `${effectiveFontSize}px`,
    transform: `scale(${isFontB ? (config.width_mult || 1) * 0.8 : config.width_mult || 1}, ${config.height_mult || 1})`,
    transformOrigin:
      config.align === "center"
        ? "center"
        : config.align === "right"
          ? "right"
          : "left",
    display: "inline-block",
    width: isFontB ? "125%" : "100%", // Compensate for scaleX shrinking width
    marginLeft:
      isFontB && config.align === "center"
        ? "-12.5%"
        : isFontB && config.align === "right"
          ? "-25%"
          : "0",
    fontFamily: "monospace",
    letterSpacing: isFontB ? "-0.5px" : "normal",
    opacity: block.isVisible === false ? 0.3 : 1,
    lineHeight: "1.2",
  };

  switch (type) {
    case "header":
      return (
        <div style={style}>
          <div className="font-black truncate">
            {resolvePreviewPlaceholders(
              config.title || context?.restaurant_name || "YUMMY RESTAURANT",
              context,
            ).toUpperCase()}
          </div>
          {config.show_address !== false && (
            <div className="text-[0.8em] truncate">
              {resolvePreviewPlaceholders(
                config.address || context?.address || "KATHMANDU, NEPAL",
                context,
              ).toUpperCase()}
            </div>
          )}
          {config.show_phone !== false && (
            <div className="text-[0.8em]">
              {config.phone_label || "Phone"}:{" "}
              {resolvePreviewPlaceholders(
                config.phone || context?.phone || "9800000000",
                context,
              )}
            </div>
          )}
          {config.show_email === true && (
            <div className="text-[0.8em]">
              Email:{" "}
              {resolvePreviewPlaceholders(
                context?.email || "contact@yummy.com",
                context,
              )}
            </div>
          )}
          {config.show_pan === true && (
            <div className="text-[0.8em]">
              {config.pan_label || "PAN No"}:{" "}
              {resolvePreviewPlaceholders(
                config.pan || context?.pan || "PAN-987654321",
                context,
              )}
            </div>
          )}
          {config.tagline && (
            <div className="text-[0.7em] italic mt-1">
              {resolvePreviewPlaceholders(config.tagline, context)}
            </div>
          )}
          <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
        </div>
      );
    case "divider":
      return (
        <div className="w-full overflow-hidden border-t border-dashed border-black my-1" />
      );
    case "bill_info": {
      const fiscalDocument =
        context?.document_family === "tax_invoice" ||
        context?.document_family === "credit_note";
      if (fiscalDocument) {
        return (
          <div style={style} className="space-y-0.5 text-left">
            <div className="flex justify-between">
              <span>
                {context.document_family === "credit_note"
                  ? "Credit note"
                  : "Invoice"}
                : 000123
              </span>
              <span>{context?.date || "03/02/2026"}</span>
            </div>
            <div>Fiscal year: 2083/084</div>
            {config.show_order_id !== false ? (
              <div>Order: #{context?.order_id || "10"}</div>
            ) : null}
            {config.show_table !== false ? (
              <div>Table / service: {context?.table_name || "4"}</div>
            ) : null}
            <div className="mt-1 w-full overflow-hidden border-t border-dashed border-black" />
          </div>
        );
      }
      // Match Flutter's visibility defaults exactly
      const showTable = config.show_table ?? true; // default true
      const showOrderId = config.show_order_id ?? true; // default true
      const showStation = config.show_station === true; // default false
      const showKotNum = config.show_kot_number === true; // default false
      const showType = config.show_kot_type === true; // default false
      const showDate = config.show_date ?? true;
      const showUser = config.show_user ?? true;
      const showTime = config.show_time ?? true;
      const showCategory = config.show_category === true; // default false

      // Legacy fallback: if no KOT/detail flags are set, show simple bill format
      const hasDetailFlags =
        showKotNum ||
        showStation ||
        showType ||
        showDate ||
        showUser ||
        showTime ||
        showCategory;

      return (
        <div style={style} className="space-y-0.5 text-left">
          {hasDetailFlags ? (
            <>
              {/* Row 1: KOT # & Station */}
              {(showKotNum || showStation) && (
                <div className="flex justify-between">
                  {showKotNum && (
                    <span>
                      {config.kot_label || "KOT"}: #{context?.kot_no || "10-1"}
                    </span>
                  )}
                  {showStation && (
                    <span className="text-right">
                      {config.station_label || "STATION"}:{" "}
                      {context?.station || "KITCHEN"}
                    </span>
                  )}
                </div>
              )}

              {/* Row 2: Type & Table */}
              {(showType || showTable) && (
                <div className="flex justify-between">
                  {showType && (
                    <span>
                      {config.type_label || "TYPE"}:{" "}
                      {context?.type || "INITIAL"}
                    </span>
                  )}
                  {showTable && (
                    <span className="text-right">
                      {config.table_label || "TABLE"}:{" "}
                      {context?.table_name || "4"}
                    </span>
                  )}
                </div>
              )}

              {/* Row 3: Ref (Order ID) & Date */}
              {(showOrderId || showDate) && (
                <div className="flex justify-between">
                  {showOrderId && (
                    <span>
                      {config.order_label || "Ref"}: #
                      {context?.order_id || "10"}
                    </span>
                  )}
                  {showDate && (
                    <span className="text-right">
                      {config.date_label || "DATE"}:{" "}
                      {context?.date || "03/02/2026"}
                    </span>
                  )}
                </div>
              )}

              {/* Row 4: Order time */}
              {showTime && (
                <div>
                  {config.time_label || "TIME"}: {context?.time || "15:30"}
                </div>
              )}

              {/* Row 5: Category */}
              {showCategory && (
                <div>
                  <span>
                    {config.category_label || "CATEGORY"}:{" "}
                    {context?.category || "GARDEN"}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Legacy/simple bill format - when no detail KOT flags set */}
              <div className="flex justify-between">
                <span>
                  {config.bill_label || "BILL"} #
                  {context?.bill_no || "REC-000869"}
                </span>
                <span className="text-right">
                  {context?.date || "03/02/2026"}
                </span>
              </div>
              {showOrderId && (
                <div>
                  <span>
                    {config.order_label || "Order"} #{context?.order_id || "10"}
                  </span>
                </div>
              )}
              {showTable && (
                <div>
                  <span>
                    {config.table_label || "Table"}:{" "}
                    {context?.table_name || "4"}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
        </div>
      );
    }
    case "items": {
      const showSerial = config.show_serial === true;
      const showRate = config.show_rate !== false;
      const showAmount = config.show_amount !== false;
      const items = context?.items?.length
        ? context.items
        : [
            {
              name: "Margherita Pizza",
              qty: "2",
              rate: "640.00",
              amount: "1,280.00",
              fiscal_code: "ITEM-001",
              unit: "plate",
              modifiers: ["Extra cheese"],
              notes: "No onion",
            },
            {
              name: "Coke",
              qty: "1",
              rate: "80.00",
              amount: "80.00",
              fiscal_code: "ITEM-002",
              unit: "bottle",
            },
          ];
      return (
        <div style={style}>
          <div
            className="grid gap-1 border-b border-dashed border-black pb-0.5 mb-1 font-bold"
            style={{
              gridTemplateColumns: `${showSerial ? "22px " : ""}minmax(0, 1fr) 30px ${showRate ? "48px " : ""}${showAmount ? "55px" : ""}`,
            }}
          >
            {showSerial && (
              <span className="w-8">{config.sn_label || "S.N"}</span>
            )}
            <span className="min-w-0 text-left">
              {config.item_label || "ITEM"}
            </span>
            <span className="text-right">{config.qty_label || "QTY"}</span>
            {showRate && (
              <span className="text-right">{config.rate_label || "RATE"}</span>
            )}
            {showAmount && (
              <span className="text-right">{config.amount_label || "AMT"}</span>
            )}
          </div>
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="mb-1">
              <div
                className="grid items-start gap-1"
                style={{
                  gridTemplateColumns: `${showSerial ? "22px " : ""}minmax(0, 1fr) 30px ${showRate ? "48px " : ""}${showAmount ? "55px" : ""}`,
                }}
              >
                {showSerial && <span>{index + 1}</span>}
                <span className="min-w-0 break-words text-left">
                  {item.name}
                </span>
                <span className="text-right tabular-nums">{item.qty}</span>
                {showRate && (
                  <span className="text-right tabular-nums">
                    {item.rate || "0.00"}
                  </span>
                )}
                {showAmount && (
                  <span className="text-right tabular-nums">
                    {item.amount || "0.00"}
                  </span>
                )}
              </div>
              {item.modifiers?.map((modifier) => (
                <div key={modifier} className="pl-4 text-left text-[0.8em]">
                  + {modifier}
                </div>
              ))}
              {item.notes ? (
                <div className="pl-4 text-left text-[0.8em]">
                  Note: {item.notes}
                </div>
              ) : null}
              {(context?.document_family === "tax_invoice" ||
                context?.document_family === "credit_note") &&
              (config.show_fiscal_code === true ||
                config.show_unit !== false) ? (
                <div className="pl-4 text-left text-[0.8em]">
                  {[
                    config.show_fiscal_code === true ? item.fiscal_code : null,
                    config.show_unit !== false ? item.unit : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              ) : null}
            </div>
          ))}
          <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
        </div>
      );
    }
    case "totals":
      return (
        <div style={style} className="space-y-0.5">
          {config.show_subtotal !== false && (
            <div className="flex justify-between">
              <span>{config.subtotal_label || "Subtotal"}</span>
              <span>{context?.subtotal || "NPR 1,360.00"}</span>
            </div>
          )}
          {config.show_tax !== false && (
            <div className="flex justify-between">
              <span>{config.tax_label || "Tax"}</span>
              <span>{context?.tax || "NPR 176.80"}</span>
            </div>
          )}
          {config.show_service_charge !== false && context?.service_charge && (
            <div className="flex justify-between">
              <span>{config.service_charge_label || "Service charge"}</span>
              <span>{context.service_charge}</span>
            </div>
          )}
          {config.show_discount !== false &&
            context?.discount !== "NPR 0.00" && (
              <div className="flex justify-between">
                <span>{config.discount_label || "Discount"}</span>
                <span>-{context?.discount || "NPR 0.00"}</span>
              </div>
            )}
          <div className="border-t-2 border-double border-black pt-0.5 mt-0.5" />
          <div className="flex justify-between font-black">
            <span>{config.total_label || "TOTAL"}</span>
            <span>{context?.total || "NPR 1,536.80"}</span>
          </div>
          <div className="pt-1 text-left text-[0.8em]">
            In words:{" "}
            {context?.amount_in_words ||
              "Nepalese Rupees One Thousand Five Hundred Thirty Six and Eighty Paisa Only"}
          </div>
        </div>
      );
    case "qr":
      return (
        <div style={style} className="flex flex-col items-center gap-1 py-2">
          <div className="w-20 h-20 border border-black flex items-center justify-center p-2 rounded">
            <QrCode className="w-full h-full" />
          </div>
        </div>
      );
    case "customer":
      return (
        <div style={style} className="text-left py-0.5">
          <div className="font-bold">
            {context?.document_family === "tax_invoice" ||
            context?.document_family === "credit_note"
              ? `Buyer: ${context?.customer_name || "Consumer"}`
              : context?.customer_name || "John Doe"}
          </div>
          {config.show_phone !== false && (
            <div>{context?.customer_phone || "987-654-3210"}</div>
          )}
          {(context?.document_family === "tax_invoice" ||
            context?.document_family === "credit_note") && (
            <div>Buyer PAN: {context?.customer_pan || "987654321"}</div>
          )}
          <div className="w-full overflow-hidden border-t border-dashed border-black mt-1" />
        </div>
      );
    case "payments": {
      const payments = context?.payments?.length
        ? context.payments
        : [{ method: "Cash", amount: "NPR 1,446.40" }];
      return (
        <div style={style} className="space-y-0.5">
          <div className="w-full overflow-hidden border-t border-dashed border-black" />
          <div className="text-center font-black">
            <span>{config.header_label || "PAYMENTS"}</span>
          </div>
          {payments.map((payment, index) => (
            <div key={`${payment.method}-${index}`}>
              <div className="flex justify-between">
                <span>{payment.method}</span>
                <span>{payment.amount}</span>
              </div>
              {config.show_reference === true && payment.reference ? (
                <div className="text-left text-[0.8em]">
                  Ref: {payment.reference}
                </div>
              ) : null}
            </div>
          ))}
          <div className="w-full overflow-hidden border-t border-dashed border-black" />
          <div className="flex justify-between font-bold">
            <span>Amount paid</span>
            <span>{context?.total_paid || "NPR 1,446.40"}</span>
          </div>
          {context?.change_returned ? (
            <div className="flex justify-between">
              <span>Change returned</span>
              <span>{context.change_returned}</span>
            </div>
          ) : null}
          {context?.balance_due && context.balance_due !== "NPR 0.00" ? (
            <div className="flex justify-between">
              <span>Balance due</span>
              <span>{context.balance_due}</span>
            </div>
          ) : null}
          <div className="text-left text-[0.8em]">
            Settlement: {context?.settlement || "Paid in full"}
          </div>
          {renderPreviewStaffAttribution(staffConfig, context)}
        </div>
      );
    }
    case "partial_pay":
      return (
        <div style={style} className="space-y-0.5">
          <div className="w-full overflow-hidden border-t border-dashed border-black" />
          <div className="font-bold text-[0.9em]">PARTIAL PAYMENTS</div>
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
    case "footer":
      return (
        <div style={style} className="py-1">
          <div className="w-full overflow-hidden border-t border-dashed border-black mb-2" />
          <div className="text-center text-[0.9em]">
            {resolvePreviewPlaceholders(config.message || "THANK YOU", context)}
          </div>
        </div>
      );
    case "text":
      return (
        <div style={style}>
          {resolvePreviewPlaceholders(
            config.text || "Your custom text here",
            context,
          )}
        </div>
      );
    case "divider":
      return (
        <div className="w-full overflow-hidden border-t border-dashed border-black/80 my-1 py-0.5" />
      );
    case "global_settings":
      return (
        <div className="text-[10px] italic bg-primary/5 p-2 rounded-md border border-primary/20 text-primary uppercase font-bold text-center">
          [ Printer: {global.paper_size} | Font: {global.global_font_type} ]
        </div>
      );
    default:
      return <div className="text-[10px] italic opacity-40">[{type}]</div>;
  }
}

function resolvePreviewPlaceholders(text: string, context?: PreviewContext) {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(
      /\{\{station_ticket_title\}\}/g,
      context?.station_ticket_title || "INITIAL TICKET",
    )
    .replace(/\{\{station\}\}/g, context?.station || "KITCHEN")
    .replace(/\{\{kot_number\}\}/g, context?.kot_no || "17-1")
    .replace(/\{\{table\}\}/g, context?.table_name || "N/A")
    .replace(/\{\{date\}\}/g, context?.date || "03/06/2026")
    .replace(/\{\{time\}\}/g, context?.time || "17:35")
    .replace(/\{\{order_id\}\}/g, context?.order_id || "15219")
    .replace(/\{\{type\}\}/g, context?.type || "INITIAL")
    .replace(
      /\{\{restaurant_name\}\}/g,
      context?.restaurant_name || "YUMMY RESTAURANT",
    )
    .replace(
      /\{\{restaurant_address\}\}/g,
      context?.address || "KATHMANDU, NEPAL",
    )
    .replace(/\{\{restaurant_phone\}\}/g, context?.phone || "9800000000")
    .replace(/\{\{restaurant_pan\}\}/g, context?.pan || "PAN-987654321");
}

function renderConfigFields(
  block: ReceiptBlock,
  update: (k: string, v: any) => void,
  mode: "receipt" | "kot",
) {
  const { config, type } = block;

  switch (type) {
    case "header":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              label="Show Logo"
              value={config.show_logo}
              onChange={(v) => update("show_logo", v)}
            />
            <ToggleItem
              label="Show Address"
              value={config.show_address}
              onChange={(v) => update("show_address", v)}
            />
            <ToggleItem
              label="Show Phone"
              value={config.show_phone}
              onChange={(v) => update("show_phone", v)}
            />
            <ToggleItem
              label="Show PAN"
              value={config.show_pan}
              onChange={(v) => update("show_pan", v)}
            />
          </div>
        </div>
      );
    case "bill_info":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Staff attribution</Label>
            <Select
              value={
                config.staff_attribution_mode ||
                (config.show_user === false ? "hidden" : "compact")
              }
              onValueChange={(value) => update("staff_attribution_mode", value)}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact served by</SelectItem>
                <SelectItem value="opened_settled">
                  Opened, handled and settled
                </SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              label="KOT #"
              value={config.show_kot_number}
              onChange={(v) => update("show_kot_number", v)}
            />
            <ToggleItem
              label="Station"
              value={config.show_station}
              onChange={(v) => update("show_station", v)}
            />
            <ToggleItem
              label="Table"
              value={config.show_table}
              onChange={(v) => update("show_table", v)}
            />
            <ToggleItem
              label="Date"
              value={config.show_date}
              onChange={(v) => update("show_date", v)}
            />
            <ToggleItem
              label="Service duration"
              value={config.show_service_duration}
              onChange={(v) => update("show_service_duration", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabelInput
              label="KOT Label"
              value={config.kot_label || "KOT"}
              onChange={(v) => update("kot_label", v)}
            />
            <LabelInput
              label="Table Label"
              value={config.table_label || "TABLE"}
              onChange={(v) => update("table_label", v)}
            />
          </div>
        </div>
      );
    case "items":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              label="Show S.N"
              value={config.show_serial}
              onChange={(v) => update("show_serial", v)}
            />
            <ToggleItem
              label="Show Rate"
              value={config.show_rate}
              onChange={(v) => update("show_rate", v)}
            />
            <ToggleItem
              label="Show Amount"
              value={config.show_amount}
              onChange={(v) => update("show_amount", v)}
            />
            <ToggleItem
              label="Item code"
              value={config.show_fiscal_code}
              onChange={(v) => update("show_fiscal_code", v)}
            />
            <ToggleItem
              label="Unit"
              value={config.show_unit}
              onChange={(v) => update("show_unit", v)}
            />
          </div>
        </div>
      );
    case "totals":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              label="Show Tax"
              value={config.show_tax}
              onChange={(v) => update("show_tax", v)}
            />
            <ToggleItem
              label="Show Service"
              value={config.show_service}
              onChange={(v) => update("show_service", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabelInput
              label="Subtotal"
              value={config.subtotal_label || "Subtotal"}
              onChange={(v) => update("subtotal_label", v)}
            />
            <LabelInput
              label="Tax Label"
              value={config.tax_label || "Tax (13%)"}
              onChange={(v) => update("tax_label", v)}
            />
            <LabelInput
              label="Total Label"
              value={config.total_label || "TOTAL"}
              onChange={(v) => update("total_label", v)}
            />
          </div>
        </div>
      );
    case "customer":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ToggleItem
              label="Phone"
              value={config.show_phone}
              onChange={(v) => update("show_phone", v)}
            />
            <ToggleItem
              label="Address"
              value={config.show_address}
              onChange={(v) => update("show_address", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabelInput
              label="CUST Label"
              value={config.customer_label || "CUST"}
              onChange={(v) => update("customer_label", v)}
            />
            <LabelInput
              label="Phone Label"
              value={config.phone_label || "PH"}
              onChange={(v) => update("phone_label", v)}
            />
          </div>
        </div>
      );
    case "partial_pay":
      return (
        <div className="grid grid-cols-2 gap-2">
          <LabelInput
            label="Split Label"
            value={config.split_label || "Split"}
            onChange={(v) => update("split_label", v)}
          />
          <LabelInput
            label="Paid Label"
            value={config.paid_label || "Paid"}
            onChange={(v) => update("paid_label", v)}
          />
        </div>
      );
    case "qr":
      return (
        <div className="space-y-4">
          <LabelInput
            label="QR Content"
            value={config.content || ""}
            onChange={(v) => update("content", v)}
            hint="UPI ID or URL"
          />
          <LabelInput
            label="QR Label"
            value={config.label || "SCAN TO PAY"}
            onChange={(v) => update("label", v)}
          />
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
            Custom Text Content
          </Label>
          <Input
            value={config.text || ""}
            onChange={(e) => update("text", e.target.value)}
            placeholder="Type here..."
            className="text-xs font-bold"
          />
        </div>
      );
    case "footer":
      return (
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
            Footer Message
          </Label>
          <Input
            value={config.message || ""}
            onChange={(e) => update("message", e.target.value)}
            placeholder="THANK YOU!"
            className="text-xs font-bold"
          />
        </div>
      );
    case "global_settings":
      return (
        <div className="space-y-6">
          <div className="space-y-3 border-b border-border pb-5">
            <div>
              <Label className="text-sm font-medium">Copies per print</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                The server sends the complete copy batch as one printer job.
                Maximum 5.
              </p>
            </div>
            {mode === "receipt" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bill-copies" className="text-xs">
                    Pre-bill copies
                  </Label>
                  <Input
                    id="bill-copies"
                    type="number"
                    min={1}
                    max={5}
                    value={config.bill_copies || 1}
                    onChange={(event) =>
                      update(
                        "bill_copies",
                        Math.max(
                          1,
                          Math.min(5, Number(event.target.value) || 1),
                        ),
                      )
                    }
                    className="h-11 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receipt-copies" className="text-xs">
                    Receipt copies
                  </Label>
                  <Input
                    id="receipt-copies"
                    type="number"
                    min={1}
                    max={5}
                    value={config.receipt_copies || 1}
                    onChange={(event) =>
                      update(
                        "receipt_copies",
                        Math.max(
                          1,
                          Math.min(5, Number(event.target.value) || 1),
                        ),
                      )
                    }
                    className="h-11 tabular-nums"
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Fiscal invoice copies remain controlled by fiscal print
                  authorization.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="kot-copies" className="text-xs">
                  KOT copies
                </Label>
                <Input
                  id="kot-copies"
                  type="number"
                  min={1}
                  max={5}
                  value={config.print_copies || 1}
                  onChange={(event) =>
                    update(
                      "print_copies",
                      Math.max(1, Math.min(5, Number(event.target.value) || 1)),
                    )
                  }
                  className="h-11 max-w-28 tabular-nums"
                />
              </div>
            )}
          </div>
          <FontSelector
            value={config.global_font_type || "A"}
            onChange={(v) => update("global_font_type", v)}
          />
          <FontSizeSlider
            label="Global Font Size"
            value={config.global_font_size || 12}
            onChange={(v) => update("global_font_size", v)}
          />
          <LineSpacingSlider
            value={config.line_spacing || 1.2}
            onChange={(v) => update("line_spacing", v)}
          />
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
              Paper Size
            </Label>
            <Select
              value={config.paper_size || "80mm"}
              onValueChange={(v) => update("paper_size", v)}
            >
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

const ToggleItem = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between p-1.5 rounded-md border border-border/20 bg-muted/20">
    <span className="text-[10px] font-bold opacity-80">{label}</span>
    <Switch
      checked={value !== false}
      onCheckedChange={onChange}
      className="scale-75"
    />
  </div>
);

const LabelInput = ({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-[9px] font-black uppercase tracking-wider opacity-60">
      {label}
    </Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={hint}
      className="h-7 text-[10px] font-bold"
    />
  </div>
);
