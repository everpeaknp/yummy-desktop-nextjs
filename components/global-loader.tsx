"use client";

import Image from "next/image";

export function GlobalLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-card p-4 shadow-xl flex items-center justify-center border border-border">
          <Image
            src="/refresh_icon.png"
            alt="Loading..."
            className="object-contain animate-pulse"
            width={48}
            height={48}
            priority
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold tracking-widest uppercase opacity-50">Yummy</p>
          <div className="h-1 w-24 bg-muted overflow-hidden rounded-full">
            <div className="h-full bg-primary animate-progress-loading w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
