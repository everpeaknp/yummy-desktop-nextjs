"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Filter,
  Loader2,
  Mail,
  MoreVertical,
  RotateCcw,
  Shield,
  User as UserIcon,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchField } from "@/components/patterns/controls/search-field";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { MobileRegisterToolbar } from "@/components/patterns/controls/mobile-register-toolbar";
import { MobileCreateFab } from "@/components/patterns/actions/mobile-create-fab";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { StaffJoinCodePanel } from "@/components/staff/staff-join-code-panel";
import {
  filterStaffDirectory,
  invitationStatusLabel,
  staffDirectoryCounts,
  staffDirectoryStateLabel,
  staffDirectoryRoleOptions,
  staffRole,
  staffRoleLabel,
  staffSetupState,
  staffStatus,
  type StaffDirectoryFilters,
  type StaffDirectoryLoadState,
  type StaffDirectoryMember,
  type StaffAccessRequestLoadState,
  type StaffInvitation,
  type StaffInvitationLoadState,
  type StaffProfileLoadState,
  type StaffSetupState,
} from "@/lib/presentation/staff-directory";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type StaffRegisterProps = {
  members: StaffDirectoryMember[];
  loadState: StaffDirectoryLoadState;
  profileLoadState: StaffProfileLoadState;
  profileUserIds: ReadonlySet<number>;
  filters: StaffDirectoryFilters;
  onFiltersChange: (filters: StaffDirectoryFilters) => void;
  invitations: StaffInvitation[];
  invitationLoadState: StaffInvitationLoadState;
  busyInvitationId: number | null;
  pendingAccessRequests: number | null;
  accessRequestLoadState: StaffAccessRequestLoadState;
  addStaffOpen: boolean;
  onAddStaffOpenChange: (open: boolean) => void;
  canManageStaff: boolean;
  onAddStaff: () => void;
  onOpenMember: (member: StaffDirectoryMember) => void;
  onEditMember: (member: StaffDirectoryMember) => void;
  onSetupProfile: (member: StaffDirectoryMember) => void;
  onRemoveMember: (member: StaffDirectoryMember) => void;
  onResendInvitation: (invitation: StaffInvitation) => void;
  onRevokeInvitation: (invitation: StaffInvitation) => void;
  onRetryStaff: () => void;
  onRetryInvitations: () => void;
};

function staffStatusLabel(member: StaffDirectoryMember) {
  const status = staffStatus(member);
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Unavailable";
}

function desktopStatus(member: StaffDirectoryMember) {
  const status = staffStatus(member);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "inactive" && "text-muted-foreground",
      )}
    >
      {staffStatusLabel(member)}
    </Badge>
  );
}

function setupBadge(state: StaffSetupState) {
  if (state === "ready") return <Badge variant="outline">Ready</Badge>;
  if (state === "needs_setup") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 text-amber-700 dark:text-amber-300"
      >
        Setup needed
      </Badge>
    );
  }
  if (state === "loading") return <Badge variant="outline">Checking…</Badge>;
  return <Badge variant="outline">Unavailable</Badge>;
}

function invitationDescription(invitation: StaffInvitation) {
  const role = staffRoleLabel(invitation.selected_role || "staff");
  const email = invitation.name ? invitation.email : null;
  const expires = invitation.expires_at
    ? `Expires ${formatDate(invitation.expires_at)}`
    : "Expiry unavailable";
  return [role, email, expires].filter(Boolean).join(" · ");
}

