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
    Check,
    X
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
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRemoving, setIsRemoving] = useState<number | null>(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "" });
    const [isInviting, setIsInviting] = useState(false);

    const fetchAdmins = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(AdminManagementApis.restaurantAdmins(restaurantId));
            if (response.data.status === 'success') {
                setAdmins(response.data.data);
            }
        } catch (err) {
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
        if (!confirm("Are you sure you want to remove this administrator's access to this restaurant?")) return;
        
        try {
            setIsRemoving(adminId);
            const response = await apiClient.delete(AdminManagementApis.removeAdmin(restaurantId, adminId));
            if (response.data.status === 'success') {
                toast.success("Administrator removed");
                setAdmins(prev => prev.filter(a => a.id !== adminId));
            }
        } catch (err) {
            toast.error("Failed to remove administrator");
        } finally {
            setIsRemoving(null);
        }
    };

    const handleInviteAdmin = async () => {
        if (!inviteForm.name || !inviteForm.email || !inviteForm.password) {
            toast.error("Please fill in all fields");
            return;
        }

        try {
            setIsInviting(true);
            const response = await apiClient.post(AdminManagementApis.restaurantAdmins(restaurantId), inviteForm);
            if (response.data.status === 'success') {
                toast.success("Administrator invited successfully");
                setIsInviteOpen(false);
                setInviteForm({ name: "", email: "", password: "" });
                fetchAdmins();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to invite administrator");
        } finally {
            setIsInviting(false);
        }
    };

    const filteredAdmins = admins.filter(admin => 
        admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                <Button size="sm" onClick={() => setIsInviteOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Admin
                </Button>
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
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {admin.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{admin.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{admin.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        {admin.is_owner ? (
                                            <Badge variant="default" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] h-5 font-bold uppercase tracking-wider">
                                                Owner
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="capitalize text-[10px] h-5 opacity-70">
                                                Administrator
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-2.5">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem 
                                                    onClick={() => handleRemoveAdmin(admin.id)}
                                                    className="text-destructive focus:text-destructive"
                                                    disabled={isRemoving === admin.id}
                                                >
                                                    {isRemoving === admin.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                                    Remove Access
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        {/* Invite Admin Dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Invite Administrator</DialogTitle>
                    <p className="text-xs text-muted-foreground font-medium">Add a new admin who can manage this restaurant dashboard.</p>
                </DialogHeader>
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
                    <div className="grid gap-2">
                        <Label htmlFor="pass" className="text-[10px] font-black uppercase tracking-widest opacity-60">Initial Password</Label>
                        <Input 
                            id="pass" 
                            type="password"
                            value={inviteForm.password}
                            onChange={(e) => setInviteForm({...inviteForm, password: e.target.value})}
                            placeholder="••••••••" 
                            className="font-bold border-border/40"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsInviteOpen(false)}
                        className="h-10 font-bold border-border/40"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleInviteAdmin} 
                        disabled={isInviting}
                        className="h-10 font-black uppercase tracking-tighter italic"
                    >
                        {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                        Send Invitation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
    );
}
