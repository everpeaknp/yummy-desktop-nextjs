"use client";

import {
  BedDouble,
  Building2,
  Layers3,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  HotelBuilding,
  HotelFloor,
  HotelRoom,
} from "@/lib/hotel/types";
import { cn } from "@/lib/utils";
import { HotelFloorRoomPlan } from "./hotel-room-board";

function buildingCondition(building: HotelBuilding) {
  if ((building.attention_count ?? 0) > 0)
    return {
      label: "Needs attention",
      dot: "bg-amber-500",
      border: "border-amber-400 dark:border-amber-700",
    };
  if ((building.room_count ?? 0) > 0 && (building.ready_count ?? 0) === 0)
    return {
      label: "All rooms occupied",
      dot: "bg-violet-500",
      border: "border-violet-400 dark:border-violet-700",
    };
  return {
    label: "Rooms ready",
    dot: "bg-emerald-500",
    border: "border-emerald-400 dark:border-emerald-700",
  };
}

function sortedFloors(building: HotelBuilding, floors: HotelFloor[]) {
  return floors
    .filter((floor) => floor.building_id === building.id)
    .sort(
      (left, right) => right.sort_order - left.sort_order || right.id - left.id,
    );
}

function BuildingFacade({
  building,
  floors,
  rooms,
  compact = false,
  onSelectFloor,
  onEditFloor,
  onSelectRoom,
  onEditBuilding,
  onAddFloor,
  onAddRoom,
  availableRoomIds,
  priceByRoomType,
}: {
  building: HotelBuilding;
  floors: HotelFloor[];
  rooms: HotelRoom[];
  compact?: boolean;
  onSelectFloor?: (floor: HotelFloor) => void;
  onEditFloor?: (floor: HotelFloor) => void;
  onSelectRoom?: (room: HotelRoom) => void;
  onEditBuilding?: () => void;
  onAddFloor?: () => void;
  onAddRoom?: () => void;
  availableRoomIds?: Set<number>;
  priceByRoomType?: Record<number, number>;
}) {
  const buildingFloors = sortedFloors(building, floors);
  const condition = buildingCondition(building);
  const availableCount = availableRoomIds
    ? rooms.filter((room) => availableRoomIds.has(room.id)).length
    : null;
  return (
    <div className="relative flex h-full flex-col pt-4">
      <div className="absolute left-[8%] right-[8%] top-1 h-4 rounded-t-xl border-x-[3px] border-t-[3px] border-current bg-background/95 opacity-90" />
      <div
        className={cn(
          "relative flex flex-1 flex-col overflow-hidden rounded-t-lg border-[3px] bg-background/95 shadow-[inset_12px_0_20px_rgba(15,23,42,0.04),inset_-12px_0_20px_rgba(15,23,42,0.04)]",
          condition.border,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b-2 bg-muted/45",
            compact ? "px-3 py-2" : "px-5 py-3",
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-black",
                compact ? "text-sm" : "text-xl",
              )}
            >
              {building.name}
            </p>
            <p
              className={cn(
                "truncate text-muted-foreground",
                compact ? "text-[10px]" : "text-xs",
              )}
            >
              {buildingFloors.length} floor
              {buildingFloors.length === 1 ? "" : "s"} · {rooms.length} room
              {rooms.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {!compact && onEditBuilding ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditBuilding}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit building
              </Button>
            ) : null}
            {!compact && onAddFloor ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddFloor}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add floor
              </Button>
            ) : null}
            {!compact && onAddRoom ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddRoom}
              >
                <BedDouble className="mr-1.5 h-3.5 w-3.5" />
                Add room
              </Button>
            ) : null}
            <Building2
              className={cn(
                "shrink-0 text-orange-600",
                compact ? "h-4 w-4" : "h-6 w-6",
              )}
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          {buildingFloors.map((floor) => {
            const floorRooms = rooms.filter(
              (room) => room.floor_id === floor.id,
            );
            return (
              <div
                key={floor.id}
                className={cn(
                  "grid border-b-[3px] border-muted-foreground/30 bg-gradient-to-b from-muted/10 to-muted/35",
                  compact
                    ? "grid-cols-[64px_1fr] gap-3 p-3"
                    : "grid-cols-[120px_1fr] gap-5 p-5",
                )}
              >
                <div className="flex min-w-0 flex-col items-center justify-center border-r border-dashed border-muted-foreground/25 pr-2 text-center text-muted-foreground">
                  {onSelectFloor ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectFloor(floor);
                      }}
                      className={cn(
                        "flex max-w-full flex-col items-center hover:text-orange-600",
                      )}
                      title={`Open ${floor.name}`}
                    >
                      <Layers3
                        className={cn(compact ? "h-3 w-3" : "mb-1 h-4 w-4")}
                      />
                      <span
                        className={cn(
                          "max-w-full truncate font-bold",
                          compact ? "text-[9px]" : "text-xs",
                        )}
                      >
                        {floor.name}
                      </span>
                    </button>
                  ) : (
                    <div className="flex max-w-full flex-col items-center">
                      <Layers3
                        className={cn(compact ? "h-3 w-3" : "mb-1 h-4 w-4")}
                      />
                      <span
                        className={cn(
                          "max-w-full truncate font-bold",
                          compact ? "text-[9px]" : "text-xs",
                        )}
                      >
                        {floor.name}
                      </span>
                    </div>
                  )}
                  {!compact && onEditFloor ? (
                    <button
                      type="button"
                      aria-label={`Edit ${floor.name}`}
                      className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-bold text-orange-600 hover:bg-orange-500/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditFloor(floor);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  ) : null}
                </div>
                <HotelFloorRoomPlan
                  floor={floor}
                  rooms={floorRooms}
                  compact={compact}
                  onSelectRoom={onSelectRoom}
                  availableRoomIds={availableRoomIds}
                  priceByRoomType={priceByRoomType}
                />
              </div>
            );
          })}
          {!buildingFloors.length ? (
            <div className="flex min-h-32 flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
              Add a floor to start placing rooms.
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-2 bg-background/95 font-semibold",
            compact ? "px-3 py-2 text-[9px]" : "px-5 py-3 text-xs",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", condition.dot)} />
            {condition.label}
          </span>
          <span className="text-muted-foreground">
            {availableCount == null
              ? `${building.occupied_count ?? 0} occupied · ${building.ready_count ?? 0} ready`
              : `${availableCount} available for this stay`}
          </span>
        </div>
      </div>
      <div className="mx-[3%] h-2 rounded-b-lg bg-muted-foreground/35" />
    </div>
  );
}

