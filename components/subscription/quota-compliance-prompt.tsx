"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { subscriptionApi } from "@/lib/subscription/api";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAuth } from "@/hooks/use-auth";
import { useSubscriptionStore } from "@/hooks/use-subscription";

type ChoiceMap = Record<string, Set<number>>;
type ComplianceIssue = {
  key: string;
  limit: number;
  items: Array<{ id: number }>;
};

function initialChoices(issues: ComplianceIssue[]): ChoiceMap {
  return issues.reduce<ChoiceMap>((choices, issue) => {
    choices[issue.key] = new Set(issue.items.slice(0, issue.limit).map((item) => item.id));
    return choices;
  }, {});
}

export function QuotaCompliancePrompt() {
  const restaurantId = useRestaurant((state) => state.restaurant?.id ?? null);
  const user = useAuth((state) => state.user);
  const current = useSubscriptionStore((state) => state.current);
  const fetchCurrent = useSubscriptionStore((state) => state.fetchCurrent);
  const issues = current?.quota_compliance?.issues ?? [];
  const isRequired = current?.quota_compliance?.required === true && issues.length > 0;
  const [choices, setChoices] = useState<ChoiceMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canResolve = [user?.role, user?.primary_role, ...(user?.roles ?? [])]
    .filter(Boolean)
    .some((role) => ["admin", "owner", "manager", "superadmin", "platform_staff"].includes(String(role).toLowerCase()));

  const issueSignature = useMemo(
    () => issues.map((issue) => `${issue.key}:${issue.limit}:${issue.items.map((item) => item.id).join(",")}`).join("|"),
    [issues],
  );

  useEffect(() => {
    if (isRequired) {
      setChoices(initialChoices(issues));
      setError(null);
    }
  }, [isRequired, issueSignature, issues]);

  const toggle = (key: string, id: number, limit: number) => {
    setChoices((previous) => {
      const next = new Set(previous[key] ?? []);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < limit) {
        next.add(id);
      }
      return { ...previous, [key]: next };
    });
  };

  const submit = async () => {
    if (!restaurantId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await subscriptionApi.resolveQuotaCompliance({
        table_ids: Array.from(choices["tables.max"] ?? []),
        menu_item_ids: Array.from(choices["menu_items.max"] ?? []),
        user_ids: Array.from(choices["users.max"] ?? []),
      }, restaurantId);
      await fetchCurrent({ restaurantId, force: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "We could not save your active resources. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isRequired || !canResolve) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-h-[min(46rem,calc(100vh-2rem))] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-[28px] border-0 bg-background p-0 shadow-2xl [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/70 bg-gradient-to-br from-amber-50 via-background to-background px-6 pb-6 pt-7 sm:px-9 sm:pt-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Choose the resources to keep active</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Your plan now has lower limits. Nothing is deleted—select the tables, menu items, and team seats you need today. The rest stay safely paused and return when your plan allows them.
          </p>
        </div>

        <div className="max-h-[calc(min(46rem,100vh-2rem)-16rem)] space-y-4 overflow-y-auto px-6 py-5 sm:px-9">
          {issues.map((issue) => {
            const selected = choices[issue.key] ?? new Set<number>();
            return (
              <section key={issue.key} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <h3 className="font-semibold capitalize text-foreground">{issue.label.replaceAll("_", " ")}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{issue.used} currently active · keep up to {issue.limit}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{selected.size} / {issue.limit} selected</span>
                </div>
                <div className="mt-3 grid max-h-44 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                  {issue.items.map((item) => {
                    const checked = selected.has(item.id);
                    const disabled = !checked && selected.size >= issue.limit;
                    return (
                      <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${checked ? "bg-primary/7 text-foreground" : "hover:bg-muted/60"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}>
                        <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(issue.key, item.id, issue.limit)} />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {error ? <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Your history and records stay intact.</p>
          <Button onClick={submit} disabled={submitting} className="h-11 rounded-xl px-5 font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Keep selected resources active
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
