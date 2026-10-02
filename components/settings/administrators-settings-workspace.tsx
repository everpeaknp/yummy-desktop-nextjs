"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Crown,
  Loader2,
  MoreVertical,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { AdminManagementApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";

type RestaurantAdministrator = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_owner: boolean;
  photo_url: string | null;
};

export function AdministratorsSettingsWorkspace() {
  const currentUser = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const canManageAdmins = hasPermission(currentUser, "admin.staff.manage");
  const [admins, setAdmins] = useState<RestaurantAdministrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });
  const [invitationResult, setInvitationResult] = useState<{
    message: string;
    code: string;
  } | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState<number | null>(null);

  const fetchAdmins = useCallback(async () => {
    if (!restaurant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get(
        AdminManagementApis.restaurantAdmins(restaurant.id),
      );
      if (response.data.status === "success") {
        setAdmins(response.data.data || []);
      }
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error.response as { status?: number })?.status
          : undefined;
      setLoadError(
        status === 403
          ? "Your role cannot view restaurant administrators."
          : "Restaurant administrators could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    void fetchAdmins();
  }, [fetchAdmins]);

  const viewerIsOwner = admins.some(
    (admin) => admin.id === currentUser?.id && admin.is_owner,
  );
  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter(
      (admin) =>
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query),
    );
  }, [admins, searchQuery]);

  const removeAdmin = async (admin: RestaurantAdministrator) => {
    if (!restaurant?.id || !canManageAdmins || admin.is_owner) return;
    if (!window.confirm(`Remove ${admin.name}'s administrator access?`)) return;
    setIsRemoving(admin.id);
    try {
      await apiClient.delete(
        AdminManagementApis.removeAdmin(restaurant.id, admin.id),
      );
      setAdmins((current) => current.filter((item) => item.id !== admin.id));
      toast.success("Administrator access removed");
    } catch {
      toast.error("Failed to remove administrator access");
    } finally {
      setIsRemoving(null);
    }
  };

  const transferOwnership = async (admin: RestaurantAdministrator) => {
    if (!restaurant?.id || !viewerIsOwner || admin.is_owner) return;
    if (!window.confirm(`Transfer restaurant ownership to ${admin.name}?`))
      return;
    setIsTransferring(admin.id);
    try {
      await apiClient.post(
        AdminManagementApis.transferOwnership(restaurant.id),
        { new_owner_id: admin.id },
      );
      toast.success(`Ownership transferred to ${admin.name}`);
      await fetchAdmins();
    } catch {
      toast.error("Failed to transfer ownership");
    } finally {
      setIsTransferring(null);
    }
  };

  const inviteAdmin = async () => {
    if (!restaurant?.id || !canManageAdmins) return;
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setIsInviting(true);
    try {
      const response = await apiClient.post(
        AdminManagementApis.restaurantAdmins(restaurant.id),
        {
          name: inviteForm.name.trim(),
          email: inviteForm.email.trim(),
        },
      );
      const message =
        response.data.message || "Administrator invitation created";
      setInvitationResult({
        message,
        code: String(response.data.data?.code || response.data.code || ""),
      });
      toast.success(message);
    } catch {
      toast.error("Failed to invite administrator");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="lg:flex lg:items-start lg:gap-8">
        <SettingsDesktopRail activeItemId="admin_management" />
        <main className="min-w-0 flex-1">
          <PageHeader
            title="Administrators"
            description="Manage business-wide administrators and restaurant ownership."
            actions={
              canManageAdmins ? (
                <Button onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Invite administrator
                </Button>
              ) : undefined
            }
          />

          <div className="mt-6 max-w-4xl space-y-5">
            <SearchField
              placeholder="Search administrators"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="md:max-w-sm"
            />

            {loading ? (
              <LoadingState label="Loading administrators" />
            ) : loadError ? (
              <ErrorState
                title="Administrators could not be loaded"
                description={loadError}
                actionLabel="Try again"
                onAction={() => void fetchAdmins()}
              />
            ) : filteredAdmins.length === 0 ? (
              <EmptyState
                title={
                  searchQuery ? "No administrators found" : "No administrators"
                }
                description={
                  searchQuery
                    ? "Try another name or email address."
                    : "Invite an administrator when another person needs business-wide access."
                }
              />
            ) : (
              <DataList>
                {filteredAdmins.map((admin) => {
                  const canRemove =
                    canManageAdmins &&
                    !admin.is_owner &&
                    admin.id !== currentUser?.id;
                  const canTransfer = viewerIsOwner && !admin.is_owner;
                  return (
                    <ListRow
                      key={admin.id}
                      leading={
                        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {admin.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={admin.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            admin.name.charAt(0)
                          )}
                        </span>
                      }
                      title={admin.name}
                      description={admin.email}
                      value={
                        <Badge
                          variant={admin.is_owner ? "outline" : "secondary"}
                        >
                          {admin.is_owner ? "Owner" : "Administrator"}
                        </Badge>
                      }
                      action={
                        canRemove || canTransfer ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11"
                                aria-label={`Actions for ${admin.name}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canTransfer ? (
                                <DropdownMenuItem
                                  onClick={() => void transferOwnership(admin)}
                                  disabled={isTransferring === admin.id}
                                >
                                  {isTransferring === admin.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Crown className="mr-2 h-4 w-4" />
                                  )}
                                  Transfer ownership
                                </DropdownMenuItem>
                              ) : null}
                              {canRemove ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => void removeAdmin(admin)}
                                  disabled={isRemoving === admin.id}
                                >
                                  {isRemoving === admin.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                  )}
                                  Remove access
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : undefined
                      }
                    />
                  );
                })}
              </DataList>
            )}
          </div>

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
                <DialogTitle>Invite administrator</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  The recipient must sign in with this email and accept the
                  invitation.
                </p>
              </DialogHeader>
              {invitationResult ? (
                <div className="space-y-4 py-2">
                  <p className="text-sm">{invitationResult.message}</p>
                  {invitationResult.code ? (
                    <div className="space-y-2">
                      <Label htmlFor="admin-invitation-code">
                        Invitation code
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="admin-invitation-code"
                          value={invitationResult.code}
                          readOnly
                          className="font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Copy invitation code"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              invitationResult.code,
                            );
                            toast.success("Invitation code copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Full name</Label>
                    <Input
                      id="admin-name"
                      value={inviteForm.name}
                      onChange={(event) =>
                        setInviteForm({
                          ...inviteForm,
                          name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email address</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm({
                          ...inviteForm,
                          email: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteOpen(false)}
                >
                  {invitationResult ? "Close" : "Cancel"}
                </Button>
                {!invitationResult ? (
                  <Button
                    onClick={() => void inviteAdmin()}
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Send invitation
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </AppPage>
  );
}
