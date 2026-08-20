import { RequestPreferenceLink } from "@/components/grow/request-preference-link";

export default function RequestLinkPage({
  searchParams,
}: {
  searchParams: { restaurant?: string; slug?: string };
}) {
  const publicSlug = (searchParams.restaurant || searchParams.slug || "").trim() || null;
  return <RequestPreferenceLink publicSlug={publicSlug} />;
}
