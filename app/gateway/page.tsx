import { redirect } from "next/navigation";

/** Compatibility redirect for bookmarks created before the unified dashboard. */
export default function GatewayPage() {
  redirect("/dashboard");
}
