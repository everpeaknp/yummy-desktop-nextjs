"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinOff } from "lucide-react";

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

const DEFAULT_CENTER: [number, number] = [27.7172, 85.3240];

export default function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const coordinatesRef = useRef({ latitude, longitude });
  const [libLoaded, setLibLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  onChangeRef.current = onChange;
  coordinatesRef.current = { latitude, longitude };

  useEffect(() => {
    if (window.L) {
      setLibLoaded(true);
      return;
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      if (window.L) {
        setLoadError(false);
        setLibLoaded(true);
      }
    };
    const handleError = () => setLoadError(true);
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    const timeout = window.setTimeout(() => {
      if (!window.L) setLoadError(true);
    }, 15000);

    return () => {
      window.clearTimeout(timeout);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!libLoaded || !mapContainerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) return;

    const initialLatitude = Number.parseFloat(coordinatesRef.current.latitude);
    const initialLongitude = Number.parseFloat(coordinatesRef.current.longitude);
    const hasInitialCoordinates = Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude);
    const center: [number, number] = hasInitialCoordinates
      ? [initialLatitude, initialLongitude]
      : DEFAULT_CENTER;

    const map = L.map(mapContainerRef.current).setView(center, 13);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const placeMarker = (lat: number, lng: number, notify: boolean) => {
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (event: any) => {
          const position = event.target.getLatLng();
          onChangeRef.current(position.lat.toFixed(6), position.lng.toFixed(6));
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (notify) onChangeRef.current(lat.toFixed(6), lng.toFixed(6));
    };

    if (hasInitialCoordinates) placeMarker(initialLatitude, initialLongitude, false);
    map.on("click", (event: any) => {
      placeMarker(event.latlng.lat, event.latlng.lng, true);
    });

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [libLoaded]);

  useEffect(() => {
    if (!libLoaded || !mapRef.current) return;
    const nextLatitude = Number.parseFloat(latitude);
    const nextLongitude = Number.parseFloat(longitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;

    if (!markerRef.current) {
      markerRef.current = window.L.marker([nextLatitude, nextLongitude], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on("dragend", (event: any) => {
        const position = event.target.getLatLng();
        onChangeRef.current(position.lat.toFixed(6), position.lng.toFixed(6));
      });
    } else {
      markerRef.current.setLatLng([nextLatitude, nextLongitude]);
    }
    mapRef.current.panTo([nextLatitude, nextLongitude]);
  }, [latitude, libLoaded, longitude]);

  if (loadError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border bg-muted/40 p-6 text-center">
        <MapPinOff className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">The interactive map could not be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">You can still enter the restaurant address and continue without a map pin.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[400px] w-full">
      {!libLoaded && (
        <div className="absolute inset-0 z-10 flex min-h-[400px] flex-col items-center justify-center rounded-xl border bg-muted">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading interactive map...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="min-h-[400px] w-full overflow-hidden rounded-xl border" />
      {libLoaded && (
        <div className="pointer-events-none absolute right-2 top-2 z-[1000] rounded-md bg-white p-2 text-[10px] font-semibold text-muted-foreground shadow-md">
          Click the map or drag the pin to set the location
        </div>
      )}
    </div>
  );
}
