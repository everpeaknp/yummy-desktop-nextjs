"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, BedDouble, ChevronRight, LayoutGrid, List, Loader2, ShoppingBag, Sofa, Truck, Zap, type LucideIcon } from "lucide-react";

import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RoomTarget = { assignmentId: number; roomNumber: string; floorName: string; guestName: string; folioNumber: string };
type TableArea = { name: string; layoutHeight: number };
type Props = {
  canDineIn: boolean; canTakeaway: boolean; canDelivery: boolean; canRoomService: boolean;
  tables: TableData[]; tableAreas: TableArea[]; rooms: RoomTarget[]; loadingTables: boolean; loadingRooms: boolean;
  onBrowseTables: () => void; onBrowseRooms: () => void;
  onStart: (channel: "quick_billing" | "pickup" | "delivery") => void;
  onChooseTable: (table: TableData) => void; onChooseRoom: (room: RoomTarget) => void;
};

export function MobileNewOrderFlow({ canDineIn, canTakeaway, canDelivery, canRoomService, tables, tableAreas, rooms, loadingTables, loadingRooms, onBrowseTables, onBrowseRooms, onStart, onChooseTable, onChooseRoom }: Props) {
  const [step, setStep] = useState<"channels" | "tables" | "rooms">("channels");
  const [tableView, setTableView] = useState<"list" | "layout">("list");
  const [area, setArea] = useState("All areas");
  const areas = useMemo(() => ["All areas", ...Array.from(new Set(tables.map((table) => table.table_type_name).filter(Boolean) as string[])).sort()], [tables]);
  const visibleTables = area === "All areas" ? tables : tables.filter((table) => table.table_type_name === area);
  const tableGroups = useMemo(() => visibleTables.reduce<Record<string, TableData[]>>((groups, table) => {
    const name = table.table_type_name || "General";
    (groups[name] ||= []).push(table);
    return groups;
  }, {}), [visibleTables]);
  const layoutHeight = (name: string) => tableAreas.find((item) => item.name === name)?.layoutHeight || 220;
  const title = step === "tables" ? "Choose a table" : step === "rooms" ? "Choose a room" : "New order";

  return <main className="mx-auto w-full max-w-md px-4 pb-28 pt-2 md:hidden">
    <header className="mb-6 flex items-center gap-3">{step !== "channels" ? <Button variant="ghost" size="icon" className="-ml-2 h-10 w-10 rounded-xl" onClick={() => setStep("channels")}><ArrowLeft className="h-5 w-5" /></Button> : null}<div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{step === "channels" ? "How would you like to start?" : "Select where this order belongs."}</p></div></header>
    {step === "channels" ? <div className="space-y-2">{canDineIn ? <FlowRow icon={Sofa} title="Dine in" description="Start with a table" onClick={() => { onBrowseTables(); setStep("tables"); }} /> : null}{canTakeaway ? <FlowRow icon={Zap} title="Quick bill" description="Create a fast counter order" onClick={() => onStart("quick_billing")} /> : null}{canTakeaway ? <FlowRow icon={ShoppingBag} title="Pickup" description="Order for collection" onClick={() => onStart("pickup")} /> : null}{canDelivery ? <FlowRow icon={Truck} title="Delivery" description="Order for delivery" onClick={() => onStart("delivery")} /> : null}{canRoomService ? <FlowRow icon={BedDouble} title="Room service" description="Charge an in-house guest" onClick={() => { onBrowseRooms(); setStep("rooms"); }} /> : null}</div> : null}
    {step === "tables" ? <><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">{areas.map((name) => <button key={name} onClick={() => setArea(name)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", area === name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{name}</button>)}</div><div className="flex shrink-0 rounded-xl bg-muted p-1"><button type="button" aria-label="List view" onClick={() => setTableView("list")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tableView === "list" && "bg-background text-primary shadow-sm")}><List className="h-4 w-4" /></button><button type="button" aria-label="Floor-plan view" onClick={() => setTableView("layout")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tableView === "layout" && "bg-background text-primary shadow-sm")}><LayoutGrid className="h-4 w-4" /></button></div></div>{loadingTables ? <Loading label="Loading tables" /> : visibleTables.length ? tableView === "list" ? <div className="grid grid-cols-2 gap-3">{visibleTables.map((table) => { const occupied = String(table.status).toLowerCase() === "occupied"; return <button type="button" key={table.id} onClick={() => onChooseTable(table)} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"><div className="flex items-start justify-between gap-2"><span className="text-base font-semibold">{table.table_name}</span><span className={cn("mt-1.5 h-2 w-2 rounded-full", occupied ? "bg-rose-500" : "bg-emerald-500")} /></div><p className="mt-4 text-xs text-muted-foreground">{occupied ? "Open order" : `${table.capacity || 0} seats`}</p></button>; })}</div> : <div className="space-y-3">{Object.entries(tableGroups).map(([name, areaTables]) => <RoomContainer key={name} title={name} tables={areaTables} layoutHeight={layoutHeight(name)} onTableClick={onChooseTable} />)}</div> : <Empty label="No tables found" />}</> : null}
    {step === "rooms" ? (loadingRooms ? <Loading label="Loading in-house guests" /> : rooms.length ? <div className="space-y-2">{rooms.map((room) => <button type="button" key={room.assignmentId} onClick={() => onChooseRoom(room)} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Room {room.roomNumber}</span><span className="block truncate text-xs text-muted-foreground">{room.guestName} · {room.floorName}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}</div> : <Empty label="No in-house rooms" />) : null}
  </main>;
}

function FlowRow({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-xs text-muted-foreground">{description}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>; }
function Loading({ label }: { label: string }) { return <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" />{label}</div>; }
function Empty({ label }: { label: string }) { return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{label}</div>; }
