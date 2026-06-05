"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type ResizableDialogVariant = "detail" | "wizard";

const VARIANT_MAX_WIDTH: Record<ResizableDialogVariant, number> = {
  detail: 860,
  wizard: 768,
};

const EDGE_MARGIN = 12;
const MINIMIZED_VERTICAL_INSET_RATIO = 0.05;

type DialogGeometry = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function computeGeometry(isMaximized: boolean, maxWidthPx: number): DialogGeometry {
  if (typeof window === "undefined") {
    return { top: 48, left: 48, width: maxWidthPx, height: 640 };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const verticalInset = Math.max(EDGE_MARGIN, Math.round(vh * MINIMIZED_VERTICAL_INSET_RATIO));

  if (isMaximized) {
    return {
      top: EDGE_MARGIN,
      left: EDGE_MARGIN,
      width: Math.max(0, vw - EDGE_MARGIN * 2),
      height: Math.max(0, vh - EDGE_MARGIN * 2),
    };
  }

  const width = Math.min(maxWidthPx, Math.max(0, vw - EDGE_MARGIN * 2));
  const height = Math.max(0, vh - verticalInset * 2);

  return {
    top: verticalInset,
    left: Math.max(EDGE_MARGIN, Math.round((vw - width) / 2)),
    width,
    height,
  };
}

/** Animated maximize/minimize — always returns pixel top/left/width/height for smooth CSS transitions. */
export function useResizableDialogStyle(
  isMaximized: boolean,
  variant: ResizableDialogVariant = "detail",
): CSSProperties {
  const maxWidthPx = VARIANT_MAX_WIDTH[variant];
  const [geometry, setGeometry] = useState<DialogGeometry>(() =>
    computeGeometry(isMaximized, maxWidthPx),
  );

  const syncGeometry = useCallback(() => {
    setGeometry(computeGeometry(isMaximized, maxWidthPx));
  }, [isMaximized, maxWidthPx]);

  useLayoutEffect(() => {
    syncGeometry();
    window.addEventListener("resize", syncGeometry);
    return () => window.removeEventListener("resize", syncGeometry);
  }, [syncGeometry]);

  return {
    position: "fixed",
    top: geometry.top,
    left: geometry.left,
    width: geometry.width,
    height: geometry.height,
    transform: "none",
    margin: 0,
    maxWidth: "none",
    maxHeight: "none",
  };
}

/** Toggle between centered modal and near-fullscreen for day-close dialogs. */
export function resizableDialogContentClass(isMaximized: boolean, baseClassName: string) {
  return cn(
    baseClassName,
    "resizable-dialog-panel",
    isMaximized ? "rounded-xl" : "rounded-2xl sm:rounded-3xl",
  );
}
