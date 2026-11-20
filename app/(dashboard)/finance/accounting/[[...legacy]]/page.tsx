import { redirect } from "next/navigation";
import { retiredAccountingDestination } from "@/lib/retired-accounting-routes";

export default function RetiredAccountingPage({ params, searchParams }: {
  params: { legacy?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(retiredAccountingDestination(params.legacy, searchParams));
}
