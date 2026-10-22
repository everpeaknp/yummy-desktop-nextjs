"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export type StaffEditSection = "profile" | "employment" | "access";

export type StaffEditRole = {
  id: number | string;
  name: string;
  label: string;
  description: string;
  permissions?: string[];
  protected?: boolean;
};

export type StaffEditValues = {
  name: string;
  email: string;
  phone: string;
  address: string;
  accountNumber: string;
  salaryType: string;
  salaryAmount: string;
  weeklyHours: string;
  dailyHours: string;
  effectiveFrom: string;
  salaryChangeReason: string;
  roleName: string;
  isActive: boolean;
};

function Section({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-4 border-b pb-6 last:border-b-0 ${className}`}>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StaffEditDialog({
  open,
  onOpenChange,
  initialSection = "profile",
  initialValues,
  roles,
  hasEmploymentProfile,
  canChangeGlobalStatus,
  effectivePermissionCount,
  saving,
  onSave,
  onOpenPermissions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: StaffEditSection;
  initialValues: StaffEditValues;
  roles: StaffEditRole[];
  hasEmploymentProfile: boolean;
  canChangeGlobalStatus: boolean;
  effectivePermissionCount: number;
  saving: boolean;
  onSave: (values: StaffEditValues) => Promise<void> | void;
  onOpenPermissions: () => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [desktopSection, setDesktopSection] =
    useState<StaffEditSection>(initialSection);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setDesktopSection(initialSection);
  }, [initialSection, initialValues, open]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.name === values.roleName),
    [roles, values.roleName],
  );

  const update = <Key extends keyof StaffEditValues>(
    key: Key,
    value: StaffEditValues[Key],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const roleField = (
    <Field label="Assigned role">
      <Select
        value={values.roleName}
        onValueChange={(value) => update("roleName", value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem
              key={`${role.id}-${role.name}`}
              value={role.name}
              disabled={role.protected}
            >
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedRole ? (
        <p className="text-xs text-muted-foreground">
          {selectedRole.description}
        </p>
      ) : null}
    </Field>
  );

  const profileFields = (
    <Section title="Profile" description="Identity and contact information.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field
          label="Email"
          hint="Login email is identity-owned and cannot be changed here."
        >
          <Input value={values.email} type="email" disabled />
        </Field>
        <Field label="Phone">
          <Input
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            autoComplete="tel"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <Textarea
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
              className="min-h-20 resize-y"
            />
          </Field>
        </div>
      </div>
    </Section>
  );

  const employmentFields = (
    <Section
      title="Employment"
      description="Compensation and expected working hours."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Payroll account"
          hint={
            hasEmploymentProfile
              ? undefined
              : "Required to create this employee's pay profile."
          }
        >
          <Input
            value={values.accountNumber}
            onChange={(event) => update("accountNumber", event.target.value)}
          />
        </Field>
        <Field label="Salary type">
          <Select
            value={values.salaryType}
            onValueChange={(value) => update("salaryType", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Salary amount">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.salaryAmount}
            onChange={(event) => update("salaryAmount", event.target.value)}
          />
        </Field>
        <Field label="Weekly hours">
          <Input
            type="number"
            min="0"
            step="0.25"
            value={values.weeklyHours}
            onChange={(event) => update("weeklyHours", event.target.value)}
          />
        </Field>
        <Field label="Daily hours">
          <Input
            type="number"
            min="0"
            step="0.25"
            value={values.dailyHours}
            onChange={(event) => update("dailyHours", event.target.value)}
          />
        </Field>
        <Field label="Effective from">
          <Input
            type="date"
            value={values.effectiveFrom}
            onChange={(event) => update("effectiveFrom", event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Salary change reason"
            hint="Required when compensation or expected hours change."
          >
            <Input
              value={values.salaryChangeReason}
              onChange={(event) =>
                update("salaryChangeReason", event.target.value)
              }
              placeholder={
                hasEmploymentProfile
                  ? "Promotion, review, or correction"
                  : "Initial salary"
              }
            />
          </Field>
        </div>
      </div>
    </Section>
  );

  const accessFields = (
    <>
      <Section
        title="Access"
        description="Role access and approved exceptions."
      >
        {roleField}
        <button
          type="button"
          onClick={onOpenPermissions}
          className="flex min-h-14 w-full items-center justify-between gap-4 border-y py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex min-w-0 items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">Permissions</span>
              <span className="block text-xs text-muted-foreground">
                Inherited role access and direct exceptions
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {effectivePermissionCount}
          </span>
        </button>
      </Section>
      <Section title="Status">
        <Field
          label="Account status"
          hint={
            canChangeGlobalStatus
              ? "Inactive accounts cannot sign in."
              : "Restaurant managers remove membership from the Employment section instead of disabling the person's global account."
          }
        >
          <Select
            value={values.isActive ? "active" : "inactive"}
            disabled={!canChangeGlobalStatus}
            onValueChange={(value) => update("isActive", value === "active")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:rounded-none lg:h-auto lg:max-h-[min(90vh,820px)] lg:max-w-3xl lg:rounded-xl lg:border">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle>Edit staff</DialogTitle>
          <DialogDescription>
            Update profile, employment, and access details.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(values);
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-6 lg:hidden">
              {profileFields}
              {employmentFields}
              {accessFields}
            </div>

            <Tabs
              value={desktopSection}
              onValueChange={(value) =>
                setDesktopSection(value as StaffEditSection)
              }
              className="hidden lg:block"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="access">Access</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="mt-6">
                {profileFields}
              </TabsContent>
              <TabsContent value="employment" className="mt-6">
                {employmentFields}
              </TabsContent>
              <TabsContent value="access" className="mt-6">
                {accessFields}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
