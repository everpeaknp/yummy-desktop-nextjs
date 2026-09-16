import * as React from "react";
import { ArrowLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileAppBar({
  title,
  navigation = "top-level",
  onBack,
  onClose,
  actions,
  className,
}: {
  title: React.ReactNode;
  navigation?: "top-level" | "secondary" | "detail";
  onBack?: () => void;
  onClose?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  const hasLeading = navigation !== "top-level" && (onBack || onClose);
  return (
    <div
      className={cn(
        "flex min-h-14 min-w-0 items-center gap-1 lg:hidden",
        className,
      )}
    >
      {hasLeading ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={onClose ? "Close" : "Back"}
          className="-ml-2 h-11 w-11 shrink-0 rounded-xl"
          onClick={onClose ?? onBack}
        >
          {onClose ? (
            <X className="h-5 w-5" />
          ) : (
            <ArrowLeft className="h-5 w-5" />
          )}
        </Button>
      ) : null}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
        {title}
      </p>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
}
