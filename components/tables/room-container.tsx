"use client";

import { useRef, useState, useCallback } from "react";
import { TableGraphic } from "./table-graphic";
import { DoorOpen } from "lucide-react";
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
}

const BASELINE_WIDTH = 400;

export function RoomContainer({
  title,
  tables,
  layoutHeight,
  isLayoutMode = false,
  onTableClick,
  onTableDrop,
}: RoomContainerProps) {
  const hasSpatialPositions = tables.some(
    (t) => t.pos_x != null && t.pos_y != null && (t.pos_x !== 0 || t.pos_y !== 0)
  );

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
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
            <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-bold tracking-wider">
              EDITING
            </span>
          )}
        </div>
      </div>

      <div className="mx-5 my-4 border-t border-border/30" />

      {/* Spatial layout or grid fallback */}
      <div className="px-4 pb-5">
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

  // z-index map: most recently moved table gets the highest z value
  // This ensures overlapping tables stack correctly and the top one drags first
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
      // Account for the offset within the table where the drag started
      const x = e.clientX - rect.left - dragOffsetRef.current.ox;
      const y = e.clientY - rect.top - dragOffsetRef.current.oy;

      // Convert to percentage — NO clamping, allow full freedom including overlap & edge placement
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
                  // Record where within the element the user grabbed
                  const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  dragOffsetRef.current = {
                    ox: e.clientX - elRect.left,
                    oy: e.clientY - elRect.top,
                  };
                  const el = e.currentTarget as HTMLElement;
                  e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
                  // Bring to front immediately on grab
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
