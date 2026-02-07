"use client";

import { cn } from "@/lib/utils";

// Status colors matching Flutter _statusColorMap + TableStatusLegend
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  FREE: { bg: "bg-emerald-500/20", border: "border-emerald-500/60", text: "text-emerald-500", dot: "bg-emerald-500" },
  OCCUPIED: { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-500", dot: "bg-red-500" },
  RESERVED: { bg: "bg-orange-500/20", border: "border-orange-500/60", text: "text-orange-500", dot: "bg-orange-500" },
  "BILL PRINTED": { bg: "bg-amber-500/20", border: "border-amber-500/60", text: "text-amber-500", dot: "bg-amber-500" },
  PAYMENT_COMPLETED: { bg: "bg-emerald-500/20", border: "border-emerald-500/60", text: "text-emerald-500", dot: "bg-emerald-500" },
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
}

export function TableGraphic({ tableName, capacity, status, currentGuests, className }: TableGraphicProps) {
  const colors = getStatusColors(status);

  // Distribute seats across 4 sides, matching Flutter: perSide = ceil(capacity / 4)
  const perSide = Math.ceil(capacity / 4);
  const allSeats = Array.from({ length: capacity }, (_, i) => i < (currentGuests ?? 0));

  const top = allSeats.slice(0, perSide);
  const bottom = allSeats.slice(perSide, perSide * 2);
  const left = allSeats.slice(perSide * 2, perSide * 3);
  const right = allSeats.slice(perSide * 3, perSide * 4);

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
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
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-evenly">
          {left.map((occupied, i) => (
            <Chair key={`l-${i}`} occupied={occupied} rotate={-90} />
          ))}
        </div>
      )}

      {/* Right chairs */}
      {right.length > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-evenly">
          {right.map((occupied, i) => (
            <Chair key={`r-${i}`} occupied={occupied} rotate={90} />
          ))}
        </div>
      )}

      {/* Center table body */}
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2",
          colors.bg,
          colors.border,
          // Size: leave room for chairs on each side
          "w-[60%] h-[55%]"
        )}
      >
        <span className={cn("font-extrabold text-lg leading-none", colors.text)}>
          {tableName}
        </span>
      </div>
    </div>
  );
}

function Chair({ occupied, rotate = 0 }: { occupied: boolean; rotate?: number }) {
  // Matching Flutter: occupied = #E65D42 (orange-red), free = grey.300
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}
      className="shrink-0"
    >
      {/* Simple chair icon matching Flutter Icons.chair */}
      <rect x="5" y="3" width="14" height="10" rx="3" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="7" y="13" width="10" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="6" y="17" width="3" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
      <rect x="15" y="17" width="3" height="4" rx="1" fill={occupied ? "#E65D42" : "#9ca3af"} />
    </svg>
  );
}
