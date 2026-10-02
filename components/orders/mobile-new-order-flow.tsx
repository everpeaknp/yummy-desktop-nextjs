"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BedDouble, ChevronRight, LayoutGrid, List, Loader2, Pin, ShoppingBag, Sofa, Truck, Zap, type LucideIcon } from "lucide-react";

import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RoomTarget = { assignmentId: number; roomNumber: string; floorName: string; guestName: string; folioNumber: string };
type TableArea = { name: string; layoutHeight: number };
export type MobileOrderStart = "dine_in" | "quick_billing" | "pickup" | "delivery" | "room_service";
export type MobileNewOrderFlowStep = "channels" | "tables" | "rooms";
type Props = {
  canDineIn: boolean; canTakeaway: boolean; canDelivery: boolean; canRoomService: boolean;
  tables: TableData[]; tableAreas: TableArea[]; rooms: RoomTarget[]; loadingTables: boolean; loadingRooms: boolean;
  onBrowseTables: () => void; onBrowseRooms: () => void;
  onStart: (channel: "quick_billing" | "pickup" | "delivery") => void;
  onChooseTable: (table: TableData) => void; onChooseRoom: (room: RoomTarget) => void;
  entryPoint?: MobileNewOrderFlowStep;
  primaryOrderType?: MobileOrderStart | null;
  onSetPrimaryOrderType?: (type: MobileOrderStart) => void;
  onExit?: () => void;
  embedded?: boolean;
};

export function MobileNewOrderFlow({ canDineIn, canTakeaway, canDelivery, canRoomService, tables, tableAreas, rooms, loadingTables, loadingRooms, onBrowseTables, onBrowseRooms, onStart, onChooseTable, onChooseRoom, entryPoint = "channels", primaryOrderType, onSetPrimaryOrderType, onExit, embedded = false }: Props) {
  const [step, setStep] = useState<MobileNewOrderFlowStep>(entryPoint);
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
  useEffect(() => setStep(entryPoint), [entryPoint]);

  return <main className={cn("mx-auto w-full max-w-md px-4 md:hidden", embedded ? "py-4" : "pb-28 pt-2")}>
    {embedded ? (
      <header className="mb-3 flex items-center gap-3">
        {step !== "channels" ? <Button variant="ghost" size="icon" className="-ml-2 h-10 w-10 rounded-xl" onClick={onExit ?? (() => setStep("channels"))}><ArrowLeft className="h-5 w-5" /><span className="sr-only">Back to orders</span></Button> : null}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </header>
    ) : null}
    {step === "channels" ? <div className="space-y-2">{canDineIn ? <FlowRow compact={embedded} icon={Sofa} type="dine_in" title="Dine in" description="Start with a table" primaryOrderType={primaryOrderType} onSetPrimaryOrderType={onSetPrimaryOrderType} onClick={() => { onBrowseTables(); setStep("tables"); }} /> : null}{canTakeaway ? <FlowRow compact={embedded} icon={Zap} type="quick_billing" title="Quick bill" description="Create a fast counter order" primaryOrderType={primaryOrderType} onSetPrimaryOrderType={onSetPrimaryOrderType} onClick={() => onStart("quick_billing")} /> : null}{canTakeaway ? <FlowRow compact={embedded} icon={ShoppingBag} type="pickup" title="Pickup" description="Order for collection" primaryOrderType={primaryOrderType} onSetPrimaryOrderType={onSetPrimaryOrderType} onClick={() => onStart("pickup")} /> : null}{canDelivery ? <FlowRow compact={embedded} icon={Truck} type="delivery" title="Delivery" description="Order for delivery" primaryOrderType={primaryOrderType} onSetPrimaryOrderType={onSetPrimaryOrderType} onClick={() => onStart("delivery")} /> : null}{canRoomService ? <FlowRow compact={embedded} icon={BedDouble} type="room_service" title="Room service" description="Charge an in-house guest" primaryOrderType={primaryOrderType} onSetPrimaryOrderType={onSetPrimaryOrderType} onClick={() => { onBrowseRooms(); setStep("rooms"); }} /> : null}</div> : null}
    {step === "tables" ? <><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">{areas.map((name) => <button key={name} onClick={() => setArea(name)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", area === name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{name}</button>)}</div><div className="flex shrink-0 rounded-xl bg-muted p-1"><button type="button" aria-label="List view" onClick={() => setTableView("list")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tableView === "list" && "bg-background text-primary shadow-sm")}><List className="h-4 w-4" /></button><button type="button" aria-label="Floor-plan view" onClick={() => setTableView("layout")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tableView === "layout" && "bg-background text-primary shadow-sm")}><LayoutGrid className="h-4 w-4" /></button></div></div>{loadingTables ? <Loading label="Loading tables" /> : visibleTables.length ? tableView === "list" ? <div className="grid grid-cols-2 gap-3">{visibleTables.map((table) => { const occupied = String(table.status).toLowerCase() === "occupied"; return <button type="button" key={table.id} onClick={() => onChooseTable(table)} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"><div className="flex items-start justify-between gap-2"><span className="text-base font-semibold">{table.table_name}</span><span className={cn("mt-1.5 h-2 w-2 rounded-full", occupied ? "bg-rose-500" : "bg-emerald-500")} /></div><p className="mt-4 text-xs text-muted-foreground">{occupied ? "Open order" : `${table.capacity || 0} seats`}</p></button>; })}</div> : <div className="space-y-3">{Object.entries(tableGroups).map(([name, areaTables]) => <RoomContainer key={name} title={name} tables={areaTables} layoutHeight={layoutHeight(name)} onTableClick={onChooseTable} />)}</div> : <Empty label="No tables found" />}</> : null}
    {step === "rooms" ? (loadingRooms ? <Loading label="Loading in-house guests" /> : rooms.length ? <div className="space-y-2">{rooms.map((room) => <button type="button" key={room.assignmentId} onClick={() => onChooseRoom(room)} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.98]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Room {room.roomNumber}</span><span className="block truncate text-xs text-muted-foreground">{room.guestName} · {room.floorName}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}</div> : <Empty label="No in-house rooms" />) : null}
  </main>;
}

function FlowRow({ icon: Icon, type, title, description, onClick, primaryOrderType, onSetPrimaryOrderType, compact = false }: { icon: LucideIcon; type: MobileOrderStart; title: string; description: string; onClick: () => void; primaryOrderType?: MobileOrderStart | null; onSetPrimaryOrderType?: (type: MobileOrderStart) => void; compact?: boolean }) { const isPrimary = primaryOrderType === type; return <div className={cn("flex items-center gap-2 rounded-2xl border bg-card shadow-sm", compact ? "p-1.5" : "p-2")}><button type="button" onClick={onClick} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition active:scale-[0.98]", compact ? "p-2" : "p-2")}><span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary", compact ? "h-9 w-9" : "h-11 w-11")}><Icon className={compact ? "h-4 w-4" : "h-5 w-5"} /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span>{!compact ? <span className="block text-xs text-muted-foreground">{description}</span> : null}</span></button><button type="button" aria-label={isPrimary ? `${title} is your primary order type` : `Set ${title} as primary`} title={isPrimary ? "Primary order type" : "Set as primary"} onClick={() => onSetPrimaryOrderType?.(type)} className={cn("flex shrink-0 items-center justify-center rounded-xl transition-colors", compact ? "h-9 w-9" : "h-11 w-11", isPrimary ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary")}><Pin className={cn("h-4 w-4", isPrimary && "fill-current")} /></button></div>; }
function Loading({ label }: { label: string }) { return <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" />{label}</div>; }
function Empty({ label }: { label: string }) { return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{label}</div>; }
