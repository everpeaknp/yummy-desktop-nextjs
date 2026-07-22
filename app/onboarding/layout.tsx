import { Sora } from "next/font/google";
import { cn } from "@/lib/utils";

/**
 * Single premium family for onboarding — geometric, calm, high-end product feel.
 * Weight contrast (500–700) replaces a second display face.
 */
const onboarding = Sora({
  subsets: ["latin"],
  variable: "--font-onboarding",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        onboarding.variable,
        onboarding.className,
        "min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))] font-onboarding antialiased tracking-[-0.015em]"
      )}
    >
      {children}
    </div>
  );
}
