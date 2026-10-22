"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  Loader2,
  Mail,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { RestaurantJoinApis, RoleApis } from "@/lib/api/endpoints";
import { addMembershipEventListener } from "@/lib/restaurant-membership";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { StaffJoinCodePanel } from "@/components/staff/staff-join-code-panel";

type JoinRequest = {
  id: number;
  user_id?: number;
  user_name: string;
  user_email: string;
  created_at?: string;
};

type Invitation = {
  id: number;
  email: string;
  name: string;
  code: string;
  selected_role?: string;
  status: string;
  created_at?: string;
  expires_at?: string;
};

type RoleOption = { value: string; label: string };

function dateLabel(value?: string) {
  return formatDate(value);
}

export default function JoinRequestsPage() {
  const user = useAuth((state) => state.user);
  const canManageRequests = hasPermission(user, "admin.staff.manage");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);
  const [extensionDays, setExtensionDays] = useState<Record<number, string>>(
    {},
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!canManageRequests) {
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const [requestRes, invitationRes, customRes, builtInRes] =
          await Promise.all([
            apiClient.get(RestaurantJoinApis.request),
            apiClient.get(RestaurantJoinApis.invitations),
            apiClient.get(RoleApis.listRoles),
            apiClient.get(RoleApis.listBuiltInRoles),
          ]);
        setRequests(requestRes.data?.data || []);
        setInvitations(invitationRes.data?.data || []);
        const custom = (customRes.data?.data || []).map(
          (role: { id: number; name: string }) => ({
            value: `custom:${role.id}`,
            label: role.name,
          }),
        );
        const blocked = new Set([
          "admin",
          "administrator",
          "superadmin",
          "super_admin",
          "platform_staff",
          "captain",
        ]);
        const builtIn = Object.keys(builtInRes.data?.data || {})
          .filter((name) => !blocked.has(name.toLowerCase()))
          .map((name) => ({ value: `built:${name}`, label: name }));
        setRoles([...builtIn, ...custom]);
      } catch (error: unknown) {
        toast.error(
          getApiErrorMessage(error, "Unable to load restaurant access"),
        );
      } finally {
        setLoading(false);
      }
    },
    [canManageRequests],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () =>
      addMembershipEventListener((detail) => {
        if (
          [
            "join_request.created",
            "join_request.cancelled",
            "invitation.accepted",
            "invitation.declined",
          ].includes(detail.event)
        ) {
          void load(true);
          if (detail.event === "join_request.created")
            toast.info("A new join request arrived");
        }
      }),
    [load],
  );

  const approve = async (request: JoinRequest) => {
    const value = selected[request.id];
    if (!value) return toast.error("Select a role before approving");
    const payload = value.startsWith("custom:")
      ? { custom_role_id: Number(value.slice(7)) }
      : { role: value.slice(6) };
    setBusyRequestId(request.id);
    try {
      await apiClient.post(RestaurantJoinApis.approve(request.id), payload);
      toast.success("Access approved and role assigned");
      await load(true);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to approve this request"));
    } finally {
      setBusyRequestId(null);
    }
  };

  const reject = async (request: JoinRequest) => {
    setBusyRequestId(request.id);
    try {
      await apiClient.post(RestaurantJoinApis.reject(request.id));
      toast.success("Join request rejected");
      await load(true);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to reject this request"));
    } finally {
      setBusyRequestId(null);
    }
  };

  const revoke = async (invitation: Invitation) => {
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.revokeInvitation(invitation.id));
      toast.success("Invitation revoked");
      await load(true);
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(error, "Unable to revoke this invitation"),
      );
    } finally {
      setBusyInvitationId(null);
    }
  };

  const resend = async (invitation: Invitation) => {
    const days = Number(extensionDays[invitation.id] || 7);
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.resendInvitation(invitation.id), {
        extend_days: days,
      });
      toast.success(`Replacement invitation sent with ${days} new days`);
      await load(true);
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

  const pendingInvitations = useMemo(
    () => invitations.filter((item) => item.status === "pending"),
    [invitations],
  );

  if (!canManageRequests) {
    return (
      <AppPage width="standard" className="flex min-h-[60vh] items-center">
        <Card className="w-full rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Access restricted
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You need staff management permission to review join requests or
            manage invitations.
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage width="wide" className="space-y-7 pb-20 lg:space-y-8">
      <PageHeader
        className="hidden lg:flex"
        title="Restaurant access"
        description="Manage the QR entry point, access requests, and email invitations."
        backHref="/staff"
      />

      <StaffJoinCodePanel canManage={canManageRequests} />

      <div className="grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="rounded-xl shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending requests</CardTitle>
                <CardDescription>
                  Choose the least-privileged role needed before approval.
                </CardDescription>
              </div>
              <Badge>{requests.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !requests.length ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading requests…
              </div>
            ) : null}
            {!loading && !requests.length ? (
              <EmptyAccessState
                icon={UserCheck}
                title="Queue is clear"
                description="New join requests appear here instantly."
              />
            ) : null}
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                    {request.user_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {request.user_name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {request.user_email}
                    </p>
                    {request.created_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {dateLabel(request.created_at)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Select
                    value={selected[request.id]}
                    onValueChange={(value) =>
                      setSelected((current) => ({
                        ...current,
                        [request.id]: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={busyRequestId === request.id}
                    onClick={() => void reject(request)}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    disabled={busyRequestId === request.id}
                    onClick={() => void approve(request)}
                  >
                    {busyRequestId === request.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email invitations</CardTitle>
                <CardDescription>
                  Resending replaces the old code and starts a fresh expiry
                  window.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {pendingInvitations.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && !invitations.length ? (
              <EmptyAccessState
                icon={Mail}
                title="No invitations"
                description="Verified-email staff invitations appear here."
              />
            ) : null}
            {invitations.map((invitation) => {
              const busy = busyInvitationId === invitation.id;
              return (
                <div key={invitation.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {invitation.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {invitation.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            invitation.status === "pending"
                              ? "default"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {invitation.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {invitation.selected_role || "staff"}
                        </span>
                        {invitation.expires_at && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {dateLabel(invitation.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {invitation.status === "pending" && (
                      <p className="font-mono text-xs font-semibold tracking-wide">
                        {invitation.code}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-[100px_1fr] gap-2">
                    <div>
                      <Label className="sr-only">Extension</Label>
                      <Select
                        value={extensionDays[invitation.id] || "7"}
                        onValueChange={(value) =>
                          setExtensionDays((current) => ({
                            ...current,
                            [invitation.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">+7 days</SelectItem>
                          <SelectItem value="14">+14 days</SelectItem>
                          <SelectItem value="30">+30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void resend(invitation)}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      {invitation.status === "pending"
                        ? "Replace & resend"
                        : "Send replacement"}
                    </Button>
                  </div>
                  {invitation.status === "pending" && (
                    <Button
                      className="mt-2 w-full text-muted-foreground hover:text-destructive"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void revoke(invitation)}
                    >
                      Revoke invitation
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppPage>
  );
}

function EmptyAccessState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
