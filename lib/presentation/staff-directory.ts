export type StaffDirectoryLoadState = "loading" | "loaded" | "error";
export type StaffProfileLoadState = "loading" | "loaded" | "error";
export type StaffInvitationLoadState = "loading" | "loaded" | "error";
export type StaffAccessRequestLoadState = "loading" | "loaded" | "error";
export type StaffStatusFilter = "all" | "active" | "inactive";
export type StaffSetupFilter = "all" | "ready" | "needs_setup";
export type StaffSetupState =
  "ready" | "needs_setup" | "loading" | "unavailable";

export type StaffDirectoryMember = {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  primary_role?: string | null;
  roles?: string[] | null;
  is_active?: boolean | null;
};

export type StaffInvitation = {
  id: number;
  email: string;
  name: string;
  code: string;
  selected_role?: string | null;
  status: string;
  created_at?: string | null;
  expires_at?: string | null;
};

export type StaffDirectoryFilters = {
  query: string;
  status: StaffStatusFilter;
  role: string;
  setup: StaffSetupFilter;
};

export function staffRole(member: StaffDirectoryMember) {
  return member.primary_role || member.role || "staff";
}

export function staffRoleLabel(role: string) {
  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function invitationStatusLabel(status: string | null | undefined) {
  const normalized = String(status || "unknown")
    .trim()
    .toLowerCase();
  const known: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
    declined: "Declined",
  };
  return (
    known[normalized] ||
    normalized
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export function staffStatus(member: StaffDirectoryMember) {
  if (member.is_active === true) return "active" as const;
  if (member.is_active === false) return "inactive" as const;
  return "unavailable" as const;
}

export function staffSetupState(
  memberId: number,
  profileLoadState: StaffProfileLoadState,
  profileUserIds: ReadonlySet<number>,
): StaffSetupState {
  if (profileLoadState === "loading") return "loading";
  if (profileLoadState === "error") return "unavailable";
  return profileUserIds.has(memberId) ? "ready" : "needs_setup";
}

export function staffDirectoryStateLabel(
  member: StaffDirectoryMember,
  setupState: StaffSetupState,
) {
  const status = staffStatus(member);
  if (status === "inactive") return "Inactive";
  if (setupState === "needs_setup") return "Setup needed";
  if (status === "active") return "Active";
  return "Unavailable";
}

export function staffDirectoryCounts(members: StaffDirectoryMember[]) {
  return members.reduce(
    (counts, member) => {
      const status = staffStatus(member);
      counts[status] += 1;
      return counts;
    },
    { active: 0, inactive: 0, unavailable: 0 },
  );
}

export function staffDirectoryRoleOptions(members: StaffDirectoryMember[]) {
  return Array.from(
    new Set(members.map(staffRole).filter((role) => role && role !== "staff")),
  ).sort((left, right) =>
    staffRoleLabel(left).localeCompare(staffRoleLabel(right)),
  );
}

export function filterStaffDirectory(
  members: StaffDirectoryMember[],
  filters: StaffDirectoryFilters,
  profileLoadState: StaffProfileLoadState,
  profileUserIds: ReadonlySet<number>,
) {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return members.filter((member) => {
    const matchesSearch =
      !normalizedQuery ||
      (member.name || "").toLowerCase().includes(normalizedQuery) ||
      (member.email || "").toLowerCase().includes(normalizedQuery);
    const memberStatus = staffStatus(member);
    const matchesStatus =
      filters.status === "all" || memberStatus === filters.status;
    const matchesRole =
      filters.role === "all" || staffRole(member) === filters.role;
    const setupState = staffSetupState(
      member.id,
      profileLoadState,
      profileUserIds,
    );
    const matchesSetup =
      filters.setup === "all" || setupState === filters.setup;

    return matchesSearch && matchesStatus && matchesRole && matchesSetup;
  });
}
