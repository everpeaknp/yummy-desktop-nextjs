"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Compass,
  HelpCircle,
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
import { useRestaurant } from "@/hooks/use-restaurant";
import { requestProductTour } from "@/lib/product-tour";

type HelpLink = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  href?: string;
  onClick?: () => void;
};

function HelpLinkRow({ link, onNavigate }: { link: HelpLink; onNavigate?: () => void }) {
  const content = (
    <>
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          link.iconBg,
          link.iconColor
        )}
      >
        <link.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-bold">{link.title}</div>
        <p className="text-xs text-muted-foreground">{link.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </>
  );

  const className =
    "flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40";

  if (link.href) {
    return (
      <Link href={link.href} className={className} onClick={onNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        link.onClick?.();
      }}
      className={className}
    >
      {content}
    </button>
  );
}

export function HelpCenterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const restaurant = useRestaurant((s) => s.restaurant);
  const showGateway =
    Boolean(restaurant?.restaurant_enabled) && Boolean(restaurant?.hotel_enabled);

  const helpGroups: Array<{ title: string; links: HelpLink[] }> = [
    {
      title: "Getting started",
      links: [
        {
          title: "Product Tour",
          description: "Guided walkthrough of the dashboard",
          icon: Compass,
          iconColor: "text-teal-600",
          iconBg: "bg-teal-50 dark:bg-teal-900/20",
          onClick: () => {
            requestProductTour();
          },
        },
        {
          title: "Onboarding",
          description: "Replay the workspace setup guide",
          href: "/onboarding?replay=1",
          icon: Rocket,
          iconColor: "text-primary",
          iconBg: "bg-primary/10",
        },
      ],
    },
    {
      title: "Useful links",
      links: [
        ...(showGateway
          ? [
              {
                title: "Switch workspace",
                description: "Choose Restaurant or Hotel",
                href: "/gateway",
                icon: Layers,
                iconColor: "text-indigo-600",
                iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
              } satisfies HelpLink,
            ]
          : []),
        {
          title: "Restaurant Profile",
          description: "Name, branding and location",
          href: "/manage/profile",
          icon: Store,
          iconColor: "text-rose-500",
          iconBg: "bg-rose-50 dark:bg-rose-900/20",
        },
        {
          title: "Restaurant Settings",
          description: "Payments, printers and operations",
          href: "/manage/settings",
          icon: Settings,
          iconColor: "text-slate-700",
          iconBg: "bg-slate-100 dark:bg-slate-800/50",
        },
        {
          title: "Additional Settings",
          description: "Appearance, notifications and more",
          href: "/manage/additional-settings",
          icon: LayoutGrid,
          iconColor: "text-slate-600",
          iconBg: "bg-slate-200 dark:bg-slate-800/80",
        },
        {
          title: "Send Feedback",
          description: "Tell us what to improve",
          href: "/feedback",
          icon: MessageSquare,
          iconColor: "text-blue-600",
          iconBg: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
          title: "Guides & Tutorials",
          description: "Learn how to use Yummy",
          href: "/manage/additional-settings?setting=guides",
          icon: BookOpen,
          iconColor: "text-emerald-600",
          iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
        },
        {
          title: "Contact Support",
          description: "Email the Yummy team",
          icon: Mail,
          iconColor: "text-blue-500",
          iconBg: "bg-blue-50 dark:bg-blue-900/20",
          onClick: () => {
            window.location.href = "mailto:support@yummy.com";
          },
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <HelpCircle className="h-5 w-5 text-primary" />
            Help
          </DialogTitle>
          <DialogDescription>
            Product tour, onboarding, and quick links to common settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {helpGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.links.map((link) => (
                  <HelpLinkRow
                    key={link.title}
                    link={link}
                    onNavigate={() => onOpenChange(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
