"use client";

import {
  BedDouble,
  Building2,
  DoorOpen,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HotelFloor, HotelRoom } from "@/lib/hotel/types";
import { hotelCurrency } from "./hotel-ui";

type RoomTone = { label: string; dot: string; tile: string; icon: string };

export const HOTEL_ROOM_GRID_COLUMNS = 10;
export const HOTEL_ROOM_GRID_STEP_X = 100;
export const HOTEL_ROOM_GRID_STEP_Y = 120;

export function hotelRoomTone(room: HotelRoom): RoomTone {
  if (room.service_status === "out_of_order")
    return {
      label: "Needs repair",
      dot: "bg-rose-500",
      tile: "border-rose-300 bg-rose-50/85 dark:border-rose-900 dark:bg-rose-950/25",
      icon: "text-rose-600",
    };
  if (room.service_status === "out_of_service")
    return {
      label: "Unavailable",
      dot: "bg-slate-500",
      tile: "border-slate-300 bg-slate-100/85 dark:border-slate-700 dark:bg-slate-900/60",
      icon: "text-slate-600 dark:text-slate-300",
    };
  if (room.occupancy_status === "occupied")
    return {
      label: "Occupied",
      dot: "bg-violet-500",
      tile: "border-violet-300 bg-violet-50/85 dark:border-violet-900 dark:bg-violet-950/25",
      icon: "text-violet-600",
    };
  if (room.housekeeping_status === "cleaning")
    return {
      label: "Being cleaned",
      dot: "bg-sky-500",
      tile: "border-sky-300 bg-sky-50/85 dark:border-sky-900 dark:bg-sky-950/25",
      icon: "text-sky-600",
    };
  if (room.housekeeping_status === "dirty")
    return {
      label: "Needs cleaning",
      dot: "bg-amber-500",
      tile: "border-amber-300 bg-amber-50/85 dark:border-amber-900 dark:bg-amber-950/25",
      icon: "text-amber-600",
    };
  return {
    label: "Ready",
    dot: "bg-emerald-500",
    tile: "border-emerald-300 bg-emerald-50/85 dark:border-emerald-900 dark:bg-emerald-950/25",
    icon: "text-emerald-600",
  };
}

