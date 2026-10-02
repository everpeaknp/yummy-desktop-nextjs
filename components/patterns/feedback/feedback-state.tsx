import * as React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeedbackStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function FeedbackState({ icon, title, description, actionLabel, onAction, className, ...props }: FeedbackStateProps) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 px-5 py-8 text-center", className)} {...props}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-sm">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? <Button type="button" onClick={onAction} className="mt-4 h-11 rounded-xl">{actionLabel}</Button> : null}
    </div>
  );
}

export function EmptyState({ icon, ...props }: Omit<FeedbackStateProps, "icon"> & { icon?: React.ReactNode }) {
  return <FeedbackState icon={icon ?? <Inbox className="h-5 w-5" />} {...props} />;
}

export function ErrorState({ icon, ...props }: Omit<FeedbackStateProps, "icon"> & { icon?: React.ReactNode }) {
  return <FeedbackState icon={icon ?? <AlertTriangle className="h-5 w-5 text-destructive" />} {...props} />;
}

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground", className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
