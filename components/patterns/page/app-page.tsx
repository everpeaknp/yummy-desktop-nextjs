import * as React from "react";

import { cn } from "@/lib/utils";

type AppPageWidth = "standard" | "wide" | "full" | "reading";

const widths: Record<AppPageWidth, string> = {
  reading: "max-w-3xl",
  standard: "max-w-6xl",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

export interface AppPageProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: AppPageWidth;
  density?: "comfortable" | "compact";
}

export function AppPage({
  width = "standard",
  density = "comfortable",
  className,
  ...props
}: AppPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 overflow-x-clip",
        widths[width],
        density === "compact" ? "space-y-4" : "space-y-5 md:space-y-6",
        className
      )}
      {...props}
    />
  );
}

