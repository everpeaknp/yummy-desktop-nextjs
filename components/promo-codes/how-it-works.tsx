import { Share2, UserPlus, Award, ArrowRight } from "lucide-react";

export function HowItWorks() {
  const steps = [
    { icon: Share2, title: "Share your code" },
    { icon: UserPlus, title: "Restaurant joins" },
    { icon: Award, title: "Both get 1 month free" },
  ];

  return (
    <div className="rounded-lg border border-primary/20 bg-card px-4 py-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            How it works
          </span>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-center gap-2 md:gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
