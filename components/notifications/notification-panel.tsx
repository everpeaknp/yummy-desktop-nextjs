"use client";

import { useEffect, useRef, useCallback } from "react";
import { Bell, CheckCheck, Loader2, BellOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications, useNotificationStore } from "@/hooks/use-notifications";
import { NotificationCard } from "./notification-card";

export function NotificationPanel() {
  const {
    notifications,
    loading,
    total,
    allNotifications,
    activeTab,
    fetchNotifications,
    markAllRead,
    tabs,
    unreadCount,
  } = useNotifications();

  const { panelOpen, setPanelOpen, setActiveTab } = useNotificationStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Fetch when panel opens
  useEffect(() => {
    if (panelOpen && !hasFetched.current) {
      hasFetched.current = true;
      fetchNotifications();
      markAllRead();
    }
    if (!panelOpen) {
      hasFetched.current = false;
    }
  }, [panelOpen, fetchNotifications, markAllRead]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      if (allNotifications.length < total && !loading) {
        fetchNotifications({ loadMore: true });
      }
    }
  }, [allNotifications.length, total, loading, fetchNotifications]);

  const handleTabChange = (type: string | null) => {
    setActiveTab(type);
  };

  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground"
                onClick={() => markAllRead()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => handleTabChange(tab.type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    activeTab === tab.type
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Notification list */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <div className="rounded-full bg-muted p-4">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">No notifications</p>
                <p className="text-xs text-muted-foreground mt-1">
                  There are no notifications for this category yet.
                </p>
              </div>
            </div>
          ) : (
            <>
              {notifications.map((n) => (
                <NotificationCard key={n.id} notification={n} />
              ))}
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
