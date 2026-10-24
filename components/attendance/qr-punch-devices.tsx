import type { AttendanceSource } from "@/lib/attendance/types";

type QrPunchDevicesProps = {
  entry: {
    source?: AttendanceSource | null;
    clock_in_device_name?: string | null;
    clock_out_device_name?: string | null;
    clock_out_at: string | null;
  };
};

export function QrPunchDevices({ entry }: QrPunchDevicesProps) {
  if (entry.source !== "qr_mobile") return null;

  return (
    <p className="mt-1 break-words text-xs text-muted-foreground">
      Clock-in device: {entry.clock_in_device_name || "Device unavailable"} ·{" "}
      Clock-out device: {entry.clock_out_device_name || (entry.clock_out_at ? "Device unavailable" : "Awaiting clock-out")}
    </p>
  );
}
