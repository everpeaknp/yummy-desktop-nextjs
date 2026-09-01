"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Hash,
  Info,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasPermission } from "@/lib/role-permissions";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import {
  FinanceHeadType,
  FinanceReportingHeadRead,
  FinanceReportingTreeNode,
} from "@/types/finance-reporting";
import { AccountHeadDialog, TYPE_LABELS } from "./account-head-dialog";
import { AccountGroupDialog } from "./account-group-dialog";
import { OpeningBalanceWizard } from "./opening-balance-wizard";
import { AccountLedgerPanel } from "@/components/finance/reports/account-ledger-panel";

const TYPE_COLORS: Record<FinanceHeadType, { badge: string; text: string; bg: string }> = {
  asset: {
    badge: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  liability: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  equity: {
    badge: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  income: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  contra_income: {
    badge: "bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800",
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
  },
  expense: {
    badge: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
  },
};

// These heads exist only to support historical events that did not identify a
// specific drawer/bank. Real custody is always represented by a dedicated
// head linked to that physical account.
const FALLBACK_CUSTODY_ROLES = new Set(["cash_drawer", "main_safe", "bank_account"]);

export function AccountHeadsClient() {
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const restaurantId = restaurant?.id || 0;

  const canManageCoa = hasPermission(user, "finance.coa.manage");
  const canManageGroups = hasPermission(user, "finance.coa.group.manage");
  const canManageOpeningBalances = hasPermission(
    user,
    "finance.coa.opening_balances.manage"
  );

  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<FinanceReportingTreeNode[]>([]);
  const [allHeads, setAllHeads] = useState<FinanceReportingHeadRead[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [activeHeadIds, setActiveHeadIds] = useState<Set<number>>(new Set());
  const [linkedCustodyHeadIds, setLinkedCustodyHeadIds] = useState<Set<number>>(new Set());

  // Filters
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [postableFilter, setPostableFilter] = useState<"all" | "postable" | "group">("all");
  const [showAccountingDetails, setShowAccountingDetails] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"in-use" | "available" | "setup">("in-use");

  // Dialog states
  const [headDialogOpen, setHeadDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false);
  const [initialParentId, setInitialParentId] = useState<number | null>(null);
  const [editingHead, setEditingHead] = useState<FinanceReportingHeadRead | null>(null);
  // Groups open the metadata sheet below; categories (postable heads) open
  // the shared Account Ledger panel -- the same one Reports > Accounts uses,
  // so both screens show identical, fully-built ledger detail.
  const [detailHead, setDetailHead] = useState<FinanceReportingHeadRead | null>(null);
  const [ledgerHeadId, setLedgerHeadId] = useState<number | null>(null);

  const loadData = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [treeRes, headsRes, activityRes, custodyRes] = await Promise.all([
        financeReportingApi.getTree(restaurantId),
        financeReportingApi.listHeads(restaurantId, { is_active: showInactive ? undefined : true }),
        financeReportingApi.getHeadActivity({ include_zero: false }),
        financeReportingApi.getCustodyReconciliation(),
      ]);
      setTreeData(treeRes);
      setAllHeads(headsRes);
      setActiveHeadIds(new Set(activityRes.rows.filter((row) => row.is_postable).map((row) => row.head_id)));
      setLinkedCustodyHeadIds(
        new Set(
          custodyRes.rows
            .map((row) => row.reporting_head_id)
            .filter((headId): headId is number => typeof headId === "number"),
        ),
      );

      // Default expand roots and top-level groups
      const defaultExpanded = new Set<number>();
      treeRes.forEach((root) => {
      defaultExpanded.add(root.id);
        root.children.forEach((child) => defaultExpanded.add(child.id));
      });
      setExpandedNodeIds(defaultExpanded);
    } catch (err: any) {
      toast.error(err.message || "Couldn't load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, showInactive]);

  const toggleExpand = (nodeId: number) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleCreateUnderParent = (parent: FinanceReportingHeadRead, isGroup: boolean) => {
    setInitialParentId(parent.id);
    setEditingHead(null);
    if (isGroup) {
      setGroupDialogOpen(true);
    } else {
      setHeadDialogOpen(true);
    }
  };

  const handleEditHead = (head: FinanceReportingHeadRead) => {
    setEditingHead(head);
    setInitialParentId(head.parent_id);
    setHeadDialogOpen(true);
  };

  const detailsVisible = showAccountingDetails || workspaceView === "setup";

  const displayName = (head: FinanceReportingHeadRead) =>
    workspaceView === "setup" && FALLBACK_CUSTODY_ROLES.has(head.system_role || "")
      ? `Built-in — ${head.name}`
      : head.name;

  // Filter tree nodes based on the selected workspace, search, type and posting filters.
  const filterNode = (node: FinanceReportingTreeNode): boolean => {
    const head = node;
    const isFallbackCustody = FALLBACK_CUSTODY_ROLES.has(head.system_role || "");
    const matchesWorkspace =
      workspaceView === "setup" ||
      (workspaceView === "available" && !isFallbackCustody) ||
      (workspaceView === "in-use" && head.is_postable && (activeHeadIds.has(head.id) || linkedCustodyHeadIds.has(head.id)));
    const matchesType = selectedType === "all" || head.head_type === selectedType;
    const matchesSearch =
      !searchQuery.trim() ||
      head.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      head.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (head.hierarchy_path && head.hierarchy_path.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPostable =
      postableFilter === "all" ||
      (postableFilter === "postable" && head.is_postable) ||
      (postableFilter === "group" && !head.is_postable);

    // If node directly matches or any descendant matches
    const selfMatches = matchesWorkspace && matchesType && matchesSearch && matchesPostable;
    const childrenMatch = node.children.some((child) => filterNode(child));
    return selfMatches || childrenMatch;
  };

  const filteredTree = useMemo(() => {
    return treeData.filter((node) => filterNode(node));
  }, [
    treeData,
    selectedType,
    searchQuery,
    postableFilter,
    workspaceView,
    activeHeadIds,
    linkedCustodyHeadIds,
  ]);

  const eligibleLeaves = useMemo(() => {
    return allHeads.filter((h) => h.is_postable && h.is_active);
  }, [allHeads]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: FinanceReportingTreeNode, depth: number = 0) => {
    const head = node;
    const visibleChildren = node.children.filter((child) => filterNode(child));
    const hasChildren = visibleChildren.length > 0;
    const isExpanded = expandedNodeIds.has(head.id);
    const colors = TYPE_COLORS[head.head_type] || TYPE_COLORS.asset;

    return (
      <div key={head.id} className="flex flex-col">
        <div
          className={`group flex items-center justify-between border-b border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40 ${
            !head.is_active ? "opacity-60 bg-muted/20" : ""
          } ${depth === 0 ? "bg-muted/15 font-semibold" : ""}`}
          style={{ paddingLeft: `${Math.max(12, depth * 24 + 12)}px` }}
        >
          {/* Left: hierarchy and the name people use in the product. */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(head.id)}
                className="h-5 w-5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {head.is_postable ? (
              <Hash className="h-4 w-4 text-muted-foreground/70 shrink-0" />
            ) : isExpanded ? (
              <FolderOpen className={`h-4 w-4 shrink-0 ${colors.text}`} />
            ) : (
              <Folder className={`h-4 w-4 shrink-0 ${colors.text}`} />
            )}

            {detailsVisible && (
              <span className="font-mono text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {head.code}
              </span>
            )}

            <button
              type="button"
              onClick={() =>
                head.is_postable ? setLedgerHeadId(head.id) : setDetailHead(head)
              }
              className="truncate text-sm font-medium hover:underline text-left text-foreground"
            >
              {displayName(head)}
            </button>

            {detailsVisible && head.system_role && (
              <Badge
                variant="outline"
                className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 gap-0.5 py-0"
              >
                <Lock className="h-2.5 w-2.5" />
                Built-in
              </Badge>
            )}

            {!head.is_active && (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 py-0">
                Inactive
              </Badge>
            )}
          </div>

          {/* Right: Badges & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[11px] py-0 ${colors.badge}`}>
                {TYPE_LABELS[head.head_type]}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {head.is_postable ? "Category" : "Group"}
              </span>
            </div>

            {/* Actions */}
            {canManageCoa && (
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                {!head.is_postable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-primary hover:bg-primary/10"
                    title="Add a category in this group"
                    onClick={() => handleCreateUnderParent(head, false)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Add category</span>
                  </Button>
                )}

                {!head.is_postable && canManageGroups && depth < 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-amber-600 hover:bg-amber-500/10"
                    title="Add a group inside this group"
                    onClick={() => handleCreateUnderParent(head, true)}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Add group</span>
                  </Button>
                )}

                {head.is_postable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
                    title="Edit category"
                    onClick={() => handleEditHead(head)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Edit</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Child nodes */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {visibleChildren.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" />
            Chart of Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize the categories you use when recording income and expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant={detailsVisible ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAccountingDetails((current) => !current)}
            disabled={workspaceView === "setup"}
            className="gap-1.5 text-xs"
          >
            <Info className="h-3.5 w-3.5" />
            {detailsVisible ? "More details shown" : "Show more details"}
          </Button>

          {canManageOpeningBalances && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpeningBalanceOpen(true)}
              className="gap-1.5 text-xs border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <Layers className="h-3.5 w-3.5" />
              Starting Balances
            </Button>
          )}

          {canManageGroups && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInitialParentId(null);
                setEditingHead(null);
                setGroupDialogOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Add Group
            </Button>
          )}

          {canManageCoa && (
            <Button
              size="sm"
              onClick={() => {
                setInitialParentId(null);
                setEditingHead(null);
                setHeadDialogOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Workspace views keep daily work separate from the complete list. */}
      <div className="rounded-xl border bg-card p-3">
        <Tabs value={workspaceView} onValueChange={(value) => setWorkspaceView(value as "in-use" | "available" | "setup")}>
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="in-use" className="px-3 py-2 text-xs">In use</TabsTrigger>
            <TabsTrigger value="available" className="px-3 py-2 text-xs">Available categories</TabsTrigger>
            <TabsTrigger value="setup" className="px-3 py-2 text-xs">Full list</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="mt-2 text-xs text-muted-foreground">
          {workspaceView === "in-use"
            ? "Categories you've actually used, or that are linked to a real bank, safe, or cash drawer."
            : workspaceView === "available"
              ? "All categories you can choose from when recording a transaction."
              : "The complete list, including built-in categories and their codes."}
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={detailsVisible ? "Search code, name, or path..." : "Search categories..."}
            className="pl-8 h-9 text-xs"
          />
        </div>

        {/* Type Tabs */}
        <Tabs
          value={selectedType}
          onValueChange={setSelectedType}
          className="w-auto"
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-2.5">
              All
            </TabsTrigger>
            <TabsTrigger value="asset" className="text-xs px-2.5">
              Assets
            </TabsTrigger>
            <TabsTrigger value="liability" className="text-xs px-2.5">
              Liabilities
            </TabsTrigger>
            <TabsTrigger value="equity" className="text-xs px-2.5">
              Equity
            </TabsTrigger>
            <TabsTrigger value="income" className="text-xs px-2.5">
              Income
            </TabsTrigger>
            <TabsTrigger value="expense" className="text-xs px-2.5">
              Expenses
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Hierarchy Tree Container */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between bg-muted/40 border-b px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>Name</span>
          <div className="hidden sm:flex items-center gap-8 pr-12">
            <span>Type</span>
            <span>Use</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs">Loading categories...</p>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
            <FolderTree className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                No categories found
              </p>
              <p className="text-xs max-w-sm mt-0.5">
                {searchQuery
                  ? "Try clearing your search or adjusting your filters."
                  : "Try a different tab, or click 'Add Category' above to create one."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredTree.map((rootNode) => renderTreeNode(rootNode, 0))}
          </div>
        )}
      </div>

      {/* Head Detail Sheet / Drawer */}
      <Sheet open={!!detailHead} onOpenChange={(open) => !open && setDetailHead(null)}>
        <SheetContent className="sm:max-w-md">
          {detailHead && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {detailHead.code}
                  </Badge>
                  <SheetTitle className="truncate">{detailHead.name}</SheetTitle>
                </div>
                <SheetDescription className="font-mono text-xs">
                  {detailHead.hierarchy_path || detailHead.name}
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-4 py-6 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-semibold mt-0.5">
                      {TYPE_LABELS[detailHead.head_type]}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className="font-semibold mt-0.5">
                      {detailHead.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                {detailHead.system_role && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <span className="font-semibold text-primary flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Built-in category
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      This category is used automatically by the system (for example: cash,
                      amounts owed to you, or amounts you owe) and can't be deleted.
                    </p>
                  </div>
                )}

                {detailHead.description && (
                  <div className="rounded-lg border p-3">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1 text-foreground leading-relaxed">
                      {detailHead.description}
                    </p>
                  </div>
                )}

                {(detailHead.business_line_scope || detailHead.station_scope) && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <span className="text-muted-foreground font-medium">Applies to:</span>
                    {detailHead.business_line_scope && (
                      <p>
                        <span className="text-muted-foreground">Business: </span>
                        <span className="font-semibold capitalize">{detailHead.business_line_scope}</span>
                      </p>
                    )}
                    {detailHead.station_scope && (
                      <p>
                        <span className="text-muted-foreground">Department: </span>
                        <span className="font-semibold">{detailHead.station_scope}</span>
                      </p>
                    )}
                  </div>
                )}

                {canManageCoa && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        const h = detailHead;
                        setDetailHead(null);
                        handleEditHead(h);
                      }}
                    >
                      Edit
                    </Button>
                    {!detailHead.is_postable && (
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          const h = detailHead;
                          setDetailHead(null);
                          handleCreateUnderParent(h, false);
                        }}
                      >
                        Add category
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Category detail: shared with Reports > Accounts */}
      <AccountLedgerPanel
        headId={ledgerHeadId}
        onOpenChange={(open) => !open && setLedgerHeadId(null)}
        onEdit={
          canManageCoa
            ? () => {
                const h = allHeads.find((head) => head.id === ledgerHeadId);
                setLedgerHeadId(null);
                if (h) handleEditHead(h);
              }
            : undefined
        }
      />

      {/* Leaf Head Dialog */}
      <AccountHeadDialog
        open={headDialogOpen}
        onOpenChange={setHeadDialogOpen}
        restaurantId={restaurantId}
        initialParentId={initialParentId}
        editHead={editingHead}
        parentOptions={allHeads}
        onSuccess={loadData}
      />

      {/* Roll-up Group Dialog */}
      <AccountGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        restaurantId={restaurantId}
        initialParentId={initialParentId}
        parentOptions={allHeads}
        onSuccess={loadData}
      />

      {/* Opening Balance Wizard */}
      <OpeningBalanceWizard
        open={openingBalanceOpen}
        onOpenChange={setOpeningBalanceOpen}
        restaurantId={restaurantId}
        eligibleLeaves={eligibleLeaves}
        onSuccess={loadData}
      />
    </div>
  );
}
