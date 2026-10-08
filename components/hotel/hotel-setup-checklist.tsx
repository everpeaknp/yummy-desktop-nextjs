"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HotelSetupReadinessResult } from "@/hooks/use-hotel-setup-readiness";
import type { HotelSetupStepKey, HotelSetupStepStatus } from "@/lib/hotel/setup-readiness";

export interface HotelSetupChecklistProps extends HotelSetupReadinessResult {
  canManageInventory: boolean;
  canManageRates: boolean;
  canManageSettings: boolean;
  canManageStaff: boolean;
  onOpenInventory: () => void;
  onOpenRates: () => void;
  onOpenSettings: () => void;
  onOpenStaff: () => void;
}

const labels: Record<HotelSetupStepStatus, string> = {
  ready: "Ready", needs_attention: "Needs attention", optional: "Optional", unknown: "Not yet verified",
};


const hotelAccessGroups = [
  { label: "Hotel view", keys: ["hotel.view"] },
  { label: "Front desk", keys: ["hotel.bookings.manage", "hotel.checkin", "hotel.checkout", "hotel.early_departure.override"] },
  { label: "Inventory", keys: ["hotel.inventory.manage"] },
  { label: "Rates", keys: ["hotel.rates.manage"] },
  { label: "Housekeeping", keys: ["hotel.housekeeping.view", "hotel.housekeeping.manage"] },
  { label: "Folio & finance", keys: ["hotel.folio.view", "hotel.folio.edit", "hotel.folio.override"] },
  { label: "Night audit", keys: ["hotel.night_audit.run"] },
] as const;
const knownHotelPermissionKeys = new Set<string>(hotelAccessGroups.flatMap((group) => [...group.keys]));
const frontDeskPermissionKeys = ["hotel.bookings.manage", "hotel.checkin", "hotel.checkout", "hotel.early_departure.override"];

function getHotelAccessGroups(permissions: string[]) {
  return hotelAccessGroups
    .filter((group) => group.keys.some((key) => permissions.includes(key)))
    .map((group) => group.label);
}

function getAssignedRole(member: HotelSetupReadinessResult["hotelTeam"][number]) {
  return member.primary_role || member.role || member.roles?.filter(Boolean).join(", ") || null;
}

function getBusinessScopeLabel(scope: "restaurant" | "hotel" | "both") {
  if (scope === "both") return "Restaurant & Hotel scope";
  return `${scope === "hotel" ? "Hotel" : "Restaurant"} scope`;
}

