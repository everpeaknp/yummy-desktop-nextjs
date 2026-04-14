"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { StaffApis, RoleApis, StaffProfileApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserPlus, Search, Filter, Mail, Phone, MoreVertical, Edit, Trash2, Shield, User as UserIcon, ArrowLeft, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { AuthApis } from "@/lib/api/endpoints";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type StaffProfile = {
  id: number;
  user_id: number;
  account_number: string;
  salary_type: string;
  salary_amount: number;
};

export default function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [staffProfilesByUserId, setStaffProfilesByUserId] = useState<Map<number, StaffProfile>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "waiter",
    roles: ["waiter"] as string[],
    primary_role: "waiter",
    permissions: [] as string[]
  });
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [payrollTarget, setPayrollTarget] = useState<any>(null);
  const [payrollSubmitting, setPayrollSubmitting] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    account_number: "",
    salary_type: "monthly",
    salary_amount: "",
    phone: "",
    address: "",
    age: "",
    weekly_hours: "",
    daily_hours: "",
  });

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();
  const { restaurant } = useRestaurant();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');
    };
    checkAuth();
  }, [user, me, router]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(StaffApis.list());
      if (response.data.status === "success") {
        setStaff(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
      toast.error("Failed to fetch staff list");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffProfiles = async () => {
    try {
      const res = await apiClient.get(StaffProfileApis.list({ skip: 0, limit: 500 }));
      if (res.data?.status === "success") {
        const profiles = (res.data.data || []) as StaffProfile[];
        const map = new Map<number, StaffProfile>();
        profiles.forEach((p) => map.set(p.user_id, p));
        setStaffProfilesByUserId(map);
      }
    } catch (err) {
      // Not fatal; payroll setup buttons will still work when called.
      console.warn("Failed to fetch staff profiles", err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await apiClient.get(RoleApis.listPermissions);
      if (response.data.status === "success") {
        setAvailablePermissions(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiClient.get(RoleApis.listRoles);
      if (response.data.status === "success") {
        setAvailableRoles(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch roles:", err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchStaffProfiles();
    fetchPermissions();
    fetchRoles();
  }, []);

  const openPayrollDialog = (member: any) => {
    const existing = staffProfilesByUserId.get(member.id);
    setPayrollTarget(member);
    setPayrollForm({
      account_number: existing?.account_number || `ACC-${member.id}`,
      salary_type: existing?.salary_type || "monthly",
      salary_amount: existing?.salary_amount != null ? String(existing.salary_amount) : "",
      phone: "",
      address: "",
      age: "",
      weekly_hours: "",
      daily_hours: "",
    });
    setIsPayrollDialogOpen(true);
  };

  const savePayrollProfile = async () => {
    if (!payrollTarget) return;
    const amount = Number(payrollForm.salary_amount);
    if (!payrollForm.account_number.trim()) return toast.error("Account number is required");
    if (!amount || Number.isNaN(amount) || amount < 0) return toast.error("Salary amount must be valid");
    if (payrollForm.salary_type !== "monthly" && payrollForm.salary_type !== "daily") {
      return toast.error("Payroll supports monthly or daily salary type only");
    }

    setPayrollSubmitting(true);
    try {
      // Ensure the user is assigned to a restaurant (required by backend staff profile creation).
      // Use the *selected* restaurant context (admin association users may have user.restaurant_id = null).
      const activeRestaurantId = restaurant?.id || user?.restaurant_id || null;
      if (!activeRestaurantId) {
        toast.error("Select a restaurant first (restaurant context is required for payroll profiles).");
        return;
      }
      if (!payrollTarget.restaurant_id) {
        try {
          await apiClient.patch(AuthApis.updateUser(payrollTarget.id), { restaurant_id: activeRestaurantId });
        } catch {
          // Backend can still create the staff profile using the requester's restaurant context.
        }
      }

      const payload: any = {
        user_id: payrollTarget.id,
        account_number: payrollForm.account_number.trim(),
        salary_type: payrollForm.salary_type,
        salary_amount: amount,
      };
      if (payrollForm.phone.trim()) payload.phone = payrollForm.phone.trim();
      if (payrollForm.address.trim()) payload.address = payrollForm.address.trim();
      if (payrollForm.age.trim()) {
        const age = Number(payrollForm.age);
        if (Number.isNaN(age) || age < 0) {
          toast.error("Age must be a valid number");
          return;
        }
        payload.age = age;
      }
      if (payrollForm.weekly_hours.trim()) {
        const weekly = Number(payrollForm.weekly_hours);
        if (Number.isNaN(weekly) || weekly < 0) {
          toast.error("Weekly hours must be a valid number");
          return;
        }
        payload.weekly_hours = weekly;
      }
      if (payrollForm.daily_hours.trim()) {
        const daily = Number(payrollForm.daily_hours);
        if (Number.isNaN(daily) || daily < 0) {
          toast.error("Daily hours must be a valid number");
          return;
        }
        payload.daily_hours = daily;
      }

      const res = await apiClient.post("/staff", payload);
      if (res.data?.status === "success") {
        toast.success("Payroll profile created");
        setIsPayrollDialogOpen(false);
        await fetchStaffProfiles();
        return;
      }
      toast.error(res.data?.message || "Failed to create payroll profile");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to create payroll profile";
      toast.error(typeof msg === "string" ? msg : "Failed to create payroll profile");
    } finally {
      setPayrollSubmitting(false);
    }
  };

  const handleOpenDialog = (member: any = null) => {
    if (member) {
      setEditingStaff(member);
      setFormData({
        name: member.name || "",
        email: member.email || "",
        password: "", // Don't show existing password
        role: member.role || "waiter",
        roles: member.roles || [member.role || "waiter"],
        primary_role: member.primary_role || member.role || "waiter",
        permissions: member.permissions || []
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "waiter",
        roles: ["waiter"],
        primary_role: "waiter",
        permissions: []
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingStaff) {
        // Update user
        const payload: any = {
          name: formData.name,
          email: formData.email,
          role: formData.primary_role, // Keep 'role' for backward compatibility or primary
          roles: formData.roles,
          primary_role: formData.primary_role
        };
        // Only include password if provided
        if (formData.password) payload.password = formData.password;
        
        await apiClient.patch(StaffApis.update(editingStaff.id), payload);
        
        // Update permissions for existing staff
        if (formData.permissions) {
          await apiClient.post(AuthApis.updateUserPermissions(editingStaff.id), {
            permission_keys: formData.permissions
          });
        }
        
        toast.success("Staff profile updated successfully");
      } else {
        // Create user
        const createPayload: any = {
          name: formData.name,
          email: formData.email,
          role: formData.primary_role,
          roles: formData.roles,
          primary_role: formData.primary_role
        };
        
        if (formData.password) createPayload.password = formData.password;
        if (user?.restaurant_id) createPayload.restaurant_id = user.restaurant_id;

        const response = await apiClient.post(StaffApis.create, createPayload);
        const newUserId = response.data.data.id;

        // If specific permissions were selected (beyond roles), assign them
        // Note: For now, we'll just handle it after creation
        if (formData.permissions && formData.permissions.length > 0) {
           await apiClient.post(AuthApis.updateUserPermissions(newUserId), {
             permission_keys: formData.permissions
           });
        }
        
        toast.success("New staff member added successfully");
      }
      setIsDialogOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error("Failed to save staff RAW DATA:", JSON.stringify(err.response?.data, null, 2));
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to save staff member";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: number) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this staff member? This action cannot be undone.")) return;
    try {
      await apiClient.delete(StaffApis.delete(id));
      toast.success("Staff member deleted successfully");
      fetchStaff();
    } catch (err: any) {
      console.error("Failed to delete staff:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || "Failed to delete staff member";
      toast.error(errMsg);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch = 
      (member.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || member.role?.toLowerCase() === roleFilter.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const r = role?.toLowerCase();
    if (r === 'admin') return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200">Admin</Badge>;
    if (r === 'manager') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200">Manager</Badge>;
    if (r === 'waiter') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200">Waiter</Badge>;
    if (r === 'chef') return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200">Chef</Badge>;
    if (r === 'cashier') return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200">Cashier</Badge>;
    return <Badge variant="outline">{role || 'Staff'}</Badge>;
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-muted-foreground">Manage employees, permissions, and roles.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchStaff()} disabled={loading} title="Refresh staff list">
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => handleOpenDialog()}>
            <UserPlus className="w-4 h-4 mr-2" /> Add Staff Member
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Total Staff" value={staff.length} icon={<Shield className="w-5 h-5" />} color="text-blue-500" />
        <MetricCard label="Active Now" value={staff.length} icon={<UserIcon className="w-5 h-5" />} color="text-emerald-500" />
        <MetricCard label="Managers" value={staff.filter(s => s.role?.toLowerCase() === 'manager' || s.role?.toLowerCase() === 'admin').length} icon={<Shield className="w-5 h-5" />} color="text-indigo-500" />
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input 
            className="pl-8 h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="chef">Chef</SelectItem>
              <SelectItem value="waiter">Waiter</SelectItem>
              <SelectItem value="cashier">Cashier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[350px]">Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payroll</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <UserIcon className="w-8 h-8 opacity-20" />
                      <p className="font-medium">No staff members found</p>
                      <p className="text-sm">Try adjusting your filters or search query, or add a new staff member.</p>
                      <Button variant="outline" size="sm" onClick={() => fetchStaff()} className="mt-2">
                        Refresh Data
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => router.push(`/staff/${member.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {member.name?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-xs text-muted-foreground">ID: #STF-{member.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[250px]">{member.email || "No email"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {staffProfilesByUserId.has(member.id) ? (
                        <Badge variant="outline" className="border-emerald-300/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                          <Wallet className="w-3.5 h-3.5 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300/40 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                          <Wallet className="w-3.5 h-3.5 mr-1" />
                          Not Set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/staff/${member.id}`)}>
                            <UserIcon className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPayrollDialog(member)}>
                            <Wallet className="w-4 h-4 mr-2" /> Setup Payroll Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(member)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteStaff(member.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isPayrollDialogOpen} onOpenChange={setIsPayrollDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Setup Payroll Profile</DialogTitle>
            <DialogDescription>
              Payroll requires salary and account details. This creates a Staff Profile used by payroll runs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-sm font-semibold">{payrollTarget?.name || "Staff"}</p>
              <p className="text-xs text-muted-foreground">{payrollTarget?.email || "No email"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={payrollForm.account_number}
                  onChange={(e) => setPayrollForm({ ...payrollForm, account_number: e.target.value })}
                  placeholder="e.g. ACC-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Type</Label>
                <Select value={payrollForm.salary_type} onValueChange={(v) => setPayrollForm({ ...payrollForm, salary_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Salary Amount</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={payrollForm.salary_amount}
                onChange={(e) => setPayrollForm({ ...payrollForm, salary_amount: e.target.value })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Use monthly or daily salary; weekly/hourly payroll is not supported by current payroll calculations.
              </p>
            </div>

            <div className="pt-2 border-t border-border/60" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  value={payrollForm.phone}
                  onChange={(e) => setPayrollForm({ ...payrollForm, phone: e.target.value })}
                  placeholder="98XXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Age (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={payrollForm.age}
                  onChange={(e) => setPayrollForm({ ...payrollForm, age: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Textarea
                value={payrollForm.address}
                onChange={(e) => setPayrollForm({ ...payrollForm, address: e.target.value })}
                placeholder="Address"
                className="min-h-[84px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weekly Hours (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={payrollForm.weekly_hours}
                  onChange={(e) => setPayrollForm({ ...payrollForm, weekly_hours: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Hours (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={payrollForm.daily_hours}
                  onChange={(e) => setPayrollForm({ ...payrollForm, daily_hours: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayrollDialogOpen(false)} disabled={payrollSubmitting}>
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={savePayrollProfile} disabled={payrollSubmitting}>
              {payrollSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
              Save Payroll Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
            <DialogDescription>
              {editingStaff ? "Update profile details for this staff member." : "Create a new account for your employee. They will be added to your restaurant."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveStaff} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                required 
                placeholder="John Doe"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                required 
                placeholder="john@example.com"
                autoComplete="off"
              />
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  required 
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assigned Roles</Label>
              <div className="grid grid-cols-2 gap-2 border border-border/40 rounded-xl p-4 bg-muted/30">
                {availableRoles.map((roleObj) => (
                  <div key={roleObj.id} className="flex items-center space-x-2 group">
                    <Checkbox
                      id={`role-${roleObj.name}`}
                      checked={formData.roles.includes(roleObj.name)}
                      onCheckedChange={(checked) => {
                        const newRoles = checked
                          ? [...formData.roles, roleObj.name]
                          : formData.roles.filter(r => r !== roleObj.name);
                        
                        // Ensure at least one role is selected
                        if (newRoles.length === 0) return;

                        let newPrimary = formData.primary_role;
                        if (!newRoles.includes(newPrimary)) {
                          newPrimary = newRoles[0];
                        }

                        setFormData({
                          ...formData,
                          roles: newRoles,
                          primary_role: newPrimary
                        });
                      }}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor={`role-${roleObj.name}`} className="text-xs font-bold capitalize cursor-pointer group-hover:text-primary transition-colors">
                      {roleObj.name}
                      {roleObj.is_system_role && <span className="ml-1 text-[8px] opacity-40 uppercase font-black">Sys</span>}
                    </Label>
                  </div>
                ))}
                {availableRoles.length === 0 && (
                  <p className="col-span-2 text-[10px] text-center text-muted-foreground italic py-2">Loading roles...</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary_role">Primary Role</Label>
              <Select 
                value={formData.primary_role} 
                onValueChange={(val) => setFormData({...formData, primary_role: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary role" />
                </SelectTrigger>
                <SelectContent>
                  {formData.roles.map((role: string) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">This is the main role shown in the staff list.</p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Permission Access
                </Label>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-2">
                Roles include defaults. Use these to grant specific module access.
              </p>
              
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(
                  availablePermissions.reduce((acc: any, curr: any) => {
                    const module = curr.module || (curr.key.split('.')[0]) || "General";
                    if (!acc[module]) acc[module] = [];
                    acc[module].push(curr);
                    return acc;
                  }, {})
                ).map(([module, perms]: [string, any]) => (
                  <div key={module} className="bg-muted/30 rounded-lg p-3 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-2 border-b border-primary/10 pb-1">{module}</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {perms.map((p: any) => (
                        <div key={p.key} className="flex items-start gap-3 group">
                          <Checkbox 
                            id={`perm-${p.key}`}
                            className="mt-1 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            checked={(formData as any).permissions?.includes(p.key)}
                            onCheckedChange={(checked) => {
                              const currentPerms = (formData as any).permissions || [];
                              const newPerms = checked
                                ? [...currentPerms, p.key]
                                : currentPerms.filter((k: string) => k !== p.key);
                              setFormData({...formData, permissions: newPerms} as any);
                            }}
                          />
                          <div className="grid gap-1 lowercase">
                            <label
                              htmlFor={`perm-${p.key}`}
                              className="text-xs font-bold leading-none cursor-pointer group-hover:text-primary transition-colors"
                            >
                              {p.key.replace(/\./g, ' ')}
                            </label>
                            {p.description && (
                              <p className="text-[11px] text-muted-foreground leading-normal">
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
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingStaff ? "Save Changes" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: any) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-muted ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
