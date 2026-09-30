import { redirect } from "next/navigation";

type CompatibilitySettingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CompatibilitySettingsPage({
  searchParams = {},
}: CompatibilitySettingsPageProps) {
  const query = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  });

  const suffix = query.toString();
  redirect(suffix ? `/settings?${suffix}` : "/settings");
}
