"use client";

import { BedDouble, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type HotelRoomBookingDraft,
  newHotelRoomDraft,
  roomTypeSelectionCount,
  UNASSIGNED_HOTEL_ROOM,
} from "@/lib/hotel/booking-draft";
import type { HotelAvailability } from "@/lib/hotel/types";
import { hotelCurrency } from "./hotel-ui";

interface Props {
  availability: HotelAvailability | null;
  rooms: HotelRoomBookingDraft[];
  onChange: (rooms: HotelRoomBookingDraft[]) => void;
  disabled?: boolean;
}

export function BookingRoomsEditor({ availability, rooms, onChange, disabled = false }: Props) {
  const update = (key: string, values: Partial<HotelRoomBookingDraft>) =>
    onChange(rooms.map((room) => (room.key === key ? { ...room, ...values } : room)));
  const selectedPhysicalRooms = new Set(
    rooms
      .map((room) => room.assignedRoomId)
      .filter((roomId) => roomId !== UNASSIGNED_HOTEL_ROOM),
  );
  const availableInventory =
    availability?.room_types.reduce((total, row) => total + row.available_inventory, 0) ?? 0;
  const canAdd = rooms.length < availableInventory;

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Rooms</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add every room in this booking. All charges will appear on one guest bill.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canAdd || !availability}
          onClick={() => {
            const firstAvailable = availability?.room_types.find(
              (row) =>
                roomTypeSelectionCount(rooms, String(row.room_type.id)) < row.available_inventory,
            );
            onChange([
              ...rooms,
              newHotelRoomDraft(
                `room-${Date.now()}-${rooms.length}`,
                firstAvailable ? String(firstAvailable.room_type.id) : "",
              ),
            ]);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />Add room
        </Button>
      </div>

      {rooms.map((room, index) => {
        const selectedType = availability?.room_types.find(
          (row) => String(row.room_type.id) === room.roomTypeId,
        );
        const physicalRooms =
          selectedType?.available_rooms.filter(
            (candidate) =>
              room.assignedRoomId === String(candidate.id) ||
              !selectedPhysicalRooms.has(String(candidate.id)),
          ) ?? [];
        return (
          <section key={room.key} className="rounded-xl border bg-muted/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-orange-500/10 p-2 text-orange-600">
                  <BedDouble className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">Room {index + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedType ? hotelCurrency(selectedType.stay_total) : "Select a room type"}
                  </p>
                </div>
              </div>
              {rooms.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={`Remove room ${index + 1}`}
                  onClick={() => onChange(rooms.filter((candidate) => candidate.key !== room.key))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Room type</Label>
                <Select
                  value={room.roomTypeId}
                  disabled={disabled}
                  onValueChange={(value) =>
                    update(room.key, {
                      roomTypeId: value,
                      assignedRoomId: UNASSIGNED_HOTEL_ROOM,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                  <SelectContent>
                    {availability?.room_types.map((row) => {
                      const usedElsewhere = roomTypeSelectionCount(
                        rooms,
                        String(row.room_type.id),
                        room.key,
                      );
                      const selectable = usedElsewhere < row.available_inventory;
                      return (
                        <SelectItem
                          key={row.room_type.id}
                          value={String(row.room_type.id)}
                          disabled={!selectable}
                        >
                          {row.room_type.name} · {Math.max(0, row.available_inventory - usedElsewhere)} left · {hotelCurrency(row.stay_total)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Physical room</Label>
                <Select
                  value={room.assignedRoomId}
                  disabled={disabled || !selectedType}
                  onValueChange={(value) => update(room.key, { assignedRoomId: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_HOTEL_ROOM}>Assign later at front desk</SelectItem>
                    {physicalRooms.map((candidate) => (
                      <SelectItem key={candidate.id} value={String(candidate.id)}>
                        Room {candidate.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedType?.room_type.max_adults}
                  value={room.adults}
                  disabled={disabled}
                  onChange={(event) => update(room.key, { adults: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  max={selectedType?.room_type.max_children}
                  value={room.children}
                  disabled={disabled}
                  onChange={(event) => update(room.key, { children: event.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>{index === 0 ? "Additional occupants" : "Room occupants"}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {index === 0
                      ? "The primary guest is assigned to this room automatically."
                      : "Optional names help staff identify who is staying in this room."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => update(room.key, { occupantNames: [...room.occupantNames, ""] })}
                >
                  <UserPlus className="mr-2 h-4 w-4" />Add occupant
                </Button>
              </div>
              {room.occupantNames.map((name, occupantIndex) => (
                <div key={`${room.key}-guest-${occupantIndex}`} className="flex gap-2">
                  <Input
                    value={name}
                    disabled={disabled}
                    placeholder="Guest name"
                    onChange={(event) =>
                      update(room.key, {
                        occupantNames: room.occupantNames.map((current, currentIndex) =>
                          currentIndex === occupantIndex ? event.target.value : current,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label="Remove occupant"
                    onClick={() =>
                      update(room.key, {
                        occupantNames: room.occupantNames.filter(
                          (_current, currentIndex) => currentIndex !== occupantIndex,
                        ),
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

