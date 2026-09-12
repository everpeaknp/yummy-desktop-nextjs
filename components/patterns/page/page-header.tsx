"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BackButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label?: string;
  href?: string;
}

export function BackButton({ label = "Back", href, className, onClick, ...props }: BackButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn("h-11 w-11 shrink-0 rounded-xl", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        href ? router.push(href) : router.back();
      }}
      {...props}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  leading,
  backHref,
  actions,
  meta,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between", className)} {...props}>
      <div className="flex min-w-0 items-start gap-1 sm:gap-2">
        {backHref ? <BackButton href={backHref} className="-ml-2 mt-0.5" /> : leading}
        <div className="min-w-0">
          <h1 className="hidden text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground md:block">
            {title}
          </h1>
          {description ? (
            <div className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</div>
          ) : null}
          {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
