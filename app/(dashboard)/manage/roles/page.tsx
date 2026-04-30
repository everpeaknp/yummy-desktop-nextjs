"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { RoleApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  Plus, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowLeft, 
  MoreVertical, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Permission {
  id: number;
  key: string;
  module: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  is_system_role: boolean;
  permissions: string[];
}

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[]
  });

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) {
        router.push('/');
        return;
      }
      fetchData();
    };
    init();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiClient.get(RoleApis.listRoles),
        apiClient.get(RoleApis.listPermissions)
      ]);

      if (rolesRes.data.status === "success") {
        setRoles(rolesRes.data.data || []);
      }
      if (permsRes.data.status === "success") {
        setPermissions(permsRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch roles/permissions:", err);
      toast.error("Failed to load roles and permissions data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (role: Role | null = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions || []
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        permissions: []
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Role name is required");
    
    setSubmitting(true);
    let payloadForDebug: any = null;
    try {
      // Backend OpenAPI: RoleCreate / RoleUpdate accept { name, description, permissions: string[] }.
      const payload: any = {
        name: formData.name.trim(),
        description: (formData.description || "").trim(),
        permissions: formData.permissions,
      };
      payloadForDebug = payload;

      if (editingRole) {
        await apiClient.put(RoleApis.updateRole(editingRole.id), payload);
        toast.success("Role updated successfully");
      } else {
        await apiClient.post(RoleApis.createRole, payload);
        toast.success("New role created successfully");
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error("Failed to save role:", { status, data, payload: payloadForDebug, err });
      const detail = data?.detail || data?.message;
      if (typeof detail === "string" && detail.trim()) toast.error(detail);
      else if (typeof data === "string" && data.trim()) toast.error(data.slice(0, 200));
      else toast.error("Failed to save role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) return toast.error("System roles cannot be deleted");
    
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;

    try {
      await apiClient.delete(RoleApis.deleteRole(role.id));
      toast.success("Role deleted successfully");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete role");
    }
  };

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key) 
        ? prev.permissions.filter(k => k !== key)
        : [...prev.permissions, key]
    }));
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc: Record<string, Permission[]>, perm) => {
    const module = perm.module || "General";
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              Role Management
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 ml-2 font-bold uppercase tracking-widest text-[10px]">Beta</Badge>
            </h1>
            <p className="text-muted-foreground font-medium">Define custom roles and manage granular access permissions.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Search roles..." 
               className="pl-9 bg-card/40 border-border/40 focus:border-primary/50"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
          <Button className="bg-primary font-bold shadow-lg shadow-primary/20" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" /> New Role
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-bold tracking-widest uppercase text-xs">Initializing Permissions...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className={cn(
              "group relative overflow-hidden border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5",
              role.is_system_role && "border-l-4 border-l-blue-500"
            )}>
              <CardHeader className="p-6 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-black">{role.name}</CardTitle>
                      {role.is_system_role && (
                        <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-200 uppercase text-[9px] font-black tracking-tighter">System</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs font-medium h-8">
                      {role.description || "No description provided."}
                    </CardDescription>
                  </div>
                  {!role.is_system_role && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => handleOpenDialog(role)}>
                          <Edit className="w-4 h-4 mr-2" /> Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteRole(role)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                   <span>Permissions</span>
                   <span className="text-foreground">{role.permissions?.length || 0}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 h-[68px] overflow-hidden relative">
                  {(role.permissions || []).slice(0, 8).map(p => (
                    <Badge key={p} variant="secondary" className="bg-muted/50 text-[10px] font-medium border-transparent">
                      {p.replace(/\./g, ' ')}
                    </Badge>
                  ))}
                  {(role.permissions || []).length > 8 && (
                    <span className="text-[10px] font-bold text-muted-foreground/80 self-center">
                       + {(role.permissions || []).length - 8} more
                    </span>
                  )}
                  {(!role.permissions || role.permissions.length === 0) && (
                    <p className="text-[11px] italic text-muted-foreground mt-2">No permissions assigned.</p>
                  )}
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-border/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                       <Users className="w-3.5 h-3.5" />
                       <span>Assigned to 0 staff</span>
                    </div>
                    <Button variant="link" className="text-[11px] font-black uppercase text-primary p-0 h-auto" onClick={() => handleOpenDialog(role)}>
                        Detail View
                    </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* New Role Placeholder */}
          <button 
            onClick={() => handleOpenDialog()}
            className="group relative h-full min-h-[220px] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Add Custom Role</span>
          </button>
        </div>
      )}

      {/* Role Dialog (Custom Modal)
          Radix Dialog/Presence has been triggering an infinite ref/update loop in dev on this page.
          This lightweight modal avoids that entire class of issues. */}
      {isDialogOpen ? (
        <SimpleModal
          onClose={() => setIsDialogOpen(false)}
          className="w-full max-w-[700px] p-0 overflow-hidden bg-card border border-border/40 shadow-2xl rounded-lg"
        >
          <form onSubmit={handleSaveRole}>
            <div className="p-8 pb-4 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-black">
                  {editingRole ? `Edit Role: ${editingRole.name}` : "Create New Custom Role"}
                </h2>
                <p className="text-sm text-muted-foreground font-medium">
                  Custom roles allow you to define precise access levels for your staff members.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="role-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Role Name</Label>
                  <Input 
                    id="role-name" 
                    placeholder="e.g., Inventory Manager" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-muted/50 border-border/40 focus:border-primary/50 h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-desc" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</Label>
                  <Input 
                    id="role-desc" 
                    placeholder="Briefly describe what this role can do" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="bg-muted/50 border-border/40 focus:border-primary/50 h-11"
                  />
                </div>
              </div>
            </div>

            <div className="px-8 pb-4">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> 
                  Permission Selection ({formData.permissions.length} selected)
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="h-6 text-[9px] font-black uppercase tracking-tighter" onClick={() => setFormData({...formData, permissions: permissions.map(p => p.key)})}>Select All</Button>
                  <Button type="button" variant="ghost" className="h-6 text-[9px] font-black uppercase tracking-tighter" onClick={() => setFormData({...formData, permissions: []})}>Clear All</Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl border border-border/20">
                {/* Avoid Radix ScrollArea here: it has caused presence/ref loops in some dev setups. */}
                <div className="h-[400px] w-full overflow-y-auto p-6 pr-5 custom-scrollbar">
                  <div className="space-y-8">
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module} className="space-y-4">
                        <div className="flex items-center gap-4">
                           <h3 className="text-[13px] font-black uppercase tracking-widest text-foreground shrink-0">{module}</h3>
                           <div className="h-[1px] w-full bg-border/20"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                          {perms.map((perm) => (
                            <div 
                              key={perm.key} 
                              className={cn(
                                "flex items-start gap-4 p-3 rounded-lg border border-transparent transition-all cursor-pointer hover:bg-white/5 hover:border-border/40",
                                formData.permissions.includes(perm.key) && "bg-white/5 border-primary/20"
                              )}
                            >
                              <input
                                id={`perm-${perm.id}`}
                                type="checkbox"
                                checked={formData.permissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                                className="mt-1 h-4 w-4 rounded-sm border border-primary bg-transparent accent-primary"
                              />
                              <div className="space-y-1">
                                <label 
                                  htmlFor={`perm-${perm.id}`} 
                                  className="text-[13px] font-bold leading-none cursor-pointer group-hover:text-primary transition-colors"
                                >
                                  {perm.key.replace(/\./g, ' ')}
                                </label>
                                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                                  {perm.description || `Grants access to ${perm.key} features.`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-muted/20 border-t border-border/20 pt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" className="font-black uppercase tracking-widest text-xs" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary font-black uppercase tracking-widest text-xs h-11 px-8 shadow-lg shadow-primary/20" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingRole ? "Update Role" : "Create Custom Role"}
              </Button>
            </div>
          </form>
        </SimpleModal>
      ) : null}
    </div>
  );
}

function SimpleModal({
  onClose,
  children,
  className,
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Lock scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/80"
        onMouseDown={() => onClose()}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn("relative", className)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={onClose}
          >
            <span className="text-xl leading-none">×</span>
          </button>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
