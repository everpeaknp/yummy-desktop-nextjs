import apiClient from "@/lib/api-client";
import { AttendanceApis } from "@/lib/api/endpoints";
import type {
  AttendanceAudit,
  AttendanceConnectorPair,
  AttendanceConnectorPairingCode,
  AttendanceDevice,
  AttendanceEntry,
  AttendanceMobileDevice,
  AttendanceHoliday,
  AttendanceLeave,
  AttendanceOverview,
  AttendanceQrSession,
  AttendanceSchedule,
  AttendanceSettings,
  AttendanceShiftTemplate,
  BaseResponse,
  StaffDeviceMapping,
} from "./types";

function unwrap<T>(response: { data: BaseResponse<T> | T }): T {
  const body = response.data as BaseResponse<T>;
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }
  return response.data as T;
}

function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.append(key, String(value));
  }
  const text = search.toString();
  return text ? "?" + text : "";
}

export const attendanceApi = {
  async getSettings() {
    return unwrap<AttendanceSettings>(await apiClient.get(AttendanceApis.settings));
  },
  async updateSettings(payload: Partial<AttendanceSettings>) {
    return unwrap<AttendanceSettings>(await apiClient.patch(AttendanceApis.settings, payload));
  },
  async listShiftTemplates() {
    return unwrap<AttendanceShiftTemplate[]>(await apiClient.get(AttendanceApis.shiftTemplates));
  },
  async createShiftTemplate(payload: Partial<AttendanceShiftTemplate>) {
    return unwrap<AttendanceShiftTemplate>(await apiClient.post(AttendanceApis.shiftTemplates, payload));
  },
  async updateShiftTemplate(id: number, payload: Partial<AttendanceShiftTemplate>) {
    return unwrap<AttendanceShiftTemplate>(await apiClient.patch(AttendanceApis.shiftTemplate(id), payload));
  },
  async listSchedules(staffId?: number) {
    return unwrap<AttendanceSchedule[]>(await apiClient.get(AttendanceApis.schedules(staffId)));
  },
  async createSchedule(payload: Partial<AttendanceSchedule>) {
    return unwrap<AttendanceSchedule>(await apiClient.post(AttendanceApis.createSchedule, payload));
  },
  async listLeaves() {
    return unwrap<AttendanceLeave[]>(await apiClient.get(AttendanceApis.leaves));
  },
  async createLeave(payload: Pick<AttendanceLeave, "staff_id" | "date_from" | "date_to" | "leave_type" | "day_fraction" | "reason">) {
    return unwrap<AttendanceLeave>(await apiClient.post(AttendanceApis.leaves, payload));
  },
  async decideLeave(id: number, action: "approve" | "reject" | "cancel", decisionNote?: string) {
    return unwrap<AttendanceLeave>(await apiClient.post(AttendanceApis.leaveDecision(id, action), { decision_note: decisionNote }));
  },
  async listHolidays() {
    return unwrap<AttendanceHoliday[]>(await apiClient.get(AttendanceApis.holidays));
  },
  async createHoliday(payload: Pick<AttendanceHoliday, "holiday_date" | "name" | "is_paid" | "worked_rate_multiplier" | "notes">) {
    return unwrap<AttendanceHoliday>(await apiClient.post(AttendanceApis.holidays, payload));
  },
  async deleteHoliday(id: number) {
    await apiClient.delete(AttendanceApis.holiday(id));
  },
  async updateSchedule(id: number, payload: Partial<AttendanceSchedule>) {
    return unwrap<AttendanceSchedule>(await apiClient.patch(AttendanceApis.schedule(id), payload));
  },
  async overview(dateFrom: string, dateTo: string) {
    return unwrap<AttendanceOverview>(await apiClient.get(AttendanceApis.overview + query({ date_from: dateFrom, date_to: dateTo })));
  },
  async listEntries(params: { dateFrom?: string; dateTo?: string; staffId?: number; limit?: number } = {}) {
    return unwrap<AttendanceEntry[]>(
      await apiClient.get(
        AttendanceApis.entries +
          query({
            date_from: params.dateFrom,
            date_to: params.dateTo,
            staff_id: params.staffId,
            limit: params.limit,
          }),
      ),
    );
  },
  async submitEntry(id: number, reason?: string) {
    return unwrap<AttendanceEntry>(await apiClient.post(AttendanceApis.submitEntry(id), { reason }));
  },
  async approveEntry(id: number, payload: { approved_overtime_minutes: number; rejected_overtime_minutes: number; reason?: string }) {
    return unwrap<AttendanceEntry>(await apiClient.post(AttendanceApis.approveEntry(id), payload));
  },
  async rejectEntry(id: number, reason: string) {
    return unwrap<AttendanceEntry>(await apiClient.post(AttendanceApis.rejectEntry(id), { reason }));
  },
  async reopenEntry(id: number, reason: string) {
    return unwrap<AttendanceEntry>(await apiClient.post(AttendanceApis.reopenEntry(id), { reason }));
  },
  async audit(id: number) {
    return unwrap<AttendanceAudit[]>(await apiClient.get(AttendanceApis.audit(id)));
  },
  exportCsvUrl(dateFrom: string, dateTo: string) {
    return AttendanceApis.exportCsv + query({ date_from: dateFrom, date_to: dateTo });
  },
  async createQrSession(payload: { station_label?: string; ttl_seconds: number }) {
    return unwrap<AttendanceQrSession>(await apiClient.post(AttendanceApis.createQrSession, payload));
  },
  async listDevices() {
    return unwrap<AttendanceDevice[]>(await apiClient.get(AttendanceApis.listDevices));
  },
  async createDevice(payload: Partial<AttendanceDevice>) {
    return unwrap<AttendanceDevice>(await apiClient.post(AttendanceApis.createDevice, payload));
  },
  async updateDevice(id: number, payload: Partial<AttendanceDevice>) {
    return unwrap<AttendanceDevice>(await apiClient.patch(AttendanceApis.updateDevice(id), payload));
  },
  async listDeviceMappings(deviceId?: number) {
    return unwrap<StaffDeviceMapping[]>(await apiClient.get(AttendanceApis.listDeviceMappings(deviceId)));
  },
  async upsertDeviceMapping(payload: Partial<StaffDeviceMapping>) {
    return unwrap<StaffDeviceMapping>(await apiClient.post(AttendanceApis.upsertDeviceMapping, payload));
  },
  async listMobileDevices() {
    return unwrap<AttendanceMobileDevice[]>(await apiClient.get(AttendanceApis.mobileDevices));
  },
  async decideMobileDevice(id: number, action: "approve" | "reject" | "revoke", reason?: string) {
    return unwrap<AttendanceMobileDevice>(await apiClient.post(AttendanceApis.mobileDeviceDecision(id, action), { reason }));
  },
  async createConnectorPairingCode(payload: { device_id?: number; ttl_seconds?: number }) {
    return unwrap<AttendanceConnectorPairingCode>(await apiClient.post(AttendanceApis.connectorPairingCodes, payload));
  },
  async pairConnector(payload: { code: string; connector_version?: string }) {
    return unwrap<AttendanceConnectorPair>(await apiClient.post(AttendanceApis.connectorPair, payload));
  },
};

export type AttendanceApi = typeof attendanceApi;

