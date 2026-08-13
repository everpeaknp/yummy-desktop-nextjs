"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import type { HotelHousekeepingTask } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canManage: boolean;
  refreshKey: number;
  onChanged: () => void;
}

const nextActions: Record<string, { status: string; label: string; icon: typeof Play } | undefined> = {
  pending: { status: "in_progress", label: "Start", icon: Play },
  assigned: { status: "in_progress", label: "Start", icon: Play },
  in_progress: { status: "completed", label: "Complete", icon: CheckCircle2 },
  completed: { status: "inspected", label: "Inspect", icon: ShieldCheck },
};

export function HousekeepingPanel({ restaurantId, canManage, refreshKey, onChanged }: Props) {
  const [businessDate, setBusinessDate] = useState(hotelDate(new Date()));
  const [tasks, setTasks] = useState<HotelHousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await hotelPmsApi.listHousekeeping(restaurantId, businessDate));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load housekeeping board"));
    } finally { setLoading(false); }
  }, [restaurantId, businessDate]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const counts = useMemo(() => ({
    pending: tasks.filter((task) => ["pending", "assigned"].includes(task.status)).length,
    cleaning: tasks.filter((task) => task.status === "in_progress").length,
    awaitingInspection: tasks.filter((task) => task.status === "completed").length,
    ready: tasks.filter((task) => task.status === "inspected").length,
  }), [tasks]);

  const advance = async (task: HotelHousekeepingTask, status: string) => {
    setWorkingId(task.id);
    try {
      await hotelPmsApi.updateHousekeepingTask(task.id, status);
      toast.success(`Room ${task.room.number}: ${humanizeHotelStatus(status)}`);
      await load();
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update housekeeping task"));
    } finally { setWorkingId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-bold">Housekeeping</h2><p className="text-sm text-muted-foreground">Operational cleaning workflow with inspection-controlled readiness.</p></div>
        <div className="flex gap-2"><Input className="w-40" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(counts).map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</p><p className="mt-1 text-3xl font-black">{value}</p></CardContent></Card>)}</div>
      {loading && !tasks.length ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : tasks.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => {
          const action = nextActions[task.status];
          const ActionIcon = action?.icon;
          return <Card key={task.id}>
            <CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><div><CardTitle>Room {task.room.number}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{humanizeHotelStatus(task.task_type)} · priority {task.priority}</p></div><HotelStatusBadge value={task.status} /></div></CardHeader>
            <CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><HotelStatusBadge value={task.room.housekeeping_status} /><HotelStatusBadge value={task.room.service_status} /></div>{task.notes ? <p className="text-sm text-muted-foreground">{task.notes}</p> : null}{canManage && action && ActionIcon ? <Button className="w-full" variant={action.status === "inspected" ? "default" : "outline"} disabled={workingId === task.id} onClick={() => void advance(task, action.status)}>{workingId === task.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ActionIcon className="mr-2 h-4 w-4" />}{action.label}</Button> : null}</CardContent>
          </Card>;
        })}</div>
      ) : <HotelEmptyState title="No housekeeping tasks" description="Departure and room-move tasks will appear automatically." />}
    </div>
  );
}