export function HotelPropertyMap({
  buildings,
  floors,
  rooms,
  selectedBuildingId,
  onSelectedBuildingChange,
  onSelectRoom,
  onEditBuilding,
  onEditFloor,
  onAddFloor,
  onAddRoom,
  manage = false,
  availableRoomIds,
  priceByRoomType,
}: {
  buildings: HotelBuilding[];
  floors: HotelFloor[];
  rooms: HotelRoom[];
  selectedBuildingId: number | "all";
  onSelectedBuildingChange: (buildingId: number | "all") => void;
  onSelectRoom: (room: HotelRoom) => void;
  onEditBuilding?: (building: HotelBuilding) => void;
  onEditFloor?: (floor: HotelFloor) => void;
  onAddFloor?: (building: HotelBuilding) => void;
  onAddRoom?: (building: HotelBuilding) => void;
  manage?: boolean;
  availableRoomIds?: Set<number>;
  priceByRoomType?: Record<number, number>;
}) {
  const orderedBuildings = [...buildings].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.name.localeCompare(right.name),
  );
  const visibleBuildings =
    selectedBuildingId === "all"
      ? orderedBuildings
      : orderedBuildings.filter(
          (building) => building.id === selectedBuildingId,
        );
  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="border-b px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Buildings and rooms</h3>
            <p className="text-xs text-muted-foreground">
              {manage
                ? "Choose a building below, then edit its floors or rooms."
                : "Select any available room to start a booking."}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
            {buildings.length} building{buildings.length === 1 ? "" : "s"}
          </span>
        </div>
        <div
          className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
          role="group"
          aria-label="Filter buildings"
        >
          <button
            type="button"
            aria-label="Show all buildings"
            onClick={() => onSelectedBuildingChange("all")}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
              selectedBuildingId === "all"
                ? "border-orange-500 bg-orange-500 text-white"
                : "bg-background hover:border-orange-300 hover:bg-orange-500/5",
            )}
          >
            All buildings
            <span className="ml-1 opacity-75">{buildings.length}</span>
          </button>
          {orderedBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              aria-label={`Show ${building.name}`}
              onClick={() => onSelectedBuildingChange(building.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                selectedBuildingId === building.id
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "bg-background hover:border-orange-300 hover:bg-orange-500/5",
              )}
            >
              {building.name}
              <span className="ml-1.5 opacity-75">{building.room_count ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-8 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_38%),linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px] p-4 sm:p-6 lg:p-8">
        {visibleBuildings.map((building) => {
          const buildingFloors = sortedFloors(building, floors);
          const buildingRooms = rooms.filter((room) =>
            buildingFloors.some((floor) => floor.id === room.floor_id),
          );
          return (
            <article
              key={building.id}
              aria-label={building.name}
              className="min-w-0"
            >
              <BuildingFacade
                building={building}
                floors={buildingFloors}
                rooms={buildingRooms}
                onSelectRoom={onSelectRoom}
                onEditFloor={manage ? onEditFloor : undefined}
                onEditBuilding={
                  manage && onEditBuilding
                    ? () => onEditBuilding(building)
                    : undefined
                }
                onAddFloor={
                  manage && onAddFloor ? () => onAddFloor(building) : undefined
                }
                onAddRoom={
                  manage && onAddRoom ? () => onAddRoom(building) : undefined
                }
                availableRoomIds={availableRoomIds}
                priceByRoomType={priceByRoomType}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
