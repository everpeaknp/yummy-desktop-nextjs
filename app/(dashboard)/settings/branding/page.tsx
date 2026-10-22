import { redirect } from "next/navigation";

export default function LegacyBrandingPage() {
  redirect("/settings/business-profile");
}
