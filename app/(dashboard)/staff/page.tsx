"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  StaffApis,
  RoleApis,
  StaffProfileApis,
  RestaurantJoinApis,
} from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { hasPermission } from "@/lib/role-permissions";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { StaffRegister } from "@/components/staff/staff-register";
import {
  type StaffDirectoryFilters,
  type StaffDirectoryLoadState,
  type StaffDirectoryMember,
  type StaffAccessRequestLoadState,
  type StaffInvitation,
  type StaffInvitationLoadState,
  type StaffProfileLoadState,
} from "@/lib/presentation/staff-directory";

type StaffProfile = {
  id: number;
  user_id: number;
  account_number: string;
  salary_type: string;
  salary_amount: number;
  weekly_hours?: number | null;
  daily_hours?: number | null;
};

export default function StaffPage() {
  const [staffLoadState, setStaffLoadState] =
    useState<StaffDirectoryLoadState>("loading");
  const [staff, setStaff] = useState<StaffDirectoryMember[]>([]);
  const [profileLoadState, setProfileLoadState] =
    useState<StaffProfileLoadState>("loading");
  const [pendingAccessRequests, setPendingAccessRequests] = useState<
    number | null
  >(null);
  const [accessRequestLoadState, setAccessRequestLoadState] =
    useState<StaffAccessRequestLoadState>("loading");
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [invitationLoadState, setInvitationLoadState] =
    useState<StaffInvitationLoadState>("loading");
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);
  const [staffProfilesByUserId, setStaffProfilesByUserId] = useState<
    Map<number, StaffProfile>
  >(new Map());
  const [filters, setFilters] = useState<StaffDirectoryFilters>({
    query: "",
    status: "all",
    role: "all",
    setup: "all",
  });
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "waiter",
    roles: ["waiter"] as string[],
    primary_role: "waiter",
  });
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const canManageStaff = hasPermission(user, "admin.staff.manage");

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchStaff = async () => {
    setStaffLoadState("loading");
    try {
      const response = await apiClient.get(StaffApis.list());
      if (response.data.status === "success") {
        const cleanedStaff = (response.data.data || []).map((s: any) => {
          const cleanRoles = (s.roles || []).filter(
            (r: string) => !r?.startsWith("__user_"),
          );
          let primaryRole = s.primary_role;
          if (!primaryRole || primaryRole.startsWith("__user_")) {
            primaryRole = cleanRoles[0] || s.role;
            if (primaryRole?.startsWith("__user_")) primaryRole = "waiter";
          }
          return {
            ...s,
            roles: cleanRoles.length > 0 ? cleanRoles : ["waiter"],
            primary_role: primaryRole || "waiter",
            role: primaryRole || "waiter",
          };
        });
        setStaff(cleanedStaff);
        setStaffLoadState("loaded");
        return;
      }
      throw new Error("Staff response was not successful");
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      setStaff([]);
      setStaffLoadState("error");
    }
  };

  const fetchStaffProfiles = async () => {
    setProfileLoadState("loading");
    try {
      const res = await apiClient.get(
        StaffProfileApis.list({ skip: 0, limit: 500 }),
      );
      if (res.data?.status === "success") {
        const profiles = (res.data.data || []) as StaffProfile[];
        const map = new Map<number, StaffProfile>();
        profiles.forEach((p) => map.set(p.user_id, p));
        setStaffProfilesByUserId(map);
        setProfileLoadState("loaded");
        return;
      }
      throw new Error("Staff profile response was not successful");
    } catch (err) {
      console.warn("Failed to fetch staff profiles", err);
      setStaffProfilesByUserId(new Map());
      setProfileLoadState("error");
      setFilters((current) => ({ ...current, setup: "all" }));
    }
  };

  const fetchPendingAccessRequests = async () => {
    if (!canManageStaff) {
      setPendingAccessRequests(null);
      setAccessRequestLoadState("loaded");
      return;
    }
    setAccessRequestLoadState("loading");
    try {
      const response = await apiClient.get(RestaurantJoinApis.request);
      if (response.data?.status !== "success") {
        throw new Error("Join request response was not successful");
      }
      const requests = Array.isArray(response.data.data)
        ? response.data.data
        : [];
      setPendingAccessRequests(requests.length);
      setAccessRequestLoadState("loaded");
    } catch (error) {
      console.warn("Failed to fetch pending staff access requests", error);
      setPendingAccessRequests(null);
      setAccessRequestLoadState("error");
    }
  };

  const fetchInvitations = async () => {
    if (!canManageStaff) {
      setInvitations([]);
      setInvitationLoadState("loaded");
      return;
    }
    setInvitationLoadState("loading");
    try {
      const response = await apiClient.get(RestaurantJoinApis.invitations);
      if (response.data?.status !== "success") {
        throw new Error("Invitation response was not successful");
      }
      setInvitations(
        Array.isArray(response.data.data) ? response.data.data : [],
      );
      setInvitationLoadState("loaded");
    } catch (error) {
      console.warn("Failed to fetch staff invitations", error);
      setInvitations([]);
      setInvitationLoadState("error");
    }
  };

  const fetchRoles = async () => {
    setRolesLoading(true);
    setRolesLoadError(null);
    try {
      // Try to load both custom roles and built-in roles (if supported).
      const [customRes, builtInRes] = await Promise.allSettled([
        apiClient.get(RoleApis.listRoles),
        apiClient.get((RoleApis as any).listBuiltInRoles || "/roles/built-in"),
      ]);

      const collect = (res: any) => {
        const payload = res?.data;
        if (!payload) return [] as any[];
        // Most endpoints: { status:"success", data: Role[] }
        if (payload?.status === "success") {
          if (Array.isArray(payload.data)) return payload.data;
          // Some variants: {data:{roles:[...]}}
          if (Array.isArray(payload.data?.roles)) return payload.data.roles;
          return [];
        }
        // Some endpoints may return raw arrays.
        if (Array.isArray(payload)) return payload;
        // Or {roles:[...]}
        if (Array.isArray(payload?.roles)) return payload.roles;
        return [];
      };

      const custom =
        customRes.status === "fulfilled" ? collect(customRes.value) : [];
      const builtIns =
        builtInRes.status === "fulfilled" ? collect(builtInRes.value) : [];

      // Fallback: ensure common system roles exist in UI even if backend doesn't return them.
      const defaultRoleNames = [
        "waiter",
        "cashier",
        "manager",
        "kitchen",
        "bar",
        "cafe",
        "barista",
        "accountant",
        "accounting_approver",
      ];
      const defaults = defaultRoleNames.map((name, idx) => ({
        id: `default-${idx}-${name}`,
        name,
        description: "",
        is_system_role: true,
        permissions: [],
      }));

      const merged = [
        ...(Array.isArray(builtIns) ? builtIns : []),
        ...(Array.isArray(custom) ? custom : []),
        ...defaults,
      ];
      const byName = new Map<string, any>();
      for (const r of merged) {
        const name = String(r?.name || "").trim();
        if (!name) continue;
        if (
          [
            "admin",
            "administrator",
            "superadmin",
            "super_admin",
            "platform_staff",
            "captain",
          ].includes(name.toLowerCase())
        )
          continue;
        // Prefer a "real" backend role over defaults.
        const existing = byName.get(name);
        if (!existing) byName.set(name, r);
        else if (
          String(existing?.id || "").startsWith("default-") &&
          !String(r?.id || "").startsWith("default-")
        ) {
          byName.set(name, r);
        }
      }

      // Keep the selected invitation role available if it is absent from the catalogue.
      for (const name of formData.roles || []) {
        const n = String(name || "").trim();
        if (!n) continue;
        if (!byName.has(n)) {
          byName.set(n, {
            id: `adhoc-${n}`,
            name: n,
            description: "",
            is_system_role: true,
            permissions: [],
          });
        }
      }

      const list = Array.from(byName.values()).sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
      setAvailableRoles(list);

      if (list.length === 0) {
        setRolesLoadError("No roles returned");
      }
    } catch (err) {
      console.error("Failed to fetch roles:", err);
      setAvailableRoles([]);
      setRolesLoadError("Failed to load roles");
      // Avoid noisy toasts on first load; the UI will show a retry affordance.
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchStaffProfiles();
    if (canManageStaff) {
      fetchPendingAccessRequests();
      fetchInvitations();
      fetchRoles();
    }
    // These loaders intentionally run once when staff-management access becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageStaff]);

  const handleOpenDialog = () => {
    setFormData({
      name: "",
      email: "",
      role: "waiter",
      roles: ["waiter"],
      primary_role: "waiter",
    });
    setIsDialogOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff) {
      toast.error("You do not have permission to manage staff");
      return;
    }
    setSubmitting(true);
    try {
      const selectedRoleObj = availableRoles.find(
        (r) => r.name === formData.primary_role,
      );

      const createPayload: any = {
        name: formData.name,
        email: formData.email,
      };

      const isCustomRole =
        selectedRoleObj?.is_system_role === false &&
        Number.isInteger(Number(selectedRoleObj.id));
      if (isCustomRole) {
        createPayload.custom_role_id = Number(selectedRoleObj.id);
      } else {
        createPayload.role = formData.primary_role;
      }

      const response = await apiClient.post(
        RestaurantJoinApis.invitations,
        createPayload,
      );
      const message =
        response.data?.message ||
        "Invitation created. No account was created until the recipient accepts.";
      const code = String(
        response.data?.data?.code || response.data?.code || "",
      );
      toast.success(message, {
        description: code ? `Manual invitation code: ${code}` : undefined,
        duration: code ? 10000 : undefined,
      });
      setIsDialogOpen(false);
      fetchStaff();
      fetchInvitations();
    } catch (err: any) {
      console.error(
        "Failed to save staff RAW DATA:",
        JSON.stringify(err.response?.data, null, 2),
      );
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        "Failed to save staff member";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStaff = async (id: number) => {
    if (!canManageStaff) {
      toast.error("You do not have permission to manage staff");
      return;
    }
    if (
      !confirm(
        "Remove this person from the restaurant? Their account stays active, and attendance and payroll history will be preserved.",
      )
    )
      return;
    try {
      await apiClient.delete(StaffApis.delete(id));
      toast.success(
        "Staff membership removed; account and history were preserved",
      );
      fetchStaff();
    } catch (err: any) {
      console.error("Failed to remove staff membership:", err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        "Failed to remove staff member";
      toast.error(errMsg);
    }
  };

  const handleResendInvitation = async (invitation: StaffInvitation) => {
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.resendInvitation(invitation.id), {
        extend_days: 7,
      });
      toast.success("Replacement invitation sent with 7 new days");
      await fetchInvitations();
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(
          error,
          "Unable to replace and resend this invitation",
        ),
      );
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleRevokeInvitation = async (invitation: StaffInvitation) => {
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.revokeInvitation(invitation.id));
      toast.success("Invitation revoked");
      await fetchInvitations();
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(error, "Unable to revoke this invitation"),
      );
    } finally {
      setBusyInvitationId(null);
    }
  };

  const profileUserIds = new Set(staffProfilesByUserId.keys());

  return (
    <AppPage width="register" className="-mt-1 pb-20 lg:mt-0 lg:pb-4">
      <PageHeader
        className="hidden lg:flex"
        title="Staff"
        description="Find staff members and manage their restaurant access."
        backHref="/manage"
      />

      <StaffRegister
        members={staff}
        loadState={staffLoadState}
        profileLoadState={profileLoadState}
        profileUserIds={profileUserIds}
        filters={filters}
        onFiltersChange={setFilters}
        invitations={invitations}
        invitationLoadState={invitationLoadState}
        busyInvitationId={busyInvitationId}
        pendingAccessRequests={pendingAccessRequests}
        accessRequestLoadState={accessRequestLoadState}
        addStaffOpen={addStaffOpen}
        onAddStaffOpenChange={setAddStaffOpen}
        canManageStaff={canManageStaff}
        onAddStaff={handleOpenDialog}
        onOpenMember={(member) => router.push(`/staff/${member.id}`)}
        onEditMember={(member) =>
          router.push(`/staff/${member.id}?edit=profile`)
        }
        onSetupProfile={(member) =>
          router.push(`/staff/${member.id}?edit=employment`)
        }
        onRemoveMember={(member) => handleRemoveStaff(member.id)}
        onResendInvitation={handleResendInvitation}
        onRevokeInvitation={handleRevokeInvitation}
        onRetryStaff={fetchStaff}
        onRetryInvitations={fetchInvitations}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
              <DialogDescription>
                Send an invitation. No account or access is created until the
                verified email owner accepts.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form
            onSubmit={handleSaveStaff}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="John Doe"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="john@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Assigned Roles
                  </Label>
                  <Link
                    href="/settings/roles"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    + Create / manage roles
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 border border-border/40 rounded-xl p-4 bg-muted/30">
                  {availableRoles.map((roleObj) => (
                    <div
                      key={roleObj.id}
                      className="flex items-center space-x-2 group"
                    >
                      <Checkbox
                        id={`role-${roleObj.name}`}
                        checked={formData.roles.includes(roleObj.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              roles: [roleObj.name],
                              primary_role: roleObj.name,
                            });
                          }
                        }}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-full"
                      />
                      <Label
                        htmlFor={`role-${roleObj.name}`}
                        className="text-xs font-bold capitalize cursor-pointer group-hover:text-primary transition-colors"
                      >
                        {roleObj.name}
                        {roleObj.is_system_role && (
                          <span className="ml-1 text-[8px] opacity-40 uppercase font-black">
                            Sys
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                  {rolesLoading && (
                    <p className="col-span-2 text-[10px] text-center text-muted-foreground italic py-2">
                      Loading roles...
                    </p>
                  )}
                  {!rolesLoading && rolesLoadError && (
                    <div className="col-span-2 flex flex-col items-center justify-center gap-2 py-2">
                      <p className="text-[10px] text-center text-muted-foreground italic">
                        {rolesLoadError}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={fetchRoles}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {!rolesLoading &&
                    !rolesLoadError &&
                    availableRoles.length === 0 && (
                      <p className="col-span-2 text-[10px] text-center text-muted-foreground italic py-2">
                        No roles available.
                      </p>
                    )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-muted/10 shrink-0">
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}
