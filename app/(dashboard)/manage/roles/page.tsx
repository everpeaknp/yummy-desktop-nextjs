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
  ArrowLeft, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Search,
  Check,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Permission {
  id?: number;
  key: string;
  module: string;
  description: string;
  title?: string | null;
  risk_level?: string | null;
}

interface Role {
  id: number;
  name: string;
  description: string;
  is_system_role: boolean;
  permissions: string[];
}

const ROLE_PRESET_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Operations manager",
  cashier: "Cashier",
  waiter: "Service staff",
  kitchen: "Kitchen staff",
  bar: "Bar staff",
  cafe: "Cafe staff",
  barista: "Barista",
  accountant: "Accountant",
  accounting_approver: "Finance approver",
  staff: "Team member",
};

const ROLE_PRESET_DESCRIPTIONS: Record<string, string> = {
  cashier: "Takes payments and manages the assigned checkout flow.",
  manager: "Runs day-to-day operations and supervises the team.",
  accountant: "Reviews finance, records, and accounting reports.",
  accounting_approver: "Reviews and approves controlled finance actions.",
  admin: "Full business administration and team management.",
  waiter: "Takes customer orders and supports table service.",
  kitchen: "Manages kitchen tickets and food preparation.",
  bar: "Manages bar orders and beverage service.",
  cafe: "Supports counter service and cafe operations.",
  barista: "Prepares drinks and manages cafe orders.",
  staff: "Basic access for a general team member.",
};

