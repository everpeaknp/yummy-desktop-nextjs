"use client";

import Link from "next/link";
import {
  BookOpen,
  Compass,
  Layers,
  LayoutGrid,
  Mail,
  MessageSquare,
  Rocket,
  Settings,
  Store,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { canReplayOnboarding } from "@/lib/onboarding";
import { isPathAccessible } from "@/lib/role-permissions";
import { requestProductTour } from "@/lib/product-tour";

type HelpAction = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
};

type HelpShortcut = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
};

function ActionTile({
  action,
  onNavigate,
}: {
  action: HelpAction;
  onNavigate: () => void;
}) {
  const className = cn(
    "flex h-full flex-col gap-3 rounded-lg border border-border bg-background p-3.5 text-left transition-colors",
    "hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  const body = (
    <>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <action.icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{action.title}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{action.description}</p>
      </div>
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} className={className} onClick={onNavigate}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onNavigate();
        action.onClick?.();
      }}
    >
      {body}
    </button>
  );
}

function ShortcutRow({
  shortcut,
  onNavigate,
}: {
  shortcut: HelpShortcut;
  onNavigate: () => void;
}) {
  const className =
    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  const body = (
    <>
      <shortcut.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 font-medium">{shortcut.title}</span>
    </>
  );

  if (shortcut.href) {
    return (
      <Link href={shortcut.href} className={className} onClick={onNavigate}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onNavigate();
        shortcut.onClick?.();
      }}
    >
      {body}
    </button>
  );
}

export function HelpCenterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated Replay is admin-only via canReplayOnboarding; prop ignored. */
  includeOnboarding?: boolean;
}) {
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const showGateway =
    Boolean(restaurant?.restaurant_enabled) && Boolean(restaurant?.hotel_enabled);
  const showOnboarding = canReplayOnboarding(user);
  const close = () => onOpenChange(false);

  const startingActions: HelpAction[] = [
    {
      title: "Product tour",
      description: "Walk through the main dashboard areas",
      icon: Compass,
      onClick: () => requestProductTour(),
    },
    ...(showOnboarding
      ? [
          {
            title: "Onboarding",
            description: "Replay the workspace setup guide",
            href: "/onboarding?replay=1",
            icon: Rocket,
          } satisfies HelpAction,
        ]
      : []),
  ];

  const shortcuts: HelpShortcut[] = [
    ...(showGateway
      ? [{ title: "Switch workspace", href: "/gateway", icon: Layers } satisfies HelpShortcut]
      : []),
    { title: "Restaurant profile", href: "/manage/profile", icon: Store },
    { title: "Restaurant settings", href: "/manage/settings", icon: Settings },
    {
      title: "Additional settings",
      href: "/manage/additional-settings",
      icon: LayoutGrid,
    },
    {
      title: "Guides & tutorials",
      href: "/manage/additional-settings?setting=guides",
      icon: BookOpen,
    },
  ].filter((item) => {
    if (!item.href) return true;
    if (item.href.startsWith("/onboarding")) return showOnboarding;
    return isPathAccessible(item.href, user);
  });

  const supportLinks: HelpShortcut[] = [
    { title: "Send feedback", href: "/feedback", icon: MessageSquare },
    {
      title: "Email support",
      icon: Mail,
      onClick: () => {
        window.location.href = "mailto:support@yummy.com";
      },
    },
  ].filter((item) => {
    if (!item.href) return true;
    return isPathAccessible(item.href, user);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <DialogHeader className="space-y-1 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">Help</DialogTitle>
          <DialogDescription>
            Start a tour or jump to a common setting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-5">
          <section className={cn("grid gap-2", startingActions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {startingActions.map((action) => (
              <ActionTile key={action.title} action={action} onNavigate={close} />
            ))}
          </section>

          {shortcuts.length > 0 ? (
            <section>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Settings</h3>
              <div className="rounded-lg border bg-muted/20 p-1">
                {shortcuts.map((shortcut) => (
                  <ShortcutRow key={shortcut.title} shortcut={shortcut} onNavigate={close} />
                ))}
              </div>
            </section>
          ) : null}

          {supportLinks.length > 0 ? (
            <section className="flex items-center gap-1 border-t pt-3 text-sm text-muted-foreground">
              {supportLinks.map((link, index) => (
                <span key={link.title} className="contents">
                  {index > 0 ? <span className="px-1.5 text-border">·</span> : null}
                  {link.href ? (
                    <Link
                      href={link.href}
                      onClick={close}
                      className="font-medium text-foreground/80 transition-colors hover:text-primary"
                    >
                      {link.title}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        link.onClick?.();
                      }}
                      className="font-medium text-foreground/80 transition-colors hover:text-primary"
                    >
                      {link.title}
                    </button>
                  )}
                </span>
              ))}
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
