"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import { MenuApis } from "@/lib/api/endpoints";
import { growthProgramsApi, type GrowthProgram, type GrowthProgramInput } from "@/lib/api/growth-programs";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { GrowPageHeader } from "@/components/grow/grow-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MenuItem = { id: number; name: string; price: number };
type FormState = Omit<GrowthProgramInput, "starts_at" | "ends_at"> & { starts_at: string; ends_at: string };

const goalChoices: { kind: FormState["goal_kind"]; title: string; example: string; scope: FormState["scope"] }[] = [
  { kind: "order_item_qty", title: "Buy a quantity of an item", example: "3 beers in one order", scope: "every_order" },
  { kind: "order_spend", title: "Spend a minimum amount", example: "Spend Rs. 5,000 in one order", scope: "every_order" },
  { kind: "total_item_qty", title: "Buy a total quantity across orders", example: "10 coffees across any number of orders", scope: "customer" },
  { kind: "item_orders", title: "Buy an item on separate orders", example: "Coffee on 10 different orders", scope: "customer" },
  { kind: "qualifying_orders", title: "Place orders above a minimum", example: "At least Rs. 1,000 on 10 separate orders", scope: "customer" },
];
const rewardChoices: { kind: FormState["reward_kind"]; title: string; detail: string }[] = [
  { kind: "free_item", title: "Free menu item", detail: "Add an item at no charge" },
  { kind: "fixed", title: "Rupee discount", detail: "Take a fixed amount off" },
  { kind: "percentage", title: "Percentage discount", detail: "Set a rate and a rupee cap" },
];
const field = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const choice = "flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring";

