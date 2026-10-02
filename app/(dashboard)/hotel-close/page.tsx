import { redirect } from "next/navigation";

export default function HotelClosePage() {
  redirect("/hotel?section=night-audit");
}