export function HotelRoomLegend() {
  const items = [
    ["Ready", "bg-emerald-500"],
    ["Occupied", "bg-violet-500"],
    ["Needs cleaning", "bg-amber-500"],
    ["Being cleaned", "bg-sky-500"],
    ["Unavailable", "bg-slate-500"],
    ["Needs repair", "bg-rose-500"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(([label, dot]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function HotelRoomDoor({
  room,
  selected = false,
  onSelect,
  pricePerNight,
  compact = false,
  available,
}: {
  room: HotelRoom;
  selected?: boolean;
  onSelect?: () => void;
  pricePerNight?: number;
  compact?: boolean;
  available?: boolean;
}) {
  const tone = hotelRoomTone(room);
  const StateIcon =
    room.service_status !== "in_service"
      ? Wrench
      : room.occupancy_status === "occupied"
        ? UsersRound
        : room.housekeeping_status === "dirty" ||
            room.housekeeping_status === "cleaning"
          ? Sparkles
          : BedDouble;
  const className = cn(
    "group relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-t-[26px] rounded-b-lg border-2 text-center shadow-[inset_0_0_0_2px_rgba(255,255,255,0.12)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
    compact
      ? "h-[112px] w-[84px] p-2 sm:h-[120px] sm:w-[92px]"
      : "h-[140px] w-[104px] p-3 sm:h-[150px] sm:w-[116px]",
    tone.tile,
    onSelect
      ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg"
      : "cursor-default",
    available === false && "opacity-35 grayscale",
    selected && "ring-2 ring-orange-500 ring-offset-2 ring-offset-background",
  );
  const content = (
    <>
      <span
        className={cn(
          "absolute bottom-2 right-2 rounded-full border border-current bg-background",
          compact ? "h-1.5 w-1.5" : "h-2 w-2",
        )}
      />
      <DoorOpen
        className={cn(
          "absolute left-2 top-2 opacity-45",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
      {!compact ? (
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-background/70 shadow-sm">
          <StateIcon className={cn("h-4 w-4", tone.icon)} />
        </span>
      ) : (
        <span
          className={cn(
            "absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full",
            tone.dot,
          )}
        />
      )}
      <p
        className={cn(
          "max-w-full truncate font-black tracking-tight",
          compact ? "text-base" : "text-xl",
        )}
      >
        {room.number}
      </p>
      <p
        className={cn(
          "mt-1 max-w-full truncate font-semibold text-muted-foreground",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {room.room_type.name}
      </p>
      {pricePerNight != null ? (
        <p
          className={cn(
            "mt-1.5 max-w-full whitespace-nowrap font-black text-orange-600 dark:text-orange-400",
            compact ? "text-[9px]" : "text-[11px]",
          )}
        >
          {hotelCurrency(pricePerNight)}
        </p>
      ) : null}
      <span
        className={cn(
          "mt-2 inline-flex min-w-0 items-center gap-1 font-semibold",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
          <span className="truncate">
            {available === false ? "Not available" : tone.label}
          </span>
      </span>
    </>
  );

  if (!onSelect) {
    return (
      <div
        aria-label={`Room ${room.number}: ${tone.label}`}
        title={`Room ${room.number}: ${tone.label}`}
        data-hotel-room-door
        className={className}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Room ${room.number}: ${tone.label}`}
      aria-pressed={selected}
      title={`Room ${room.number}: ${tone.label}`}
      data-hotel-room-door
      className={className}
    >
      {content}
    </button>
  );
}

export type HotelRoomGridCell = { column: number; row: number };

export function hotelRoomGridCoordinates(column: number, row: number) {
  return {
    pos_x: column * HOTEL_ROOM_GRID_STEP_X,
    pos_y: row * HOTEL_ROOM_GRID_STEP_Y,
  };
}

export function hotelRoomGridLayout(
  rooms: HotelRoom[],
  columns = HOTEL_ROOM_GRID_COLUMNS,
): Map<number, HotelRoomGridCell> {
  const result = new Map<number, HotelRoomGridCell>();
  const occupied = new Set<string>();
  const sorted = [...rooms].sort(
    (left, right) =>
      left.pos_y - right.pos_y ||
      left.pos_x - right.pos_x ||
      left.number.localeCompare(right.number, undefined, { numeric: true }),
  );
  sorted.forEach((room, index) => {
    let column = Number.isFinite(room.pos_x)
      ? Math.max(
          0,
          Math.min(
            columns - 1,
            Math.round(room.pos_x / HOTEL_ROOM_GRID_STEP_X),
          ),
        )
      : index % columns;
    let row = Number.isFinite(room.pos_y)
      ? Math.max(0, Math.round(room.pos_y / HOTEL_ROOM_GRID_STEP_Y))
      : Math.floor(index / columns);
    let attempts = 0;
    while (occupied.has(`${column}:${row}`) && attempts < 1000) {
      column += 1;
      if (column >= columns) {
        column = 0;
        row += 1;
      }
      attempts += 1;
    }
    occupied.add(`${column}:${row}`);
    result.set(room.id, { column, row });
  });
  return result;
}

function svgRoomColors(room: HotelRoom) {
  const label = hotelRoomTone(room).label;
  if (label === "Ready")
    return { fill: "rgba(16,185,129,.16)", stroke: "#10b981" };
  if (label === "Occupied")
    return { fill: "rgba(139,92,246,.16)", stroke: "#8b5cf6" };
  if (label === "Needs cleaning")
    return { fill: "rgba(245,158,11,.16)", stroke: "#f59e0b" };
  if (label === "Being cleaned")
    return { fill: "rgba(14,165,233,.16)", stroke: "#0ea5e9" };
  if (label === "Needs repair")
    return { fill: "rgba(244,63,94,.16)", stroke: "#f43f5e" };
  return { fill: "rgba(100,116,139,.16)", stroke: "#64748b" };
}

function HotelFloorSpatialPlan({
  floor,
  rooms,
  compact = false,
  layoutMode = false,
  selectedRoomId = null,
  priceByRoomType,
  availableRoomIds,
  onSelectRoom,
  onMoveRoom,
}: {
  floor: HotelFloor;
  rooms: HotelRoom[];
  compact?: boolean;
  layoutMode?: boolean;
  selectedRoomId?: number | null;
  priceByRoomType?: Record<number, number>;
  availableRoomIds?: Set<number>;
  onSelectRoom?: (room: HotelRoom) => void;
  onMoveRoom?: (roomId: number, column: number, row: number) => void;
}) {
  const width = Math.max(1000, floor.layout_width || 1200);
  const layout = hotelRoomGridLayout(rooms);
  const highestRow = Math.max(
    0,
    ...Array.from(layout.values()).map((cell) => cell.row),
  );
  const height = Math.max(
    floor.layout_height || 700,
    (highestRow + 2) * HOTEL_ROOM_GRID_STEP_Y,
  );
  const roomWidth = 80;
  const roomHeight = 110;

  const pointerPosition = (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = svg.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / Math.max(1, bounds.width)) * width,
      y: ((clientY - bounds.top) / Math.max(1, bounds.height)) * height,
    };
  };

  return (
    <div
      data-floor-room-plan={floor.id}
      data-room-grid-editor={layoutMode ? floor.id : undefined}
      className="overflow-hidden rounded-2xl border bg-background/75"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${floor.name} room layout`}
      >
        <rect width={width} height={height} fill="transparent" />
        {layoutMode ? (
          <g className="text-muted-foreground/15">
            {Array.from(
              { length: Math.ceil(width / HOTEL_ROOM_GRID_STEP_X) + 1 },
              (_, column) => (
                <line
                  key={`column-${column}`}
                  x1={column * HOTEL_ROOM_GRID_STEP_X}
                  x2={column * HOTEL_ROOM_GRID_STEP_X}
                  y1={0}
                  y2={height}
                  stroke="currentColor"
                  strokeWidth={1}
                />
              ),
            )}
            {Array.from(
              { length: Math.ceil(height / HOTEL_ROOM_GRID_STEP_Y) + 1 },
              (_, row) => (
                <line
                  key={`row-${row}`}
                  x1={0}
                  x2={width}
                  y1={row * HOTEL_ROOM_GRID_STEP_Y}
                  y2={row * HOTEL_ROOM_GRID_STEP_Y}
                  stroke="currentColor"
                  strokeWidth={1}
                />
              ),
            )}
          </g>
        ) : null}
        {layoutMode ? (
          <g>
            {Array.from(
              {
                length:
                  Math.ceil(height / HOTEL_ROOM_GRID_STEP_Y) *
                  HOTEL_ROOM_GRID_COLUMNS,
              },
              (_, index) => {
                const column = index % HOTEL_ROOM_GRID_COLUMNS;
                const row = Math.floor(index / HOTEL_ROOM_GRID_COLUMNS);
                return (
                  <rect
                    key={`${column}:${row}`}
                    data-room-grid-cell={`${column}:${row}`}
                    x={column * HOTEL_ROOM_GRID_STEP_X}
                    y={row * HOTEL_ROOM_GRID_STEP_Y}
                    width={HOTEL_ROOM_GRID_STEP_X}
                    height={HOTEL_ROOM_GRID_STEP_Y}
                    fill="transparent"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const roomId = Number(
                        event.dataTransfer.getData("hotel-room-id"),
                      );
                      if (roomId) onMoveRoom?.(roomId, column, row);
                    }}
                  />
                );
              },
            )}
          </g>
        ) : null}
        <g>
          {rooms.map((room) => {
            const cell = layout.get(room.id) ?? { column: 0, row: 0 };
            const x = cell.column * HOTEL_ROOM_GRID_STEP_X + 10;
            const y = cell.row * HOTEL_ROOM_GRID_STEP_Y + 5;
            const colors = svgRoomColors(room);
            const available = availableRoomIds
              ? availableRoomIds.has(room.id)
              : true;
            const selected = selectedRoomId === room.id;
            return (
              <g
                key={room.id}
                aria-label={`Room ${room.number}: ${hotelRoomTone(room).label}`}
                data-hotel-room-door
                data-room-draggable={layoutMode ? room.id : undefined}
                opacity={available ? 1 : 0.28}
                className={cn(
                  onSelectRoom && "cursor-pointer",
                  layoutMode && "cursor-grab active:cursor-grabbing",
                )}
                onClick={() => onSelectRoom?.(room)}
                onDragStart={
                  layoutMode
                    ? (event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "hotel-room-id",
                          String(room.id),
                        );
                      }
                    : undefined
                }
                onPointerDown={
                  layoutMode && onMoveRoom
                    ? (event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        const svg = event.currentTarget.ownerSVGElement;
                        if (!svg) return;
                        const move = (pointer: PointerEvent) => {
                          const point = pointerPosition(
                            svg,
                            pointer.clientX,
                            pointer.clientY,
                          );
                          const column = Math.max(
                            0,
                            Math.min(
                              HOTEL_ROOM_GRID_COLUMNS - 1,
                              Math.floor(point.x / HOTEL_ROOM_GRID_STEP_X),
                            ),
                          );
                          const row = Math.max(
                            0,
                            Math.floor(point.y / HOTEL_ROOM_GRID_STEP_Y),
                          );
                          onMoveRoom(room.id, column, row);
                        };
                        const stop = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", stop);
                          window.removeEventListener("pointercancel", stop);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", stop);
                        window.addEventListener("pointercancel", stop);
                      }
                    : undefined
                }
              >
                <title>{`Room ${room.number}: ${hotelRoomTone(room).label}`}</title>
                {selected ? (
                  <rect
                    x={x - 5}
                    y={y - 5}
                    width={roomWidth + 10}
                    height={roomHeight + 10}
                    rx={24}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={4}
                  />
                ) : null}
                <rect
                  x={x}
                  y={y}
                  width={roomWidth}
                  height={roomHeight}
                  rx={18}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={3}
                />
                <path
                  d={`M ${x + 9} ${y + roomHeight - 8} V ${y + 22} Q ${x + roomWidth / 2} ${y - 3} ${x + roomWidth - 9} ${y + 22} V ${y + roomHeight - 8}`}
                  fill="none"
                  stroke={colors.stroke}
                  strokeOpacity={0.45}
                  strokeWidth={2}
                />
                <circle
                  cx={x + roomWidth - 12}
                  cy={y + roomHeight / 2}
                  r={3.5}
                  fill={colors.stroke}
                />
                <circle
                  cx={x + roomWidth / 2}
                  cy={y + 12}
                  r={4}
                  fill={colors.stroke}
                />
                <text
                  x={x + roomWidth / 2}
                  y={y + 48}
                  textAnchor="middle"
                  fill="currentColor"
                  className="fill-foreground"
                  fontSize={18}
                  fontWeight={900}
                >
                  {room.number}
                </text>
                {!compact ? (
                  <>
                    <text
                      x={x + roomWidth / 2}
                      y={y + 66}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={9}
                    >
                      {room.room_type.name.slice(0, 12)}
                    </text>
                    <text
                      x={x + roomWidth / 2}
                      y={y + 86}
                      textAnchor="middle"
                      fill={colors.stroke}
                      fontSize={9}
                      fontWeight={700}
                    >
                      {priceByRoomType?.[room.room_type_id] != null
                        ? hotelCurrency(
                            priceByRoomType[room.room_type_id],
                          ).replace("NPR ", "")
                        : hotelRoomTone(room).label}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
        {!rooms.length ? (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={18}
          >
            No rooms on this floor
          </text>
        ) : null}
      </svg>
    </div>
  );
}

export function HotelFloorRoomPlan(props: {
  floor: HotelFloor;
  rooms: HotelRoom[];
  compact?: boolean;
  selectedRoomId?: number | null;
  priceByRoomType?: Record<number, number>;
  availableRoomIds?: Set<number>;
  onSelectRoom?: (room: HotelRoom) => void;
}) {
  const {
    floor,
    rooms,
    compact = false,
    selectedRoomId = null,
    priceByRoomType,
    availableRoomIds,
    onSelectRoom,
  } = props;
  const layout = hotelRoomGridLayout(rooms);
  const orderedRooms = [...rooms].sort((left, right) => {
    const leftCell = layout.get(left.id) ?? { column: 0, row: 0 };
    const rightCell = layout.get(right.id) ?? { column: 0, row: 0 };
    return (
      leftCell.row - rightCell.row ||
      leftCell.column - rightCell.column ||
      left.number.localeCompare(right.number, undefined, { numeric: true })
    );
  });
  const previewLimit = compact ? 8 : orderedRooms.length;
  const visibleRooms = orderedRooms.slice(0, previewLimit);
  const remainingRooms = orderedRooms.length - visibleRooms.length;

  return (
    <div
      data-floor-room-plan={floor.id}
      className={cn(
        "rounded-2xl border bg-background/75",
        compact ? "p-3" : "p-4 sm:p-5",
      )}
    >
      {visibleRooms.length ? (
        <div
          className={cn(
            "grid items-start justify-items-center",
            compact
              ? "grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-3"
              : "grid-cols-[repeat(auto-fit,minmax(116px,1fr))] gap-4",
          )}
        >
          {visibleRooms.map((room) => (
            <HotelRoomDoor
              key={room.id}
              room={room}
              compact={compact}
              selected={selectedRoomId === room.id}
              onSelect={
                onSelectRoom ? () => onSelectRoom(room) : undefined
              }
              pricePerNight={priceByRoomType?.[room.room_type_id]}
              available={
                availableRoomIds
                  ? availableRoomIds.has(room.id)
                  : undefined
              }
            />
          ))}
          {remainingRooms > 0 ? (
            <div
              className="flex h-[112px] w-[84px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 text-center sm:h-[120px] sm:w-[92px]"
              aria-label={`${remainingRooms} more rooms`}
            >
              <span className="text-lg font-black">+{remainingRooms}</span>
              <span className="mt-1 text-[9px] font-semibold text-muted-foreground">
                more rooms
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
          No rooms on this floor
        </div>
      )}
    </div>
  );
}

export function HotelFloorBoard({
  floor,
  rooms,
  selectedRoomId,
  onSelectRoom,
  selectedFloor = false,
  onSelectFloor,
  layoutMode = false,
  onMoveRoom,
  priceByRoomType,
}: {
  floor: HotelFloor | null;
  rooms: HotelRoom[];
  selectedRoomId: number | null;
  onSelectRoom: (room: HotelRoom) => void;
  selectedFloor?: boolean;
  onSelectFloor?: () => void;
  layoutMode?: boolean;
  onMoveRoom?: (roomId: number, column: number, row: number) => void;
  priceByRoomType?: Record<number, number>;
}) {
  const ready = rooms.filter(
    (room) => hotelRoomTone(room).label === "Ready",
  ).length;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-sm transition-colors",
        selectedFloor && "border-orange-400 ring-2 ring-orange-500/15",
      )}
    >
      <header
        role={onSelectFloor ? "button" : undefined}
        tabIndex={onSelectFloor ? 0 : undefined}
        onClick={onSelectFloor}
        onKeyDown={
          onSelectFloor
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") onSelectFloor();
              }
            : undefined
        }
        className={cn(
          "flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
          onSelectFloor && "cursor-pointer hover:bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold">
              {floor?.name ?? "Rooms without a floor"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {rooms.length} room{rooms.length === 1 ? "" : "s"} · {ready} ready
            </p>
          </div>
        </div>
        <HotelRoomLegend />
      </header>
      <div className="p-3 sm:p-4">
        {floor ? (
          layoutMode && onMoveRoom ? (
            <>
              <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] px-4 py-3">
                <p className="text-sm font-bold">Arrange {floor.name}</p>
                <p className="text-xs text-muted-foreground">
                  Drag a room to any grid position.
                </p>
              </div>
              <HotelFloorSpatialPlan
                floor={floor}
                rooms={rooms}
                layoutMode
                selectedRoomId={selectedRoomId}
                onSelectRoom={onSelectRoom}
                onMoveRoom={onMoveRoom}
                priceByRoomType={priceByRoomType}
              />
            </>
          ) : (
            <HotelFloorRoomPlan
              floor={floor}
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={onSelectRoom}
              priceByRoomType={priceByRoomType}
            />
          )
        ) : (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-10">
            {rooms.map((room) => (
              <HotelRoomDoor
                key={room.id}
                room={room}
                selected={selectedRoomId === room.id}
                onSelect={() => onSelectRoom(room)}
                pricePerNight={priceByRoomType?.[room.room_type_id]}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