function invitationActions(
  invitation: StaffInvitation,
  busy: boolean,
  onResend: (invitation: StaffInvitation) => void,
  onRevoke: (invitation: StaffInvitation) => void,
) {
  const pending = invitation.status.trim().toLowerCase() === "pending";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={busy}
          aria-label={`Actions for ${invitation.name || invitation.email}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onResend(invitation)}>
          {pending ? "Replace and resend" : "Resend invitation"}
        </DropdownMenuItem>
        {pending ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onRevoke(invitation)}
          >
            Revoke invitation
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DirectoryFilters({
  filters,
  roleOptions,
  setupAvailable,
  onChange,
  mobile = false,
}: {
  filters: StaffDirectoryFilters;
  roleOptions: string[];
  setupAvailable: boolean;
  onChange: (filters: StaffDirectoryFilters) => void;
  mobile?: boolean;
}) {
  const triggerClassName = mobile ? "h-11 w-full rounded-xl" : "h-10 w-40";

  return (
    <div className={cn(mobile ? "space-y-4" : "flex items-center gap-2")}>
      <Select
        value={filters.status}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as StaffDirectoryFilters["status"],
          })
        }
      >
        <SelectTrigger className={triggerClassName} aria-label="Status filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.role}
        onValueChange={(role) => onChange({ ...filters, role })}
      >
        <SelectTrigger className={triggerClassName} aria-label="Role filter">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          {roleOptions.map((role) => (
            <SelectItem key={role} value={role}>
              {staffRoleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.setup}
        disabled={!setupAvailable}
        onValueChange={(value) =>
          onChange({
            ...filters,
            setup: value as StaffDirectoryFilters["setup"],
          })
        }
      >
        <SelectTrigger className={triggerClassName} aria-label="Setup filter">
          <SelectValue
            placeholder={setupAvailable ? "Setup" : "Setup unavailable"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All setup states</SelectItem>
          <SelectItem value="ready">Ready</SelectItem>
          <SelectItem value="needs_setup">Setup needed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function StaffRegister({
  members,
  loadState,
  profileLoadState,
  profileUserIds,
  filters,
  onFiltersChange,
  invitations,
  invitationLoadState,
  busyInvitationId,
  pendingAccessRequests,
  accessRequestLoadState,
  addStaffOpen,
  onAddStaffOpenChange,
  canManageStaff,
  onAddStaff,
  onOpenMember,
  onEditMember,
  onSetupProfile,
  onRemoveMember,
  onResendInvitation,
  onRevokeInvitation,
  onRetryStaff,
  onRetryInvitations,
}: StaffRegisterProps) {
  const filteredMembers = filterStaffDirectory(
    members,
    filters,
    profileLoadState,
    profileUserIds,
  );
  const counts = staffDirectoryCounts(members);
  const roleOptions = staffDirectoryRoleOptions(members);
  const setupAttention =
    profileLoadState === "loaded"
      ? members.filter(
          (member) =>
            staffSetupState(member.id, profileLoadState, profileUserIds) ===
            "needs_setup",
        ).length
      : null;
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status.trim().toLowerCase() === "pending",
  ).length;
  const hasFilters =
    Boolean(filters.query.trim()) ||
    filters.status !== "all" ||
    filters.role !== "all" ||
    filters.setup !== "all";
  const activeFilterCount = [
    filters.status !== "all",
    filters.role !== "all",
    filters.setup !== "all",
  ].filter(Boolean).length;
  const clearFilters = () =>
    onFiltersChange({ query: "", status: "all", role: "all", setup: "all" });
  const beginEmailInvite = () => {
    onAddStaffOpenChange(false);
    window.setTimeout(onAddStaff, 0);
  };

  return (
    <section className="space-y-4" aria-labelledby="staff-directory-title">
      <h2 id="staff-directory-title" className="sr-only">
        Staff management
      </h2>

      {members.length > 0 ? (
        <>
          <MobileRegisterToolbar
            search={
              <SearchField
                placeholder="Search name or email"
                value={filters.query}
                onChange={(event) =>
                  onFiltersChange({ ...filters, query: event.target.value })
                }
                onClear={() => onFiltersChange({ ...filters, query: "" })}
              />
            }
            filter={
              <FilterBar
                title="Filters"
                activeCount={activeFilterCount}
                responsiveAt="lg"
                mobileTriggerVariant="icon"
                mobileContent={
                  <>
                    <DirectoryFilters
                      mobile
                      filters={filters}
                      roleOptions={roleOptions}
                      setupAvailable={profileLoadState === "loaded"}
                      onChange={onFiltersChange}
                    />
                    {profileLoadState === "error" ? (
                      <p className="text-sm text-muted-foreground">
                        Setup status is unavailable. Other filters still work.
                      </p>
                    ) : null}
                  </>
                }
                mobileFooter={
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                    <SheetClose asChild>
                      <Button type="button" className="h-11 rounded-xl">
                        View staff
                      </Button>
                    </SheetClose>
                  </div>
                }
              >
                <DirectoryFilters
                  filters={filters}
                  roleOptions={roleOptions}
                  setupAvailable={profileLoadState === "loaded"}
                  onChange={onFiltersChange}
                />
              </FilterBar>
            }
          />

          <FilterBar
            className="hidden lg:block"
            title="Filters"
            responsiveAt="lg"
            actions={
              canManageStaff ? (
                <Button
                  type="button"
                  onClick={() => onAddStaffOpenChange(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add staff
                </Button>
              ) : null
            }
          >
            <SearchField
              containerClassName="max-w-sm"
              placeholder="Search name or email"
              value={filters.query}
              onChange={(event) =>
                onFiltersChange({ ...filters, query: event.target.value })
              }
              onClear={() => onFiltersChange({ ...filters, query: "" })}
            />
            <DirectoryFilters
              filters={filters}
              roleOptions={roleOptions}
              setupAvailable={profileLoadState === "loaded"}
              onChange={onFiltersChange}
            />
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            ) : null}
            {profileLoadState === "error" ? (
              <span className="text-xs text-muted-foreground">
                Setup status is unavailable
              </span>
            ) : null}
          </FilterBar>
        </>
      ) : null}

      {loadState === "loading" ? (
        <LoadingState label="Loading staff…" />
      ) : loadState === "error" ? (
        <ErrorState
          title="Staff could not be loaded"
          description="Check the connection and try again."
          actionLabel="Retry"
          onAction={onRetryStaff}
        />
      ) : members.length === 0 ? (
        <>
          <EmptyState
            className="lg:hidden"
            icon={<UserIcon className="h-5 w-5" />}
            title="No staff yet"
            description="Invite your first staff member to begin building the directory."
          />
          <EmptyState
            className="hidden lg:flex"
            icon={<UserIcon className="h-5 w-5" />}
            title="No staff yet"
            description="Invite your first staff member to begin building the directory."
            actionLabel={canManageStaff ? "Add staff" : undefined}
            onAction={
              canManageStaff ? () => onAddStaffOpenChange(true) : undefined
            }
          />
        </>
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-5 w-5" />}
          title="No staff match these filters"
          description="Change the search or filters to see other staff members."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <>
          <DataList className="lg:hidden">
            {filteredMembers.map((member) => {
              const setupState = staffSetupState(
                member.id,
                profileLoadState,
                profileUserIds,
              );
              const description = [
                staffRoleLabel(staffRole(member)),
                member.email || "No email",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ListRow
                  key={member.id}
                  role="button"
                  tabIndex={0}
                  interactive
                  leading={
                    <span className="font-semibold">
                      {member.name?.trim().charAt(0).toUpperCase() || "S"}
                    </span>
                  }
                  title={member.name || "Staff member"}
                  description={description}
                  meta={staffDirectoryStateLabel(member, setupState)}
                  onClick={() => onOpenMember(member)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenMember(member);
                    }
                  }}
                />
              );
            })}
          </DataList>

          <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-border bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Staff member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead className="w-[25%]">Contact</TableHead>
                  <TableHead className="w-14 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => {
                  const setupState = staffSetupState(
                    member.id,
                    profileLoadState,
                    profileUserIds,
                  );
                  return (
                    <TableRow
                      key={member.id}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer"
                      onClick={() => onOpenMember(member)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenMember(member);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                            {member.name?.trim().charAt(0).toUpperCase() || "S"}
                          </div>
                          <span className="min-w-0 truncate font-semibold">
                            {member.name || "Staff member"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{staffRoleLabel(staffRole(member))}</TableCell>
                      <TableCell>{desktopStatus(member)}</TableCell>
                      <TableCell>{setupBadge(setupState)}</TableCell>
                      <TableCell>
                        <span className="block max-w-[320px] truncate text-sm text-muted-foreground">
                          {member.email || "No email"}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl"
                              aria-label={`Actions for ${member.name || "staff member"}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onOpenMember(member)}
                            >
                              <UserIcon className="mr-2 h-4 w-4" />
                              Open staff member
                            </DropdownMenuItem>
                            {canManageStaff ? (
                              <>
                                {setupState === "needs_setup" ? (
                                  <DropdownMenuItem
                                    onClick={() => onSetupProfile(member)}
                                  >
                                    <Wallet className="mr-2 h-4 w-4" />
                                    Set up staff profile
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  onClick={() => onEditMember(member)}
                                >
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Edit staff
                                </DropdownMenuItem>
                                {!staffRole(member)
                                  .toLowerCase()
                                  .includes("admin") ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onRemoveMember(member)}
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    Remove from restaurant
                                  </DropdownMenuItem>
                                ) : null}
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {loadState === "loaded" && members.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">Staff directory</span>
            <span>
              {counts.active} active
              {counts.inactive > 0 ? ` · ${counts.inactive} inactive` : ""}
              {` · ${members.length} total`}
            </span>
          </div>
          {setupAttention != null && setupAttention > 0 ? (
            <button
              type="button"
              className="font-medium text-amber-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
              onClick={() =>
                onFiltersChange({ ...filters, setup: "needs_setup" })
              }
            >
              {setupAttention} need setup
            </button>
          ) : null}
        </div>
      ) : null}

      {canManageStaff ? (
        <MobileCreateFab
          label="Add staff"
          onClick={() => onAddStaffOpenChange(true)}
        />
      ) : null}

      <Sheet open={addStaffOpen} onOpenChange={onAddStaffOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-none overflow-y-auto p-0 sm:max-w-3xl lg:max-w-5xl"
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 text-left sm:px-5 sm:py-4">
            <SheetTitle>Add staff</SheetTitle>
            <SheetDescription>
              Invite staff directly or let them request access with the join
              code.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-0 px-4 py-4 sm:px-5 sm:py-5">
            <section className="space-y-3 border-b border-border pb-3 lg:flex lg:items-center lg:justify-between lg:gap-6 lg:space-y-0">
              <div>
                <h3 className="text-sm font-semibold">Invite by email</h3>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  Send a verified-email invitation and assign the intended role.
                </p>
              </div>
              <Button
                id="staff-invite-by-email"
                type="button"
                className="h-11 w-full rounded-xl sm:w-auto"
                onClick={beginEmailInvite}
              >
                <Mail className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </section>

            <StaffJoinCodePanel canManage={canManageStaff} compactMobile />

            <section className="space-y-3 border-b border-border py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Pending requests</h3>
                {accessRequestLoadState === "loaded" &&
                pendingAccessRequests != null ? (
                  <span className="text-xs text-muted-foreground">
                    {pendingAccessRequests}
                  </span>
                ) : null}
              </div>

              {accessRequestLoadState === "loading" ? (
                <LoadingState label="Loading requests…" className="min-h-16" />
              ) : accessRequestLoadState === "error" ? (
                <ErrorState
                  title="Requests could not be loaded"
                  description="Open the access queue to try again."
                />
              ) : pendingAccessRequests && pendingAccessRequests > 0 ? (
                <DataList>
                  <Link href="/staff/join-requests" className="block">
                    <ListRow
                      interactive
                      leading={<Shield className="h-4 w-4" />}
                      title="Review access requests"
                      description="Assign roles, approve, or reject requests"
                      meta={`${pendingAccessRequests} pending`}
                    />
                  </Link>
                </DataList>
              ) : (
                <div className="space-y-1 py-1">
                  <p className="text-sm font-medium text-foreground">
                    No pending requests
                  </p>
                  <p className="text-xs leading-4 text-muted-foreground">
                    New join requests will appear after staff scan the join
                    code.
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-3 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Invitations</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Track verified-email invitations and their expiry.
                  </p>
                </div>
                {invitationLoadState === "loaded" ? (
                  <span className="text-xs text-muted-foreground">
                    {pendingInvitations} pending · {invitations.length} total
                  </span>
                ) : null}
              </div>

              {invitationLoadState === "loading" ? (
                <LoadingState
                  label="Loading invitations…"
                  className="min-h-16"
                />
              ) : invitationLoadState === "error" ? (
                <ErrorState
                  title="Invitations could not be loaded"
                  description="Check the connection and try again."
                  actionLabel="Retry"
                  onAction={onRetryInvitations}
                />
              ) : invitations.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">
                  No invitations yet.
                </p>
              ) : (
                <>
                  <DataList className="lg:hidden">
                    {invitations.map((invitation) => (
                      <ListRow
                        key={invitation.id}
                        leading={<Mail className="h-4 w-4" />}
                        title={invitation.name || invitation.email}
                        description={invitationDescription(invitation)}
                        meta={invitationStatusLabel(invitation.status)}
                        action={invitationActions(
                          invitation,
                          busyInvitationId === invitation.id,
                          onResendInvitation,
                          onRevokeInvitation,
                        )}
                      />
                    ))}
                  </DataList>

                  <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-border bg-card lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invitee</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="w-14 text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {invitation.name || "Invited staff member"}
                                </p>
                                <p className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">
                                  {invitation.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {staffRoleLabel(
                                invitation.selected_role || "staff",
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {invitationStatusLabel(invitation.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invitation.expires_at
                                ? formatDate(invitation.expires_at)
                                : "Unavailable"}
                            </TableCell>
                            <TableCell className="text-right">
                              {invitationActions(
                                invitation,
                                busyInvitationId === invitation.id,
                                onResendInvitation,
                                onRevokeInvitation,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
