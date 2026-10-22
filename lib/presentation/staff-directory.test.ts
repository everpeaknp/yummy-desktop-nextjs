import { describe, expect, it } from "vitest";

import {
  filterStaffDirectory,
  invitationStatusLabel,
  staffDirectoryCounts,
  staffDirectoryRoleOptions,
  staffDirectoryStateLabel,
  staffSetupState,
  type StaffDirectoryMember,
} from "./staff-directory";

const members: StaffDirectoryMember[] = [
  {
    id: 1,
    name: "Asha Rai",
    email: "asha@example.com",
    primary_role: "operations_manager",
    is_active: true,
  },
  {
    id: 2,
    name: "Bikash Thapa",
    email: "bikash@example.com",
    role: "custom_cashier",
    is_active: false,
  },
];

const profiles = new Set([1]);

describe("staff directory presentation", () => {
  it("filters by name, email, actual status, actual role, and proven setup state", () => {
    expect(
      filterStaffDirectory(
        members,
        {
          query: "asha@",
          status: "active",
          role: "operations_manager",
          setup: "ready",
        },
        "loaded",
        profiles,
      ).map((member) => member.id),
    ).toEqual([1]);

    expect(
      filterStaffDirectory(
        members,
        {
          query: "bikash",
          status: "inactive",
          role: "custom_cashier",
          setup: "needs_setup",
        },
        "loaded",
        profiles,
      ).map((member) => member.id),
    ).toEqual([2]);
  });

  it("keeps loading and failed profile queries distinct from missing profiles", () => {
    expect(staffSetupState(2, "loading", new Set())).toBe("loading");
    expect(staffSetupState(2, "error", new Set())).toBe("unavailable");
    expect(staffSetupState(2, "loaded", new Set())).toBe("needs_setup");
    expect(staffSetupState(1, "loaded", profiles)).toBe("ready");
  });

  it("uses actual staff roles and actual active flags", () => {
    expect(staffDirectoryRoleOptions(members)).toEqual([
      "custom_cashier",
      "operations_manager",
    ]);
    expect(staffDirectoryCounts(members)).toEqual({
      active: 1,
      inactive: 1,
      unavailable: 0,
    });
  });

  it("prioritizes inactive and setup attention over routine active state", () => {
    expect(staffDirectoryStateLabel(members[1], "needs_setup")).toBe(
      "Inactive",
    );
    expect(staffDirectoryStateLabel(members[0], "needs_setup")).toBe(
      "Setup needed",
    );
    expect(staffDirectoryStateLabel(members[0], "ready")).toBe("Active");
  });

  it("humanizes invitation states without collapsing unknown values", () => {
    expect(invitationStatusLabel("pending")).toBe("Pending");
    expect(invitationStatusLabel("accepted")).toBe("Accepted");
    expect(invitationStatusLabel("delivery_paused")).toBe("Delivery Paused");
  });
});
