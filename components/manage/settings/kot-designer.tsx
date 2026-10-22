"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Save,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  ConfigPanel,
  MobileDesignerEditorSheet,
} from "./designer-components";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  global_font_type: "A",
  global_font_size: 11,
  line_spacing: 1.0,
  paper_size: "80mm",
  column_capacity: 48,
  print_copies: 1,
};

const DEFAULT_KOT_BLOCKS: ReceiptBlock[] = [
  {
    id: "k1",
    type: "text",
    config: {
      text: "{{station_ticket_title}}",
      bold: true,
      align: "center",
      font_size: 12,
    },
    isVisible: true,
    showOnBill: true,
    showOnReceipt: true,
  },
  {
    id: "k2",
    type: "divider",
    config: {},
    isVisible: true,
    showOnBill: true,
    showOnReceipt: true,
  },
  {
    id: "k3",
    type: "bill_info",
    config: {
      show_kot_number: true,
      show_table: true,
      show_station: false,
      show_kot_type: true,
      show_order_id: true,
      show_date: true,
      show_time: true,
      show_user: false,
      kot_label: "KOT",
      table_label: "Table",
    },
    isVisible: true,
    showOnBill: true,
    showOnReceipt: true,
  },
  {
    id: "k4",
    type: "divider",
    config: {},
    isVisible: true,
    showOnBill: true,
    showOnReceipt: true,
  },
  {
    id: "k5",
    type: "items",
    config: {
      show_serial: false,
      show_rate: false,
      show_amount: false,
      show_cancelled_items: true,
      item_label: "ITEM",
      qty_label: "QTY",
      bold: true,
    },
    isVisible: true,
    showOnBill: true,
    showOnReceipt: true,
  },
];

interface KOTDesignerProps {
  restaurantId: number;
  initialTemplate?: any[];
}