function localInputDate(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function emptyForm(): FormState {
  return {
    name: "", scope: "every_order", goal_kind: "order_item_qty", goal_item_id: null,
    goal_quantity: 3, goal_min_spend: null, reward_kind: "free_item", reward_value: null,
    reward_item_id: null, reward_quantity: 1, percentage_cap: null, redemption_limit: 100,
    starts_at: localInputDate(new Date()), ends_at: localInputDate(new Date(Date.now() + 30 * 86_400_000)),
  };
}

function describe(program: GrowthProgramInput, items: MenuItem[]): string {
  const item = (id: number | null) => items.find((entry) => entry.id === id)?.name || "an item you choose";
  const goal = program.goal_kind === "order_spend" ? `Spend Rs. ${program.goal_min_spend}`
    : program.goal_kind === "order_item_qty" ? `Buy ${program.goal_quantity} × ${item(program.goal_item_id)} in one order`
    : program.goal_kind === "total_item_qty" ? `Buy ${program.goal_quantity} × ${item(program.goal_item_id)} across orders`
    : program.goal_kind === "item_orders" ? `Order ${item(program.goal_item_id)} on ${program.goal_quantity} separate orders`
    : `Complete ${program.goal_quantity} orders of at least Rs. ${program.goal_min_spend}`;
  const reward = program.reward_kind === "free_item" ? `${program.reward_quantity} × ${item(program.reward_item_id)} free`
    : program.reward_kind === "fixed" ? `Rs. ${program.reward_value} off`
    : `${program.reward_value}% off, up to Rs. ${program.percentage_cap}`;
  return `${goal} → ${reward}`;
}

function matchingItems(items: MenuItem[], query: string, selectedId: number | null): MenuItem[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return items;
  const matches = items.filter((item) => item.name.toLocaleLowerCase().includes(term));
  const selected = items.find((item) => item.id === selectedId);
  return selected && !matches.some((item) => item.id === selected.id) ? [selected, ...matches] : matches;
}

export function GrowOffersClient() {
  const user = useAuth((state) => state.user);
  const restaurantId = user?.restaurant_id;
  const canManage = hasPermission(user, "grow.campaigns.manage");
  const [offers, setOffers] = useState<GrowthProgram[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [goalSearch, setGoalSearch] = useState("");
  const [rewardSearch, setRewardSearch] = useState("");

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [programs, menu] = await Promise.all([
        growthProgramsApi.list(), apiClient.get(MenuApis.getMenusGroupedByRestaurant(restaurantId)),
      ]);
      setOffers(programs);
      setItems((menu.data.data as { items: MenuItem[] }[]).flatMap((group) => group.items));
      setError("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Offers could not be loaded. Try again."));
    } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { void reload(); }, [reload]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chooseGoal = (goal: FormState["goal_kind"]) => setForm((current) => ({
    ...current, goal_kind: goal, scope: goal === "total_item_qty" || goal === "item_orders" || goal === "qualifying_orders" ? "customer" : "every_order",
    goal_item_id: goal === "order_item_qty" || goal === "total_item_qty" || goal === "item_orders" ? current.goal_item_id : null,
    goal_quantity: goal === "order_spend" ? null : current.goal_quantity || 1,
    goal_min_spend: goal === "order_spend" || goal === "qualifying_orders" ? current.goal_min_spend || 1000 : null,
  }));
  const chooseReward = (reward: FormState["reward_kind"]) => setForm((current) => ({
    ...current, reward_kind: reward,
    reward_item_id: reward === "free_item" ? current.reward_item_id : null,
    reward_quantity: reward === "free_item" ? current.reward_quantity || 1 : null,
    reward_value: reward === "free_item" ? null : current.reward_value || 100,
    percentage_cap: reward === "percentage" ? current.percentage_cap || 500 : null,
  }));

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const payload: GrowthProgramInput = { ...form, name: form.name.trim(),
        starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() };
      if (!payload.name || payload.redemption_limit < 1 || new Date(payload.ends_at) <= new Date(payload.starts_at)) {
        throw new Error("Enter a name, a positive redemption limit, and an end after the start.");
      }
      if (editingId) await growthProgramsApi.update(editingId, payload);
      else await growthProgramsApi.create(payload);
      setNotice(editingId ? "Offer draft saved." : "Offer draft created. Activate it when ready.");
      setShowForm(false); setEditingId(null); setForm(emptyForm()); await reload();
    } catch (cause) { setError(getApiErrorMessage(cause, cause instanceof Error ? cause.message : "Offer could not be saved.")); }
    finally { setBusy(false); }
  }

  async function changeStatus(offer: GrowthProgram, status: "active" | "paused" | "retired") {
    setBusy(true); setError(""); setNotice("");
    try { await growthProgramsApi.setStatus(offer.id, status); setNotice(`${offer.name} ${status}.`); await reload(); }
    catch (cause) { setError(getApiErrorMessage(cause, "Offer status could not be changed.")); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6">
    <GrowPageHeader title="Offers" description="Reward guests for what they order and how often they visit." actions={canManage && !showForm ? <Button onClick={() => { setForm(emptyForm()); setGoalSearch(""); setRewardSearch(""); setEditingId(null); setShowForm(true); }}>Create offer</Button> : undefined} />
    {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
    {showForm && <Card><CardHeader><CardTitle>{editingId ? "Edit offer draft" : "Create an offer"}</CardTitle><p className="text-sm text-muted-foreground">Choose what earns the reward, then choose what the customer gets.</p></CardHeader><CardContent><form onSubmit={save} className="grid max-w-5xl gap-5 md:grid-cols-2">
      <fieldset className="space-y-4 md:col-span-2">
        <legend className="mb-3 text-base font-semibold">1. When does the customer qualify?</legend>
        {(["every_order", "customer"] as const).map((scope) => <div key={scope} className="space-y-2">
          <h3 className="text-sm font-semibold">{scope === "every_order" ? "On a single order" : "Across completed orders"}</h3>
          <p className="text-xs text-muted-foreground">{scope === "every_order" ? "Works for every guest, even without a customer account." : "Returning guests earn this reward across visits and use it on a future order."}</p>
          <div className={`grid gap-2 sm:grid-cols-2 ${scope === "customer" ? "lg:grid-cols-3" : ""}`}>{goalChoices.filter((option) => option.scope === scope).map((option) => <label key={option.kind} className={`${choice} ${form.goal_kind === option.kind ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
            <input type="radio" name="goal-kind" value={option.kind} checked={form.goal_kind === option.kind} onChange={() => chooseGoal(option.kind)} className="mt-1 accent-primary" />
            <span><span className="block font-medium">{option.title}</span><span className="mt-1 block text-xs text-muted-foreground">For example: {option.example}</span></span>
          </label>)}</div>
        </div>)}
      </fieldset>
      {(form.goal_kind === "order_item_qty" || form.goal_kind === "total_item_qty" || form.goal_kind === "item_orders") && <div className="space-y-2 text-sm font-medium"><label htmlFor="goal-item-search">Find the qualifying item</label><input id="goal-item-search" type="search" autoComplete="off" className={field} value={goalSearch} onChange={(event) => setGoalSearch(event.target.value)} placeholder="Search menu items…" /><label htmlFor="goal-item-select">Qualifying item</label><select id="goal-item-select" name="goal-item" className={field} required value={form.goal_item_id ?? ""} onChange={(event) => set("goal_item_id", Number(event.target.value) || null)}><option value="">Choose an item</option>{matchingItems(items, goalSearch, form.goal_item_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      {form.goal_kind !== "order_spend" && <label className="space-y-2 text-sm font-medium">{form.goal_kind === "item_orders" ? "Separate orders needed" : form.goal_kind === "qualifying_orders" ? "Orders needed" : "Item quantity needed"}<input name="goal-quantity" className={field} required type="number" min="1" step="1" value={form.goal_quantity ?? ""} onChange={(event) => set("goal_quantity", Number(event.target.value) || null)} /></label>}
      {(form.goal_kind === "order_spend" || form.goal_kind === "qualifying_orders") && <label className="space-y-2 text-sm font-medium">Minimum order value (Rs.)<input className={field} required type="number" min="0.01" step="0.01" value={form.goal_min_spend ?? ""} onChange={(event) => set("goal_min_spend", Number(event.target.value) || null)} /></label>}
      {(form.goal_kind === "total_item_qty" || form.goal_kind === "item_orders") && <p className="text-xs text-muted-foreground md:col-span-2">{form.goal_kind === "total_item_qty" ? "Every paid unit counts. Buying 10 in one order adds 10." : "Each completed order counts once, even if it contains several of the item."}</p>}
      <fieldset className="space-y-2 md:col-span-2">
        <legend className="mb-3 text-base font-semibold">2. What does the customer get?</legend>
        <div className="grid gap-2 sm:grid-cols-3">{rewardChoices.map((option) => <label key={option.kind} className={`${choice} ${form.reward_kind === option.kind ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
          <input type="radio" name="reward-kind" value={option.kind} checked={form.reward_kind === option.kind} onChange={() => chooseReward(option.kind)} className="mt-1 accent-primary" />
          <span><span className="block font-medium">{option.title}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></span>
        </label>)}</div>
      </fieldset>
      {form.reward_kind === "free_item" ? <><div className="space-y-2 text-sm font-medium"><label htmlFor="reward-item-search">Find the free item</label><input id="reward-item-search" type="search" autoComplete="off" className={field} value={rewardSearch} onChange={(event) => setRewardSearch(event.target.value)} placeholder="Search menu items…" /><label htmlFor="reward-item-select">Free item</label><select id="reward-item-select" name="reward-item" className={field} required value={form.reward_item_id ?? ""} onChange={(event) => set("reward_item_id", Number(event.target.value) || null)}><option value="">Choose an item</option>{matchingItems(items, rewardSearch, form.reward_item_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><label className="space-y-2 text-sm font-medium">Free quantity<input className={field} required type="number" min="1" step="1" value={form.reward_quantity ?? ""} onChange={(event) => set("reward_quantity", Number(event.target.value) || null)} /></label></>
        : <><label className="space-y-2 text-sm font-medium">{form.reward_kind === "fixed" ? "Discount (Rs.)" : "Discount (%)"}<input className={field} required type="number" min="0.01" max={form.reward_kind === "percentage" ? 100 : undefined} step="0.01" value={form.reward_value ?? ""} onChange={(event) => set("reward_value", Number(event.target.value) || null)} /></label>{form.reward_kind === "percentage" && <label className="space-y-2 text-sm font-medium">Maximum discount (Rs.)<input className={field} required type="number" min="0.01" step="0.01" value={form.percentage_cap ?? ""} onChange={(event) => set("percentage_cap", Number(event.target.value) || null)} /></label>}</>}
      <section aria-label="Offer preview" aria-live="polite" className="rounded-lg border border-primary/25 bg-primary/5 p-4 md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Offer preview</p>
        <p className="mt-2 text-sm font-medium">{describe(form, items)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{form.scope === "every_order" ? "Added when an order qualifies." : "Guests earn this over time and use it on a future order."}</p>
      </section>
      <h3 className="text-base font-semibold md:col-span-2">3. Name and limits</h3>
      <label className="space-y-2 text-sm font-medium md:col-span-2">Offer name<input name="offer-name" className={field} required maxLength={160} value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="For example: Buy 3 beers, get a hookah…" /></label>
      <label className="space-y-2 text-sm font-medium">Maximum uses across all orders<input name="redemption-limit" className={field} required type="number" min="1" step="1" value={form.redemption_limit} onChange={(event) => set("redemption_limit", Number(event.target.value) || 0)} /></label>
      <label className="space-y-2 text-sm font-medium">Starts<input name="starts-at" className={field} required type="datetime-local" value={form.starts_at} onChange={(event) => set("starts_at", event.target.value)} /></label>
      <label className="space-y-2 text-sm font-medium">Ends<input name="ends-at" className={field} required type="datetime-local" value={form.ends_at} onChange={(event) => set("ends_at", event.target.value)} /></label>
      <p className="text-sm text-muted-foreground md:col-span-2">Each order can use one reward. Choose a free item with no required options.</p>
      <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button><Button type="button" variant="outline" onClick={() => { setShowForm(false); setError(""); }}>Cancel</Button></div>
    </form></CardContent></Card>}
    <section aria-label="Created offers" className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">Loading offers…</p> : offers.length ? offers.map((offer) => <Card key={offer.id}><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{offer.name}</h2><span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{offer.status}</span><span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{offer.scope === "customer" ? "Customer loyalty" : "Every eligible order"}</span></div><p className="mt-1 text-sm text-muted-foreground">{describe(offer, items)}</p>{offer.scope === "customer" && <p className="mt-1 text-xs text-muted-foreground">Guests earn progress from completed orders and use the reward on a future visit.</p>}<p className="mt-1 text-xs text-muted-foreground">Maximum {offer.redemption_limit} claims · Ends {new Date(offer.ends_at).toLocaleDateString("en-NP")}</p></div>{canManage && <div className="flex shrink-0 flex-wrap gap-2">{offer.status === "draft" && <><Button variant="outline" disabled={busy} onClick={() => { setEditingId(offer.id); setGoalSearch(""); setRewardSearch(""); setForm({ ...offer, starts_at: localInputDate(new Date(offer.starts_at)), ends_at: localInputDate(new Date(offer.ends_at)) }); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button><Button disabled={busy} onClick={() => void changeStatus(offer, "active")}>Activate</Button></>}{offer.status === "active" && <Button variant="outline" disabled={busy} onClick={() => void changeStatus(offer, "paused")}>Pause</Button>}{offer.status === "paused" && <><Button disabled={busy} onClick={() => void changeStatus(offer, "active")}>Resume</Button><Button variant="outline" disabled={busy} onClick={() => void changeStatus(offer, "retired")}>Retire</Button></>}</div>}</CardContent></Card>) : <p className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">No offers yet. Create one to reward orders or repeat visits.</p>}</section>
  </div>;
}
