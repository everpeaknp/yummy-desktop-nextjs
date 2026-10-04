import { describe, expect, it } from "vitest";
import type { AppNotification } from "@/hooks/use-notifications";
import { extractContent } from "./notification-card";

const baseNotification: AppNotification = {
  id: 1,
  restaurant_id: 114,
  user_id: null,
  actor_id: null,
  type: "order",
  status: "sent",
  channel: "in_app",
  event: "table.service_requested",
  title: "Order update",
  body: null,
  entity_type: "table_service_request",
  entity_id: 1,
  payload: null,
  target_department: null,
  target_roles: ["waiter", "admin"],
  created_at: "2026-10-02T12:00:00Z",
  read_at: null,
};

describe("table service notification content", () => {
  it.each([
    ["call_waiter", "Waiter requested"],
    ["request_bill", "Bill requested"],
    ["water", "Water requested"],
    ["cutlery", "Cutlery requested"],
  ])("shows %s with table context", (requestType, expectedTitle) => {
    const content = extractContent({
      ...baseNotification,
      payload: { request_type: requestType, table_name: "B2" },
    });

    expect(content).toEqual({
      header: expectedTitle,
      subtitle: "Table B2",
      bodyLines: [],
    });
  });

  it("labels reminder notifications without creating another request", () => {
    const content = extractContent({
      ...baseNotification,
      payload: { request_type: "water", table_name: "B2", reminder: true },
    });

    expect(content.header).toBe("Reminder: water requested");
    expect(content.subtitle).toBe("Table B2");
  });
});
