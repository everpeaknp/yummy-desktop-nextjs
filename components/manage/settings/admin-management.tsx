"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    Users, 
    UserPlus, 
    Trash2, 
    Shield, 
    MoreVertical, 
    Search,
    Loader2,
    Copy,
    Crown
} from "lucide-react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { AdminManagementApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";

interface Admin {
    id: number;
    name: string;
    email: string;
    role: string;
    is_owner: boolean;
    photo_url: string | null;
}

interface AdminManagementProps {
    restaurantId: number;
}

export function AdminManagement({ restaurantId }: AdminManagementProps) {
    const currentUser = useAuth((state) => state.user);
    const currentUserId = currentUser?.id;
    const canManageAdmins = hasPermission(currentUser, "admin.staff.manage");
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRemoving, setIsRemoving] = useState<number | null>(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: "", email: "" });
    const [invitationResult, setInvitationResult] = useState<{ message: string; code: string } | null>(null);
    const [isInviting, setIsInviting] = useState(false);
    const [isTransferring, setIsTransferring] = useState<number | null>(null);

    const fetchAdmins = useCallback(async () => {
        try {
            setLoading(true);
            setForbidden(false);
            const response = await apiClient.get(AdminManagementApis.restaurantAdmins(restaurantId));
            if (response.data.status === 'success') {
                setAdmins(response.data.data);
            }
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 403) {
                setForbidden(true);
                setAdmins([]);
                return;
            }
            console.error('Failed to fetch admins:', err);
            toast.error("Failed to load restaurant admins");
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    const handleRemoveAdmin = async (adminId: number) => {
        if (!canManageAdmins) {
            toast.error("You do not have permission to manage administrators");
            return;
        }
        const target = admins.find((admin) => admin.id === adminId);
        if (!target || target.is_owner || target.id === currentUserId) {
            toast.error("The owner and your own administrator access cannot be removed here");
            return;
        }
        if (!confirm("Are you sure you want to remove this administrator's access to this restaurant?")) return;
        
        try {
            setIsRemoving(adminId);
            const response = await apiClient.delete(AdminManagementApis.removeAdmin(restaurantId, adminId));
            if (response.data.status === 'success') {
                toast.success("Administrator removed");
                setAdmins(prev => prev.filter(a => a.id !== adminId));
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || err.response?.data?.message || "Failed to remove administrator");
        } finally {
            setIsRemoving(null);
        }
    };

    const handleInviteAdmin = async () => {
        if (!canManageAdmins) {
            toast.error("You do not have permission to manage administrators");
            return;
        }
        if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
            toast.error("Name and email are required");
            return;
        }

        try {
            setIsInviting(true);
            const response = await apiClient.post(AdminManagementApis.restaurantAdmins(restaurantId), {
                name: inviteForm.name.trim(),
                email: inviteForm.email.trim(),
            });
            if (response.data.status === 'success') {
                const message = response.data.message || "Administrator invitation created";
                const code = String(response.data.data?.code || response.data.code || "");
                setInvitationResult({ message, code });
                toast.success(message);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || err.response?.data?.message || "Failed to invite administrator");
        } finally {
            setIsInviting(false);
        }
    };

    const handleCopyInvitationCode = async () => {
        if (!invitationResult?.code) return;
        try {
            await navigator.clipboard.writeText(invitationResult.code);
            toast.success("Invitation code copied");
        } catch {
            toast.error("Could not copy automatically. Select and copy the code manually.");
        }
    };

    const handleTransferOwnership = async (admin: Admin) => {
        if (!viewerIsOwner) {
            toast.error("Only the restaurant owner can transfer ownership");
            return;
        }
        if (!confirm(`Transfer restaurant ownership to ${admin.name}? You will remain an administrator.`)) return;

        try {
            setIsTransferring(admin.id);
            const response = await apiClient.post(
                AdminManagementApis.transferOwnership(restaurantId),
                { new_owner_id: admin.id },
            );
            toast.success(response.data?.message || `Ownership transferred to ${admin.name}`);
            await fetchAdmins();
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to transfer ownership");
        } finally {
            setIsTransferring(null);
        }
    };

    const viewerIsOwner = admins.some((admin) => admin.id === currentUserId && admin.is_owner);

    const filteredAdmins = admins.filter(admin => 
        admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (forbidden) {
        return (
            <div className="py-8">
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-destructive/10 p-2">
                            <Shield className="h-5 w-5 text-destructive" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm">Access restricted</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Your role isn&apos;t allowed to view or manage restaurant administrators.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Loading administrators...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search admins..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                </div>
                {canManageAdmins && (
                    <Button size="sm" onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Admin
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                <h2 className="text-[11px] font-black tracking-[0.2em] text-muted-foreground/70 uppercase">
                    System Administrators
                </h2>
                <div className="border rounded-lg overflow-hidden border-border/40">
                <Table>
                    <TableHeader className="bg-muted/30 border-b border-border/40">
                        <TableRow>
                            <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60">User</TableHead>
                            <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60">Role</TableHead>
                            <TableHead className="text-right text-[10px] font-black tracking-widest uppercase opacity-60">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAdmins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                    {searchQuery ? "No admins match your search" : "No additional admins found"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAdmins.map((admin) => (
                                <TableRow key={admin.id}>
                                    <TableCell className="py-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden shrink-0">
                                                {admin.photo_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={admin.photo_url}
                                                        alt={admin.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    admin.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{admin.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{admin.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        {admin.is_owner ? (
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] h-5 font-bold uppercase tracking-wider"
                                            >
                                                Owner
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="capitalize text-[10px] h-5">
                                                Administrator
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-2.5">
                                        {(viewerIsOwner && !admin.is_owner) || (canManageAdmins && !admin.is_owner && admin.id !== currentUserId) ? <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {viewerIsOwner && !admin.is_owner && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleTransferOwnership(admin)}
                                                        disabled={isTransferring === admin.id}
                                                    >
                                                        {isTransferring === admin.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                                                        Transfer Ownership
                                                    </DropdownMenuItem>
                                                )}
                                                {canManageAdmins && !admin.is_owner && admin.id !== currentUserId && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleRemoveAdmin(admin.id)}
                                                        className="text-destructive focus:text-destructive"
                                                        disabled={isRemoving === admin.id}
                                                    >
                                                        {isRemoving === admin.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                                        Remove Access
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu> : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        {/* Invite Admin Dialog */}
        <Dialog
            open={isInviteOpen}
            onOpenChange={(open) => {
                setIsInviteOpen(open);
                if (!open) {
                    setInviteForm({ name: "", email: "" });
                    setInvitationResult(null);
                }
            }}
        >
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Invite Administrator</DialogTitle>
                    <p className="text-xs text-muted-foreground font-medium">The recipient must sign in with this verified email and accept the invitation before they become an admin.</p>
                </DialogHeader>
                {invitationResult ? (
                    <div className="grid gap-4 py-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-sm font-medium">{invitationResult.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">No administrator account or access has been created yet.</p>
                        </div>
                        {invitationResult.code && (
                            <div className="grid gap-2">
                                <Label htmlFor="admin-invitation-code" className="text-[10px] font-black uppercase tracking-widest opacity-60">Manual Invitation Code</Label>
                                <div className="flex gap-2">
                                    <Input id="admin-invitation-code" value={invitationResult.code} readOnly className="font-mono font-bold" />
                                    <Button type="button" variant="outline" size="icon" onClick={handleCopyInvitationCode} aria-label="Copy invitation code">
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Share this code securely if email delivery was unavailable.</p>
                            </div>
                        )}
                    </div>
                ) : (
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Full Name</Label>
                        <Input 
                            id="name" 
                            value={inviteForm.name}
                            onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                            placeholder="John Doe" 
                            className="font-bold border-border/40"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest opacity-60">Email Address</Label>
                        <Input 
                            id="email" 
                            type="email"
                            value={inviteForm.email}
                            onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                            placeholder="john@example.com" 
                            className="font-bold border-border/40"
                        />
                    </div>
                </div>
                )}
                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsInviteOpen(false)}
                        className="h-10 font-bold border-border/40"
                    >
                        {invitationResult ? "Close" : "Cancel"}
                    </Button>
                    {!invitationResult && (
                    <Button 
                        onClick={handleInviteAdmin} 
                        disabled={isInviting}
                        className="h-10 font-black uppercase tracking-tighter italic"
                    >
                        {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                        Send Invitation
                    </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
    );
}