export function HotelSetupChecklist({ status, readiness, hotelTeam, teamStatus, reload, canManageInventory, canManageRates, canManageSettings, canManageStaff, onOpenInventory, onOpenRates, onOpenSettings, onOpenStaff }: HotelSetupChecklistProps) {
  const operationalReady = status === "ready" && !!readiness?.operationalReady;
  const [expanded, setExpanded] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  const steps: { key: HotelSetupStepKey | "team"; title: string; action?: string; allowed?: boolean; onOpen?: () => void; optional?: boolean }[] = [
    { key: "settings", title: "Property settings", action: "Review settings", allowed: canManageSettings, onOpen: onOpenSettings },
    { key: "floors", title: "Buildings and floors", action: "Review buildings and floors", allowed: canManageInventory, onOpen: onOpenInventory, optional: true },
    { key: "roomTypes", title: "Room types", action: "Add room types", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "rooms", title: "Rooms", action: "Add rooms", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "rates", title: "Default booking rates", action: "Set base rates", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "ratePlans", title: "Advanced rates", action: "Review advanced rates", allowed: canManageRates, onOpen: onOpenRates, optional: true },
    { key: "team", title: "Hotel team review", optional: true },
  ];
  const activeStep = steps[activeStepIndex];
  const isTeamStep = activeStep.key === "team";
  const readinessStep = readiness && activeStep.key !== "team" ? readiness.steps[activeStep.key] : null;
  const hasHotelView = hotelTeam.some((member) => member.permissions?.includes("hotel.view"));
  const hasFrontDeskActions = hotelTeam.some((member) => member.permissions?.some((key) => frontDeskPermissionKeys.includes(key)));

  return (
    <div ref={rootRef} className="relative flex flex-col items-end">
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2.5 text-xs" aria-label={expanded ? "Collapse setup checklist" : "Open setup checklist"} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Close setup" : "Setup checklist"}
      </Button>
      {expanded && (
        <section id={contentId} aria-label="Hotel setup" className="absolute right-0 top-full z-50 mt-2 max-h-[min(75vh,42rem)] w-[min(92vw,56rem)] overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground shadow-lg">
          <div className="mb-3">
            <h2 className="text-base font-semibold">Get your hotel ready</h2>
            <p className="text-sm text-muted-foreground">
              {operationalReady ? "Your hotel is ready for bookings." : "A few checks will help your team welcome guests with confidence."}
            </p>
          </div>
          <div className="space-y-1.5" aria-label="Hotel setup progress">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Step {activeStepIndex + 1} of {steps.length}</span>
            </div>
            <div role="progressbar" aria-label="Hotel setup progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={activeStepIndex + 1} className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((activeStepIndex + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          {status === "error" && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              <p className="text-sm">We couldn&apos;t check your hotel setup. Please try again.</p>
              <Button type="button" size="sm" variant="outline" className="mt-1.5" onClick={() => void reload()}>Retry setup check</Button>
            </div>
          )}

          <section aria-label={`Setup step ${activeStepIndex + 1}: ${activeStep.title}`} className="rounded-lg border px-3 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{activeStep.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {isTeamStep
                    ? "Review who can work in Hotel and whether the right front-desk access is covered."
                    : status === "loading" || !readinessStep
                      ? "Checking this part of your hotel setup..."
                      : readinessStep.reason}
                </p>
              </div>
              {isTeamStep ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Informational</span>
              ) : readinessStep ? (
                <span className={`rounded-full px-2.5 py-1 text-xs ${readinessStep.status === "ready" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>{labels[readinessStep.status]}</span>
              ) : null}
            </div>
            {status === "loading" || (!readiness && status !== "error") ? (
              <div role="status" aria-live="polite" className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">Checking your hotel setup...</p>
                <div aria-hidden="true" className="h-8 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : !isTeamStep && readinessStep && readinessStep.status !== "unknown" ? (
              readinessStep.status === "ready" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-green-700 dark:text-green-300">Ready</p>
                  {activeStep.allowed ? <Button type="button" size="sm" variant="outline" onClick={() => { setExpanded(false); activeStep.onOpen?.(); }}>{activeStep.action?.replace(/^Add /, "Review ").replace(/^Set /, "Review ")}</Button> : <p className="text-sm text-muted-foreground">Ask your administrator to review {activeStep.title.toLowerCase()}.</p>}
              </div>
            ) : activeStep.allowed ? (
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { setExpanded(false); activeStep.onOpen?.(); }}>{activeStep.action}</Button>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Ask your administrator to review {activeStep.title.toLowerCase()}.</p>
              )
            ) : null}

            {isTeamStep && (
              <div className="mt-2 space-y-2">
                {teamStatus === "loading" && <p className="mt-2 text-sm text-muted-foreground">Loading Hotel team...</p>}
                {teamStatus === "error" && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">We couldn&apos;t load the Hotel team.</p>
                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void reload()}>Retry team review</Button>
                  </div>
                )}
                {teamStatus === "ready" && hotelTeam.length > 0 && (
                  <>
                    <ul aria-label="Hotel team" className="mt-2 space-y-1.5">
                      {hotelTeam.map((member) => {
                        const permissions = member.permissions || [];
                        const accessGroups = getHotelAccessGroups(permissions);
                        const hasOtherHotelAccess = permissions.some((key) => key.startsWith("hotel.") && !knownHotelPermissionKeys.has(key));
                        const assignedRole = getAssignedRole(member);
                        return (
                          <li key={member.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{member.name}</p>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{assignedRole ? `Role: ${assignedRole}` : "Assigned role not available"}</span>
                                {member.business_scope && <span>{getBusinessScopeLabel(member.business_scope)}</span>}
                              </div>
                            </div>
                            <div aria-label={`${member.name} Hotel access`} className="flex min-w-0 flex-wrap gap-1.5 sm:justify-end">
                              {accessGroups.map((group) => <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{group}</span>)}
                              {hasOtherHotelAccess && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Other Hotel access</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {(!hasHotelView || !hasFrontDeskActions) && (
                      <ul aria-label="Hotel access gaps" className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                        {!hasHotelView && <li>No team member currently has Hotel viewing access.</li>}
                        {!hasFrontDeskActions && <li>No one currently appears to have front-desk actions.</li>}
                      </ul>
                    )}
                  </>
                )}
                {teamStatus === "ready" && hotelTeam.length === 0 && (
                  <div className="mt-2 rounded-lg border border-dashed p-2.5">
                    <p className="text-sm font-medium">No team members currently have Hotel permissions.</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">Assign Hotel access to the staff who need to view stays or help guests at the front desk.</p>
                    {canManageStaff ? (
                      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { setExpanded(false); onOpenStaff(); }}>Review staff access</Button>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Ask an administrator to assign Hotel access to the right staff.</p>
                    )}
                  </div>
                )}
                {(teamStatus === "forbidden" || (teamStatus === "ready" && hotelTeam.length > 0 && !canManageStaff)) && (
                  <p className="mt-2 text-sm text-muted-foreground">Ask your administrator to review who has Hotel access.</p>
                )}
                {teamStatus === "ready" && hotelTeam.length > 0 && canManageStaff && (
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { setExpanded(false); onOpenStaff(); }}>Review Hotel team</Button>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <Button type="button" size="sm" variant="outline" disabled={activeStepIndex === 0} onClick={() => setActiveStepIndex((index) => Math.max(0, index - 1))}>Back</Button>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {activeStep.optional && activeStepIndex < steps.length - 1 && (
                <Button type="button" size="sm" variant="ghost" aria-label="Skip this optional step" onClick={() => setActiveStepIndex((index) => Math.min(steps.length - 1, index + 1))}>Skip</Button>
              )}
              {activeStepIndex < steps.length - 1 ? (
                <Button type="button" size="sm" aria-label={`Continue to ${steps[activeStepIndex + 1].title}`} onClick={() => setActiveStepIndex((index) => Math.min(steps.length - 1, index + 1))}>Continue</Button>
              ) : (
                <Button type="button" size="sm" onClick={() => setExpanded(false)}>{operationalReady ? "Finish setup" : "Done for now"}</Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
