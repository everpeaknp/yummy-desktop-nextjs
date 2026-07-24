import React from "react";
import { Check, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

type PricingPlan = {
	name: string;
	desc: string;
	priceLabel: string;
	periodLabel: string;
	renewalLabel: string;
	noteLabel: string;
	ctaLabel: string;
	onCtaClick?: () => void;
	features: string[];
};

type FUIPricingSectionWithOnePlanProps = {
	plan?: PricingPlan;
	className?: string;
};

const defaultPlan: PricingPlan = {
	name: "Basic plan",
	desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	priceLabel: "$32",
	periodLabel: "Price - Monthly",
	renewalLabel: "Renewal: No separate renewal price",
	noteLabel: "Tax not included",
	ctaLabel: "Get Started",
	features: [
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
		"Curabitur faucibus",
	],
};
export default function FUIPricingSectionWithOnePlan({
	plan = defaultPlan,
	className,
}: FUIPricingSectionWithOnePlanProps) {
	return (
		<section className={cn("h-full w-full rounded-xl border bg-background p-2", className)}>
			<div className="h-full rounded-xl border bg-card shadow-sm">
				<div className="border-b p-4 sm:p-5">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<p className="text-foreground truncate text-2xl font-semibold tracking-tight">{plan.name}</p>
							<p className="text-muted-foreground mt-2 text-sm">{plan.desc}</p>
						</div>
						<div className="shrink-0 text-right">
							<p className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">{plan.priceLabel}</p>
							<p className="text-muted-foreground text-xs">{plan.periodLabel}</p>
						</div>
					</div>

					<div className="mt-4 rounded-lg border bg-muted/20 p-2.5 text-sm font-semibold">
						{plan.renewalLabel}
					</div>

					<p className="text-muted-foreground mt-2 text-[11px]">{plan.noteLabel}</p>

					<button
						type="button"
						className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold tracking-tight transition-colors"
						onClick={plan.onCtaClick}
					>
						<Zap className="h-4 w-4" />
						{plan.ctaLabel}
					</button>
				</div>

				<div className="p-4 sm:p-5">
					<p className="text-foreground pb-2 text-sm font-semibold">Features</p>
					<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{plan.features.map((featureItem, idx) => (
							<li key={`${featureItem}-${idx}`} className="text-muted-foreground flex items-center gap-2 text-xs">
								<Check className="text-primary h-4 w-4 shrink-0" />
								<span className="truncate">{featureItem}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
