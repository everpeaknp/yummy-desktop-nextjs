"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, MessageSquareText, RefreshCw, Search, Users, Filter, ChevronLeft, ChevronRight, PencilLine, Loader2, UserCheck, UserMinus } from "lucide-react";
import { MdEmail } from "react-icons/md";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasPermission } from "@/lib/role-permissions";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";

interface Subscriber {
  customer_id: number;
  name: string;
  phone?: string;
  email?: string;
  preferred_language?: string;
  whatsapp_subscribed: boolean;
  email_subscribed: boolean;
  sms_subscribed: boolean;
  whatsapp_status: "opted_in" | "opted_out" | "not_asked";
  email_status: "opted_in" | "opted_out" | "not_asked";
  sms_status: "opted_in" | "opted_out" | "not_asked";
  created_at?: string | null;
  customer_created_at?: string | null;
}

type ChannelFilter = "all" | "email" | "sms" | "both";
type BulkConsentMode = "opt_in" | "opt_out";

function getLanguageLabel(lang?: string): string {
  const languageMap: Record<string, string> = {
    en: "English",
    ne: "Nepali",
    ne_romanized: "Nepali (Romanized)",
  };
  return languageMap[lang || "en"] || "English";
}

function ConsentBadge({
  channel,
  status,
}: {
  channel: "Email" | "SMS";
  status: Subscriber["email_status"];
}) {
  const label =
    status === "opted_in"
      ? "Allowed"
      : status === "opted_out"
        ? "Stopped"
        : "Not asked";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 whitespace-nowrap font-medium",
        status === "opted_in" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "opted_out" &&
          "border-muted-foreground/20 bg-muted text-muted-foreground",
      )}
    >
      {channel === "SMS" ? (
        <MessageSquareText aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <MdEmail aria-hidden="true" className="h-3.5 w-3.5" />
      )}
      {channel}: {label}
    </Badge>
  );
}

