"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ExternalLink,
  Film,
  Headphones,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShoppingBag,
  Smartphone,
} from "lucide-react";
import { AppPage } from "@/components/patterns/page/app-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchHelpCenter,
  supportHref,
  youtubeVideoId,
  type HelpCenterData,
  type HelpGuide,
} from "@/lib/help-center";

type View = "guides" | "videos" | "support";

const guideIcons = {
  "book-open": BookOpen,
  orders: ShoppingBag,
  settings: Settings2,
  mobile: Smartphone,
  tips: Lightbulb,
} as const;

export default function HelpCenterPage() {
  const [data, setData] = useState<HelpCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [view, setView] = useState<View>("guides");
  const [selectedGuide, setSelectedGuide] = useState<HelpGuide | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchHelpCenter();
      setData(next);
      setSelectedGuide((current) => current ?? next.guides.find((guide) => guide.is_featured) ?? next.guides[0] ?? null);
    } catch (loadError) {
      setError(
        (loadError as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "The Help Center could not be loaded. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#support") setView("support");
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(data?.guides.map((guide) => guide.category) ?? []))],
    [data],
  );
  const filteredGuides = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.guides ?? []).filter((guide) => {
      const categoryMatches = category === "All" || guide.category === category;
      const queryMatches =
        !normalized ||
        guide.title.toLowerCase().includes(normalized) ||
        guide.summary.toLowerCase().includes(normalized) ||
        guide.sections.some((section) =>
          `${section.title} ${section.body} ${section.bullets.join(" ")}`.toLowerCase().includes(normalized),
        );
      return categoryMatches && queryMatches;
    });
  }, [category, data, query]);

  if (loading) return <CenterState icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Loading help" description="Getting the latest guides and support details." />;
  if (error || !data) return <CenterState icon={<CircleHelp className="h-7 w-7" />} title="Help is temporarily unavailable" description={error ?? "No help content is available."} action={<Button onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>} />;

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-border pb-6">
          <Link href="/dashboard" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="h-4 w-4" />Back to dashboard
          </Link>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)] lg:items-end">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{data.settings.heading}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{data.settings.subheading}</p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search guides</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setView("guides")} placeholder="Search a task or question" className="h-12 rounded-xl pl-12 text-base" />
            </label>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/30 p-1" aria-label="Help Center sections">
          <SectionTab active={view === "guides"} icon={<BookOpen className="h-4 w-4" />} label="Guides" onClick={() => setView("guides")} />
          <SectionTab active={view === "videos"} icon={<Film className="h-4 w-4" />} label="Videos" onClick={() => setView("videos")} />
          <SectionTab active={view === "support"} icon={<Headphones className="h-4 w-4" />} label="Support" onClick={() => setView("support")} />
        </nav>

        {view === "guides" ? (
          <section className="space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Guide categories">
              {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}>{item}</button>)}
            </div>

            {filteredGuides.length === 0 ? (
              <EmptyCopy title="No guide matches that search" description="Try a shorter phrase or choose another category." />
            ) : (
              <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
                  {filteredGuides.map((guide) => <GuideRow key={guide.id} guide={guide} selected={selectedGuide?.id === guide.id} onClick={() => setSelectedGuide(guide)} />)}
                </div>
                <GuideReader guide={selectedGuide && filteredGuides.some((guide) => guide.id === selectedGuide.id) ? selectedGuide : filteredGuides[0]} />
              </div>
            )}
          </section>
        ) : view === "videos" ? (
          <section className="space-y-5">
            <div><h2 className="text-xl font-semibold tracking-tight">Video tutorials</h2><p className="mt-1 text-sm text-muted-foreground">Watch a complete workflow, then try it in your workspace.</p></div>
            {data.videos.length === 0 ? <EmptyCopy title="No videos published yet" description="New tutorials will appear here as soon as they are ready." /> : <div className="grid gap-5 md:grid-cols-2">{data.videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>}
          </section>
        ) : (
          <SupportSection data={data} />
        )}
      </div>
    </AppPage>
  );
}

function SectionTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{icon}<span>{label}</span></button>;
}

