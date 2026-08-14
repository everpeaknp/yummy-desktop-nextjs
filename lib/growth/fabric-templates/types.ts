/**
 * Types for Fabric template system
 */

import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";

export interface FabricTemplateConfig {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  offerLabel: string;
  expiresOn: string;
  terms: string;
}

export interface FabricTemplateObject {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface FabricTemplate {
  id: CampaignPosterTemplate;
  name: string;
  description: string;
  fabricJSON: {
    version: string;
    objects: FabricTemplateObject[];
    background?: string;
  };
  variables: Record<
    string,
    {
      objectId: string;
      property: string;
      defaultValue?: unknown;
    }
  >;
}

export const TEMPLATE_COLORS: Record<
  CampaignPosterTemplate,
  { primary: string; secondary: string }
> = {
  fresh: { primary: "#047857", secondary: "#10b981" },
  warm: { primary: "#c2410c", secondary: "#fb923c" },
  minimal: { primary: "#111827", secondary: "#4b5563" },
  ticket: { primary: "#f97316", secondary: "#fb923c" },
};
