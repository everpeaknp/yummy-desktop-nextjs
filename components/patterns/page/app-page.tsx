import * as React from "react";

import { cn } from "@/lib/utils";

type AppPageWidth =
  | "standard"
  | "register"
  | "report"
  | "workspace"
  | "form"
  | "detail"
  | "wide"
  | "full"
  | "reading";

const widths: Record<AppPageWidth, string> = {
  reading: "max-w-3xl",
  standard: "max-w-6xl",
  register: "max-w-7xl",
  report: "max-w-[1440px]",
  workspace: "max-w-[1600px]",
  form: "max-w-3xl",
  detail: "max-w-4xl",
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
        className,
      )}
      {...props}
    />
  );
}
