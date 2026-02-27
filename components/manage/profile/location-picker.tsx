"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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

export default function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const [libLoaded, setLibLoaded] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkLeaflet = () => {
            if (window.L) {
                if (isMounted) setLibLoaded(true);
                return;
            }
        };

        // Load Leaflet CSS only if not present
        if (!document.getElementById("leaflet-css")) {
            const link = document.createElement("link");
            link.id = "leaflet-css";
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);
        }

        // Load Leaflet JS
        if (!document.getElementById("leaflet-js")) {
            const script = document.createElement("script");
            script.id = "leaflet-js";
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // Poll for window.L since script.onload is sometimes flaky in Next.js SPA navigation
        const interval = setInterval(() => {
            if (window.L) {
                if (isMounted) setLibLoaded(true);
                clearInterval(interval);
            }
        }, 300);

        checkLeaflet();

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!libLoaded || !mapContainerRef.current) return;

        const L = window.L;
        if (!L) return;

        const defaultLat = parseFloat(latitude) || 27.7172; 
        const defaultLng = parseFloat(longitude) || 85.3240;

        // Ensure container has height
        if (mapContainerRef.current.clientHeight === 0) {
            mapContainerRef.current.style.height = "100%";
            mapContainerRef.current.style.minHeight = "400px";
        }

        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 13);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);

            markerRef.current = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(mapRef.current);

            // Handle map click
            mapRef.current.on("click", (e: any) => {
                const { lat, lng } = e.latlng;
                markerRef.current.setLatLng([lat, lng]);
                onChange(lat.toFixed(6), lng.toFixed(6));
            });

            // Handle marker drag
            markerRef.current.on("dragend", (e: any) => {
                const { lat, lng } = e.target.getLatLng();
                onChange(lat.toFixed(6), lng.toFixed(6));
            });
            
            // Fix map sizing issues inside flex/grid containers
            setTimeout(() => {
                mapRef.current?.invalidateSize();
            }, 500);
        } else {
            // Update marker if coordinates change from outside (e.g. typing)
            const currentLat = parseFloat(latitude);
            const currentLng = parseFloat(longitude);
            if (!isNaN(currentLat) && !isNaN(currentLng)) {
                const pos = markerRef.current.getLatLng();
                if (pos.lat !== currentLat || pos.lng !== currentLng) {
                    markerRef.current.setLatLng([currentLat, currentLng]);
                    mapRef.current.panTo([currentLat, currentLng]);
                }
            }
        }

        return () => {
            // Cleanup map instance properly on unmount
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [libLoaded, latitude, longitude, onChange]);

    return (
        <>
            {!libLoaded ? (
                <div className="h-full w-full min-h-[400px] flex flex-col items-center justify-center bg-muted rounded-xl border z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Loading interactive map...</p>
                </div>
            ) : (
                <div className="relative group w-full h-full min-h-[400px]">
                    <div 
                        ref={mapContainerRef} 
                        className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border z-0"
                    />
                    <div className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded-md shadow-md text-[10px] font-semibold text-muted-foreground pointer-events-none">
                        Click map or drag pin to move location
                    </div>
                </div>
            )}
        </>
    );
}
