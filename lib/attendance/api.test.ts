import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceApi } from "./api";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue({ data: { data: {} } });
  mocked.post.mockResolvedValue({ data: { data: {} } });
  mocked.patch.mockResolvedValue({ data: { data: {} } });
});

describe("attendanceApi", () => {
  it("calls settings and schedule endpoints", async () => {
    await attendanceApi.getSettings();
    await attendanceApi.updateSettings({ timezone: "Asia/Kathmandu" });
    await attendanceApi.listSchedules(12);
    await attendanceApi.createSchedule({ staff_id: 12, weekday: 1 });

    expect(mocked.get).toHaveBeenCalledWith("/attendance/settings");
    expect(mocked.patch).toHaveBeenCalledWith("/attendance/settings", { timezone: "Asia/Kathmandu" });
    expect(mocked.get).toHaveBeenCalledWith("/attendance/schedules?staff_id=12");
    expect(mocked.post).toHaveBeenCalledWith("/attendance/schedules", { staff_id: 12, weekday: 1 });
  });

  it("calls overview entries approvals audit and export contracts", async () => {
    await attendanceApi.overview("2026-06-23", "2026-06-24");
    await attendanceApi.listEntries({ dateFrom: "2026-06-23", staffId: 4, limit: 50 });
    await attendanceApi.approveEntry(9, { approved_overtime_minutes: 30, rejected_overtime_minutes: 0, reason: "ok" });
    await attendanceApi.audit(9);

    expect(mocked.get).toHaveBeenCalledWith("/attendance/overview?date_from=2026-06-23&date_to=2026-06-24");
    expect(mocked.get).toHaveBeenCalledWith("/attendance/entries?date_from=2026-06-23&staff_id=4&limit=50");
    expect(mocked.post).toHaveBeenCalledWith("/attendance/entries/9/approve", {
      approved_overtime_minutes: 30,
      rejected_overtime_minutes: 0,
      reason: "ok",
    });
    expect(mocked.get).toHaveBeenCalledWith("/attendance/entries/9/audit");
    expect(attendanceApi.exportCsvUrl("2026-06-23", "2026-06-24")).toBe("/attendance/export.csv?date_from=2026-06-23&date_to=2026-06-24");
  });

  it("calls QR device connector and mobile-device endpoints", async () => {
    await attendanceApi.createQrSession({ station_label: "Front", ttl_seconds: 60 });
    await attendanceApi.createDevice({ name: "ZK" });
    await attendanceApi.updateDevice(7, { is_active: false });
    await attendanceApi.upsertDeviceMapping({ device_id: 7, staff_id: 2, device_user_id: "42" });
    await attendanceApi.createConnectorPairingCode({ device_id: 7, ttl_seconds: 600 });
    await attendanceApi.decideMobileDevice(3, "revoke", "lost phone");

    expect(mocked.post).toHaveBeenCalledWith("/attendance/qr-sessions", { station_label: "Front", ttl_seconds: 60 });
    expect(mocked.post).toHaveBeenCalledWith("/attendance/devices", { name: "ZK" });
    expect(mocked.patch).toHaveBeenCalledWith("/attendance/devices/7", { is_active: false });
    expect(mocked.post).toHaveBeenCalledWith("/attendance/device-mappings", { device_id: 7, staff_id: 2, device_user_id: "42" });
    expect(mocked.post).toHaveBeenCalledWith("/attendance/connectors/pairing-codes", { device_id: 7, ttl_seconds: 600 });
    expect(mocked.post).toHaveBeenCalledWith("/attendance/mobile-devices/3/revoke", { reason: "lost phone" });
  });
});

