import * as React from "react";

import { cn } from "@/lib/utils";

export interface MobileRegisterToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  search: React.ReactNode;
  filter?: React.ReactNode;
}

export function MobileRegisterToolbar({
  search,
  filter,
  className,
  ...props
}: MobileRegisterToolbarProps) {
  return (
    <div
      data-mobile-register-toolbar
      className={cn("flex min-w-0 items-center gap-2 lg:hidden", className)}
      {...props}
    >
      <div className="min-w-0 flex-1">{search}</div>
      {filter ? <div className="shrink-0">{filter}</div> : null}
    </div>
  );
}
