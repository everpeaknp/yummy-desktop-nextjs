"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { Camera, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { AuthApis } from "@/lib/api/endpoints";

const roleBadgeColors: Record<string, string> = {
  admin: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  administrator: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  platform_staff: "border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-400",
  superadmin: "border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-400",
  super_admin: "border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-400",
  manager: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
  waiter: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
  chef: "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400",
  cashier: "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400",
};

export default function MyProfilePage() {
  const user = useAuth((state) => state.user);
  const [name, setName] = useState(user?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.full_name || "");
  }, [user?.full_name]);

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      toast.error("Name cannot be empty");
      return;
    }
    if (normalizedName === user?.full_name) return;

    try {
      setSavingName(true);
      await apiClient.patch(AuthApis.meProfile, { name: normalizedName });
      await useAuth.getState().syncUserProfile();
      toast.success("Your name was updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not update your name");
    } finally {
      setSavingName(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const hasAllowedMimeType = ["image/jpeg", "image/png"].includes(file.type);
    const hasAllowedExtension = /\.(jpe?g|png)$/i.test(file.name);
    if (!hasAllowedMimeType && !hasAllowedExtension) {
      toast.error("Choose a JPG or PNG image");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      event.target.value = "";
      return;
    }

    try {
      setUploadingPhoto(true);
      const form = new FormData();
      form.append("file", file);
      await apiClient.post(AuthApis.uploadProfilePicture, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await useAuth.getState().syncUserProfile();
      toast.success("Profile photo updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not update your photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.next || password.next !== password.confirm) {
      toast.error("Enter matching new passwords");
      return;
    }
    if (password.next.length < 8) {
      toast.error("Use at least 8 characters for your new password");
      return;
    }

    try {
      setSavingPassword(true);
      await apiClient.post(AuthApis.changePassword, {
        old_password: password.current || undefined,
        new_password: password.next,
        confirm_password: password.confirm,
      });
      setPassword({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Could not update your password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (user?.full_name || user?.email || "U")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppPage width="form" density="compact" className="pb-10 lg:pb-8">
      <PageHeader
        title="My profile"
        description="Manage your personal account details and sign-in security."
        leading={<UserRound className="h-5 w-5 text-primary" />}
      />

      <Card>
        <CardHeader className="space-y-1.5 px-4 pb-3 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
          <CardTitle className="text-xl sm:text-2xl">Personal details</CardTitle>
          <CardDescription>These details identify you across Yummy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
          <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-3 sm:p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-lg font-semibold text-primary sm:h-20 sm:w-20">
              {user?.photo_url ? (
                <Image
                  src={user.photo_url}
                  alt={user.full_name || "Profile photo"}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : initials}
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <p className="font-medium">Profile photo</p>
                <p className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
              </div>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={uploadPhoto} />
              <Button type="button" variant="outline" size="sm" onClick={() => photoInput.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {uploadingPhoto ? "Uploading…" : "Change photo"}
              </Button>
            </div>
          </div>

          <form onSubmit={saveName} className="space-y-4">
            <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
              </div>
              <Button type="submit" size="default" className="h-10 shrink-0 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none" disabled={savingName || !name.trim() || name.trim() === user?.full_name}>
                {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save name
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email address</Label>
              <Input id="profile-email" type="email" value={user?.email || ""} readOnly className="bg-muted/30" />
              <p className="text-xs text-muted-foreground">Changing your sign-in email requires a verified email-change flow.</p>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Access roles</p>
              <div className="flex flex-wrap gap-2">
                {(user?.roles?.length ? user.roles : [user?.role || "Staff"]).map((role) => (
                  <Badge
                    key={role}
                    variant="outline"
                    className={`capitalize ${roleBadgeColors[role.toLowerCase().replaceAll(" ", "_")] || ""}`}
                  >
                    {role.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1.5 px-4 pb-3 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><KeyRound className="h-4 w-4 text-primary" />Password & security</CardTitle>
          <CardDescription>Choose a password you do not use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} placeholder="Leave blank if you have not set one" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword || !password.next || !password.confirm}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppPage>
  );
}
