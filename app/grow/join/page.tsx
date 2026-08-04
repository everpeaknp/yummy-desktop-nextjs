import { PublicGrowthSignup } from "@/components/grow/public-growth-signup";

export default function GrowthJoinPage({
  searchParams,
}: {
  searchParams: { restaurant?: string; slug?: string };
}) {
  const publicSlug = (searchParams.restaurant || searchParams.slug || "").trim() || null;
  return <PublicGrowthSignup publicSlug={publicSlug} />;
}
