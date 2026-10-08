"use client";

import { useEffect, useId, useState } from "react";
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
  const [expanded, setExpanded] = useState(!operationalReady);
  const contentId = useId();
  useEffect(() => {
    if (operationalReady) setExpanded(false);
  }, [operationalReady]);

  const steps: { key: HotelSetupStepKey; title: string; action: string; allowed: boolean; onOpen: () => void }[] = [
    { key: "settings", title: "Property settings", action: "Review settings", allowed: canManageSettings, onOpen: onOpenSettings },
    { key: "floors", title: "Buildings and floors", action: "Review buildings and floors", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "roomTypes", title: "Room types", action: "Add room types", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "rooms", title: "Rooms", action: "Add rooms", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "rates", title: "Default booking rates", action: "Set base rates", allowed: canManageInventory, onOpen: onOpenInventory },
    { key: "ratePlans", title: "Advanced rates", action: "Review advanced rates", allowed: canManageRates, onOpen: onOpenRates },
  ];
  const hasHotelView = hotelTeam.some((member) => member.permissions?.includes("hotel.view"));
  const hasFrontDeskActions = hotelTeam.some((member) => member.permissions?.some((key) => frontDeskPermissionKeys.includes(key)));

  return (
    <section aria-label="Hotel setup" className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Get your hotel ready</h2>
          <p className="text-sm text-muted-foreground">
            {operationalReady ? "Your hotel is ready for bookings." : "A few checks will help your team welcome guests with confidence."}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Collapse setup checklist" : "Open setup checklist"}
        </Button>
      </div>
      {expanded && (
        <div id={contentId} className="mt-4 space-y-4">
          {status === "error" ? (
            <div role="alert" className="rounded-lg border p-3">
              <p className="text-sm">We couldn&apos;t check your hotel setup. Please try again.</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void reload()}>Retry setup check</Button>
            </div>
          ) : status === "loading" || !readiness ? (
            <div role="status" aria-live="polite" className="space-y-2">
              <p className="text-sm text-muted-foreground">Checking your hotel setup...</p>
              <div aria-hidden="true" className="h-12 animate-pulse rounded-lg bg-muted" />
              <div aria-hidden="true" className="h-12 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <ul aria-label="Setup steps" className="grid gap-3 md:grid-cols-2">
              {steps.map(({ key, title, action, allowed, onOpen }) => {
                const step = readiness.steps[key];
                return (
                  <li key={key} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">{title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${step.status === "ready" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>{labels[step.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{step.reason}</p>
                    {step.status !== "unknown" && (allowed ? (
                      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onOpen}>{step.status === "ready" && ["roomTypes", "rooms", "rates"].includes(key) ? `Review ${key === "roomTypes" ? "room types" : key === "rooms" ? "rooms" : "base rates"}` : action}</Button>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Ask your administrator to review {title.toLowerCase()}.</p>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium">Hotel team review</h3>
            <p className="text-sm text-muted-foreground">People with Hotel access. Team review is informational and does not affect booking readiness.</p>
            {teamStatus === "loading" && <p className="mt-2 text-sm text-muted-foreground">Loading Hotel team...</p>}
            {teamStatus === "error" && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">We couldn&apos;t load the Hotel team.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void reload()}>Retry team review</Button>
              </div>
            )}
            {teamStatus === "ready" && hotelTeam.length > 0 && (
              <>
                <ul aria-label="Hotel team" className="mt-3 space-y-2">
                  {hotelTeam.map((member) => {
                    const permissions = member.permissions || [];
                    const accessGroups = getHotelAccessGroups(permissions);
                    const hasOtherHotelAccess = permissions.some((key) => key.startsWith("hotel.") && !knownHotelPermissionKeys.has(key));
                    const assignedRole = getAssignedRole(member);
                    return (
                      <li key={member.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
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
                  <ul aria-label="Hotel access gaps" className="mt-3 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                    {!hasHotelView && <li>No team member currently has Hotel viewing access.</li>}
                    {!hasFrontDeskActions && <li>No one currently appears to have front-desk actions.</li>}
                  </ul>
                )}
              </>
            )}
            {teamStatus === "ready" && hotelTeam.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">No team members currently have Hotel permissions.</p>
                <p className="mt-1 text-sm text-muted-foreground">Assign Hotel access to the staff who need to view stays or help guests at the front desk.</p>
                {canManageStaff ? (
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onOpenStaff}>Review staff access</Button>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Ask an administrator to assign Hotel access to the right staff.</p>
                )}
              </div>
            )}
            {(teamStatus === "forbidden" || (teamStatus === "ready" && hotelTeam.length > 0 && !canManageStaff)) && (
              <p className="mt-2 text-sm text-muted-foreground">Ask your administrator to review who has Hotel access.</p>
            )}
            {teamStatus === "ready" && hotelTeam.length > 0 && canManageStaff && (
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onOpenStaff}>Review Hotel team</Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
