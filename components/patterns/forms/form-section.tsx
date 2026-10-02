import * as React from "react";

import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title ? (
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function FieldGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export function FormActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0",
        className,
      )}
      {...props}
    />
  );
}
