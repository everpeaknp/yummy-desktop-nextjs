"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, Building2, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelPmsApi } from "@/lib/hotel/api";
import type { HotelFloor, HotelRoom, HotelRoomType } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, hotelCurrency, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canManage: boolean;
  refreshKey: number;
  onChanged: () => void;
}

export function InventoryPanel({ restaurantId, canManage, refreshKey, onChanged }: Props) {
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [floors, setFloors] = useState<HotelFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [typeDialog, setTypeDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [floorDialog, setFloorDialog] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeRate, setTypeRate] = useState("");
  const [typeAdults, setTypeAdults] = useState("2");
  const [typeChildren, setTypeChildren] = useState("0");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomFloorId, setRoomFloorId] = useState("none");
  const [roomCapacity, setRoomCapacity] = useState("2");
  const [floorName, setFloorName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRooms, nextTypes, nextFloors] = await Promise.all([
        hotelPmsApi.listRooms(restaurantId),
        hotelPmsApi.listRoomTypes(restaurantId),
        hotelPmsApi.listFloors(restaurantId),
      ]);
      setRooms(nextRooms);
      setRoomTypes(nextTypes);
      setFloors(nextFloors);
      if (!roomTypeId && nextTypes.length) setRoomTypeId(String(nextTypes[0].id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load room inventory"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, roomTypeId]);

  useEffect(() => {
    void load();
  }, [refreshKey, restaurantId]);

  const counts = useMemo(() => ({
    total: rooms.length,
    occupied: rooms.filter((room) => room.occupancy_status === "occupied").length,
    dirty: rooms.filter((room) => room.housekeeping_status === "dirty").length,
    unavailable: rooms.filter((room) => room.service_status !== "in_service").length,
  }), [rooms]);

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
      setTypeCode(""); setTypeName(""); setTypeRate("");
      await afterMutation("Room type created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create room type"));
    } finally { setSaving(false); }
  };

  const createRoom = async () => {
    if (!roomNumber.trim() || !roomTypeId) return;
    setSaving(true);
    try {
      await hotelPmsApi.createRoom({
        restaurant_id: restaurantId,
        room_type_id: Number(roomTypeId),
        floor_id: roomFloorId === "none" ? null : Number(roomFloorId),
        number: roomNumber.trim(),
        capacity: Math.max(1, Number(roomCapacity || 1)),
      });
      setRoomDialog(false); setRoomNumber("");
      await afterMutation("Room created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create room"));
    } finally { setSaving(false); }
  };

  const createFloor = async () => {
    if (!floorName.trim()) return;
    setSaving(true);
    try {
      await hotelPmsApi.createFloor({ restaurant_id: restaurantId, name: floorName.trim() });
      setFloorDialog(false); setFloorName("");
      await afterMutation("Floor created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create floor"));
    } finally { setSaving(false); }
  };

  const updateStatus = async (room: HotelRoom, values: { housekeeping_status?: string; service_status?: string }) => {
    setWorkingId(room.id);
    try {
      await hotelPmsApi.updateRoomStatus(room.id, room.version, values);
      await afterMutation("Room status updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update room"));
    } finally { setWorkingId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><h2 className="text-xl font-bold">Room inventory</h2><p className="text-sm text-muted-foreground">Separate occupancy, housekeeping readiness, and service availability.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
          {canManage ? <><Button variant="outline" onClick={() => setFloorDialog(true)}><Building2 className="mr-2 h-4 w-4" />Floor</Button><Button variant="outline" onClick={() => setTypeDialog(true)}><Plus className="mr-2 h-4 w-4" />Room type</Button><Button onClick={() => setRoomDialog(true)} disabled={!roomTypes.length}><BedDouble className="mr-2 h-4 w-4" />Room</Button></> : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(counts).map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></CardContent></Card>)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {loading && !rooms.length ? <div className="col-span-full flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : rooms.length ? rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="pb-2"><div className="flex items-start justify-between"><div><CardTitle>Room {room.number}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{room.room_type.name} · {room.floor?.name ?? "No floor"}</p></div><HotelStatusBadge value={room.occupancy_status} /></div></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2"><HotelStatusBadge value={room.housekeeping_status} /><HotelStatusBadge value={room.service_status} /></div>
                {canManage ? <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={room.housekeeping_status} onValueChange={(value) => void updateStatus(room, { housekeeping_status: value })} disabled={workingId === room.id}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["clean", "dirty", "cleaning", "inspected"].map((value) => <SelectItem key={value} value={value}>{humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select>
                  <Select value={room.service_status} onValueChange={(value) => void updateStatus(room, { service_status: value })} disabled={workingId === room.id}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["in_service", "out_of_service", "out_of_order"].map((value) => <SelectItem key={value} value={value}>{humanizeHotelStatus(value)}</SelectItem>)}</SelectContent></Select>
                </div> : null}
              </CardContent>
            </Card>
          )) : <HotelEmptyState className="col-span-full" title="No PMS rooms" description="Create room types, floors, and rooms directly in Hotel PMS." />}
        </div>
        <Card><CardHeader><CardTitle className="text-base">Room types</CardTitle></CardHeader><CardContent className="space-y-3">{roomTypes.map((type) => <div key={type.id} className="rounded-xl border p-3"><div className="flex justify-between gap-2"><div><p className="font-semibold">{type.name}</p><p className="text-xs text-muted-foreground">{type.code} · up to {type.max_adults} adults</p></div><p className="font-semibold">{hotelCurrency(type.base_rate)}</p></div></div>)}</CardContent></Card>
      </div>

      <Dialog open={typeDialog} onOpenChange={setTypeDialog}><DialogContent><DialogHeader><DialogTitle>Create room type</DialogTitle></DialogHeader><div className="grid gap-3 py-2"><Label>Code</Label><Input value={typeCode} onChange={(e) => setTypeCode(e.target.value.toUpperCase())} /><Label>Name</Label><Input value={typeName} onChange={(e) => setTypeName(e.target.value)} /><Label>Base nightly rate</Label><Input type="number" min={0} value={typeRate} onChange={(e) => setTypeRate(e.target.value)} /><div className="grid grid-cols-2 gap-3"><div><Label>Max adults</Label><Input type="number" min={1} value={typeAdults} onChange={(e) => setTypeAdults(e.target.value)} /></div><div><Label>Max children</Label><Input type="number" min={0} value={typeChildren} onChange={(e) => setTypeChildren(e.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setTypeDialog(false)}>Cancel</Button><Button disabled={saving || !typeCode.trim() || !typeName.trim()} onClick={() => void createType()}>Create</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}><DialogContent><DialogHeader><DialogTitle>Create physical room</DialogTitle></DialogHeader><div className="grid gap-3 py-2"><Label>Room number</Label><Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} /><Label>Room type</Label><Select value={roomTypeId} onValueChange={setRoomTypeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roomTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent></Select><Label>Floor</Label><Select value={roomFloorId} onValueChange={setRoomFloorId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No floor</SelectItem>{floors.map((floor) => <SelectItem key={floor.id} value={String(floor.id)}>{floor.name}</SelectItem>)}</SelectContent></Select><Label>Capacity</Label><Input type="number" min={1} value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setRoomDialog(false)}>Cancel</Button><Button disabled={saving || !roomNumber.trim() || !roomTypeId} onClick={() => void createRoom()}>Create</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={floorDialog} onOpenChange={setFloorDialog}><DialogContent><DialogHeader><DialogTitle>Create floor</DialogTitle></DialogHeader><div className="grid gap-2 py-2"><Label>Floor name</Label><Input value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="Floor 1" /></div><DialogFooter><Button variant="outline" onClick={() => setFloorDialog(false)}>Cancel</Button><Button disabled={saving || !floorName.trim()} onClick={() => void createFloor()}>Create</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
