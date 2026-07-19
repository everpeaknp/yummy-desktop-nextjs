"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LocationMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export type LocationMapCanvasProps = {
  latitude: string;
  longitude: string;
  isDark: boolean;
  height?: number;
  onChange: (lat: string, lng: string) => void;
  apiRef?: MutableRefObject<LocationMapHandle | null>;
};

function attachBasemap(map: L.Map, isDark: boolean): L.TileLayer {
  const primaryUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const fallbackUrl = isDark
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

  let active = L.tileLayer(primaryUrl, {
    attribution: "",
    maxZoom: 20,
    subdomains: "abcd",
  }).addTo(map);

  let usedFallback = false;
  active.on("tileerror", () => {
    if (usedFallback) return;
    usedFallback = true;
    map.removeLayer(active);
    active = L.tileLayer(fallbackUrl, {
      attribution: "",
      maxZoom: 19,
      tileSize: 256,
    }).addTo(map);
  });

  return active;
}

export default function LocationMapCanvas({
  latitude,
  longitude,
  isDark,
  height = 220,
  onChange,
  apiRef,
}: LocationMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    const lat = parseFloat(latitude) || 27.7172;
    const lng = parseFloat(longitude) || 85.324;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: false,
    }).setView([lat, lng], 14);

    tilesRef.current = attachBasemap(map, isDark);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
    });

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onChangeRef.current(pos.lat.toFixed(6), pos.lng.toFixed(6));
    });

    mapRef.current = map;
    markerRef.current = marker;

    if (apiRef) {
      apiRef.current = {
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
      };
    }

    const refresh = () => map.invalidateSize({ animate: false });
    refresh();
    const t1 = window.setTimeout(refresh, 100);
    const t2 = window.setTimeout(refresh, 350);
    const t3 = window.setTimeout(refresh, 800);
    window.addEventListener("resize", refresh);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("resize", refresh);
      if (apiRef) apiRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      tilesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const pos = marker.getLatLng();
    if (Math.abs(pos.lat - lat) > 1e-7 || Math.abs(pos.lng - lng) > 1e-7) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
      map.invalidateSize({ animate: false });
    }
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 50);
    return () => window.clearTimeout(id);
  }, [height]);

  return (
    <div
      ref={containerRef}
      className="location-map h-full w-full"
      data-map-theme={isDark ? "dark" : "light"}
      style={{ height: "100%", width: "100%", minHeight: height }}
    />
  );
}
