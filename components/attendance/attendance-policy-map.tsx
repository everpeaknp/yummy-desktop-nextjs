"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinOff, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { attendanceLocationState } from "./attendance-policy";

type LeafletWindow = Window & { L?: any };

type AttendancePolicyMapProps = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onEditRestaurantLocation: () => void;
};

export function AttendancePolicyMap({
  latitude,
  longitude,
  radiusMeters,
  onEditRestaurantLocation,
}: AttendancePolicyMapProps) {
  if (attendanceLocationState(latitude, longitude) === "missing") {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border bg-muted/20 p-6 text-center">
        <MapPinOff className="mb-3 h-7 w-7 text-destructive" />
        <h3 className="text-base font-semibold">Restaurant location required</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Set the restaurant location once in its profile before enabling mobile attendance.
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={onEditRestaurantLocation}>
          <PencilLine className="mr-2 h-4 w-4" />
          Set restaurant location
        </Button>
      </div>
    );
  }

  return (
    <PolicyMapCanvas
      latitude={latitude!}
      longitude={longitude!}
      radiusMeters={radiusMeters}
    />
  );
}

function PolicyMapCanvas({
  latitude,
  longitude,
  radiusMeters,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const initialPolicyRef = useRef({ latitude, longitude, radiusMeters });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const browser = window as LeafletWindow;
    if (browser.L) {
      setReady(true);
      return () => {
        mounted = false;
      };
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const timer = window.setInterval(() => {
      if ((window as LeafletWindow).L) {
        window.clearInterval(timer);
        if (mounted) setReady(true);
      }
    }, 150);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const L = (window as LeafletWindow).L;
    if (!L) return;

    const initial = initialPolicyRef.current;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    }).setView(
      [initial.latitude, initial.longitude],
      zoomForRadius(initial.radiusMeters),
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markerRef.current = L.marker([initial.latitude, initial.longitude]).addTo(map);
    circleRef.current = L.circle([initial.latitude, initial.longitude], {
      radius: initial.radiusMeters,
      color: "hsl(var(--primary))",
      fillColor: "hsl(var(--primary))",
      fillOpacity: 0.14,
      weight: 2,
    }).addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const point = [latitude, longitude];
    map.setView(point, zoomForRadius(radiusMeters));
    markerRef.current?.setLatLng(point);
    circleRef.current?.setLatLng(point);
    circleRef.current?.setRadius(radiusMeters);
  }, [latitude, longitude, radiusMeters]);

  return (
    <div className="relative min-h-60 overflow-hidden rounded-lg border bg-muted/20">
      {!ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : null}
      <div ref={containerRef} className="h-64 w-full" aria-label="Attendance geofence map" />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md border bg-background/95 px-3 py-2 text-xs font-semibold shadow-sm">
        {radiusMeters} m attendance radius
      </div>
    </div>
  );
}

function zoomForRadius(radiusMeters: number) {
  if (radiusMeters <= 75) return 18;
  if (radiusMeters <= 200) return 17;
  if (radiusMeters <= 500) return 16;
  if (radiusMeters <= 1200) return 15;
  return 14;
}
