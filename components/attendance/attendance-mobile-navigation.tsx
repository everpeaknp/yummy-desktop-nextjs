"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, CalendarOff, ChartNoAxesCombined, ChevronDown, ClipboardCheck, Clock3, Settings2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  activeTab: string;
  onChange: (value: string) => void;
  canViewAttendance: boolean;
  canPayrollExport: boolean;
  canManageAttendance: boolean;
  canManageDevices: boolean;
};

export function AttendanceMobileNavigation(props: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [props.activeTab]);
  const sections = [
    { value: "overview", label: "Daily attendance", icon: Clock3, visible: props.canViewAttendance },
    { value: "reports", label: "Reports", icon: ChartNoAxesCombined, visible: props.canViewAttendance },
    { value: "timesheets", label: "Timesheets", icon: ClipboardCheck, visible: props.canViewAttendance },
    { value: "payroll-export", label: "Payroll", icon: Wallet, visible: props.canPayrollExport },
    { value: "schedules", label: "Schedule", icon: CalendarDays, visible: props.canManageAttendance },
    { value: "leave", label: "Leave & holidays", icon: CalendarOff, visible: props.canManageAttendance && props.canViewAttendance },
  ].filter((section) => section.visible);
  const setup = [
    { value: "qr", label: "QR kiosk", visible: props.canManageAttendance },
    { value: "devices", label: "Devices", visible: props.canManageDevices },
    { value: "settings", label: "Settings", visible: props.canManageAttendance },
  ].filter((section) => section.visible);
  const activeSetup = setup.find((section) => section.value === props.activeTab);

  return (
    <div className="min-w-0 space-y-2 2xl:hidden">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="text-base font-semibold tracking-tight">Team attendance</p>
        {setup.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-h-11 gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground" aria-label={activeSetup ? `Setup: ${activeSetup.label}` : "Attendance setup"}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {activeSetup ? activeSetup.label : "Setup"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={props.activeTab} onValueChange={props.onChange}>
                {setup.map((section) => <DropdownMenuRadioItem key={section.value} value={section.value} className="min-h-11">{section.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {sections.length > 0 ? (
        <TabsList aria-label="Attendance sections" ref={listRef} className="flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto rounded-xl bg-muted p-1 [scrollbar-width:thin]">
          {sections.map((section) => (
            <TabsTrigger key={section.value} value={section.value} className="min-h-11 shrink-0 gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <section.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
    </div>
  );
}
