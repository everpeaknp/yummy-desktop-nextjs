"use client";

import { useEffect, useState } from "react";
import { Grid3x3, List, Phone, RefreshCw, Search, Users, Filter, ChevronLeft, ChevronRight } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import { cn } from "@/lib/utils";

interface Subscriber {
  customer_id: number;
  name: string;
  phone?: string;
  email?: string;
  whatsapp_subscribed: boolean;
  email_subscribed: boolean;
  created_at: string;
}

type ViewMode = "table" | "grid";
type ChannelFilter = "all" | "whatsapp" | "email" | "both";

export function SubscribersClient() {
  const user = useAuth((state) => state.user);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [filteredSubscribers, setFilteredSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  useEffect(() => {
    void loadSubscribers();
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
                        <div className="flex items-center gap-2">
                          {subscriber.whatsapp_subscribed && (
                            <Badge variant="outline" className="gap-1.5">
                              <FaWhatsapp className="h-3 w-3" />
                              WhatsApp
                            </Badge>
                          )}
                          {subscriber.email_subscribed && (
                            <Badge variant="outline" className="gap-1.5">
                              <MdEmail className="h-3 w-3" />
                              Email
                            </Badge>
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
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    {subscriber.whatsapp_subscribed && (
                      <Badge variant="outline" className="gap-1.5">
                        <FaWhatsapp className="h-3 w-3" />
                        WhatsApp
                      </Badge>
                    )}
                    {subscriber.email_subscribed && (
                      <Badge variant="outline" className="gap-1.5">
                        <MdEmail className="h-3 w-3" />
                        Email
                      </Badge>
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
