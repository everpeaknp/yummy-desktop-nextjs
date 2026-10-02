import * as React from "react";

import { cn } from "@/lib/utils";

export function DetailGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDListElement>) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 min-[480px]:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      {...props}
    />
  );
}

export function DetailField({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}
