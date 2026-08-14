"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hotelDate, hotelPmsApi } from "@/lib/hotel/api";
import {
  currentHousekeepingTasks,
  housekeepingBoardCounts,
  housekeepingHistory,
} from "@/lib/hotel/housekeeping-board";
import type { HotelHousekeepingTask } from "@/lib/hotel/types";
import { HotelEmptyState, HotelStatusBadge, humanizeHotelStatus } from "./hotel-ui";

interface Props {
  restaurantId: number;
  canManage: boolean;
  refreshKey: number;
  onChanged: () => void;
}

const nextActions: Record<string, { status: string; label: string; icon: typeof Play } | undefined> = {
  pending: { status: "in_progress", label: "Start cleaning", icon: Play },
  assigned: { status: "in_progress", label: "Start cleaning", icon: Play },
  in_progress: { status: "completed", label: "Finish cleaning", icon: CheckCircle2 },
  completed: { status: "inspected", label: "Mark room ready", icon: ShieldCheck },
};

const taskStatusLabels: Record<string, string> = {
  pending: "Needs cleaning",
  assigned: "Assigned",
  in_progress: "Cleaning",
  completed: "Ready to inspect",
  inspected: "Ready",
  canceled: "Canceled",
};

export function HousekeepingPanel({ restaurantId, canManage, refreshKey, onChanged }: Props) {
  const [businessDate, setBusinessDate] = useState(hotelDate(new Date()));
  const [tasks, setTasks] = useState<HotelHousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [view, setView] = useState<"current" | "history">("current");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await hotelPmsApi.listHousekeeping(restaurantId, businessDate));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't load housekeeping"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, businessDate]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const currentTasks = useMemo(() => currentHousekeepingTasks(tasks), [tasks]);
  const historyTasks = useMemo(() => housekeepingHistory(tasks), [tasks]);
  const visibleTasks = view === "current" ? currentTasks : historyTasks;
  const counts = useMemo(() => housekeepingBoardCounts(tasks), [tasks]);

  const advance = async (task: HotelHousekeepingTask, status: string) => {
    setWorkingId(task.id);
    try {
      await hotelPmsApi.updateHousekeepingTask(task.id, status);
      toast.success(`Room ${task.room.number}: ${taskStatusLabels[status] ?? humanizeHotelStatus(status)}`);
      await load();
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "We couldn't update this room"));
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold">Housekeeping</h2>
          <p className="text-sm text-muted-foreground">See which rooms need cleaning and move them through each step.</p>
        </div>
        <div className="flex gap-2">
          <Input className="w-40" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(counts).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</p>
              <p className="mt-1 text-3xl font-black">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">{view === "current" ? "Rooms to clean" : "Cleaning history"}</h3>
          <p className="text-sm text-muted-foreground">
            {view === "current" ? "The latest cleaning status for every room." : "Previously completed or cancelled cleaning work."}
          </p>
        </div>
        <div className="flex self-start rounded-lg border p-1 sm:self-auto">
          <Button size="sm" variant={view === "current" ? "secondary" : "ghost"} onClick={() => setView("current")}>Current</Button>
          <Button size="sm" variant={view === "history" ? "secondary" : "ghost"} onClick={() => setView("history")}>History</Button>
        </div>
      </div>

      {loading && !tasks.length ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : visibleTasks.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleTasks.map((task) => {
            const action = nextActions[task.status];
            const ActionIcon = action?.icon;
            return (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>Room {task.room.number}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{humanizeHotelStatus(task.task_type)}{task.priority > 0 ? ` · Priority ${task.priority}` : ""}</p>
                    </div>
                    <HotelStatusBadge value={task.status} label={taskStatusLabels[task.status] ?? humanizeHotelStatus(task.status)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {view === "current" ? <HotelStatusBadge value={task.room.service_status} /> : null}
                  {task.notes ? <p className="text-sm text-muted-foreground">{task.notes}</p> : null}
                  {view === "current" && canManage && action && ActionIcon ? (
                    <Button className="w-full" variant={action.status === "inspected" ? "default" : "outline"} disabled={workingId === task.id} onClick={() => void advance(task, action.status)}>
                      {workingId === task.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ActionIcon className="mr-2 h-4 w-4" />}
                      {action.label}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <HotelEmptyState
          title={view === "current" ? "No rooms need attention" : "No cleaning history"}
          description={view === "current" ? "Every room is ready. New cleaning work will appear here." : "Completed and cancelled cleaning work will appear here."}
        />
      )}
    </div>
  );
}
