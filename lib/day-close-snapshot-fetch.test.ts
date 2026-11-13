import { describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import { fetchDayCloseSnapshotForDetail } from "./day-close-snapshot-fetch";
import { parseDayCloseCurrent, parseDayCloseDetail, parseDayCloseListItem, parseDayCloseSession } from "@/types/day-close";
import { formatDayCloseListHeading } from "./day-close-format";

vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn() } }));

describe("saved dayclose identity", () => {
  it.each(["pending", "reopened", "confirmed"])("loads the saved %s report by ID", async (status) => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: { status: "success", data: { snapshot_data: { net_sales: 125 }, generated_at: "2026-11-13T12:00:00Z" } } });
    const detail = parseDayCloseDetail({ id: 7, restaurant_id: 52, status, name: "Dinner", period_end_at: "2026-11-13T12:00:00Z" });
    const report = await fetchDayCloseSnapshotForDetail(7, detail);
    expect(apiClient.get).toHaveBeenCalledOnce();
    expect(apiClient.get).toHaveBeenCalledWith("/day-closes/7/snapshot");
    expect(report?.snapshot_data?.net_sales).toBe(125);
  });

  it("carries the name through current, history, detail and session parsing", () => {
    const payload = { id: 7, restaurant_id: 52, status: "confirmed", name: "Dinner" };
    for (const parse of [parseDayCloseCurrent, parseDayCloseDetail, parseDayCloseListItem, parseDayCloseSession]) {
      expect(parse(payload)?.name).toBe("Dinner");
    }
    expect(formatDayCloseListHeading(payload)).toBe("Dinner #7");
  });
});
