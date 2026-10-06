"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { RoleApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Shield,
  ShieldCheck,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  Check,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";

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
  manager: "Manager",
  cashier: "Cashier",
  waiter: "Service staff",
  kitchen: "Kitchen staff",
  bar: "Bar staff",
  cafe: "Cafe staff",
  barista: "Barista",
  accountant: "Accountant",
  accounting_approver: "Accounting approver",
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
  return (
    ROLE_PRESET_LABELS[roleName] ||
    roleName
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
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
  return (
    labels[moduleName.toLowerCase()] ||
    moduleName
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function readablePermission(key: string, permissions: Permission[]) {
  const permission = permissions.find((item) => item.key === key);
  return (
    permission?.title ||
    key
      .replaceAll(".", " ")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [builtInPresets, setBuiltInPresets] = useState<
    Record<string, string[]>
  >({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) {
        router.push("/");
        return;
      }
      fetchData();
    };
    init();
  }, [user, me, router]);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
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
      setLoadError("Roles and permissions could not be loaded.");
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
        permissions: role.permissions || [],
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        permissions: [],
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
      console.error("Failed to save role:", {
        status,
        data,
        payload: payloadForDebug,
        err,
      });
      const detail = data?.detail || data?.message;
      if (typeof detail === "string" && detail.trim()) toast.error(detail);
      else if (typeof data === "string" && data.trim())
        toast.error(data.slice(0, 200));
      else toast.error("Failed to save role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role)
      return toast.error("System roles cannot be deleted");

    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`))
      return;

    try {
      await apiClient.delete(RoleApis.deleteRole(role.id));
      toast.success("Role deleted successfully");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete role");
    }
  };

  const togglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));
  };

  const togglePermissionGroup = (groupPermissions: Permission[]) => {
    const keys = Array.from(
      new Set(groupPermissions.map((permission) => permission.key)),
    );
    setFormData((previous) => {
      const allSelected = keys.every((key) =>
        previous.permissions.includes(key),
      );
      return {
        ...previous,
        permissions: allSelected
          ? previous.permissions.filter((key) => !keys.includes(key))
          : Array.from(new Set(previous.permissions.concat(keys))),
      };
    });
  };

  const applyPreset = (presetName: string) => {
    const presetPermissions = builtInPresets[presetName];
    if (!presetPermissions) return;
    setFormData((previous) => ({
      ...previous,
      permissions: [...presetPermissions],
      name: previous.name || `${readableRoleName(presetName)} copy`,
      description:
        previous.description ||
        ROLE_PRESET_DESCRIPTIONS[presetName] ||
        "Custom access based on a built-in role.",
    }));
    setSelectedPreset(presetName);
  };

  const createFromPreset = (presetName: string) => {
    const label =
      ROLE_PRESET_LABELS[presetName] || presetName.replaceAll("_", " ");
    setEditingRole(null);
    setFormData({
      name: `${label} copy`,
      description:
        ROLE_PRESET_DESCRIPTIONS[presetName] ||
        "Custom access based on a built-in role.",
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

  const visiblePermissions = permissions.filter((permission) => {
    const query = permissionQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      permission.key,
      permission.title,
      permission.description,
      permission.module,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  // Group permissions by module
  const groupedPermissions = visiblePermissions.reduce(
    (acc: Record<string, Permission[]>, perm) => {
      const permissionModule = perm.module || "General";
      if (!acc[permissionModule]) acc[permissionModule] = [];
      acc[permissionModule].push(perm);
      return acc;
    },
    {},
  );

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId="roles" />
        <main className="min-w-0 flex-1">
          <PageHeader
            title="Roles & permissions"
            description="Define reusable access roles. Individual staff assignments remain in Staff Detail."
          />
          <div className="mt-3 flex justify-start">
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Create role
            </Button>
          </div>
          <SearchField
            placeholder="Search roles"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mt-5 md:max-w-sm"
          />

          <div className="mt-6 max-w-4xl space-y-8">
            {loading ? (
              <LoadingState label="Loading roles and permissions" />
            ) : loadError ? (
              <ErrorState
                title="Roles could not be loaded"
                description={loadError}
                actionLabel="Try again"
                onAction={() => void fetchData()}
              />
            ) : (
              <>
                {Object.keys(builtInPresets).length ? (
                  <section className="space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">Role templates</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Start from preset access for common restaurant jobs.
                      </p>
                    </div>
                    <DataList>
                      {Object.keys(builtInPresets).map((presetName) => (
                        <ListRow
                          key={presetName}
                          action={
                            <Button
                              type="button"
                              variant="link"
                              aria-label={`Use ${readableRoleName(presetName)} template`}
                              className="h-auto gap-1.5 px-2 py-2 text-sm font-semibold text-primary"
                              onClick={() => createFromPreset(presetName)}
                            >
                              Use template <ArrowRight className="h-4 w-4" />
                            </Button>
                          }
                          title={readableRoleName(presetName)}
                          description={
                            `${builtInPresets[presetName].length} permissions · ${ROLE_PRESET_DESCRIPTIONS[presetName] || "Ready-to-use access template."}`
                          }
                        />
                      ))}
                    </DataList>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">Business roles</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reusable access definitions available when assigning
                      staff.
                    </p>
                  </div>
                  {filteredRoles.length ? (
                    <DataList>
                      {filteredRoles.map((role) => (
                        <ListRow
                          key={role.id}
                          leading={<ShieldCheck className="h-4 w-4" />}
                          title={readableRoleName(role.name)}
                          description={
                            role.description ||
                            "Access for a specific job or responsibility."
                          }
                          meta={`${role.permissions?.length || 0} permissions`}
                          value={
                            role.is_system_role ? (
                              <Badge variant="outline">System</Badge>
                            ) : undefined
                          }
                          action={
                            !role.is_system_role ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11"
                                    aria-label={`Actions for ${readableRoleName(role.name)}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDialog(role)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" /> Edit role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => void handleDeleteRole(role)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : undefined
                          }
                        />
                      ))}
                    </DataList>
                  ) : (
                    <EmptyState
                      title={
                        searchQuery ? "No roles found" : "No business roles"
                      }
                      description={
                        searchQuery
                          ? "Try another role name or description."
                          : "Create a role when the standard templates do not match a job."
                      }
                      actionLabel={searchQuery ? undefined : "Create role"}
                      onAction={
                        searchQuery ? undefined : () => handleOpenDialog()
                      }
                    />
                  )}
                </section>
              </>
            )}
          </div>

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
                      {editingRole
                        ? `Edit ${readableRoleName(editingRole.name)}`
                        : "Create a custom role"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Start from a job template, then change only the access
                      this role genuinely needs.
                    </p>
                  </div>

                  {!editingRole ? (
                    <section className="mb-7">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">
                              Start with a built-in role
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Choose from all available roles, or start with no
                              access.
                            </p>
                          </div>
                          {selectedPreset ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={startBlankRole}
                            >
                              Start blank
                            </Button>
                          ) : null}
                        </div>
                        <Select
                          value={selectedPreset || "blank"}
                          onValueChange={(value) =>
                            value === "blank"
                              ? startBlankRole()
                              : applyPreset(value)
                          }
                        >
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue placeholder="Choose a role template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="blank">
                              Start with no template
                            </SelectItem>
                            {Object.keys(builtInPresets).map((presetName) => (
                              <SelectItem key={presetName} value={presetName}>
                                {readableRoleName(presetName)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                          {selectedPreset ? (
                            <>
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span>
                                <strong className="font-medium text-foreground">
                                  {readableRoleName(selectedPreset)}
                                </strong>{" "}
                                includes{" "}
                                {builtInPresets[selectedPreset]?.length || 0}{" "}
                                capabilities.{" "}
                                {ROLE_PRESET_DESCRIPTIONS[selectedPreset] ||
                                  "You can adjust it below before saving."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                Starting blank means this role has no access
                                until you choose it below.
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="role-name">Role name</Label>
                      <Input
                        id="role-name"
                        placeholder="For example, Inventory manager"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
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
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        className="h-11"
                      />
                    </div>
                  </section>

                  <section className="mt-6 rounded-xl border border-border/60">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                      onClick={() => setShowPermissionEditor((value) => !value)}
                    >
                      <span>
                        <span className="block font-semibold">
                          Customize access
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formData.permissions.length} capabilities included.
                          Most roles do not need changes.
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          showPermissionEditor && "rotate-180",
                        )}
                      />
                    </button>
                    {showPermissionEditor ? (
                      <div className="border-t border-border/60 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            Only enable access that is needed for this job.
                            Sensitive actions are marked for review.
                          </p>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  permissions: permissions.map(
                                    (permission) => permission.key,
                                  ),
                                })
                              }
                            >
                              Select all
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setFormData({ ...formData, permissions: [] })
                              }
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <SearchField
                          placeholder="Search permissions"
                          value={permissionQuery}
                          onChange={(event) =>
                            setPermissionQuery(event.target.value)
                          }
                          className="mb-4"
                        />
                        <div className="max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                          <div className="space-y-5">
                            {Object.entries(groupedPermissions).map(
                              ([module, perms]) => {
                                const modulePermissions = permissions.filter(
                                  (permission) =>
                                    (permission.module || "General") === module,
                                );
                                const selectedCount = modulePermissions.filter((perm) =>
                                  formData.permissions.includes(perm.key),
                                ).length;
                                const allSelected =
                                  modulePermissions.length > 0 &&
                                  selectedCount === modulePermissions.length;
                                const partiallySelected =
                                  selectedCount > 0 && !allSelected;

                                return (
                                <div key={module}>
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold">
                                      {readableModuleName(module)}
                                    </h3>
                                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                                      <input
                                        type="checkbox"
                                        aria-label={
                                          `${allSelected ? "Clear all" : "Select all"} ${readableModuleName(module)} permissions`
                                        }
                                        aria-checked={
                                          partiallySelected
                                            ? "mixed"
                                            : allSelected
                                        }
                                        checked={allSelected}
                                        ref={(checkbox) => {
                                          if (checkbox) {
                                            checkbox.indeterminate =
                                              partiallySelected;
                                          }
                                        }}
                                        onChange={() =>
                                          togglePermissionGroup(modulePermissions)
                                        }
                                        className="h-4 w-4 accent-primary"
                                      />
                                      <span>
                                        {allSelected ? "Clear section" : "Select all"}
                                      </span>
                                    </label>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {perms.map((perm) => {
                                      const selected =
                                        formData.permissions.includes(perm.key);
                                      return (
                                        <label
                                          key={perm.key}
                                          htmlFor={`perm-${perm.key}`}
                                          className={cn(
                                            "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                                            selected
                                              ? "border-primary/50 bg-primary/5"
                                              : "border-border/50 hover:bg-muted/50",
                                          )}
                                        >
                                          <input
                                            id={`perm-${perm.key}`}
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() =>
                                              togglePermission(perm.key)
                                            }
                                            className="mt-0.5 h-4 w-4 accent-primary"
                                          />
                                          <span className="min-w-0">
                                            <span className="flex flex-wrap items-center gap-1 text-sm font-medium">
                                              {readablePermission(
                                                perm.key,
                                                permissions,
                                              )}
                                              {perm.risk_level === "high" ||
                                              perm.risk_level === "critical" ? (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] capitalize"
                                                >
                                                  Needs care
                                                </Badge>
                                              ) : null}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                              {perm.description ||
                                                "Access to this part of Yummy."}
                                            </span>
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 p-4 sm:px-8">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-10 px-6 font-semibold"
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingRole ? "Update Role" : "Create Custom Role"}
                  </Button>
                </div>
              </form>
            </SimpleModal>
          ) : null}
        </main>
      </div>
    </AppPage>
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
    document.body,
  );
}