function readableRoleName(roleName: string) {
  return ROLE_PRESET_LABELS[roleName]
    || roleName.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableModuleName(moduleName: string) {
  const labels: Record<string, string> = {
    pos: "Point of sale",
    finance: "Finance",
    hotel: "Hotel",
    inventory: "Inventory",
    reports: "Reports",
    workforce: "Workforce",
  };
  return labels[moduleName.toLowerCase()]
    || moduleName.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readablePermission(key: string, permissions: Permission[]) {
  const permission = permissions.find((item) => item.key === key);
  return permission?.title || key.replaceAll(".", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [builtInPresets, setBuiltInPresets] = useState<Record<string, string[]>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState(false);

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
  }, [user, me, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, presetsRes] = await Promise.all([
        apiClient.get(RoleApis.listRoles),
        apiClient.get(RoleApis.listPermissions),
        apiClient.get(RoleApis.listBuiltInRoles),
      ]);

      if (rolesRes.data.status === "success") {
        setRoles(rolesRes.data.data || []);
      }
      if (permsRes.data.status === "success") {
        setPermissions(permsRes.data.data || []);
      }
      if (presetsRes.data.status === "success") {
        setBuiltInPresets(presetsRes.data.data || {});
      }
    } catch (err) {
      console.error("Failed to fetch roles/permissions:", err);
      toast.error("Failed to load roles and permissions data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (role: Role | null = null) => {
    setSelectedPreset(null);
    setShowPermissionEditor(Boolean(role));
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
      await useAuth.getState().syncUserProfile();
      await useAuth.getState().refreshSession();
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

  const applyPreset = (presetName: string) => {
    const presetPermissions = builtInPresets[presetName];
    if (!presetPermissions) return;
    setFormData((previous) => ({
      ...previous,
      permissions: [...presetPermissions],
      name: previous.name || `${readableRoleName(presetName)} copy`,
      description: previous.description || ROLE_PRESET_DESCRIPTIONS[presetName] || "Custom access based on a built-in role.",
    }));
    setSelectedPreset(presetName);
  };

  const createFromPreset = (presetName: string) => {
    const label = ROLE_PRESET_LABELS[presetName] || presetName.replaceAll("_", " ");
    setEditingRole(null);
    setFormData({
      name: `${label} copy`,
      description: ROLE_PRESET_DESCRIPTIONS[presetName] || "Custom access based on a built-in role.",
      permissions: [...(builtInPresets[presetName] || [])],
    });
    setSelectedPreset(presetName);
    setShowPermissionEditor(false);
    setIsDialogOpen(true);
  };

  const startBlankRole = () => {
    setSelectedPreset(null);
    setFormData((previous) => ({ ...previous, permissions: [] }));
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc: Record<string, Permission[]>, perm) => {
    const permissionModule = perm.module || "General";
    if (!acc[permissionModule]) acc[permissionModule] = [];
    acc[permissionModule].push(perm);
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
              Roles
            </h1>
            <p className="text-muted-foreground font-medium">Create clear job roles and give people the access they need to do their work.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Find a role..."
               className="pl-9 bg-card/40 border-border/40 focus:border-primary/50"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
          <Button className="bg-primary font-bold shadow-lg shadow-primary/20" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" /> Create role
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-bold tracking-widest uppercase text-xs">Initializing Permissions...</p>
        </div>
      ) : (
        <>
        {Object.keys(builtInPresets).length ? <section className="space-y-3"><div><h2 className="text-lg font-bold">Role templates</h2><p className="text-sm text-muted-foreground">Ready-to-use access for common jobs. Create a copy only when you need a variation.</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{Object.keys(builtInPresets).map((presetName) => <Card key={presetName} className="group border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold leading-5">{readableRoleName(presetName)}</p><p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{ROLE_PRESET_DESCRIPTIONS[presetName] || "Ready-to-use access template."}</p></div></div><div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5"><span className="text-[11px] text-muted-foreground">{builtInPresets[presetName].length} capabilities</span><Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs font-semibold text-primary hover:bg-primary/5" onClick={() => createFromPreset(presetName)}>Use template</Button></div></CardContent></Card>)}</div></section> : null}
        <section className="space-y-3"><div><h2 className="text-lg font-bold">Custom roles</h2><p className="text-sm text-muted-foreground">Roles created specifically for this business.</p></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className={cn(
              "group relative overflow-hidden border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5",
              role.is_system_role && "border-l-4 border-l-blue-500"
            )}>
              <CardHeader className="p-6 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-black">{readableRoleName(role.name)}</CardTitle>
                      {role.is_system_role && (
                        <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-200 uppercase text-[9px] font-black tracking-tighter">System</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs font-medium h-8">
                      {role.description || "Custom access for a specific job or responsibility."}
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
                   <span>Capabilities</span>
                   <span className="text-foreground">{role.permissions?.length || 0} included</span>
                </div>
                <div className="flex flex-wrap gap-1.5 h-[68px] overflow-hidden relative">
                  {(role.permissions || []).slice(0, 8).map(p => (
                    <Badge key={p} variant="secondary" className="bg-muted/50 text-[10px] font-medium border-transparent">
                      {readablePermission(p, permissions)}
                    </Badge>
                  ))}
                  {(role.permissions || []).length > 8 && (
                    <span className="text-[10px] font-bold text-muted-foreground/80 self-center">
                       + {(role.permissions || []).length - 8} more
                    </span>
                  )}
                  {(!role.permissions || role.permissions.length === 0) && (
                    <p className="text-[11px] italic text-muted-foreground mt-2">No access has been selected yet.</p>
                  )}
                </div>
                <div className="pt-4 flex items-center justify-between border-t border-border/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                       <ShieldCheck className="w-3.5 h-3.5" />
                       <span>Custom role</span>
                    </div>
                    <Button variant="link" className="text-[11px] font-black uppercase text-primary p-0 h-auto" onClick={() => handleOpenDialog(role)}>
                        Edit access
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
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Create a custom role</span>
          </button>
        </div></section></>
      )}

      {/* Role Dialog (Custom Modal)
          Radix Dialog/Presence has been triggering an infinite ref/update loop in dev on this page.
          This lightweight modal avoids that entire class of issues. */}
      {isDialogOpen ? (
        <SimpleModal
          onClose={() => setIsDialogOpen(false)}
          className="w-full max-w-[760px] p-0 overflow-hidden bg-card border border-border/40 shadow-2xl rounded-2xl"
        >
          <form onSubmit={handleSaveRole}>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-6 sm:p-8">
              <div className="mb-7 pr-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {editingRole ? `Edit ${readableRoleName(editingRole.name)}` : "Create a custom role"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start from a job template, then change only the access this role genuinely needs.
                </p>
              </div>

              {!editingRole ? <section className="mb-7">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Start with a built-in role</h3>
                      <p className="text-xs text-muted-foreground">Choose from all available roles, or start with no access.</p>
                    </div>
                    {selectedPreset ? <Button type="button" variant="ghost" size="sm" onClick={startBlankRole}>Start blank</Button> : null}
                  </div>
                  <Select value={selectedPreset || "blank"} onValueChange={(value) => value === "blank" ? startBlankRole() : applyPreset(value)}>
                    <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Choose a role template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Start with no template</SelectItem>
                      {Object.keys(builtInPresets).map((presetName) => <SelectItem key={presetName} value={presetName}>{readableRoleName(presetName)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                    {selectedPreset ? <><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span><strong className="font-medium text-foreground">{readableRoleName(selectedPreset)}</strong> includes {builtInPresets[selectedPreset]?.length || 0} capabilities. {ROLE_PRESET_DESCRIPTIONS[selectedPreset] || "You can adjust it below before saving."}</span></> : <><Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Starting blank means this role has no access until you choose it below.</span></>}
                  </div>
                </div>
              </section> : null}

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role name</Label>
                  <Input
                    id="role-name"
                    placeholder="For example, Inventory manager"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-desc">What is this role for?</Label>
                  <Input
                    id="role-desc"
                    placeholder="One short description for your team"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="h-11"
                  />
                </div>
              </section>

              <section className="mt-6 rounded-xl border border-border/60">
                <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left" onClick={() => setShowPermissionEditor((value) => !value)}>
                  <span><span className="block font-semibold">Customize access</span><span className="mt-0.5 block text-xs text-muted-foreground">{formData.permissions.length} capabilities included. Most roles do not need changes.</span></span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showPermissionEditor && "rotate-180")} />
                </button>
                {showPermissionEditor ? <div className="border-t border-border/60 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Only enable access that is needed for this job. Sensitive actions are marked for review.</p>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, permissions: permissions.map((permission) => permission.key) })}>Select all</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, permissions: [] })}>Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-5">
                      {Object.entries(groupedPermissions).map(([module, perms]) => <div key={module}>
                        <h3 className="mb-2 text-sm font-semibold">{readableModuleName(module)}</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {perms.map((perm) => {
                            const selected = formData.permissions.includes(perm.key);
                            return <label key={perm.key} htmlFor={`perm-${perm.key}`} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", selected ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-muted/50")}>
                              <input id={`perm-${perm.key}`} type="checkbox" checked={selected} onChange={() => togglePermission(perm.key)} className="mt-0.5 h-4 w-4 accent-primary" />
                              <span className="min-w-0"><span className="flex flex-wrap items-center gap-1 text-sm font-medium">{readablePermission(perm.key, permissions)}{(perm.risk_level === "high" || perm.risk_level === "critical") ? <Badge variant="outline" className="text-[9px] capitalize">Needs care</Badge> : null}</span><span className="mt-0.5 block text-xs text-muted-foreground">{perm.description || "Access to this part of Yummy."}</span></span>
                            </label>;
                          })}
                        </div>
                      </div>)}
                    </div>
                  </div>
                </div> : null}
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 sm:px-8">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-10 px-6 font-semibold" disabled={submitting}>
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
