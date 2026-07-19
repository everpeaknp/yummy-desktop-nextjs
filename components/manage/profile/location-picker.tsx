"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Loader2, LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LocationMapHandle } from "./location-map-canvas";

const LocationMapCanvas = dynamic(() => import("./location-map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  /** Show locate button in the map control stack. Default true. */
  showDetectButton?: boolean;
  /** Fixed pixel height. Omit when using className="h-full" to fill parent. */
  height?: number;
  className?: string;
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  showDetectButton = true,
  height,
  className,
}: LocationPickerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const mapApiRef = useRef<LocationMapHandle | null>(null);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";
  const mapHeight = height ?? 220;

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }

    setDetecting(true);
    const toastId = toast.loading("Detecting location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6));
        toast.success("Location detected", { id: toastId });
        setDetecting(false);
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow access and try again."
            : "Could not detect your location. Try again or set the pin manually.";
        toast.error(message, { id: toastId });
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const controlBtn = cn(
    "h-[34px] w-[34px] rounded-md border p-0 shadow-md",
    isDark
      ? "border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
      : "border-border bg-background text-foreground hover:bg-muted"
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border",
        isDark ? "border-border bg-zinc-900" : "border-border bg-slate-100",
        className
      )}
      style={height != null ? { height } : undefined}
    >
      {mounted && resolvedTheme ? (
        <LocationMapCanvas
          key={isDark ? "dark" : "light"}
          latitude={latitude}
          longitude={longitude}
          isDark={isDark}
          height={mapHeight}
          onChange={onChange}
          apiRef={mapApiRef}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute left-2 top-2 z-[1100] rounded-md border px-2 py-1.5 text-[10px] font-semibold shadow-md",
          isDark
            ? "border-zinc-700 bg-zinc-900/90 text-zinc-300"
            : "border-border bg-white/95 text-muted-foreground"
        )}
      >
        Click map or drag pin
      </div>

      <div className="absolute bottom-2.5 right-2.5 z-[1100] flex flex-col gap-1.5">
        {showDetectButton ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={controlBtn}
            onClick={detectLocation}
            disabled={detecting}
            title="Use my location"
            aria-label="Use my location"
          >
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={controlBtn}
          onClick={() => mapApiRef.current?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={controlBtn}
          onClick={() => mapApiRef.current?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
