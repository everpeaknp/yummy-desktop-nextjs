"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { RestaurantJoinApis, RoleApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type JoinRequest = { id: number; user_name: string; user_email: string };
type Invitation = { id: number; email: string; name: string; code: string; selected_role?: string; status: string };
type RoleOption = { value: string; label: string };

export default function JoinRequestsPage() {
  const user = useAuth((state) => state.user);
  const canManageRequests = hasPermission(user, "admin.staff.manage");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [joinCode, setJoinCode] = useState("");
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!canManageRequests) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [requestRes, invitationRes, customRes, builtInRes] = await Promise.all([
        apiClient.get(RestaurantJoinApis.request), apiClient.get(RestaurantJoinApis.invitations),
        apiClient.get(RoleApis.listRoles), apiClient.get(RoleApis.listBuiltInRoles),
      ]);
      setRequests(requestRes.data?.data || []);
      setInvitations(invitationRes.data?.data || []);
      const custom = (customRes.data?.data || []).map((role: { id: number; name: string }) => ({ value: `custom:${role.id}`, label: role.name }));
      const blockedBuiltIns = new Set(["admin", "administrator", "superadmin", "super_admin", "platform_staff", "captain"]);
      const builtIn = Object.keys(builtInRes.data?.data || {})
        .filter((name) => !blockedBuiltIns.has(name.toLowerCase()))
        .map((name) => ({ value: `built:${name}`, label: name }));
      setRoles([...builtIn, ...custom]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to load restaurant access requests"));
    } finally {
      setLoading(false);
    }
  }, [canManageRequests]);
  useEffect(() => { void load(); }, [load]);

  const rotate = async () => {
    if (!canManageRequests) return;
    if (rotating) return;
    setRotating(true);
    try {
      const response = await apiClient.post(RestaurantJoinApis.rotateCode);
      const data = response.data.data;
      setJoinCode(data.code);
      setQr(await QRCode.toDataURL(data.qr_payload, { width: 260, margin: 1 }));
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to generate the restaurant join code"));
    } finally {
      setRotating(false);
    }
  };
  const approve = async (request: JoinRequest) => {
    if (!canManageRequests) return;
    const value = selected[request.id];
    if (!value) return toast.error("Select a role before approving");
    const payload = value.startsWith("custom:") ? { custom_role_id: Number(value.slice(7)) } : { role: value.slice(6) };
    setBusyRequestId(request.id);
    try {
      await apiClient.post(RestaurantJoinApis.approve(request.id), payload);
      toast.success("User approved and role assigned");
      await load();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to approve this request"));
    } finally {
      setBusyRequestId(null);
    }
  };

  const reject = async (request: JoinRequest) => {
    if (!canManageRequests) return;
    setBusyRequestId(request.id);
    try {
      await apiClient.post(RestaurantJoinApis.reject(request.id));
      toast.success("Join request rejected");
      await load();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to reject this request"));
    } finally {
      setBusyRequestId(null);
    }
  };

  const revoke = async (invitation: Invitation) => {
    if (!canManageRequests) return;
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.revokeInvitation(invitation.id));
      toast.success("Invitation revoked");
      await load();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to revoke this invitation"));
    } finally {
      setBusyInvitationId(null);
    }
  };

  if (!canManageRequests) {
    return <div className="mx-auto flex min-h-[60vh] max-w-xl items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Access restricted</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">You need staff management permission to review join requests or manage invitations.</CardContent>
      </Card>
    </div>;
  }

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Restaurant access</h1><p className="text-muted-foreground">Manage public join requests and verified-email invitations.</p></div>
    <Card><CardHeader><CardTitle>Join code and QR</CardTitle></CardHeader><CardContent className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">Rotating disables the previous code. Codes only create pending requests.</p>
      {qr && <><Image src={qr} alt="Restaurant join QR" width={256} height={256} unoptimized className="mx-auto h-64 w-64" /><p className="font-mono text-3xl font-bold tracking-widest">{joinCode}</p></>}
      <Button disabled={rotating} onClick={() => void rotate()}>{rotating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{rotating ? "Generating..." : joinCode ? "Rotate code" : "Generate code and QR"}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Pending join requests</CardTitle></CardHeader><CardContent className="space-y-3">
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading requests...</div>}
      {!loading && !requests.length && <p className="text-sm text-muted-foreground">No pending requests.</p>}
      {requests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center">
        <div className="flex-1"><b>{request.user_name}</b><p className="text-sm text-muted-foreground">{request.user_email}</p></div>
        <Select value={selected[request.id]} onValueChange={(value) => setSelected({ ...selected, [request.id]: value })}><SelectTrigger className="w-52"><SelectValue placeholder="Choose role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" disabled={busyRequestId === request.id} onClick={() => void reject(request)}>Reject</Button>
        <Button disabled={busyRequestId === request.id} onClick={() => void approve(request)}>{busyRequestId === request.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve</Button>
      </div>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Email invitations</CardTitle></CardHeader><CardContent className="space-y-3">
      {!loading && !invitations.length && <p className="text-sm text-muted-foreground">No invitations.</p>}
      {invitations.map((invitation) => <div key={invitation.id} className="flex items-center gap-3 rounded-lg border p-4"><div className="flex-1"><b>{invitation.name}</b><p className="text-sm text-muted-foreground">{invitation.email} · {invitation.selected_role} · {invitation.status}</p>{invitation.status === "pending" && <p className="mt-1 font-mono text-xs">Code: {invitation.code}</p>}</div>{invitation.status === "pending" && <Button variant="outline" disabled={busyInvitationId === invitation.id} onClick={() => void revoke(invitation)}>{busyInvitationId === invitation.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Revoke</Button>}</div>)}
    </CardContent></Card>
  </div>;
}
