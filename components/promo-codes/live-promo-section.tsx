"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Grid3x3, List, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { LivePromoCode, LivePromoFilters } from "@/lib/live-promo-types";
import {
  listLivePromoCodes,
  computePromoStatus,
} from "@/lib/live-promo-service";
import { LivePromoCard } from "./live-promo-card";
import { LivePromoListView } from "./live-promo-list-view";
import { LivePromoSkeleton } from "./live-promo-skeleton";

export function LivePromoSection() {
  const [promos, setPromos] = useState<LivePromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<LivePromoFilters>({
    status: "all",
    searchQuery: "",
  });

  const { toast } = useToast();

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLivePromoCodes();
      setPromos(data);
    } catch (error) {
      console.error("Failed to fetch live promo codes:", error);
      toast({
        title: "Error",
        description: "Failed to load promo codes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  // Filter and compute stats
  const filteredPromos = promos.filter((promo) => {
    const status = computePromoStatus(promo);
    const matchesStatus = filters.status === "all" || status === filters.status;
    const matchesSearch =
      !filters.searchQuery ||
      promo.code.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      promo.description.toLowerCase().includes(filters.searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: promos.length,
    active: promos.filter((p) => computePromoStatus(p) === "active").length,
    scheduled: promos.filter((p) => computePromoStatus(p) === "scheduled").length,
    expired: promos.filter((p) => computePromoStatus(p) === "expired").length,
    disabled: promos.filter((p) => computePromoStatus(p) === "disabled").length,
  };

  if (loading) {
    return <LivePromoSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Live Promo Codes</h2>
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
            {statusCounts.active} active
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          View available subscription promotional codes
        </p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "scheduled", "expired", "disabled"] as const).map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-9 rounded-full transition-all",
                filters.status === status && "shadow-sm"
              )}
              onClick={() => setFilters((prev) => ({ ...prev, status }))}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <Badge
                variant={filters.status === status ? "secondary" : "outline"}
                className="ml-2 h-5 px-1.5 rounded-full bg-background/20 text-xs"
              >
                {statusCounts[status]}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Search and View Toggle */}
        <div className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search codes..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              className="h-9 pl-9 rounded-lg sm:w-64"
            />
          </div>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredPromos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted bg-muted/10 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            {promos.length === 0 ? (
              <Tag className="h-8 w-8 text-primary" />
            ) : (
              <Search className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {promos.length === 0 ? "No promo codes available" : "No codes match this filter"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {promos.length === 0
              ? "No promo codes available right now. Check back soon."
              : "Try adjusting your filters or search query."}
          </p>
          {promos.length > 0 && (
            <Button
              onClick={() => setFilters({ status: "all", searchQuery: "" })}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPromos.map((promo) => (
            <LivePromoCard key={promo.id} promo={promo} />
          ))}
        </div>
      ) : (
        <LivePromoListView promos={filteredPromos} />
      )}
    </div>
  );
}
