import apiClient from "@/lib/api-client";
import { HelpCenterApis } from "@/lib/api/endpoints";

export type HelpGuideSection = {
  title: string;
  body: string;
  bullets: string[];
};

export type HelpGuide = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  sections: HelpGuideSection[];
  estimated_minutes?: number | null;
  sort_order: number;
  is_featured: boolean;
};

export type HelpVideo = {
  id: number;
  title: string;
  description?: string | null;
  youtube_url: string;
  thumbnail_url?: string | null;
  category: string;
  duration_minutes?: number | null;
  is_main: boolean;
};

export type HelpSettings = {
  heading: string;
  subheading: string;
  support_message: string;
  whatsapp_number?: string | null;
  phone_number?: string | null;
  email?: string | null;
  support_hours?: string | null;
  feedback_enabled: boolean;
};

export type HelpCenterData = {
  settings: HelpSettings;
  guides: HelpGuide[];
  videos: HelpVideo[];
};

export async function fetchHelpCenter(): Promise<HelpCenterData> {
  const response = await apiClient.get(HelpCenterApis.content);
  return response.data.data as HelpCenterData;
}

/**
 * The Admin dashboard creates and edits tutorials through `/tutorial-videos`.
 * Read that same collection first so the dashboard reflects the exact published
 * record, including its main-video flag. The Help Center aggregate remains a
 * compatibility fallback for deployments where the collection route is gated.
 */
export async function fetchDashboardTutorialVideos(): Promise<HelpVideo[]> {
  try {
    const response = await apiClient.get("/tutorial-videos");
    const data = response.data?.data;
    const videos = Array.isArray(data) ? data : data?.items;
    if (Array.isArray(videos) && videos.length > 0) return videos as HelpVideo[];
  } catch {
    // Continue to the public Help Center endpoint for roles without collection access.
  }

  try {
    const content = await fetchHelpCenter();
    return Array.isArray(content?.videos) ? content.videos : [];
  } catch {
    return [];
  }
}

export function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function supportHref(kind: "whatsapp" | "phone" | "email", value: string): string {
  if (kind === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent("Hello Yummy support, I need help with:")}`;
  }
  if (kind === "phone") return `tel:${value}`;
  return `mailto:${value}?subject=${encodeURIComponent("Yummy support request")}`;
}
