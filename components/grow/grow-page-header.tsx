import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function GrowPageHeader({
  title,
  description,
  actions,
  backLink,
}: {
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  backLink?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {backLink ? (
          <Link href={backLink.href} className="mb-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />{backLink.label}
          </Link>
        ) : null}
        <h1 className="text-pretty text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
