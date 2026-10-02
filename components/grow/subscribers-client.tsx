"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Grid3x3, List, Phone, MessageSquareText, RefreshCw, Search, Users, Filter, ChevronLeft, ChevronRight, Share2, Copy, Check, ExternalLink, Download, QrCode as QrCodeIcon, PencilLine, Loader2, UserCheck, UserMinus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRestaurant } from "@/hooks/use-restaurant";
import type { GrowthSettings } from "@/lib/api/growth-types";
import { hasPermission } from "@/lib/role-permissions";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";

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

type ViewMode = "table" | "grid";
type ChannelFilter = "all" | "email" | "sms" | "both";
type BulkConsentMode = "opt_in" | "opt_out";

function resolveGrowPublicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GROW_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

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
      ? "Opted in"
      : status === "opted_out"
        ? "Opted out"
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
        <MessageSquareText className="h-3.5 w-3.5" />
      ) : (
        <MdEmail className="h-3.5 w-3.5" />
      )}
      {channel}: {label}
    </Badge>
  );
}

export function SubscribersClient() {
  const user = useAuth((state) => state.user);
  const { restaurant } = useRestaurant();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
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

  const loadSubscribers = async () => {
    if (!user?.restaurant_id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await growthApi.getSubscribers(user.restaurant_id);
      setSubscribers(data);
      setFilteredSubscribers(data);
    } catch (err) {
      console.error("Failed to load subscribers:", err);
      setError(err instanceof Error ? err.message : "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const data = await growthApi.getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load growth settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    void loadSubscribers();
    void loadSettings();
  }, [user?.restaurant_id]);

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
    both: subscribers.filter((s) => s.sms_subscribed && s.email_subscribed).length,
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

  const signupUrl = 
    settings?.public_enrollment_slug
      ? `${resolveGrowPublicBaseUrl()}/grow/join?restaurant=${encodeURIComponent(settings.public_enrollment_slug)}`
      : "";

  useEffect(() => {
    if (!signupUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(signupUrl, {
      width: 520,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(() => toast.error("Failed to render the sign-up QR code"));
  }, [signupUrl]);

  const copyToClipboard = async () => {
    if (!signupUrl) return;
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const shareNative = async () => {
    if (!signupUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our rewards program",
          text: "Sign up to receive exclusive offers and deals!",
          url: signupUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Failed to share");
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${safeFileName(restaurant?.name || "restaurant")}-grow-signup-qr.png`;
    anchor.click();
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
      toast.error(err instanceof Error ? err.message : "Failed to update consent");
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
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Customer Audience</h1>
          <p className="text-sm text-muted-foreground">
            All active customers, with their marketing consent shown per channel
          </p>
        </div>
        <div className="flex items-center gap-2">
          {signupUrl && (
            <>
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share Sign-up Page
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Share Public Sign-up Page</DialogTitle>
                    <DialogDescription>
                      Share this link or QR code with customers so they can join your rewards program
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* QR Code Display */}
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
                      {qrDataUrl ? (
                        <Image
                          src={qrDataUrl}
                          width={200}
                          height={200}
                          alt="Growth sign-up QR code"
                          unoptimized
                          className="h-[200px] w-[200px] rounded bg-white p-2"
                        />
                      ) : (
                        <div className="flex h-[200px] w-[200px] items-center justify-center text-muted-foreground">
                          <QrCodeIcon className="h-12 w-12" />
                        </div>
                      )}
                      <Button
                        onClick={downloadQr}
                        disabled={!qrDataUrl}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download QR Code
                      </Button>
                    </div>

                    {/* URL Display and Copy */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sign-up Link</label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value={signupUrl} 
                          readOnly 
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void copyToClipboard()}
                          className="shrink-0"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="flex-1 gap-2"
                        onClick={() => void shareNative()}
                      >
                        <Share2 className="h-4 w-4" />
                        Share Link
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        variant="outline"
                        asChild
                      >
                        <a href={signupUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open Page
                        </a>
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 gap-1.5"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Table</span>
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 gap-1.5"
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="hidden sm:inline">Grid</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSubscribers()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.customers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-500/10">
                <MessageSquareText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SMS</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.sms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-orange-500/10">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscribers</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <MdEmail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Subscribers List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>All Customers</CardTitle>
              <CardDescription>
                Showing {filteredSubscribers.length ? startIndex + 1 : 0}-{Math.min(endIndex, filteredSubscribers.length)} of {filteredSubscribers.length} customers
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="email">Email opted in</SelectItem>
                  <SelectItem value="sms">SMS opted in</SelectItem>
                  <SelectItem value="both">Both opted in</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email..."
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
                  Eligibility is checked separately for Email and SMS.
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
                  <UserMinus className="h-4 w-4" />
                  Opt out
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openBulkDialog("opt_in")}
                >
                  <UserCheck className="h-4 w-4" />
                  Opt in
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
            <div className="text-center py-10">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || channelFilter !== "all" ? "No customers match your filters" : "No customers yet"}
              </p>
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-lg border">
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
                    <TableHead>Preferred Language</TableHead>
                    <TableHead>Marketing consent</TableHead>
                    <TableHead className="text-right">Last opt-in</TableHead>
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
                            <Phone className="h-3.5 w-3.5" />
                            {subscriber.phone}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {subscriber.email ? (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MdEmail className="h-3.5 w-3.5" />
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
                            <PencilLine className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedSubscribers.map((subscriber) => (
                <div
                  key={subscriber.customer_id}
                  className={cn(
                    "relative flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30",
                    selectedCustomerIds.has(subscriber.customer_id) &&
                      "border-primary/40 bg-primary/5",
                  )}
                >
                  {canManageConsent && (
                    <Checkbox
                      checked={selectedCustomerIds.has(subscriber.customer_id)}
                      onCheckedChange={(checked) =>
                        toggleCustomerSelection(
                          subscriber.customer_id,
                          checked === true,
                        )
                      }
                      aria-label={`Select ${subscriber.name}`}
                      className="absolute right-4 top-4"
                    />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{subscriber.name}</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {subscriber.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {subscriber.phone}
                        </div>
                      )}
                      {subscriber.email && (
                        <div className="flex items-center gap-1.5">
                          <MdEmail className="h-3.5 w-3.5" />
                          {subscriber.email}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">Language:</span>
                        <span>{getLanguageLabel(subscriber.preferred_language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <ConsentBadge channel="Email" status={subscriber.email_status} />
                    <ConsentBadge channel="SMS" status={subscriber.sms_status} />
                  </div>
                  {subscriber.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Subscribed {new Date(subscriber.created_at).toLocaleDateString()}
                    </p>
                  )}
                  {canManageConsent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto gap-1.5"
                      onClick={() => openConsentDialog(subscriber)}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Manage consent
                    </Button>
                  )}
                </div>
              ))}
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
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
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
            <DialogTitle>Manage marketing consent</DialogTitle>
            <DialogDescription>
              Add any missing contact details, then select the channels {consentCustomer?.name}
              {" "}explicitly agreed to. Turning a channel off records an opt-out immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                checked={consentDraft.sms}
                disabled={!contactDraft.phone.trim() && !consentCustomer?.sms_subscribed}
                onCheckedChange={(checked) =>
                  setConsentDraft((current) => ({
                    ...current,
                    sms: checked === true,
                  }))
                }
              />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-violet-600" /> SMS
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uses the phone number above.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
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
    </div>
  );
}
