"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  Eraser,
  Loader2,
  Map as MapIcon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UsersRound,
  X,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type {
  HotelAvailability,
  HotelBuilding,
  HotelFloor,
  HotelRoom,
  HotelRoomType,
} from "@/lib/hotel/types";
import { cn } from "@/lib/utils";
import {
  HotelEmptyState,
  HotelStatusBadge,
  hotelCurrency,
  humanizeHotelStatus,
} from "./hotel-ui";
import {
  HotelFloorBoard,
  hotelRoomGridCoordinates,
  hotelRoomGridLayout,
  hotelRoomTone,
} from "./hotel-room-board";
import { HotelPropertyMap } from "./hotel-property-map";
import { BookingFormDialog } from "./booking-form-dialog";

interface Props {
  restaurantId: number;
  canManage: boolean;
  refreshKey: number;
  onChanged: () => void;
}

const floorKey = (floorId: number | null) =>
  floorId == null ? "unassigned" : `floor-${floorId}`;

export function InventoryPanel({
  restaurantId,
  canManage,
  refreshKey,
  onChanged,
}: Props) {
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [buildings, setBuildings] = useState<HotelBuilding[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [floors, setFloors] = useState<HotelFloor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [mode, setMode] = useState<"book" | "manage">("book");
  const [selectedType, setSelectedType] = useState("all");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [arrivalDate, setArrivalDate] = useState(() => hotelDate(new Date()));
  const [departureDate, setDepartureDate] = useState(() =>
    hotelDate(new Date(Date.now() + 86_400_000)),
  );
  const [availability, setAvailability] = useState<HotelAvailability | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<HotelRoom | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [layoutSnapshot, setLayoutSnapshot] = useState<HotelRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<number | null>(null);
  const [activeBuildingId, setActiveBuildingId] = useState<number | null>(null);
  const [buildingFilterId, setBuildingFilterId] = useState<number | "all">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [typeDialog, setTypeDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [floorDialog, setFloorDialog] = useState(false);
  const [buildingDialog, setBuildingDialog] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<HotelBuilding | null>(
    null,
  );
  const [editingRoom, setEditingRoom] = useState<HotelRoom | null>(null);
  const [typeCode, setTypeCode] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeRate, setTypeRate] = useState("");
  const [typeAdults, setTypeAdults] = useState("2");
  const [typeChildren, setTypeChildren] = useState("0");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomFloorId, setRoomFloorId] = useState("none");
  const [roomCapacity, setRoomCapacity] = useState("2");
  const [roomNotes, setRoomNotes] = useState("");
  const [floorName, setFloorName] = useState("");
  const [floorOrder, setFloorOrder] = useState("0");
  const [floorBuildingId, setFloorBuildingId] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [buildingCode, setBuildingCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRooms, nextTypes, nextFloors, nextBuildings] =
        await Promise.all([
          hotelPmsApi.listRooms(restaurantId),
          hotelPmsApi.listRoomTypes(restaurantId),
          hotelPmsApi.listFloors(restaurantId),
          hotelPmsApi.listBuildings(restaurantId),
        ]);
      setRooms(nextRooms);
      setRoomTypes(nextTypes);
      setFloors([...nextFloors].sort((a, b) => a.sort_order - b.sort_order));
      setBuildings(nextBuildings);
      setBuildingFilterId((current) =>
        current === "all" ||
        nextBuildings.some((building) => building.id === current)
          ? current
          : "all",
      );
      setActiveBuildingId((current) =>
        nextBuildings.some((building) => building.id === current)
          ? current
          : null,
      );
      setActiveFloorId((current) =>
        nextFloors.some((floor) => floor.id === current) ? current : null,
      );
      setSelectedRoomId((current) =>
        nextRooms.some((room) => room.id === current)
          ? current
          : (nextRooms[0]?.id ?? null),
      );
      setRoomTypeId(
        (current) => current || (nextTypes[0] ? String(nextTypes[0].id) : ""),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't load the rooms"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (
      mode !== "book" ||
      !arrivalDate ||
      !departureDate ||
      departureDate <= arrivalDate
    )
      return;
    let active = true;
    setAvailabilityLoading(true);
    hotelPmsApi
      .getAvailability(restaurantId, arrivalDate, departureDate)
      .then((result) => {
        if (active) setAvailability(result);
      })
      .catch((error) => {
        if (active)
          toast.error(
            getApiErrorMessage(
              error,
              "We couldn't check which rooms are available",
            ),
          );
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, restaurantId, arrivalDate, departureDate, refreshKey]);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const activeBuilding =
    buildings.find((building) => building.id === activeBuildingId) ??
    buildings[0] ??
    null;
  const activeFloor =
    floors.find((floor) => floor.id === activeFloorId) ?? null;
  const priceByRoomType = useMemo(() => {
    const nights = Math.max(1, availability?.nights ?? 1);
    return Object.fromEntries(
      (availability?.room_types ?? []).map((row) => {
        const totals = [
          row.stay_total,
          ...row.rate_options.map((option) => option.stay_total),
        ]
          .map(Number)
          .filter(Number.isFinite);
        return [
          row.room_type.id,
          (totals.length
            ? Math.min(...totals)
            : Number(row.room_type.base_rate)) / nights,
        ];
      }),
    );
  }, [availability]);
  const availableRooms = useMemo(() => {
    const rows = availability?.room_types ?? [];
    const minimum = minimumPrice.trim() === "" ? null : Number(minimumPrice);
    const maximum = maximumPrice.trim() === "" ? null : Number(maximumPrice);
    return rows
      .filter(
        (row) =>
          selectedType === "all" || String(row.room_type.id) === selectedType,
      )
      .filter((row) => {
        const price =
          priceByRoomType[row.room_type.id] ?? Number(row.room_type.base_rate);
        return (
          (minimum == null || !Number.isFinite(minimum) || price >= minimum) &&
          (maximum == null || !Number.isFinite(maximum) || price <= maximum)
        );
      })
      .flatMap((row) => row.available_rooms);
  }, [availability, selectedType, minimumPrice, maximumPrice, priceByRoomType]);
  const availableRoomIds = useMemo(
    () => new Set(availableRooms.map((room) => room.id)),
    [availableRooms],
  );
  const visibleRooms = mode === "book" ? availableRooms : rooms;
  const withoutFloor = useMemo(
    () => visibleRooms.filter((room) => !room.floor),
    [visibleRooms],
  );
  const floorSections = useMemo(() => {
    const scopedFloors =
      activeBuildingId == null
        ? floors
        : floors.filter((floor) => floor.building_id === activeBuildingId);
    let rows: Array<{ floor: HotelFloor | null; rooms: HotelRoom[] }> =
      scopedFloors.map((floor) => ({
        floor,
        rooms: visibleRooms.filter((room) => room.floor?.id === floor.id),
      }));
    if (withoutFloor.length || !floors.length)
      rows.push({ floor: null, rooms: withoutFloor });
    if (mode === "book") rows = rows.filter((row) => row.rooms.length > 0);
    if (selectedFloor === "all") return rows;
    return rows.filter(
      (row) => floorKey(row.floor?.id ?? null) === selectedFloor,
    );
  }, [
    floors,
    visibleRooms,
    selectedFloor,
    withoutFloor,
    mode,
    activeBuildingId,
  ]);

  const counts = useMemo(
    () => ({
      total: rooms.length,
      ready: rooms.filter((room) => hotelRoomTone(room).label === "Ready")
        .length,
      occupied: rooms.filter((room) => room.occupancy_status === "occupied")
        .length,
      attention: rooms.filter(
        (room) =>
          room.housekeeping_status === "dirty" ||
          room.service_status !== "in_service",
      ).length,
    }),
    [rooms],
  );

  const afterMutation = async (message: string) => {
    toast.success(message);
    await load();
    onChanged();
  };

  const createType = async () => {
    if (!typeCode.trim() || !typeName.trim() || Number(typeRate) < 0) return;
    setSaving(true);
    try {
      await hotelPmsApi.createRoomType({
        restaurant_id: restaurantId,
        code: typeCode.trim(),
        name: typeName.trim(),
        base_rate: Number(typeRate || 0),
        max_adults: Math.max(1, Number(typeAdults || 1)),
        max_children: Math.max(0, Number(typeChildren || 0)),
      });
      setTypeDialog(false);
      setTypeCode("");
      setTypeName("");
      setTypeRate("");
      await afterMutation("Room type created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create room type"));
    } finally {
      setSaving(false);
    }
  };

  const openRoomDialog = (room?: HotelRoom, preferredFloorId?: number) => {
    const current = room ?? null;
    setEditingRoom(current);
    setRoomNumber(current?.number ?? "");
    setRoomName(current?.name ?? "");
    setRoomTypeId(
      current
        ? String(current.room_type_id)
        : roomTypes[0]
          ? String(roomTypes[0].id)
          : "",
    );
    setRoomFloorId(
      current
        ? current.floor_id == null
          ? "none"
          : String(current.floor_id)
        : preferredFloorId != null
          ? String(preferredFloorId)
          : "none",
    );
    setRoomCapacity(String(current?.capacity ?? 2));
    setRoomNotes(current?.notes ?? "");
    setRoomDialog(true);
  };

  const saveRoom = async () => {
    if (!roomNumber.trim() || !roomTypeId) return;
    setSaving(true);
    try {
      const common = {
        name: roomName.trim() || null,
        notes: roomNotes.trim() || null,
      };
      const room = editingRoom
        ? await hotelPmsApi.updateRoom(editingRoom.id, {
            version: editingRoom.version,
            ...common,
            ...(editingRoom.occupancy_status === "vacant"
              ? {
                  room_type_id: Number(roomTypeId),
                  floor_id: roomFloorId === "none" ? null : Number(roomFloorId),
                  number: roomNumber.trim(),
                  capacity: Math.max(1, Number(roomCapacity || 1)),
                }
              : {}),
          })
        : await hotelPmsApi.createRoom({
            restaurant_id: restaurantId,
            room_type_id: Number(roomTypeId),
            floor_id: roomFloorId === "none" ? null : Number(roomFloorId),
            number: roomNumber.trim(),
            capacity: Math.max(1, Number(roomCapacity || 1)),
            ...common,
          });
      setRoomDialog(false);
      setSelectedRoomId(room.id);
      await afterMutation(editingRoom ? "Room updated" : "Room created");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          editingRoom ? "Failed to update room" : "Failed to create room",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const removeRoom = async (room: HotelRoom) => {
    if (
      !window.confirm(
        `Remove room ${room.number}? Historical bookings will be kept, but this room will no longer be available for new bookings.`,
      )
    )
      return;
    setSaving(true);
    try {
      await hotelPmsApi.updateRoom(room.id, {
        version: room.version,
        is_active: false,
      });
      setRoomDialog(false);
      setEditingRoom(null);
      setSelectedRoomId(null);
      await afterMutation(`Room ${room.number} removed`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't remove this room"));
    } finally {
      setSaving(false);
    }
  };

  const openFloorDialog = (preferredBuilding?: HotelBuilding) => {
    if (preferredBuilding) setActiveBuildingId(preferredBuilding.id);
    const defaultBuilding = preferredBuilding ?? activeBuilding ?? buildings[0];
    setFloorName("");
    setFloorOrder(String(floors.length));
    setFloorBuildingId(defaultBuilding ? String(defaultBuilding.id) : "");
    setFloorDialog(true);
  };

  const saveFloor = async () => {
    if (!floorName.trim()) return;
    setSaving(true);
    try {
      const normalizedOrder = Math.max(0, Number(floorOrder || 0));
      const floor = await hotelPmsApi.createFloor({
        restaurant_id: restaurantId,
        building_id: floorBuildingId
          ? Number(floorBuildingId)
          : activeBuilding?.id,
        name: floorName.trim(),
        sort_order: normalizedOrder,
        layout_width: 1200,
        layout_height: 700,
      });
      setFloorDialog(false);
      setSelectedFloor(floorKey(floor.id));
      setActiveFloorId(floor.id);
      await afterMutation("Floor added");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't add the floor"));
    } finally {
      setSaving(false);
    }
  };

  const removeFloor = async (floor: HotelFloor) => {
    const roomCount = rooms.filter((room) => room.floor_id === floor.id).length;
    if (roomCount) {
      toast.error(
        `Remove ${roomCount} room${roomCount === 1 ? "" : "s"} from this floor first.`,
      );
      return;
    }
    if (!window.confirm(`Remove ${floor.name}?`)) return;
    setSaving(true);
    try {
      await hotelPmsApi.updateFloor(floor.id, { is_active: false });
      setActiveFloorId(null);
      setSelectedFloor("all");
      await afterMutation(`${floor.name} removed`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't remove this floor"));
    } finally {
      setSaving(false);
    }
  };

  const openBuildingDialog = (building?: HotelBuilding) => {
    const current = building ?? null;
    setEditingBuilding(current);
    setBuildingName(current?.name ?? "");
    setBuildingCode(current?.code ?? "");
    setBuildingDialog(true);
  };

  const saveBuilding = async () => {
    if (!buildingName.trim()) return;
    setSaving(true);
    try {
      const index = buildings.length;
      const building = editingBuilding
        ? await hotelPmsApi.updateBuilding(editingBuilding.id, {
            version: editingBuilding.version,
            name: buildingName.trim(),
            code: buildingCode.trim() || null,
          })
        : await hotelPmsApi.createBuilding({
            restaurant_id: restaurantId,
            name: buildingName.trim(),
            code: buildingCode.trim() || null,
            sort_order: index,
            pos_x: 60 + (index % 3) * 500,
            pos_y: 70 + Math.floor(index / 3) * 330,
          });
      setBuildingDialog(false);
      setEditingBuilding(null);
      setBuildingName("");
      setBuildingCode("");
      setActiveBuildingId(building.id);
      if (!editingBuilding) setBuildingFilterId(building.id);
      await afterMutation(
        editingBuilding ? "Building updated" : "Building added",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't add the building"));
    } finally {
      setSaving(false);
    }
  };

  const removeBuilding = async (building: HotelBuilding) => {
    const floorCount = floors.filter(
      (floor) => floor.building_id === building.id,
    ).length;
    if (floorCount) {
      toast.error(
        `Remove this building's ${floorCount} floor${floorCount === 1 ? "" : "s"} first.`,
      );
      return;
    }
    if (!window.confirm(`Remove ${building.name}?`)) return;
    setSaving(true);
    try {
      await hotelPmsApi.updateBuilding(building.id, {
        version: building.version,
        is_active: false,
      });
      setBuildingDialog(false);
      setEditingBuilding(null);
      setActiveBuildingId(null);
      if (buildingFilterId === building.id) setBuildingFilterId("all");
      await afterMutation(`${building.name} removed`);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "We couldn't remove this building"),
      );
    } finally {
      setSaving(false);
    }
  };

  const saveActiveFloor = async () => {
    if (!activeFloor || !floorName.trim()) return;
    setSaving(true);
    try {
      const targetBuildingId = floorBuildingId
        ? Number(floorBuildingId)
        : activeFloor.building_id;
      await hotelPmsApi.updateFloor(activeFloor.id, {
        building_id: targetBuildingId,
        name: floorName.trim(),
        sort_order: Math.max(0, Number(floorOrder || 0)),
      });
      setActiveBuildingId(targetBuildingId);
      await afterMutation("Floor details saved");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "We couldn't save the floor details"),
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!activeFloor) return;
    setFloorName(activeFloor.name);
    setFloorOrder(String(activeFloor.sort_order));
    setFloorBuildingId(String(activeFloor.building_id));
  }, [activeFloor]);

  const startLayoutEditing = () => {
    setLayoutSnapshot(rooms.map((room) => ({ ...room })));
    setLayoutEditing(true);
  };

  const cancelLayoutEditing = () => {
    setRooms(layoutSnapshot);
    setLayoutSnapshot([]);
    setLayoutEditing(false);
  };

  const moveRoomOnGrid = (roomId: number, column: number, row: number) => {
    setRooms((current) => {
      const moving = current.find((room) => room.id === roomId);
      if (!moving || moving.floor_id == null) return current;
      const floorRooms = current.filter(
        (room) => room.floor_id === moving.floor_id,
      );
      const layout = hotelRoomGridLayout(floorRooms);
      const movingCell = layout.get(moving.id) ?? { column: 0, row: 0 };
      const targetRoom = floorRooms.find((room) => {
        const cell = layout.get(room.id);
        return (
          room.id !== moving.id && cell?.column === column && cell.row === row
        );
      });
      const targetCoordinates = hotelRoomGridCoordinates(column, row);
      const previousCoordinates = hotelRoomGridCoordinates(
        movingCell.column,
        movingCell.row,
      );
      return current.map((room) => {
        if (room.id === moving.id)
          return {
            ...room,
            ...targetCoordinates,
          };
        if (targetRoom && room.id === targetRoom.id)
          return {
            ...room,
            ...previousCoordinates,
          };
        return room;
      });
    });
  };

  const autoArrange = () => {
    if (!activeFloor) return;
    setRooms((current) => {
      const roomsOnFloor = current
        .filter((room) => room.floor_id === activeFloor.id)
        .sort((left, right) =>
          left.number.localeCompare(right.number, undefined, { numeric: true }),
        );
      const updates = new Map(
        roomsOnFloor.map((room, index) => [
          room.id,
          {
            ...room,
            ...hotelRoomGridCoordinates(index % 10, Math.floor(index / 10)),
          },
        ]),
      );
      return current.map((room) => updates.get(room.id) ?? room);
    });
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const moved = rooms.filter((room) => {
        const original = layoutSnapshot.find(
          (candidate) => candidate.id === room.id,
        );
        return (
          original &&
          (original.floor_id !== room.floor_id ||
            original.pos_x !== room.pos_x ||
            original.pos_y !== room.pos_y)
        );
      });
      await Promise.all(
        moved.map((room) =>
          hotelPmsApi.updateRoom(room.id, {
            version: room.version,
            floor_id: room.floor_id,
            pos_x: room.pos_x,
            pos_y: room.pos_y,
          }),
        ),
      );
      setLayoutEditing(false);
      setLayoutSnapshot([]);
      await afterMutation("Room arrangement saved");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't save the floor plan"));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const startBooking = (room: HotelRoom) => {
    setBookingRoom(room);
    setBookingOpen(true);
  };

  const handleRoomSelection = (room: HotelRoom) => {
    if (mode === "manage") {
      if (room.floor?.building_id != null) {
        setActiveBuildingId(room.floor.building_id);
      }
      openRoomDialog(room);
      return;
    }
    if (availabilityLoading) {
      toast.message("Checking room availability...");
      return;
    }
    if (!availableRoomIds.has(room.id)) {
      toast.error(
        "This room is not available for the selected stay. Change the dates or choose another room.",
      );
      return;
    }
    startBooking(room);
  };

  const updateStatus = async (
    room: HotelRoom,
    values: { housekeeping_status?: string; service_status?: string },
  ) => {
    setWorkingId(room.id);
    try {
      await hotelPmsApi.updateRoomStatus(room.id, room.version, values);
      await afterMutation("Room status updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update room"));
    } finally {
      setWorkingId(null);
    }
  };

  const metricCards = [
    {
      label: "All rooms",
      value: counts.total,
      icon: BedDouble,
      tone: "text-foreground bg-muted",
    },
    {
      label: "Ready",
      value: counts.ready,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-500/10",
    },
    {
      label: "Occupied",
      value: counts.occupied,
      icon: UsersRound,
      tone: "text-violet-700 bg-violet-500/10",
    },
    {
      label: "Needs attention",
      value: counts.attention,
      icon: Sparkles,
      tone: "text-amber-700 bg-amber-500/10",
    },
  ];
  const selectedNights = Math.max(1, availability?.nights ?? 1);
  const hasPriceFilter =
    minimumPrice.trim() !== "" || maximumPrice.trim() !== "";
  const displayedRoomCount = availableRooms.length;
  const clearBookingFilters = () => {
    setSelectedType("all");
    setMinimumPrice("");
    setMaximumPrice("");
  };
  const bookingFiltersNode =
    mode === "book" ? (
      <Card className="border-orange-500/15 shadow-sm">
        <CardContent className="p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-xl border bg-background sm:w-[350px]">
              <label className="relative border-r px-3 py-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Check-in
                </span>
                <Input
                  className="h-6 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                  type="date"
                  value={arrivalDate}
                  min={hotelDate(new Date())}
                  onChange={(event) => {
                    const value = event.target.value;
                    setArrivalDate(value);
                    if (departureDate <= value) {
                      const next = new Date(`${value}T00:00:00`);
                      next.setDate(next.getDate() + 1);
                      setDepartureDate(hotelDate(next));
                    }
                  }}
                />
              </label>
              <label className="relative px-3 py-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Check-out
                </span>
                <Input
                  className="h-6 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                  type="date"
                  value={departureDate}
                  min={arrivalDate}
                  onChange={(event) => setDepartureDate(event.target.value)}
                />
              </label>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-[45px] min-w-[210px] flex-1 rounded-xl">
                <SelectValue placeholder="All room types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All room types ·{" "}
                  {availability?.room_types.reduce(
                    (sum, row) => sum + row.available_rooms.length,
                    0,
                  ) ?? 0}
                </SelectItem>
                {availability?.room_types
                  .filter((row) => row.available_inventory > 0)
                  .map((row) => (
                    <SelectItem
                      key={row.room_type.id}
                      value={String(row.room_type.id)}
                    >
                      {row.room_type.name} · {row.available_rooms.length} ·{" "}
                      {hotelCurrency(
                        priceByRoomType[row.room_type.id] ??
                          row.room_type.base_rate,
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={hasPriceFilter ? "secondary" : "outline"}
                  className="h-[45px] rounded-xl px-3"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Price{hasPriceFilter ? " · set" : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[min(92vw,330px)] rounded-2xl p-4"
                align="end"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">Nightly price</p>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to show every price.
                    </p>
                  </div>
                  {hasPriceFilter ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMinimumPrice("");
                        setMaximumPrice("");
                      }}
                    >
                      <Eraser className="mr-1.5 h-3.5 w-3.5" />
                      Clear
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        NPR
                      </span>
                      <Input
                        className="pl-12"
                        type="number"
                        min={0}
                        step={100}
                        value={minimumPrice}
                        onChange={(event) =>
                          setMinimumPrice(event.target.value)
                        }
                        placeholder="Any"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Up to</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        NPR
                      </span>
                      <Input
                        className="pl-12"
                        type="number"
                        min={0}
                        step={100}
                        value={maximumPrice}
                        onChange={(event) =>
                          setMaximumPrice(event.target.value)
                        }
                        placeholder="Any"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex h-[45px] min-w-fit items-center gap-2 rounded-xl bg-orange-500/10 px-3 text-orange-700">
              {availabilityLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              <div className="leading-tight">
                <p className="text-sm font-black">
                  {displayedRoomCount} available
                </p>
                <p className="text-[10px] font-semibold opacity-75">
                  {selectedNights} night{selectedNights === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {selectedType !== "all" || hasPriceFilter ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-[45px] w-[45px] rounded-xl"
                aria-label="Clear room filters"
                onClick={clearBookingFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    ) : null;

  const buildingDialogNode = canManage ? (
    <Dialog
      open={buildingDialog}
      onOpenChange={(open) => {
        setBuildingDialog(open);
        if (!open) setEditingBuilding(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingBuilding ? `Edit ${editingBuilding.name}` : "Add building"}
          </DialogTitle>
          <DialogDescription>
            {editingBuilding
              ? "Update the name guests and staff use for this building."
              : "Add a separate building, wing, or accommodation block."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label>Building name</Label>
            <Input
              value={buildingName}
              onChange={(event) => setBuildingName(event.target.value)}
              placeholder="Garden wing"
            />
          </div>
          <div className="space-y-2">
            <Label>Short code</Label>
            <Input
              value={buildingCode}
              onChange={(event) =>
                setBuildingCode(event.target.value.toUpperCase())
              }
              placeholder="GW"
            />
          </div>
        </div>
        <DialogFooter>
          {editingBuilding ? (
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void removeBuilding(editingBuilding)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove building
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setBuildingDialog(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !buildingName.trim()}
            onClick={() => void saveBuilding()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingBuilding ? "Save changes" : "Add building"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  const bookingDialogNode = (
    <BookingFormDialog
      open={bookingOpen}
      onOpenChange={(open) => {
        setBookingOpen(open);
        if (!open) setBookingRoom(null);
      }}
      restaurantId={restaurantId}
      initialRoom={bookingRoom}
      initialArrivalDate={arrivalDate}
      initialDepartureDate={departureDate}
      onCreated={async () => {
        setBookingOpen(false);
        setBookingRoom(null);
        await load();
        onChanged();
      }}
    />
  );

  if (loading && buildings.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!loading && activeBuilding == null) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Rooms</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first building, then create its floors and rooms.
            </p>
          </div>
          {canManage ? (
            <Button onClick={() => openBuildingDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add building
            </Button>
          ) : null}
        </div>
        <HotelEmptyState
          title="No buildings yet"
          description="Add a building to begin setting up hotel rooms."
        />
        {buildingDialogNode}
      </div>
    );
  }

  if (!loading && activeBuilding && activeFloor == null) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {mode === "manage" ? "Manage rooms" : "Choose a room"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "manage"
                ? "Edit buildings, floors, and room details from this screen."
                : "View all floors and select any available room to start a booking."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button
                disabled={saving}
                variant={mode === "manage" ? "default" : "outline"}
                onClick={() =>
                  setMode((current) =>
                    current === "manage" ? "book" : "manage",
                  )
                }
              >
                <Settings2 className="mr-2 h-4 w-4" />
                {mode === "manage" ? "Done managing" : "Manage property"}
              </Button>
            ) : null}
            {canManage && mode === "manage" ? (
              <>
                <Button variant="outline" onClick={() => openBuildingDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add building
                </Button>
                <Button variant="outline" onClick={() => setTypeDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add room type
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh rooms"
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {bookingFiltersNode}
        <HotelPropertyMap
          buildings={buildings}
          floors={floors}
          rooms={rooms}
          selectedBuildingId={buildingFilterId}
          onSelectedBuildingChange={(buildingId) => {
            setBuildingFilterId(buildingId);
            if (buildingId !== "all") setActiveBuildingId(buildingId);
          }}
          manage={mode === "manage"}
          onSelectRoom={handleRoomSelection}
          onEditBuilding={(building) => {
            setActiveBuildingId(building.id);
            openBuildingDialog(building);
          }}
          onEditFloor={(floor) => {
            setMode("manage");
            setLayoutEditing(false);
            setActiveBuildingId(floor.building_id);
            setActiveFloorId(floor.id);
            setSelectedFloor(floorKey(floor.id));
            setSelectedRoomId(
              rooms.find((room) => room.floor_id === floor.id)?.id ?? null,
            );
          }}
          onAddFloor={(building) => openFloorDialog(building)}
          onAddRoom={(building) => {
            setActiveBuildingId(building.id);
            const defaultFloor = floors
              .filter((floor) => floor.building_id === building.id)
              .sort((left, right) => left.sort_order - right.sort_order)[0];
            openRoomDialog(undefined, defaultFloor?.id);
          }}
          availableRoomIds={mode === "book" ? availableRoomIds : undefined}
          priceByRoomType={mode === "book" ? priceByRoomType : undefined}
        />
        {buildingDialogNode}
        {bookingDialogNode}
        <Dialog open={floorDialog} onOpenChange={setFloorDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add floor</DialogTitle>
              <DialogDescription>
                Choose its building now. You can move it to another building
                later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <Label>Building</Label>
                <Select
                  value={floorBuildingId}
                  onValueChange={setFloorBuildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={String(building.id)}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor name</Label>
                <Input
                  value={floorName}
                  onChange={(event) => setFloorName(event.target.value)}
                  placeholder="Second floor"
                />
              </div>
              <div className="space-y-2">
                <Label>Display order</Label>
                <Input
                  type="number"
                  min={0}
                  value={floorOrder}
                  onChange={(event) => setFloorOrder(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFloorDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || !floorName.trim() || !floorBuildingId}
                onClick={() => void saveFloor()}
              >
                Add floor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add room type</DialogTitle>
              <DialogDescription>
                Create a reusable room option with its price and guest capacity.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="space-y-2">
                  <Label>Short code</Label>
                  <Input
                    value={typeCode}
                    onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                    placeholder="DLX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room type name</Label>
                  <Input
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="Deluxe room"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nightly price</Label>
                <Input
                  type="number"
                  min={0}
                  value={typeRate}
                  onChange={(e) => setTypeRate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={typeAdults}
                    onChange={(e) => setTypeAdults(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={typeChildren}
                    onChange={(e) => setTypeChildren(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTypeDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || !typeCode.trim() || !typeName.trim()}
                onClick={() => void createType()}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
                room type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? `Edit room ${editingRoom.number}` : "Add room"}
              </DialogTitle>
              <DialogDescription>
                {editingRoom?.occupancy_status === "occupied"
                  ? "This room is occupied. You can update its name and notes now; other details can be changed after checkout."
                  : "Set the room number, type, floor, capacity, and notes."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Room number</Label>
                  <Input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="201"
                    disabled={editingRoom?.occupancy_status === "occupied"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(e.target.value)}
                    disabled={editingRoom?.occupancy_status === "occupied"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Display name{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Courtyard room"
                />
              </div>
              <div className="space-y-2">
                <Label>Room type</Label>
                <Select
                  value={roomTypeId}
                  onValueChange={setRoomTypeId}
                  disabled={editingRoom?.occupancy_status === "occupied"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Select
                  value={roomFloorId}
                  onValueChange={setRoomFloorId}
                  disabled={editingRoom?.occupancy_status === "occupied"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No floor assigned</SelectItem>
                    {floors.map((floor) => (
                      <SelectItem key={floor.id} value={String(floor.id)}>
                        {floor.building.name} / {floor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Staff notes{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  value={roomNotes}
                  onChange={(e) => setRoomNotes(e.target.value)}
                  placeholder="Maintenance access, bed setup, or other notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              {editingRoom ? (
                <Button
                  variant="destructive"
                  disabled={
                    saving || editingRoom.occupancy_status === "occupied"
                  }
                  onClick={() => void removeRoom(editingRoom)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove room
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setRoomDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || !roomNumber.trim() || !roomTypeId}
                onClick={() => void saveRoom()}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRoom ? "Save changes" : "Add room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            Edit {activeFloor?.name ?? "floor"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeBuilding?.name ?? "Building"} · Arrange rooms on the grid and
            save the arrangement when finished.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActiveBuildingId(null);
              setActiveFloorId(null);
              setSelectedRoomId(null);
            }}
          >
            <MapIcon className="mr-2 h-4 w-4" />
            Buildings
          </Button>
          {activeBuilding && activeFloor ? (
            <Button
              variant="outline"
              onClick={() => {
                setActiveFloorId(null);
                setSelectedFloor("all");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {activeBuilding.name}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh rooms"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {mode === "book" ? (
        <Card className="border-orange-500/15 shadow-sm">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-xl border bg-background sm:w-[350px]">
                <label className="relative border-r px-3 py-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Check-in
                  </span>
                  <Input
                    className="h-6 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                    type="date"
                    value={arrivalDate}
                    min={hotelDate(new Date())}
                    onChange={(event) => {
                      const value = event.target.value;
                      setArrivalDate(value);
                      if (departureDate <= value) {
                        const next = new Date(`${value}T00:00:00`);
                        next.setDate(next.getDate() + 1);
                        setDepartureDate(hotelDate(next));
                      }
                    }}
                  />
                </label>
                <label className="relative px-3 py-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Check-out
                  </span>
                  <Input
                    className="h-6 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                    type="date"
                    value={departureDate}
                    min={arrivalDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid min-w-[300px] flex-1 grid-cols-2 gap-2 sm:grid-cols-[minmax(190px,1fr)_minmax(150px,0.75fr)]">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-[45px] rounded-xl">
                    <SelectValue placeholder="All room types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All room types ·{" "}
                      {availability?.room_types.reduce(
                        (sum, row) => sum + row.available_rooms.length,
                        0,
                      ) ?? 0}
                    </SelectItem>
                    {availability?.room_types
                      .filter((row) => row.available_inventory > 0)
                      .map((row) => (
                        <SelectItem
                          key={row.room_type.id}
                          value={String(row.room_type.id)}
                        >
                          {row.room_type.name} · {row.available_rooms.length} ·{" "}
                          {hotelCurrency(
                            priceByRoomType[row.room_type.id] ??
                              row.room_type.base_rate,
                          )}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                  <SelectTrigger className="h-[45px] rounded-xl">
                    <SelectValue placeholder="All floors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All floors · {visibleRooms.length}
                    </SelectItem>
                    {floors.map((floor) => (
                      <SelectItem key={floor.id} value={floorKey(floor.id)}>
                        {floor.name} ·{" "}
                        {
                          visibleRooms.filter(
                            (room) => room.floor?.id === floor.id,
                          ).length
                        }
                      </SelectItem>
                    ))}
                    {withoutFloor.length ? (
                      <SelectItem value="unassigned">
                        No floor · {withoutFloor.length}
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={hasPriceFilter ? "secondary" : "outline"}
                      className="h-[45px] rounded-xl px-3"
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Price{hasPriceFilter ? " · 1" : ""}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(92vw,330px)] rounded-2xl p-4"
                    align="end"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">Nightly price</p>
                        <p className="text-xs text-muted-foreground">
                          Leave blank to show every price.
                        </p>
                      </div>
                      {hasPriceFilter ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMinimumPrice("");
                            setMaximumPrice("");
                          }}
                        >
                          <Eraser className="mr-1.5 h-3.5 w-3.5" />
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>From</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            NPR
                          </span>
                          <Input
                            className="pl-12"
                            type="number"
                            min={0}
                            step={100}
                            value={minimumPrice}
                            onChange={(event) =>
                              setMinimumPrice(event.target.value)
                            }
                            placeholder="Any"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Up to</Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            NPR
                          </span>
                          <Input
                            className="pl-12"
                            type="number"
                            min={0}
                            step={100}
                            value={maximumPrice}
                            onChange={(event) =>
                              setMaximumPrice(event.target.value)
                            }
                            placeholder="Any"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="ml-auto flex h-[45px] min-w-fit items-center gap-2 rounded-xl bg-orange-500/10 px-3 text-orange-700">
                  <CalendarDays className="h-4 w-4" />
                  <div className="leading-tight">
                    <p className="text-sm font-black">
                      {displayedRoomCount} available
                    </p>
                    <p className="text-[10px] font-semibold opacity-75">
                      {selectedNights} night{selectedNights === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {selectedType !== "all" ||
                selectedFloor !== "all" ||
                hasPriceFilter ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-[45px] w-[45px] rounded-xl"
                    aria-label="Clear room filters"
                    onClick={clearBookingFilters}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {layoutEditing ? (
              <>
                <Button variant="outline" onClick={autoArrange}>
                  Sort rooms by number
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelLayoutEditing}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={() => void saveLayout()} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save room arrangement
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startLayoutEditing}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Arrange rooms
                </Button>
                <Button variant="outline" onClick={() => openBuildingDialog()}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Add building
                </Button>
                <Button variant="outline" onClick={() => openFloorDialog()}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Add floor
                </Button>
                <Button variant="outline" onClick={() => setTypeDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add room type
                </Button>
                <Button
                  onClick={() => openRoomDialog()}
                  disabled={!roomTypes.length}
                >
                  <BedDouble className="mr-2 h-4 w-4" />
                  Add room
                </Button>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {metricCards.map((metric) => (
              <Card key={metric.label} className="shadow-none">
                <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      metric.tone,
                    )}
                  >
                    <metric.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-black leading-none">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {mode === "manage" ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
          <span className="shrink-0 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Floor
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedFloor("all")}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                selectedFloor === "all"
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "bg-card hover:bg-muted",
              )}
            >
              All floors{" "}
              <span className="ml-1 opacity-70">{visibleRooms.length}</span>
            </button>
            {floors
              .filter(
                (floor) =>
                  activeBuildingId == null ||
                  floor.building_id === activeBuildingId,
              )
              .map((floor) => {
                const count = visibleRooms.filter(
                  (room) => room.floor?.id === floor.id,
                ).length;
                const key = floorKey(floor.id);
                return (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setSelectedFloor(key)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                      selectedFloor === key
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    {floor.name}{" "}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                );
              })}
            {withoutFloor.length ? (
              <button
                type="button"
                onClick={() => setSelectedFloor("unassigned")}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  selectedFloor === "unassigned"
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "bg-card hover:bg-muted",
                )}
              >
                No floor{" "}
                <span className="ml-1 opacity-70">{withoutFloor.length}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {(loading && !rooms.length) ||
      (mode === "book" && availabilityLoading) ? (
        <div className="flex min-h-72 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : mode === "book" ? (
        floorSections.length ? (
          <div className="space-y-4">
            {floorSections.map((section) => (
              <HotelFloorBoard
                key={floorKey(section.floor?.id ?? null)}
                floor={section.floor}
                rooms={section.rooms}
                selectedRoomId={null}
                onSelectRoom={startBooking}
                priceByRoomType={priceByRoomType}
              />
            ))}
          </div>
        ) : (
          <HotelEmptyState
            title="No rooms available"
            description="Try another room type, price range, or stay dates."
          />
        )
      ) : rooms.length ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {floorSections.map((section) => (
              <HotelFloorBoard
                key={floorKey(section.floor?.id ?? null)}
                floor={section.floor}
                rooms={section.rooms}
                selectedRoomId={selectedRoomId}
                selectedFloor={section.floor?.id === activeFloorId}
                onSelectRoom={(room) => {
                  setSelectedRoomId(room.id);
                  if (room.floor_id != null) setActiveFloorId(room.floor_id);
                }}
                onSelectFloor={
                  section.floor
                    ? () => setActiveFloorId(section.floor!.id)
                    : undefined
                }
                layoutMode={layoutEditing}
                onMoveRoom={moveRoomOnGrid}
              />
            ))}
          </div>
          <aside className="xl:sticky xl:top-4">
            {selectedRoom ? (
              <Card className="overflow-hidden shadow-sm">
                <div className={cn("h-1.5", hotelRoomTone(selectedRoom).dot)} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Selected room
                      </p>
                      <h3 className="mt-1 text-2xl font-black">
                        Room {selectedRoom.number}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedRoom.room_type.name} /{" "}
                        {selectedRoom.floor?.name ?? "No floor"}
                      </p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
                      <DoorOpen className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                      <p className="font-bold">
                        {selectedRoom.capacity} guests
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Base rate</p>
                      <p className="font-bold">
                        {hotelCurrency(selectedRoom.room_type.base_rate)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <HotelStatusBadge value={selectedRoom.occupancy_status} />
                    <HotelStatusBadge
                      value={selectedRoom.housekeeping_status}
                    />
                    <HotelStatusBadge value={selectedRoom.service_status} />
                  </div>
                  {canManage ? (
                    <div className="mt-5 space-y-4 border-t pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => openRoomDialog(selectedRoom)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit room details
                      </Button>
                      <div className="space-y-2">
                        <Label>Housekeeping</Label>
                        <Select
                          value={selectedRoom.housekeeping_status}
                          onValueChange={(value) =>
                            void updateStatus(selectedRoom, {
                              housekeeping_status: value,
                            })
                          }
                          disabled={workingId === selectedRoom.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["clean", "dirty", "cleaning", "inspected"].map(
                              (value) => (
                                <SelectItem key={value} value={value}>
                                  {humanizeHotelStatus(value)}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Room availability</Label>
                        <Select
                          value={selectedRoom.service_status}
                          onValueChange={(value) =>
                            void updateStatus(selectedRoom, {
                              service_status: value,
                            })
                          }
                          disabled={workingId === selectedRoom.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "in_service",
                              "out_of_service",
                              "out_of_order",
                            ].map((value) => (
                              <SelectItem key={value} value={value}>
                                {humanizeHotelStatus(value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {workingId === selectedRoom.id ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Updating room...
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            {activeFloor ? (
              <Card className="mt-4 overflow-hidden shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Selected floor
                      </p>
                      <h3 className="mt-1 text-xl font-black">
                        {activeFloor.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {
                          rooms.filter(
                            (room) => room.floor_id === activeFloor.id,
                          ).length
                        }{" "}
                        rooms
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                      <Building2 className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label>Floor name</Label>
                    <Input
                      value={floorName}
                      onChange={(event) => setFloorName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Building</Label>
                    <Select
                      value={floorBuildingId}
                      onValueChange={setFloorBuildingId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem
                            key={building.id}
                            value={String(building.id)}
                          >
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Display order</Label>
                    <Input
                      type="number"
                      min={0}
                      value={floorOrder}
                      onChange={(event) => setFloorOrder(event.target.value)}
                    />
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Floor layout
                    </p>
                    <p className="mt-1">
                      Arrange rooms anywhere on the floor.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    disabled={saving || !floorName.trim()}
                    onClick={() => void saveActiveFloor()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save floor details
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={saving}
                    onClick={() => void removeFloor(activeFloor)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove floor
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <div className="mt-4 rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">Room types</h3>
                  <p className="text-xs text-muted-foreground">
                    Nightly price and guest capacity
                  </p>
                </div>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                {roomTypes.slice(0, 5).map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {type.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Up to {type.max_adults + type.max_children} guests
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold">
                      {hotelCurrency(type.base_rate)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <HotelEmptyState
          title="No rooms yet"
          description="Add a room type, floor, and room to begin."
        />
      )}

      <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add room type</DialogTitle>
            <DialogDescription>
              Create a reusable room option with its price and guest capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="space-y-2">
                <Label>Short code</Label>
                <Input
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                  placeholder="DLX"
                />
              </div>
              <div className="space-y-2">
                <Label>Room type name</Label>
                <Input
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="Deluxe room"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nightly price</Label>
              <Input
                type="number"
                min={0}
                value={typeRate}
                onChange={(e) => setTypeRate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min={1}
                  value={typeAdults}
                  onChange={(e) => setTypeAdults(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={typeChildren}
                  onChange={(e) => setTypeChildren(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !typeCode.trim() || !typeName.trim()}
              onClick={() => void createType()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
              room type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? `Edit room ${editingRoom.number}` : "Add room"}
            </DialogTitle>
            <DialogDescription>
              {editingRoom?.occupancy_status === "occupied"
                ? "This room is occupied. You can update its name and notes now; other details can be changed after checkout."
                : "Set the room number, type, floor, capacity, and notes."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Room number</Label>
                <Input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="201"
                  disabled={editingRoom?.occupancy_status === "occupied"}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(e.target.value)}
                  disabled={editingRoom?.occupancy_status === "occupied"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Display name{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Courtyard room"
              />
            </div>
            <div className="space-y-2">
              <Label>Room type</Label>
              <Select
                value={roomTypeId}
                onValueChange={setRoomTypeId}
                disabled={editingRoom?.occupancy_status === "occupied"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Select
                value={roomFloorId}
                onValueChange={setRoomFloorId}
                disabled={editingRoom?.occupancy_status === "occupied"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No floor assigned</SelectItem>
                  {floors.map((floor) => (
                    <SelectItem key={floor.id} value={String(floor.id)}>
                      {floor.building.name} / {floor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Staff notes{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={roomNotes}
                onChange={(e) => setRoomNotes(e.target.value)}
                placeholder="Maintenance access, bed setup, or other notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            {editingRoom ? (
              <Button
                variant="destructive"
                disabled={saving || editingRoom.occupancy_status === "occupied"}
                onClick={() => void removeRoom(editingRoom)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove room
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setRoomDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !roomNumber.trim() || !roomTypeId}
              onClick={() => void saveRoom()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRoom ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={floorDialog} onOpenChange={setFloorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add floor</DialogTitle>
            <DialogDescription>
              Choose the building and give the floor a clear name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Building</Label>
              <Select
                value={floorBuildingId}
                onValueChange={setFloorBuildingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((building) => (
                    <SelectItem key={building.id} value={String(building.id)}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Floor name</Label>
              <Input
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="Second floor"
              />
            </div>
            <div className="space-y-2">
              <Label>Display order</Label>
              <Input
                type="number"
                min={0}
                value={floorOrder}
                onChange={(e) => setFloorOrder(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFloorDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !floorName.trim() || !floorBuildingId}
              onClick={() => void saveFloor()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
              floor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {buildingDialogNode}
      {bookingDialogNode}
    </div>
  );
}