function GuideRow({ guide, selected, onClick }: { guide: HelpGuide; selected: boolean; onClick: () => void }) {
  const Icon = guideIcons[guide.icon as keyof typeof guideIcons] ?? BookOpen;
  return <button type="button" onClick={onClick} className={cn("flex w-full gap-3 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected ? "bg-primary/[0.07]" : "hover:bg-muted/50")}><div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><Icon className="h-4 w-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold leading-5">{guide.title}</p>{guide.is_featured ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Start here</span> : null}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{guide.summary}</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{guide.estimated_minutes ? `${guide.estimated_minutes} min` : "Quick guide"}</p></div></button>;
}

function GuideReader({ guide }: { guide: HelpGuide }) {
  return <article className="min-w-0 p-5 sm:p-7 lg:p-8"><div className="max-w-2xl"><p className="text-sm font-medium text-primary">{guide.category}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{guide.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.summary}</p><div className="mt-7 space-y-7">{guide.sections.map((section, index) => <section key={`${guide.id}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</div><div><h3 className="font-semibold leading-7">{section.title}</h3>{section.body ? <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{section.body}</p> : null}{section.bullets.length ? <ul className="mt-3 space-y-2">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-2 text-sm leading-6"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" /><span>{bullet}</span></li>)}</ul> : null}</div></section>)}</div></div></article>;
}

function VideoCard({ video }: { video: HelpCenterData["videos"][number] }) {
  const id = youtubeVideoId(video.youtube_url);
  return <article className="overflow-hidden rounded-2xl border border-border bg-card"><div className="relative aspect-video bg-muted">{id ? <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <a href={video.youtube_url} target="_blank" rel="noreferrer" className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-primary"><Play className="h-5 w-5" />Open video<ExternalLink className="h-4 w-4" /></a>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">{video.category}</p><h2 className="mt-1 font-semibold">{video.title}</h2></div>{video.duration_minutes ? <span className="shrink-0 text-xs text-muted-foreground">{video.duration_minutes} min</span> : null}</div>{video.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{video.description}</p> : null}</div></article>;
}

function SupportSection({ data }: { data: HelpCenterData }) {
  const support = data.settings;
  const channels = [support.whatsapp_number ? { label: "WhatsApp", detail: support.whatsapp_number, icon: MessageSquare, href: supportHref("whatsapp", support.whatsapp_number), external: true } : null, support.phone_number ? { label: "Call support", detail: support.phone_number, icon: Phone, href: supportHref("phone", support.phone_number), external: false } : null, support.email ? { label: "Email support", detail: support.email, icon: Mail, href: supportHref("email", support.email), external: false } : null].filter(Boolean) as Array<{ label: string; detail: string; icon: typeof Mail; href: string; external: boolean }>;
  return <section id="support" className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]"><div className="rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Headphones className="h-5 w-5" /></div><h2 className="mt-5 text-2xl font-semibold tracking-tight">Talk to a person</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{support.support_message}</p>{support.support_hours ? <p className="mt-4 text-sm font-medium">{support.support_hours}</p> : null}</div><div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="divide-y divide-border">{channels.map((channel) => <a key={channel.label} href={channel.href} target={channel.external ? "_blank" : undefined} rel={channel.external ? "noreferrer" : undefined} className="flex min-h-20 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><channel.icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{channel.label}</p><p className="truncate text-sm text-muted-foreground">{channel.detail}</p></div><ExternalLink className="h-4 w-4 text-muted-foreground" /></a>)}{support.feedback_enabled ? <Link href="/feedback" className="flex min-h-20 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MessageSquare className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold">Send feedback</p><p className="text-sm text-muted-foreground">Report a problem or suggest an improvement.</p></div></Link> : null}</div>{channels.length === 0 && !support.feedback_enabled ? <EmptyCopy title="No support channel is configured" description="Please check again later." /> : null}</div></section>;
}

function EmptyCopy({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center"><BookOpen className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }

function CenterState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) { return <div className="flex min-h-[65vh] items-center justify-center p-6"><div className="max-w-sm text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><h1 className="mt-4 text-xl font-semibold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div></div>; }
