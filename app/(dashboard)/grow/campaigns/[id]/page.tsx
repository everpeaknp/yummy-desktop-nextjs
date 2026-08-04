import { CampaignDetailClient } from "@/components/grow/campaign-administration/campaign-detail-client";

export default function GrowthCampaignDetailPage({ params }: { params: { id: string } }) {
  return <CampaignDetailClient campaignId={params.id} />;
}

