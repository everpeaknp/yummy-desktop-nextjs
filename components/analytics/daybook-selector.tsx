"use client";

import { useMemo, useState } from "react";
import { ReceiptText, Check, Loader2 } from "lucide-react";
import type { DayCloseSession } from "@/types/day-close-session";
import {
  formatDaybookChipLabel,
  formatDaybookSessionRange,
  formatDaybookSessionLabel,
} from "@/lib/day-close-session-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type DaybookSelectorProps = {
  timezone: string;
  selectedSession: DayCloseSession | null;
  sessions: DayCloseSession[];
  loading: boolean;
  error: string | null;
  onSelect: (session: DayCloseSession | null) => void;
  onOpen?: () => void;
};

export function DaybookSelector({
  timezone,
  selectedSession,
  sessions,
  loading,
  error,
  onSelect,
  onOpen,
}: DaybookSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const chipLabel = formatDaybookChipLabel(selectedSession, timezone);
  const rangeLabel = selectedSession
    ? formatDaybookSessionRange(selectedSession, timezone)
    : null;

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => {
      const haystack = [
        formatDaybookSessionLabel(session, timezone),
        formatDaybookSessionRange(session, timezone),
        session.business_date,
        session.business_line,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, sessions, timezone]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      onOpen?.();
    } else {
      setQuery("");
    }
  };

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Button
        type="button"
        variant="outline"
        className="justify-start gap-2 rounded-full h-9 px-4 max-w-full"
        onClick={() => handleOpenChange(true)}
      >
        <ReceiptText className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="truncate text-sm font-semibold">{chipLabel}</span>
      </Button>
      {rangeLabel ? (
        <p className="text-xs text-muted-foreground px-1">{rangeLabel}</p>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Select Daybook</SheetTitle>
            <SheetDescription>
              Load analytics for an exact confirmed day-close accounting window.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search daybooks"
            />

            <DaybookOption
              title="Daybook: All"
              subtitle="Use the selected date range"
              selected={selectedSession === null}
              onSelect={() => {
                onSelect(null);
                setOpen(false);
              }}
            />

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading daybook sessions...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {error || "No confirmed daybook sessions"}
              </p>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                {filteredSessions.map((session) => (
                  <DaybookOption
                    key={session.id}
                    title={formatDaybookSessionLabel(session, timezone)}
                    subtitle={formatDaybookSessionRange(session, timezone)}
                    selected={selectedSession?.id === session.id}
                    onSelect={() => {
                      onSelect(session);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DaybookOption({
  title,
  subtitle,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-border hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {selected ? <Check className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" /> : null}
      </div>
    </button>
  );
}
