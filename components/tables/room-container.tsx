"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { TableGraphic } from "./table-graphic";
import { DoorOpen, GripHorizontal, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableData {
  id: number;
  table_name: string;
  capacity: number;
  status: string;
  current_guests?: number;
  pos_x: number;
  pos_y: number;
  table_type_id?: number;
  table_type_name?: string;
  active_order_ids?: number[];
}

interface RoomContainerProps {
  title: string;
  tables: TableData[];
  layoutHeight: number;
  isLayoutMode?: boolean;
  onTableClick?: (table: TableData) => void;
  onTableDrop?: (tableId: number, posX: number, posY: number) => void;
  onHeightChanged?: (newHeight: number) => void;
  onAutoArrange?: (updates: Record<number, { posX: number; posY: number }>, newHeight: number) => void;
}

const BASELINE_WIDTH = 400;

export function RoomContainer({
  title,
  tables,
  layoutHeight,
  isLayoutMode = false,
  onTableClick,
  onTableDrop,
  onHeightChanged,
  onAutoArrange,
}: RoomContainerProps) {
  const hasSpatialPositions = tables.some(
    (t) => t.pos_x != null && t.pos_y != null && (t.pos_x !== 0 || t.pos_y !== 0)
  );

  const handleAutoArrange = useCallback(() => {
    if (!onAutoArrange) return;
    const cols = 4;
    const colWidth = 100 / cols; // 25% per column
    const tableWidthPct = 15; // each table is 15% wide
    const rowHeightNorm = 22; // normalized row height units
    const marginY = 2;

    const sorted = [...tables].sort((a, b) => a.table_name.localeCompare(b.table_name));
    const rows = Math.ceil(sorted.length / cols);

    // Calculate new normalized height to fit all rows
    const newHeight = Math.max((rows * rowHeightNorm) + marginY + 5, 100);

    const updates: Record<number, { posX: number; posY: number }> = {};
    sorted.forEach((table, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const posX = (col * colWidth) + (colWidth - tableWidthPct) / 2;
      const posY = (row * rowHeightNorm + marginY) / newHeight * 100;
      updates[table.id] = { posX, posY };
    });

    onAutoArrange(updates, newHeight);
  }, [tables, onAutoArrange]);

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-visible">
      {/* Header matching Flutter RoomContainer */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <DoorOpen className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold tracking-widest text-orange-500 uppercase">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">
              {tables.length} Tables
            </p>
          </div>
          {isLayoutMode && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-bold tracking-wider">
                EDITING
              </span>
              {onAutoArrange && (
                <button
                  onClick={handleAutoArrange}
                  title="Auto Arrange Grid"
                  className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 my-4 border-t border-border/30" />

      {/* Spatial layout or grid fallback */}
      <div className="px-4 pb-2">
        {hasSpatialPositions || isLayoutMode ? (
          <SpatialLayout
            tables={tables}
            layoutHeight={layoutHeight}
            isLayoutMode={isLayoutMode}
            onTableClick={onTableClick}
            onTableDrop={onTableDrop}
          />
        ) : (
          <GridLayout tables={tables} onTableClick={onTableClick} />
        )}
      </div>

      {/* Drag handle at the bottom of the OUTER card (resizes whole card) */}
      {isLayoutMode && onHeightChanged ? (
        <ResizeHandle layoutHeight={layoutHeight} onHeightChanged={onHeightChanged} />
      ) : (
        <div className="pb-3" />
      )}
    </div>
  );
}

function SpatialLayout({
  tables,
  layoutHeight,
  isLayoutMode,
  onTableClick,
  onTableDrop,
}: {
  tables: TableData[];
  layoutHeight: number;
  isLayoutMode?: boolean;
  onTableClick?: (table: TableData) => void;
  onTableDrop?: (tableId: number, posX: number, posY: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTableId = useRef<number | null>(null);
  const dragOffsetRef = useRef<{ ox: number; oy: number }>({ ox: 0, oy: 0 });

  const [zMap, setZMap] = useState<Record<number, number>>({});
  const zCounter = useRef(1);

  const bringToFront = useCallback((tableId: number) => {
    zCounter.current += 1;
    setZMap((prev) => ({ ...prev, [tableId]: zCounter.current }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!containerRef.current || dragTableId.current === null) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffsetRef.current.ox;
      const y = e.clientY - rect.top - dragOffsetRef.current.oy;

      const percX = (x / rect.width) * 100;
      const percY = (y / rect.height) * 100;

      onTableDrop?.(dragTableId.current, percX, percY);
      bringToFront(dragTableId.current);
      dragTableId.current = null;
    },
    [onTableDrop, bringToFront]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-2xl border bg-black/[0.03] dark:bg-black/20 overflow-hidden",
        isLayoutMode ? "border-orange-500/30" : "border-orange-500/10"
      )}
      style={{
        paddingBottom: `${(layoutHeight / BASELINE_WIDTH) * 100}%`,
      }}
      onDragOver={isLayoutMode ? handleDragOver : undefined}
      onDrop={isLayoutMode ? handleDrop : undefined}
    >
      {tables.map((table) => {
        const leftPct = table.pos_x ?? 0;
        const topPct = table.pos_y ?? 0;

        return (
          <div
            key={table.id}
            className={cn(
              "absolute",
              isLayoutMode
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-pointer transition-transform hover:scale-110"
            )}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: "15%",
              aspectRatio: "1 / 1.15",
              zIndex: zMap[table.id] ?? 0,
            }}
            draggable={isLayoutMode}
            onDragStart={
              isLayoutMode
                ? (e) => {
                  dragTableId.current = table.id;
                  e.dataTransfer.effectAllowed = "move";
                  const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  dragOffsetRef.current = {
                    ox: e.clientX - elRect.left,
                    oy: e.clientY - elRect.top,
                  };
                  const el = e.currentTarget as HTMLElement;
                  e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
                  bringToFront(table.id);
                }
                : undefined
            }
            onClick={() => {
              if (!isLayoutMode) {
                onTableClick?.(table);
              } else {
                bringToFront(table.id);
              }
            }}
          >
            <TableGraphic
              tableName={table.table_name}
              capacity={table.capacity}
              status={table.status}
              currentGuests={table.current_guests}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Resize handle at the bottom of the outer card ────────────────
function ResizeHandle({
  layoutHeight,
  onHeightChanged,
}: {
  layoutHeight: number;
  onHeightChanged: (newHeight: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Find the parent card element on mount
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      // Walk up to the outer card (rounded-3xl)
      cardRef.current = el.closest(".rounded-3xl") as HTMLDivElement | null;
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current || !cardRef.current) return;
      e.preventDefault();
      const deltaY = e.clientY - startYRef.current;
      // Find the spatial layout div inside the card to get its width
      const spatialDiv = cardRef.current.querySelector("[style*='padding-bottom']") as HTMLDivElement | null;
      const width = spatialDiv?.offsetWidth || cardRef.current.offsetWidth;
      const scale = width / BASELINE_WIDTH;
      // We stored the starting layoutHeight (normalized), convert delta to normalized
      const deltaNormalized = scale > 0 ? deltaY / scale : deltaY;
      const newNormalized = startHeightRef.current + deltaNormalized;
      onHeightChanged(Math.max(newNormalized, 100));
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onHeightChanged]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = layoutHeight;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [layoutHeight]
  );

  return (
    <div ref={handleRef} className="flex justify-center pb-2 pt-1">
      <div
        onMouseDown={startResize}
        className="w-[72px] h-7 flex items-center justify-center rounded-full bg-card border border-orange-500/30 shadow cursor-ns-resize hover:border-orange-500/60 transition-colors"
      >
        <GripHorizontal className="w-4 h-4 text-orange-500" />
      </div>
    </div>
  );
}

function GridLayout({
  tables,
  onTableClick,
}: {
  tables: TableData[];
  onTableClick?: (table: TableData) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
      {tables.map((table) => (
        <div
          key={table.id}
          className="aspect-square cursor-pointer transition-transform hover:scale-105"
          onClick={() => onTableClick?.(table)}
        >
          <TableGraphic
            tableName={table.table_name}
            capacity={table.capacity}
            status={table.status}
            currentGuests={table.current_guests}
          />
        </div>
      ))}
    </div>
  );
}
