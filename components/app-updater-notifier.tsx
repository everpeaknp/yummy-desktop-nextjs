"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function AppUpdaterNotifier() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const currentBuildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
        if (!currentBuildTime) return;

        const storedBuildTime = localStorage.getItem("yummy_app_build_time");

        // If we have a stored build time, and it's different from the current one, it means the app was updated
        if (storedBuildTime && storedBuildTime !== currentBuildTime) {
            // Delay the toast slightly so it appears smoothly after the app has fully rendered
            setTimeout(() => {
                toast.success("App has been updated to the latest version!", {
                    description: "You are now running the latest features and bug fixes.",
                    duration: 6000,
                });
            }, 1500);
        }

        // Always save the current build time so we don't notify again until the next update
        if (storedBuildTime !== currentBuildTime) {
            localStorage.setItem("yummy_app_build_time", currentBuildTime);
        }
    }, [mounted]);

    return null;
}
