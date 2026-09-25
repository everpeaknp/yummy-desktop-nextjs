import { cn } from "@/lib/utils";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.35))] font-onboarding antialiased tracking-[-0.015em]"
      )}
    >
      {children}
    </div>
  );
}

