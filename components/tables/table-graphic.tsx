"use client";

import { cn } from "@/lib/utils";

// Status colors matching Flutter _statusColorMap + TableStatusLegend
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  FREE: { bg: "bg-emerald-500/20", border: "border-emerald-500/60", text: "text-emerald-500", dot: "bg-emerald-500" },
  OCCUPIED: { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-500", dot: "bg-red-500" },
  RESERVED: { bg: "bg-orange-500/20", border: "border-orange-500/60", text: "text-orange-500", dot: "bg-orange-500" },
  "BILL PRINTED": { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-500", dot: "bg-red-500" },
  PAYMENT_COMPLETED: { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-500", dot: "bg-red-500" },
};

const DEFAULT_COLORS = { bg: "bg-gray-500/20", border: "border-gray-500/60", text: "text-gray-500", dot: "bg-gray-500" };

export function getStatusColors(status: string) {
  return STATUS_COLORS[status?.toUpperCase()] || DEFAULT_COLORS;
}

interface TableGraphicProps {
  tableName: string;
  capacity: number;
  status: string;
  currentGuests?: number;
  className?: string;
  spaceKind?: string;
}

export function TableGraphic({ tableName, capacity, status, currentGuests, className, spaceKind }: TableGraphicProps) {
  const colors = getStatusColors(status);
  const isRoom = spaceKind === "room";

  if (isRoom) {
    return (
      <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 w-full h-full p-2.5 gap-2 shadow-sm transition-all bg-card/60 hover:bg-card select-none",
            colors.bg,
            colors.border
          )}
        >
          {/* Elegant Bed Icon */}
          <div className={cn("opacity-95 transition-transform duration-300 scale-100 hover:scale-105")}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={colors.text}
            >
              <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/>
              <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
              <path d="M12 4v6"/>
              <path d="M2 17h20"/>
              <path d="M6 8h4"/>
              <path d="M14 8h4"/>
            </svg>
          </div>
          <span title={tableName} className={cn("w-full overflow-hidden break-words px-1 text-center font-black text-[clamp(0.55rem,2.2vw,1.5rem)] leading-[0.95] uppercase [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]", colors.text)}>
            {tableName}
          </span>
          <span className={cn("font-bold text-[clamp(0.5rem,1.4vw,0.875rem)] opacity-90 leading-none", colors.text)}>
            {capacity}
          </span>
        </div>
      </div>
    );
  }

  // Distribute seats across 4 sides, matching Flutter: perSide = ceil(capacity / 4)
  const perSide = Math.ceil(capacity / 4);
  const allSeats = Array.from({ length: capacity }, (_, i) => i < (currentGuests ?? 0));

  const top = allSeats.slice(0, perSide);
  const bottom = allSeats.slice(perSide, perSide * 2);
  const left = allSeats.slice(perSide * 2, perSide * 3);
  const right = allSeats.slice(perSide * 3, perSide * 4);

  const labelScale = Math.max(8, 60 / Math.max(tableName.length, 2));

  return (
    <div className={cn("relative h-full w-full [container-type:size]", className)}>
      {/* Top chairs */}
      {top.length > 0 && (
        <div className="absolute top-0 left-0 right-0 flex justify-evenly">
          {top.map((occupied, i) => (
            <Chair key={`t-${i}`} occupied={occupied} />
          ))}
        </div>
      )}

      {/* Bottom chairs */}
      {bottom.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-evenly">
          {bottom.map((occupied, i) => (
            <Chair key={`b-${i}`} occupied={occupied} rotate={180} />
          ))}
        </div>
      )}

      {/* Left chairs */}
      {left.length > 0 && (
        <div className="absolute bottom-0 left-0 top-0 flex flex-col justify-evenly">
          {left.map((occupied, i) => (
            <Chair key={`l-${i}`} occupied={occupied} rotate={-90} />
          ))}
        </div>
      )}

      {/* Right chairs */}
      {right.length > 0 && (
        <div className="absolute bottom-0 right-0 top-0 flex flex-col justify-evenly">
          {right.map((occupied, i) => (
            <Chair key={`r-${i}`} occupied={occupied} rotate={90} />
          ))}
        </div>
      )}

      <div
        className={cn(
          "absolute left-1/2 top-1/2 flex h-[55%] w-[60%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-lg border-2 p-[3px]",
          colors.bg,
          colors.border,
          // Size: leave room for chairs on each side
        )}
      >
        <span
          title={tableName}
          className={cn("block max-w-full whitespace-nowrap text-center font-extrabold leading-none", colors.text)}
          style={{ fontSize: `min(18px, ${labelScale}cqw)` }}
        >
          {tableName}
        </span>
        <span
          className={cn("mt-[3px] font-bold leading-none", colors.text)}
          style={{ fontSize: "min(12px, 16cqw)" }}
        >
          {capacity}
        </span>
      </div>
    </div>
  );
}

function Chair({ occupied, rotate = 0 }: { occupied: boolean; rotate?: number }) {
  // Matching Flutter: occupied = #E65D42 (orange-red), free = grey.300
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
      style={{ width: "clamp(8px, 14cqw, 16px)", height: "clamp(8px, 14cqw, 16px)", transform: `rotate(${rotate}deg)` }}
    >
      {/* Simple chair icon matching Flutter Icons.chair */}
      <rect x="5" y="3" width="14" height="10" rx="3" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="7" y="13" width="10" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="6" y="17" width="3" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="15" y="17" width="3" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
    </svg>
  );
}
