"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  CalendarClock,
  Check,
  Copy,
  Download,
  Loader2,
  Mail,
  Printer,
  QrCode,
  RotateCw,
  Share2,
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
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasPermission } from "@/lib/role-permissions";
import { getImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] || character);
}

function dateLabel(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function JoinRequestsPage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const canManageRequests = hasPermission(user, "admin.staff.manage");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [joinCode, setJoinCode] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null);
  const [extensionDays, setExtensionDays] = useState<Record<number, string>>({});

  const displayJoinCode = useCallback(async (code: string, backendPayload?: string) => {
    if (!code) return;
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const universalLink = localHost
      ? `${window.location.origin}/join?code=${encodeURIComponent(code)}`
      : backendPayload || `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
    setJoinCode(code);
    setJoinLink(universalLink);
    setQr(await QRCode.toDataURL(universalLink, {
      width: 640,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }));
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!canManageRequests) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const [requestRes, invitationRes, customRes, builtInRes, codeRes] = await Promise.all([
        apiClient.get(RestaurantJoinApis.request),
        apiClient.get(RestaurantJoinApis.invitations),
        apiClient.get(RoleApis.listRoles),
        apiClient.get(RoleApis.listBuiltInRoles),
        apiClient.get(RestaurantJoinApis.currentCode).catch(() => null),
      ]);
      setRequests(requestRes.data?.data || []);
      setInvitations(invitationRes.data?.data || []);
      const custom = (customRes.data?.data || []).map((role: { id: number; name: string }) => ({
        value: `custom:${role.id}`,
        label: role.name,
      }));
      const blocked = new Set(["admin", "administrator", "superadmin", "super_admin", "platform_staff", "captain"]);
      const builtIn = Object.keys(builtInRes.data?.data || {})
        .filter((name) => !blocked.has(name.toLowerCase()))
        .map((name) => ({ value: `built:${name}`, label: name }));
      setRoles([...builtIn, ...custom]);
      const existingCode = String(codeRes?.data?.data?.code || "");
      if (existingCode) {
        await displayJoinCode(existingCode, String(codeRes?.data?.data?.qr_payload || ""));
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to load restaurant access"));
    } finally {
      setLoading(false);
    }
  }, [canManageRequests, displayJoinCode]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => addMembershipEventListener((detail) => {
    if (["join_request.created", "join_request.cancelled", "invitation.accepted", "invitation.declined"].includes(detail.event)) {
      void load(true);
      if (detail.event === "join_request.created") toast.info("A new join request arrived");
    }
  }), [load]);

  const rotate = async () => {
    if (!canManageRequests || rotating) return;
    if (joinCode && !window.confirm("Rotate the join code? Existing printed QR posters and copied links will stop working immediately.")) return;
    setRotating(true);
    try {
      const response = await apiClient.post(RestaurantJoinApis.rotateCode);
      const code = String(response.data?.data?.code || "");
      await displayJoinCode(code, String(response.data?.data?.qr_payload || ""));
      toast.success(joinCode ? "Join code rotated" : "Join QR created");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to generate the join code"));
    } finally {
      setRotating(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(joinLink);
    toast.success("Join link copied");
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Join ${restaurant?.name || "our restaurant"} on Yummy`,
        text: `Request access to ${restaurant?.name || "our restaurant"} using code ${joinCode}.`,
        url: joinLink,
      });
      return;
    }
    await copyLink();
  };

  const downloadQr = async () => {
    try {
      const loadImage = (source: string, crossOrigin = false) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = document.createElement("img");
        if (crossOrigin) image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fff7ed";
      context.fillRect(0, 0, canvas.width, 300);
      context.fillStyle = "#f97316";
      context.fillRect(0, 0, canvas.width, 18);

      const logoUrl = restaurant?.profile_picture ? getImageUrl(restaurant.profile_picture) : "";
      if (logoUrl) {
        try {
          const logo = await loadImage(logoUrl, true);
          const maxSize = 110;
          const scale = Math.min(maxSize / logo.naturalWidth, maxSize / logo.naturalHeight);
          const width = logo.naturalWidth * scale;
          const height = logo.naturalHeight * scale;
          context.drawImage(logo, (canvas.width - width) / 2, 52 + (maxSize - height) / 2, width, height);
        } catch {
          // Restaurant name still brands the poster if the remote image disallows canvas use.
        }
      }

      context.textAlign = "center";
      context.fillStyle = "#111827";
      context.font = "700 44px Arial";
      context.fillText(restaurant?.name || "Restaurant", canvas.width / 2, 220, 760);
      context.fillStyle = "#6b7280";
      context.font = "24px Arial";
      context.fillText("Scan with your phone camera to request access", canvas.width / 2, 268);

      const qrImage = await loadImage(qr);
      context.fillStyle = "#ffffff";
      context.fillRect(135, 325, 630, 630);
      context.drawImage(qrImage, 170, 360, 560, 560);
      context.fillStyle = "#111827";
      context.font = "800 52px monospace";
      context.fillText(joinCode, canvas.width / 2, 1010);
      context.fillStyle = "#4b5563";
      context.font = "22px Arial";
      context.fillText("Every request needs manager approval and a role assignment.", canvas.width / 2, 1070);
      context.fillStyle = "#9ca3af";
      context.font = "18px Arial";
      context.fillText(joinLink.length > 82 ? `${joinLink.slice(0, 79)}...` : joinLink, canvas.width / 2, 1125, 780);

      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `${safeFileName(restaurant?.name || "restaurant")}-join-poster.png`;
      anchor.click();
    } catch {
      toast.error("Unable to create the branded QR poster");
    }
  };

  const printQr = () => {
    const popup = window.open("", "_blank", "width=720,height=900");
    if (!popup) return toast.error("Allow popups to print the QR poster");
    const name = escapeHtml(restaurant?.name || "Restaurant");
    const logo = restaurant?.profile_picture ? escapeHtml(restaurant.profile_picture) : "";
    popup.document.write(`<!doctype html><html><head><title>${name} join QR</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#111827}.poster{text-align:center;border:1px solid #e5e7eb;border-radius:28px;padding:48px;width:480px}.logo{width:76px;height:76px;object-fit:contain;border-radius:18px;margin-bottom:18px}h1{font-size:30px;margin:0}p{color:#6b7280;font-size:16px}.qr{width:340px;height:340px}.code{font-family:monospace;font-size:34px;letter-spacing:8px;font-weight:800;margin:18px 0}.hint{font-size:13px}</style></head><body><main class="poster">${logo ? `<img class="logo" src="${logo}" alt="">` : ""}<h1>Join ${name}</h1><p>Scan with your phone camera, sign in, and request access.</p><img class="qr" src="${qr}" alt="Join QR"><div class="code">${escapeHtml(joinCode)}</div><p class="hint">A manager must approve every request and choose a role.</p></main><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

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
      toast.error(getApiErrorMessage(error, "Unable to revoke this invitation"));
    } finally {
      setBusyInvitationId(null);
    }
  };

  const resend = async (invitation: Invitation) => {
    const days = Number(extensionDays[invitation.id] || 7);
    setBusyInvitationId(invitation.id);
    try {
      await apiClient.post(RestaurantJoinApis.resendInvitation(invitation.id), { extend_days: days });
      toast.success(`Replacement invitation sent with ${days} new days`);
      await load(true);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Unable to replace and resend this invitation"));
    } finally {
      setBusyInvitationId(null);
    }
  };

  const pendingInvitations = useMemo(
    () => invitations.filter((item) => item.status === "pending"),
    [invitations],
  );

  if (!canManageRequests) {
    return <div className="mx-auto flex min-h-[60vh] max-w-xl items-center p-6"><Card className="w-full rounded-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Access restricted</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">You need staff management permission to review join requests or manage invitations.</CardContent></Card></div>;
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Badge variant="secondary" className="mb-3">Access center</Badge><h1 className="text-3xl font-bold tracking-tight">Restaurant access</h1><p className="mt-1 text-muted-foreground">Share one safe entry point, review applicants, and keep invitations current.</p></div><Badge variant="outline" className="w-fit gap-2 px-3 py-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live updates</Badge></header>

    <Card className="overflow-hidden rounded-3xl border-primary/15 shadow-sm"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="flex flex-col justify-center bg-gradient-to-br from-primary/10 via-background to-blue-500/10 p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><QrCode className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-bold">One QR, approval required</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">A phone camera opens the secure join link. Scanning never grants access by itself—the request remains pending until your team assigns a role.</p><Button className="mt-6 w-fit" disabled={rotating} onClick={() => void rotate()}>{rotating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}{joinCode ? "Rotate code" : "Generate join QR"}</Button></div><div className="flex min-h-80 items-center justify-center p-6 sm:p-8">{qr ? <div className="w-full max-w-sm text-center"><div className="mx-auto w-fit rounded-3xl border bg-white p-4 shadow-sm"><Image src={qr} alt={`${restaurant?.name || "Restaurant"} join QR`} width={280} height={280} unoptimized /></div><p className="mt-4 font-mono text-3xl font-black tracking-[0.22em]">{joinCode}</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Button size="sm" variant="outline" onClick={() => void copyLink()}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</Button><Button size="sm" variant="outline" onClick={() => void shareLink()}><Share2 className="mr-1.5 h-3.5 w-3.5" />Share</Button><Button size="sm" variant="outline" onClick={() => void downloadQr()}><Download className="mr-1.5 h-3.5 w-3.5" />Save</Button><Button size="sm" variant="outline" onClick={printQr}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button></div></div> : <div className="max-w-xs text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-dashed bg-muted/30"><QrCode className="h-9 w-9 text-muted-foreground" /></div><p className="mt-4 font-semibold">No active QR in this session</p><p className="mt-1 text-sm text-muted-foreground">Generate or rotate the code before downloading the branded poster.</p></div>}</div></div></Card>

    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="rounded-3xl"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Pending requests</CardTitle><CardDescription>Choose the least-privileged role needed before approval.</CardDescription></div><Badge>{requests.length}</Badge></div></CardHeader><CardContent className="space-y-3">{loading && !requests.length ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading requests…</div> : null}{!loading && !requests.length ? <EmptyAccessState icon={UserCheck} title="Queue is clear" description="New join requests appear here instantly." /> : null}{requests.map((request) => <div key={request.id} className="rounded-2xl border p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{request.user_name?.charAt(0).toUpperCase() || "?"}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{request.user_name}</p><p className="truncate text-sm text-muted-foreground">{request.user_email}</p>{request.created_at && <p className="mt-1 text-xs text-muted-foreground">Requested {dateLabel(request.created_at)}</p>}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><Select value={selected[request.id]} onValueChange={(value) => setSelected((current) => ({ ...current, [request.id]: value }))}><SelectTrigger><SelectValue placeholder="Choose role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={busyRequestId === request.id} onClick={() => void reject(request)}><UserX className="mr-2 h-4 w-4" />Reject</Button><Button disabled={busyRequestId === request.id} onClick={() => void approve(request)}>{busyRequestId === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button></div></div>)}</CardContent></Card>

      <Card className="rounded-3xl"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Email invitations</CardTitle><CardDescription>Resending replaces the old code and starts a fresh expiry window.</CardDescription></div><Badge variant="secondary">{pendingInvitations.length} active</Badge></div></CardHeader><CardContent className="space-y-3">{!loading && !invitations.length ? <EmptyAccessState icon={Mail} title="No invitations" description="Verified-email staff invitations appear here." /> : null}{invitations.map((invitation) => { const busy = busyInvitationId === invitation.id; return <div key={invitation.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{invitation.name}</p><p className="truncate text-sm text-muted-foreground">{invitation.email}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={invitation.status === "pending" ? "default" : "outline"} className="capitalize">{invitation.status}</Badge><span className="text-xs text-muted-foreground">{invitation.selected_role || "staff"}</span>{invitation.expires_at && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{dateLabel(invitation.expires_at)}</span>}</div></div>{invitation.status === "pending" && <p className="font-mono text-xs font-semibold tracking-wide">{invitation.code}</p>}</div><div className="mt-4 grid grid-cols-[100px_1fr] gap-2"><div><Label className="sr-only">Extension</Label><Select value={extensionDays[invitation.id] || "7"} onValueChange={(value) => setExtensionDays((current) => ({ ...current, [invitation.id]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">+7 days</SelectItem><SelectItem value="14">+14 days</SelectItem><SelectItem value="30">+30 days</SelectItem></SelectContent></Select></div><Button variant="outline" disabled={busy} onClick={() => void resend(invitation)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}{invitation.status === "pending" ? "Replace & resend" : "Send replacement"}</Button></div>{invitation.status === "pending" && <Button className="mt-2 w-full text-muted-foreground hover:text-destructive" size="sm" variant="ghost" disabled={busy} onClick={() => void revoke(invitation)}>Revoke invitation</Button>}</div>; })}</CardContent></Card>
    </div>
  </div>;
}

function EmptyAccessState({ icon: Icon, title, description }: { icon: typeof UserCheck; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><Icon className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