export function SubscribersClient() {
  const user = useAuth((state) => state.user);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [consentCustomer, setConsentCustomer] = useState<Subscriber | null>(null);
  const [consentDraft, setConsentDraft] = useState({ email: false, sms: false });
  const [contactDraft, setContactDraft] = useState({ phone: "", email: "" });
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(
    new Set(),
  );
  const [bulkMode, setBulkMode] = useState<BulkConsentMode | null>(null);
  const [bulkChannels, setBulkChannels] = useState({
    email: false,
    sms: false,
  });
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const canManageConsent = hasPermission(user, "customers.manage");

  const loadSubscribers = useCallback(async () => {
    if (!user?.restaurant_id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await growthApi.getSubscribers(user.restaurant_id);
      setSubscribers(data);
      setFilteredSubscribers(data);
    } catch (err) {
      console.error("Failed to load subscribers:", err);
      setError(getApiErrorMessage(err, "Customers could not be loaded. Try again."));
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    if (!searchQuery.trim() && channelFilter === "all") {
      setFilteredSubscribers(subscribers);
      setCurrentPage(1);
      return;
    }

    let filtered = subscribers;

    // Apply channel filter
    if (channelFilter === "email") {
      filtered = filtered.filter((s) => s.email_subscribed);
    } else if (channelFilter === "sms") {
      filtered = filtered.filter((s) => s.sms_subscribed);
    } else if (channelFilter === "both") {
      filtered = filtered.filter((s) => s.sms_subscribed && s.email_subscribed);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.name.toLowerCase().includes(query) ||
          sub.phone?.toLowerCase().includes(query) ||
          sub.email?.toLowerCase().includes(query)
      );
    }

    setFilteredSubscribers(filtered);
    setCurrentPage(1);
  }, [searchQuery, channelFilter, subscribers]);

  const stats = {
    customers: subscribers.length,
    total: subscribers.filter(
      (s) => s.email_subscribed || s.sms_subscribed,
    ).length,
    email: subscribers.filter((s) => s.email_subscribed).length,
    sms: subscribers.filter((s) => s.sms_subscribed).length,
  };

  // Pagination
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscribers = filteredSubscribers.slice(startIndex, endIndex);
  const selectedCustomers = subscribers.filter((customer) =>
    selectedCustomerIds.has(customer.customer_id),
  );
  const selectedPageCount = paginatedSubscribers.filter((customer) =>
    selectedCustomerIds.has(customer.customer_id),
  ).length;
  const allPageSelected =
    paginatedSubscribers.length > 0 &&
    selectedPageCount === paginatedSubscribers.length;

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const openConsentDialog = (customer: Subscriber) => {
    setConsentCustomer(customer);
    setConsentDraft({
      email: customer.email_subscribed,
      sms: customer.sms_subscribed,
    });
    setContactDraft({
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setConsentConfirmed(false);
  };

  const saveConsent = async () => {
    if (!consentCustomer || !user?.restaurant_id || !consentConfirmed) return;
    const emailChanged =
      consentDraft.email !== consentCustomer.email_subscribed;
    const smsChanged = consentDraft.sms !== consentCustomer.sms_subscribed;
    const phone = contactDraft.phone.trim();
    const email = contactDraft.email.trim();
    if (consentDraft.sms && !phone) {
      toast.error("Add a phone number before opting into SMS");
      return;
    }
    if (consentDraft.email && !email) {
      toast.error("Add an email address before opting into Email");
      return;
    }
    const contactChanged =
      phone !== (consentCustomer.phone || "").trim() ||
      email !== (consentCustomer.email || "").trim();
    if (!contactChanged && !emailChanged && !smsChanged) {
      setConsentCustomer(null);
      return;
    }

    try {
      setConsentSaving(true);
      if (contactChanged) {
        await apiClient.patch(
          CustomerApis.updateCustomer(consentCustomer.customer_id),
          { phone: phone || null, email: email || null },
        );
      }
      if (emailChanged || smsChanged) {
        await growthApi.updateStaffConsent({
          customerId: consentCustomer.customer_id,
          restaurantId: user.restaurant_id,
          emailOptedIn: emailChanged ? consentDraft.email : undefined,
          smsOptedIn: smsChanged ? consentDraft.sms : undefined,
        });
      }
      toast.success("Marketing consent updated");
      setConsentCustomer(null);
      await loadSubscribers();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update marketing consent"));
    } finally {
      setConsentSaving(false);
    }
  };

  const toggleCustomerSelection = (customerId: number, selected: boolean) => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (selected) next.add(customerId);
      else next.delete(customerId);
      return next;
    });
  };

  const toggleCurrentPage = (selected: boolean) => {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      for (const customer of paginatedSubscribers) {
        if (selected) next.add(customer.customer_id);
        else next.delete(customer.customer_id);
      }
      return next;
    });
  };

  const openBulkDialog = (mode: BulkConsentMode) => {
    setBulkMode(mode);
    setBulkChannels({ email: false, sms: false });
    setBulkConfirmed(false);
  };

  const bulkEligibility = {
    email: selectedCustomers.filter((customer) =>
      bulkMode === "opt_in"
        ? Boolean(customer.email) && !customer.email_subscribed
        : customer.email_subscribed,
    ).length,
    sms: selectedCustomers.filter((customer) =>
      bulkMode === "opt_in"
        ? Boolean(customer.phone) && !customer.sms_subscribed
        : customer.sms_subscribed,
    ).length,
  };

  const applyBulkConsent = async () => {
    if (!bulkMode || !user?.restaurant_id || !bulkConfirmed) return;
    const restaurantId = user.restaurant_id;
    if (!bulkChannels.email && !bulkChannels.sms) {
      toast.error("Select at least one channel");
      return;
    }

    const operations = selectedCustomers.flatMap((customer) => {
      const emailEligible =
        bulkChannels.email &&
        (bulkMode === "opt_in"
          ? Boolean(customer.email) && !customer.email_subscribed
          : customer.email_subscribed);
      const smsEligible =
        bulkChannels.sms &&
        (bulkMode === "opt_in"
          ? Boolean(customer.phone) && !customer.sms_subscribed
          : customer.sms_subscribed);
      if (!emailEligible && !smsEligible) return [];
      return [
        {
          customer,
          request: growthApi.updateStaffConsent({
            customerId: customer.customer_id,
            restaurantId,
            emailOptedIn: emailEligible ? bulkMode === "opt_in" : undefined,
            smsOptedIn: smsEligible ? bulkMode === "opt_in" : undefined,
          }),
        },
      ];
    });

    if (!operations.length) {
      toast.error("None of the selected customers are eligible for this change");
      return;
    }

    try {
      setBulkSaving(true);
      const results = await Promise.allSettled(
        operations.map((operation) => operation.request),
      );
      const failedIds = new Set<number>();
      let applied = 0;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") applied += 1;
        else failedIds.add(operations[index].customer.customer_id);
      });
      const skipped = selectedCustomers.length - operations.length;
      const failed = failedIds.size;
      toast[failed ? "warning" : "success"](
        `${bulkMode === "opt_in" ? "Opt-in" : "Opt-out"} applied to ${applied} customer${applied === 1 ? "" : "s"}. ${skipped} skipped${failed ? `, ${failed} failed` : ""}.`,
      );
      setSelectedCustomerIds(failedIds);
      setBulkMode(null);
      await loadSubscribers();
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-20">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-pretty text-3xl font-black tracking-tight">Customers</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            See who can receive offers and update a customer&apos;s contact permission.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSubscribers()} disabled={loading} className="gap-2 self-start md:self-auto">
          <RefreshCw aria-hidden="true" className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh customers
        </Button>
      </header>

      <section className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-4" aria-label="Customer reach summary">
        {[
          ["All customers", stats.customers, "People in your customer list"],
          ["Can receive offers", stats.total, "Email, SMS, or both"],
          ["SMS", stats.sms, "Can receive text offers"],
          ["Email", stats.email, "Can receive email offers"],
        ].map(([label, value, detail], index) => (
          <div key={label} className={cn("p-5", index > 0 && "border-t border-border sm:border-l sm:border-t-0", index === 2 && "sm:border-l-0 sm:border-t lg:border-l lg:border-t-0")}>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </section>

      {/* Subscribers List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Customer list</CardTitle>
              <CardDescription>
                Showing {filteredSubscribers.length ? startIndex + 1 : 0}-{Math.min(endIndex, filteredSubscribers.length)} of {filteredSubscribers.length} customers
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelFilter)}>
                <SelectTrigger aria-label="Filter customers by offer permission" className="w-full sm:w-48">
                  <Filter aria-hidden="true" className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="email">Can receive email</SelectItem>
                  <SelectItem value="sms">Can receive SMS</SelectItem>
                  <SelectItem value="both">Can receive both</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search customers"
                  name="customer-search"
                  autoComplete="off"
                  placeholder="Search by name, phone, or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          {canManageConsent && selectedCustomerIds.size > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {selectedCustomerIds.size} customer{selectedCustomerIds.size === 1 ? "" : "s"} selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Choose whether to allow or stop offers for these customers.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCustomerIds(new Set())}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openBulkDialog("opt_out")}
                >
                  <UserMinus aria-hidden="true" className="h-4 w-4" />
                  Stop offers
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openBulkDialog("opt_in")}
                >
                  <UserCheck aria-hidden="true" className="h-4 w-4" />
                  Allow offers
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadSubscribers()}>
                Try again
              </Button>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="text-center py-10">
              <Users aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">{searchQuery || channelFilter !== "all" ? "No matching customers" : "No customers yet"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{searchQuery || channelFilter !== "all" ? "Try another search or choose Everyone." : "Customers will appear after their first completed order."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canManageConsent && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            allPageSelected
                              ? true
                              : selectedPageCount > 0
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) =>
                            toggleCurrentPage(checked === true)
                          }
                          aria-label="Select customers on this page"
                        />
                      </TableHead>
                    )}
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Can receive</TableHead>
                    <TableHead className="text-right">Permission added</TableHead>
                    {canManageConsent && <TableHead className="w-[90px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.customer_id}>
                      {canManageConsent && (
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomerIds.has(subscriber.customer_id)}
                            onCheckedChange={(checked) =>
                              toggleCustomerSelection(
                                subscriber.customer_id,
                                checked === true,
                              )
                            }
                            aria-label={`Select ${subscriber.name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{subscriber.name}</TableCell>
                      <TableCell>
                        {subscriber.phone ? (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone aria-hidden="true" className="h-3.5 w-3.5" />
                            {subscriber.phone}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {subscriber.email ? (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MdEmail aria-hidden="true" className="h-3.5 w-3.5" />
                            {subscriber.email}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getLanguageLabel(subscriber.preferred_language)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <ConsentBadge channel="Email" status={subscriber.email_status} />
                          <ConsentBadge channel="SMS" status={subscriber.sms_status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {subscriber.created_at
                          ? new Date(subscriber.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      {canManageConsent && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openConsentDialog(subscriber)}
                          >
                            <PencilLine aria-hidden="true" className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredSubscribers.length > itemsPerPage && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(consentCustomer)}
        onOpenChange={(open) => {
          if (!open && !consentSaving) setConsentCustomer(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer contact permissions</DialogTitle>
            <DialogDescription>
              Add any missing contact details, then select the channels {consentCustomer?.name}
              {" "}explicitly agreed to. Turning a channel off records an opt-out immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                aria-label="Allow SMS offers"
                checked={consentDraft.sms}
                disabled={!contactDraft.phone.trim() && !consentCustomer?.sms_subscribed}
                onCheckedChange={(checked) =>
                  setConsentDraft((current) => ({
                    ...current,
                    sms: checked === true,
                  }))
                }
              />
              <div className="min-w-0 flex-1 space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-violet-600" /> SMS
                </span>
                <Input
                  value={contactDraft.phone}
                  onChange={(event) =>
                    setContactDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  type="tel"
                  name="customer-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98XXXXXXXX"
                  aria-label="Customer phone number"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                aria-label="Allow email offers"
                checked={consentDraft.email}
                disabled={!contactDraft.email.trim() && !consentCustomer?.email_subscribed}
                onCheckedChange={(checked) =>
                  setConsentDraft((current) => ({
                    ...current,
                    email: checked === true,
                  }))
                }
              />
              <div className="min-w-0 flex-1 space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MdEmail className="h-4 w-4 text-blue-600" /> Email
                </span>
                <Input
                  value={contactDraft.email}
                  onChange={(event) =>
                    setContactDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  type="email"
                  name="customer-email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="customer@example.com"
                  aria-label="Customer email address"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Checkbox
                checked={consentConfirmed}
                onCheckedChange={(checked) =>
                  setConsentConfirmed(checked === true)
                }
              />
              <span className="text-xs leading-5 text-muted-foreground">
                I confirm the customer personally requested these consent changes.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConsentCustomer(null)}
              disabled={consentSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveConsent()}
              disabled={!consentConfirmed || consentSaving}
              className="gap-2"
            >
              {consentSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(bulkMode)}
        onOpenChange={(open) => {
          if (!open && !bulkSaving) setBulkMode(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkMode === "opt_in" ? "Bulk opt in" : "Bulk opt out"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomers.length} selected. Only customers eligible for
              each chosen channel will be changed; the rest will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4 text-violet-600" /> SMS
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {bulkEligibility.sms} eligible
              </span>
              <Checkbox
                checked={bulkChannels.sms}
                disabled={bulkEligibility.sms === 0}
                onCheckedChange={(checked) =>
                  setBulkChannels((current) => ({
                    ...current,
                    sms: checked === true,
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <MdEmail className="h-4 w-4 text-blue-600" /> Email
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {bulkEligibility.email} eligible
              </span>
              <Checkbox
                checked={bulkChannels.email}
                disabled={bulkEligibility.email === 0}
                onCheckedChange={(checked) =>
                  setBulkChannels((current) => ({
                    ...current,
                    email: checked === true,
                  }))
                }
              />
            </label>

            <label className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <Checkbox
                checked={bulkConfirmed}
                onCheckedChange={(checked) => setBulkConfirmed(checked === true)}
              />
              <span className="text-xs leading-5 text-muted-foreground">
                {bulkMode === "opt_in"
                  ? "I confirm every customer being opted in personally agreed to receive marketing on the selected channel."
                  : "I confirm these customers requested or require this opt-out."}
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkMode(null)}
              disabled={bulkSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void applyBulkConsent()}
              disabled={
                bulkSaving ||
                !bulkConfirmed ||
                (!bulkChannels.email && !bulkChannels.sms)
              }
              className="gap-2"
            >
              {bulkSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply to eligible
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
