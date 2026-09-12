import { notFound } from "next/navigation";

import { WebUiGallery } from "@/components/design-system/web-ui-gallery";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <WebUiGallery />;
}

