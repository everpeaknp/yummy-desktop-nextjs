"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

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
        // Load Leaflet CSS
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
            script.onload = () => setLibLoaded(true);
            document.head.appendChild(script);
        } else if (window.L) {
            setLibLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!libLoaded || !mapContainerRef.current) return;

        const L = window.L;
        const defaultLat = parseFloat(latitude) || 27.7172; 
        const defaultLng = parseFloat(longitude) || 85.3240;

        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 13);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'
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
            // No need to destroy map on every render, just when component unmounts
        };
    }, [libLoaded, latitude, longitude, onChange]);

    if (!libLoaded) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-muted rounded-xl border">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading interactive map...</p>
            </div>
        );
    }

    return (
        <div className="relative group w-full h-full">
            <div 
                ref={mapContainerRef} 
                className="w-full h-full rounded-xl overflow-hidden border z-0"
            />
            <div className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded-md shadow-md text-[10px] font-semibold text-muted-foreground pointer-events-none">
                Click map or drag pin to move location
            </div>
        </div>
    );
}
