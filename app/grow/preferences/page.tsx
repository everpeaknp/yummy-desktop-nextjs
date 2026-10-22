import { PublicGrowthPreferencesClient } from "@/components/grow/public-growth-preferences";

export default function GrowthPreferencesPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const signedToken = (searchParams.token || "").trim() || null;
  return <PublicGrowthPreferencesClient signedToken={signedToken} />;
}
