"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Grid3x3, List, Phone, RefreshCw, Search, Users, Filter, ChevronLeft, ChevronRight, Share2, Copy, Check, ExternalLink, Download, QrCode as QrCodeIcon } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface Subscriber {
  customer_id: number;
  name: string;
  phone?: string;
  email?: string;
  preferred_language?: string;
  whatsapp_subscribed: boolean;
  email_subscribed: boolean;
  created_at: string;
}

type ViewMode = "table" | "grid";
type ChannelFilter = "all" | "whatsapp" | "email" | "both";

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
    if (channelFilter === "whatsapp") {
      filtered = filtered.filter((s) => s.whatsapp_subscribed);
    } else if (channelFilter === "email") {
      filtered = filtered.filter((s) => s.email_subscribed);
    } else if (channelFilter === "both") {
      filtered = filtered.filter((s) => s.whatsapp_subscribed && s.email_subscribed);
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
    total: subscribers.length,
    whatsapp: subscribers.filter((s) => s.whatsapp_subscribed).length,
    email: subscribers.filter((s) => s.email_subscribed).length,
    both: subscribers.filter((s) => s.whatsapp_subscribed && s.email_subscribed).length,
  };

  // Pagination
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscribers = filteredSubscribers.slice(startIndex, endIndex);

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

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-sm text-muted-foreground">
            Customers who have opted in to receive marketing communications
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Subscribers</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <FaWhatsapp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.whatsapp}</p>
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

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Both Channels</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.both}</p>
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
              <CardTitle>All Subscribers</CardTitle>
              <CardDescription>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredSubscribers.length)} of {filteredSubscribers.length} subscribers
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelFilter)}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="both">Both Channels</SelectItem>
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
                {searchQuery || channelFilter !== "all" ? "No subscribers found matching your filters" : "No subscribers yet"}
              </p>
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Preferred Language</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="text-right">Subscribed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.customer_id}>
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
                        <div className="flex items-center gap-2">
                          {subscriber.whatsapp_subscribed && (
                            <div className="p-1.5 rounded bg-green-500/10">
                              <FaWhatsapp className="h-4 w-4 text-green-600" />
                            </div>
                          )}
                          {subscriber.email_subscribed && (
                            <div className="p-1.5 rounded bg-blue-500/10">
                              <MdEmail className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {subscriber.created_at
                          ? new Date(subscriber.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
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
                  className="flex flex-col gap-3 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
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
                    {subscriber.whatsapp_subscribed && (
                      <div className="p-1.5 rounded bg-green-500/10" title="WhatsApp">
                        <FaWhatsapp className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                    {subscriber.email_subscribed && (
                      <div className="p-1.5 rounded bg-blue-500/10" title="Email">
                        <MdEmail className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                  {subscriber.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Subscribed {new Date(subscriber.created_at).toLocaleDateString()}
                    </p>
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
    </div>
  );
}
