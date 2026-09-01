import { Metadata } from "next";
import { StationsManagementClient } from "@/components/stations/stations-management-client";

export const metadata: Metadata = {
  title: "Stations | Yummy",
  description: "Manage the departments used across Menu, Inventory, and Finance.",
};

export default function StationsPage() {
  return <StationsManagementClient />;
}
