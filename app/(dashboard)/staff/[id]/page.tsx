"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { StaffApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, Wallet, Clock, Shield, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { AuthApis } from "@/lib/api/endpoints";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function StaffDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any>(null);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submittingPerms, setSubmittingPerms] = useState(false);
  const user = useAuth(state => state.user);
  const router = useRouter();

  useEffect(() => {
    const fetchStaffDetail = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await apiClient.get(StaffApis.getStaff(id as string));
        if (response.data.status === "success") {
          const staffDetail = response.data.data;
          setStaff(staffDetail);
          setSelectedPermissions(staffDetail.permissions || []);
        }
      } catch (err) {
        console.error("Failed to fetch staff detail:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchPermissions = async () => {
      try {
        const response = await apiClient.get(AuthApis.listPermissions);
        if (response.data.status === "success") {
          setAvailablePermissions(response.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch permissions:", err);
      }
    };

    fetchStaffDetail();
    fetchPermissions();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to deactivate this staff member?")) return;
    try {
      await apiClient.delete(StaffApis.delete(id as string));
      toast.success("Staff member deactivated");
      router.push('/staff');
    } catch (err: any) {
      console.error("Failed to delete staff:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to deactivate staff member";
      toast.error(errMsg);
    }
  };

  const handleUpdatePermissions = async () => {
    setSubmittingPerms(true);
    try {
      await apiClient.post(AuthApis.updateUserPermissions(id as string), {
        permission_keys: selectedPermissions
      });
      toast.success("Permissions updated successfully");
      setIsPermDialogOpen(false);
      
      // Refresh staff data to get updated permissions
      const response = await apiClient.get(StaffApis.getStaff(id as string));
      if (response.data.status === "success") {
        setStaff(response.data.data);
      }
    } catch (err) {
      console.error("Failed to update permissions:", err);
      toast.error("Failed to update permissions");
    } finally {
      setSubmittingPerms(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6">
        <Link href="/staff">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
            <p className="text-muted-foreground">The staff record you are looking for does not exist or you don't have permission to view it.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{staff.name}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> {staff.primary_role || staff.role} • ID: #STF-{staff.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Deactivate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic contact and profile details.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={staff.email || "N/A"} />
            <InfoItem icon={<Calendar className="w-4 h-4" />} label="Joined Date" value={staff.created_at ? format(new Date(staff.created_at), 'MMMM dd, yyyy') : "N/A"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Primary Role" value={<Badge variant="outline" className="capitalize">{staff.primary_role || staff.role}</Badge>} />
            <InfoItem 
              icon={<Shield className="w-4 h-4" />} 
              label="All Roles" 
              value={
                <div className="flex flex-wrap gap-1 mt-1">
                  {(staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role || "Staff"]).map((r: string) => (
                    <Badge key={r} variant="secondary" className="capitalize text-[10px] py-0">{r}</Badge>
                  ))}
                </div>
              } 
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Security & Permissions</CardTitle>
              <CardDescription>Granular access control settings.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsPermDialogOpen(true)}>
              <Shield className="w-4 h-4 mr-2" /> Manage
            </Button>
          </CardHeader>
          <CardContent>
             <div className="flex flex-wrap gap-2">
               {staff.permissions && staff.permissions.length > 0 ? (
                 staff.permissions.map((p: string) => (
                   <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                     {p}
                   </Badge>
                 ))
               ) : (
                 <p className="text-sm text-muted-foreground italic">No customized permissions. User has default role-based access.</p>
               )}
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>Recent actions performed by this staff member.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-center py-8 text-muted-foreground">
               No recent activity logs found.
             </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPermDialogOpen} onOpenChange={setIsPermDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Granular Permissions</DialogTitle>
            <DialogDescription>
              Select specific permissions to grant or override defaults for {staff.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-[350px] pr-4">
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(
                  availablePermissions.reduce((acc: any, curr: any) => {
                    if (!acc[curr.module]) acc[curr.module] = [];
                    acc[curr.module].push(curr);
                    return acc;
                  }, {})
                ).map(([module, perms]: [string, any]) => (
                  <div key={module} className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                      {module}
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {perms.map((p: any) => (
                        <div key={p.key} className="flex items-start space-x-3">
                          <Checkbox 
                            id={`perm-detail-${p.key}`}
                            checked={selectedPermissions.includes(p.key)}
                            onCheckedChange={(checked) => {
                              setSelectedPermissions(prev => 
                                checked 
                                  ? [...prev, p.key] 
                                  : prev.filter(k => k !== p.key)
                              );
                            }}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`perm-detail-${p.key}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {p.key}
                            </label>
                            {p.description && (
                              <p className="text-xs text-muted-foreground">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePermissions} disabled={submittingPerms}>
              {submittingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: any, label: string, value: any }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