export function KOTDesigner({
  restaurantId,
  initialTemplate,
}: KOTDesignerProps) {
  const restaurant = useRestaurant((s) => s.restaurant);
  const [blocks, setBlocks] = useState<ReceiptBlock[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(
    DEFAULT_GLOBAL_CONFIG,
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [mobileDraftBlock, setMobileDraftBlock] = useState<ReceiptBlock | null>(
    null,
  );
  const [mobileDraftGlobal, setMobileDraftGlobal] =
    useState<GlobalConfig | null>(null);
  const [mobileDraftPosition, setMobileDraftPosition] = useState<number | null>(
    null,
  );
  const initialBlocksRef = useRef<ReceiptBlock[]>([]);
  const initialGlobalConfigRef = useRef<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);

  useEffect(() => {
    if (
      initialTemplate &&
      Array.isArray(initialTemplate) &&
      initialTemplate.length > 0
    ) {
      const potentialGlobal = initialTemplate.find(
        (b) => b.type === "global_settings",
      );
      const nextGlobalConfig: GlobalConfig = potentialGlobal
        ? {
            global_font_type: potentialGlobal.global_font_type || "A",
            global_font_size: potentialGlobal.global_font_size || 11,
            line_spacing: potentialGlobal.line_spacing || 1.0,
            paper_size: potentialGlobal.paper_size || "80mm",
            column_capacity:
              potentialGlobal.column_capacity ||
              (potentialGlobal.paper_size === "58mm" ? 32 : 48),
            print_copies: potentialGlobal.print_copies || 1,
          }
        : DEFAULT_GLOBAL_CONFIG;
      setGlobalConfig(nextGlobalConfig);
      initialGlobalConfigRef.current = { ...nextGlobalConfig };

      const mappedBlocks = initialTemplate
        .filter((b) => b.type !== "global_settings")
        .map((b) => {
          // Extract everything into config except meta fields
          const {
            id,
            type,
            is_visible,
            isVisible,
            show_on_bill,
            show_on_receipt,
            ...rest
          } = b;
          return {
            id: id || uuidv4(),
            type: type as BlockType,
            isVisible: is_visible ?? isVisible ?? true,
            showOnBill: show_on_bill ?? true,
            showOnReceipt: show_on_receipt ?? true,
            config: { ...rest, ...(b.config || {}) },
          };
        });

      setBlocks(mappedBlocks);
      initialBlocksRef.current = mappedBlocks.map((block) => ({
        ...block,
        config: { ...block.config },
      }));
      setSelectedBlockId(
        mappedBlocks.find((block) => block.type === "header")?.id ??
          mappedBlocks[0]?.id ??
          null,
      );
    } else {
      const defaultBlocks = DEFAULT_KOT_BLOCKS.map((block) => ({
        ...block,
        config: { ...block.config },
      }));
      setBlocks(defaultBlocks);
      setGlobalConfig(DEFAULT_GLOBAL_CONFIG);
      initialBlocksRef.current = defaultBlocks;
      initialGlobalConfigRef.current = { ...DEFAULT_GLOBAL_CONFIG };
      setSelectedBlockId(defaultBlocks[0]?.id ?? null);
    }
  }, [initialTemplate]);

  const handleAddBlock = (type: BlockType) => {
    if (type === "global_settings") {
      openGlobalEditor();
      return;
    }
    const newBlock: ReceiptBlock = {
      id: uuidv4(),
      type,
      config: {},
      isVisible: true,
      showOnBill: true,
      showOnReceipt: true,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    setPreviewExpanded(true);
    openMobileBlockEditor(newBlock, blocks.length);
    toast.info(`Added ${BLOCK_METADATA[type].title} to KOT`);
  };

  const handleUpdateBlock = (id: string, updates: Partial<ReceiptBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  };

  const handleSelectBlock = (id: string) => {
    setSelectedBlockId(id);
    setPreviewExpanded(true);
    const block = blocks.find((candidate) => candidate.id === id);
    if (block) {
      openMobileBlockEditor(block, blocks.indexOf(block));
    }
  };

  const isDesktopDesignerViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1280px)").matches;

  function openMobileBlockEditor(block: ReceiptBlock, position: number) {
    if (isDesktopDesignerViewport()) return;
    setMobileDraftBlock({ ...block, config: { ...block.config } });
    setMobileDraftGlobal(null);
    setMobileDraftPosition(position);
    setMobileEditorOpen(true);
  }

  function openGlobalEditor() {
    setSelectedBlockId("global");
    if (isDesktopDesignerViewport()) return;
    setMobileDraftBlock(null);
    setMobileDraftGlobal({ ...globalConfig });
    setMobileDraftPosition(null);
    setMobileEditorOpen(true);
  }

  const closeMobileEditor = () => {
    setMobileEditorOpen(false);
    setMobileDraftBlock(null);
    setMobileDraftGlobal(null);
    setMobileDraftPosition(null);
  };

  const saveMobileEditor = () => {
    if (mobileDraftGlobal) {
      setGlobalConfig({ ...mobileDraftGlobal });
      closeMobileEditor();
      return;
    }
    if (!mobileDraftBlock) return;
    setBlocks((current) => {
      const currentIndex = current.findIndex(
        (block) => block.id === mobileDraftBlock.id,
      );
      if (currentIndex < 0) return current;
      const next = [...current];
      next[currentIndex] = {
        ...mobileDraftBlock,
        config: { ...mobileDraftBlock.config },
      };
      const destination = Math.max(
        0,
        Math.min(mobileDraftPosition ?? currentIndex, next.length - 1),
      );
      const [moved] = next.splice(currentIndex, 1);
      next.splice(destination, 0, moved);
      return next;
    });
    closeMobileEditor();
  };

  const handleCancel = () => {
    const restoredBlocks = initialBlocksRef.current.map((block) => ({
      ...block,
      config: { ...block.config },
    }));
    setBlocks(restoredBlocks);
    setGlobalConfig({ ...initialGlobalConfigRef.current });
    setSelectedBlockId(restoredBlocks[0]?.id ?? null);
    setPreviewExpanded(true);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((previous) => {
      const remaining = previous.filter((block) => block.id !== id);
      if (selectedBlockId === id) {
        setSelectedBlockId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    [newBlocks[index], newBlocks[targetIndex]] = [
      newBlocks[targetIndex],
      newBlocks[index],
    ];
    setBlocks(newBlocks);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const templateData = [
        {
          type: "global_settings",
          id: "metadata",
          ...globalConfig,
        },
        ...blocks.map((b) => ({
          id: b.id,
          type: b.type,
          is_visible: b.isVisible,
          isVisible: b.isVisible, // Keep both for safety
          show_on_bill: b.showOnBill,
          show_on_receipt: b.showOnReceipt,
          ...b.config,
        })),
      ];

      const response = await apiClient.put(
        RestaurantApis.updateTemplates(restaurantId),
        {
          kot_template: templateData,
        },
      );

      if (response.data.status === "success") {
        initialBlocksRef.current = blocks.map((block) => ({
          ...block,
          config: { ...block.config },
        }));
        initialGlobalConfigRef.current = { ...globalConfig };
        toast.success("Kitchen ticket layout saved");
      }
    } catch (err) {
      toast.error("Failed to save KOT template");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="flex min-w-0 flex-col gap-4 xl:min-h-[720px]">
      <div className="flex flex-col gap-3 border-b border-border bg-background pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Kitchen ticket layout</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="hidden h-10 xl:inline-flex"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-10"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save layout
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-muted/40">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between bg-background px-4 text-sm font-medium xl:hidden"
              onClick={() => setPreviewExpanded((expanded) => !expanded)}
              aria-expanded={previewExpanded}
            >
              Kitchen ticket preview
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  previewExpanded && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "relative min-h-[320px] p-3 sm:p-5 xl:min-h-[560px]",
                !previewExpanded && "hidden xl:block",
              )}
            >
              <div className="absolute left-4 top-4 z-10 hidden rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium backdrop-blur xl:block">
                Kitchen ticket preview
              </div>
              <div className="flex max-h-[430px] items-start justify-center overflow-y-auto p-2 pt-8 xl:max-h-[520px]">
                <ThermalPreview
                  blocks={blocks}
                  globalConfig={globalConfig}
                  mode="kot"
                  selectedId={selectedBlockId}
                  onSelect={handleSelectBlock}
                  context={{
                    restaurant_name: restaurant?.name,
                    address: restaurant?.address,
                    phone: restaurant?.phone,
                    kot_no: "10-1",
                    station: "KITCHEN",
                    station_ticket_title: "INITIAL TICKET",
                    type: "Initial Ticket",
                    table_name: "M1",
                    order_id: "10",
                    date: "03/02/2026",
                    time: "15:30",
                    user: "BHAVANA THAPALIYA",
                    items: [
                      {
                        name: "CHICKEN MOMO",
                        qty: "2",
                        modifiers: ["Extra spicy"],
                        notes: "No onion",
                      },
                      { name: "COKE", qty: "1" },
                    ],
                  }}
                />
              </div>
              <p className="border-t border-border bg-background px-4 py-2 text-center text-xs text-muted-foreground">
                Click a block to edit it.
              </p>
            </div>
          </div>

          <div className="flex max-h-[440px] flex-col overflow-hidden rounded-xl border border-border bg-background">
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold">Blocks</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a block to edit it or add missing content.
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3">
                <BlockPalette
                  onAdd={handleAddBlock}
                  blocks={blocks}
                  onSelect={handleSelectBlock}
                />
              </div>
            </ScrollArea>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            <button
              type="button"
              className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-muted/50"
              onClick={openGlobalEditor}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Print defaults</p>
                <p className="text-xs text-muted-foreground">
                  Paper size, base font, and line spacing
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <Link
              href="/settings/printers"
              className="flex min-h-16 items-center gap-3 px-4 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Printer settings</p>
                <p className="text-xs text-muted-foreground">
                  Station routing and device behavior
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border bg-background xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100vh-7rem)] xl:flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4">
              {selectedBlockId === "global" ? (
                <ConfigPanel
                  block={{
                    id: "global",
                    type: "global_settings",
                    config: globalConfig,
                    isVisible: true,
                    showOnBill: true,
                    showOnReceipt: true,
                  }}
                  onUpdate={(u) => {
                    setGlobalConfig((prev) => ({
                      ...prev,
                      ...(u.config as GlobalConfig),
                    }));
                  }}
                  onDelete={() => {}}
                />
              ) : selectedBlock ? (
                <ConfigPanel
                  block={selectedBlock}
                  onUpdate={(u) => handleUpdateBlock(selectedBlock.id, u)}
                  onDelete={() => handleDeleteBlock(selectedBlock.id)}
                  mode="kot"
                />
              ) : null}
            </div>
          </ScrollArea>
          {selectedBlock && selectedBlockId !== "global" && (
            <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/30 p-3">
              <p className="col-span-2 text-xs font-medium text-muted-foreground">
                Position
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 text-xs"
                onClick={() =>
                  handleMoveBlock(
                    blocks.findIndex((b) => b.id === selectedBlockId),
                    "up",
                  )
                }
                disabled={
                  blocks.findIndex((b) => b.id === selectedBlockId) === 0
                }
              >
                <ChevronUp className="h-3 w-3" /> Move up
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 text-xs"
                onClick={() =>
                  handleMoveBlock(
                    blocks.findIndex((b) => b.id === selectedBlockId),
                    "down",
                  )
                }
                disabled={
                  blocks.findIndex((b) => b.id === selectedBlockId) ===
                  blocks.length - 1
                }
              >
                <ChevronDown className="h-3 w-3" /> Move down
              </Button>
            </div>
          )}
        </div>
      </div>

      <MobileDesignerEditorSheet
        open={mobileEditorOpen}
        onOpenChange={(open) => {
          if (!open) closeMobileEditor();
        }}
        block={mobileDraftBlock}
        globalConfig={mobileDraftGlobal}
        mode="kot"
        position={mobileDraftPosition}
        blockCount={blocks.length}
        onUpdateBlock={(updates) =>
          setMobileDraftBlock((current) =>
            current ? { ...current, ...updates } : current,
          )
        }
        onUpdateGlobal={(updates) => setMobileDraftGlobal(updates)}
        onMove={(direction) =>
          setMobileDraftPosition((position) => {
            if (position === null) return position;
            return direction === "up"
              ? Math.max(0, position - 1)
              : Math.min(blocks.length - 1, position + 1);
          })
        }
        onDelete={() => {
          if (mobileDraftBlock) handleDeleteBlock(mobileDraftBlock.id);
          closeMobileEditor();
        }}
        onCancel={closeMobileEditor}
        onSave={saveMobileEditor}
      />
    </div>
  );
}
