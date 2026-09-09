/** Campaign costs, demand and attribution share the park's simulation clock. */
import type { Park, Guest, Building } from "./simulation";
export const MARKETING_DAY = 90;
export const MARKETING_TYPES = {
  flyers: { name: "Flyer im Umland", dailyCost: 90, entryLift: 0.18, spawnLift: 0.1, rideBonus: 0 },
  park: { name: "Parkkampagne", dailyCost: 180, entryLift: 0.35, spawnLift: 0.2, rideBonus: 0 },
  ride: {
    name: "Attraktionskampagne",
    dailyCost: 120,
    entryLift: 0.2,
    spawnLift: 0.12,
    rideBonus: 2,
  },
} as const;
export type MarketingKind = keyof typeof MARKETING_TYPES;
export type RevenueKind = "ticket" | "ride" | "shop";
export type MarketingRevenue = Record<RevenueKind, number>;
export type MarketingTotals = { cost: number; visitors: number; revenue: MarketingRevenue };
export type Campaign = MarketingTotals & {
  id: number;
  kind: MarketingKind;
  days: 1 | 2 | 3;
  startedAt: number;
  endsAt: number;
  cancelledAt?: number;
  targetId?: number;
  targetName?: string;
};
export type MarketingState = {
  nextId: number;
  campaigns: Campaign[];
  archivedTotals: MarketingTotals;
};
export type MarketingPark = Park & { marketing?: MarketingState };
export type MarketingGuest = Guest & { campaignId?: number | null };
/** Use the simulation's access() here at integration. No runtime simulation import / dependency cycle. */
export type RideAvailable = (s: MarketingPark, b: Building) => boolean;
const rideKinds = new Set([
  "coaster",
  "wheel",
  "carousel",
  "swing",
  "drop",
  "pirate",
  "teacups",
  "spinner",
  "custom",
]);
const defaultRideAvailable: RideAvailable = (_s, b) => rideKinds.has(b.kind) && b.open && b.tested;
const zeroRevenue = (): MarketingRevenue => ({ ticket: 0, ride: 0, shop: 0 });
const zeroTotals = (): MarketingTotals => ({ cost: 0, visitors: 0, revenue: zeroRevenue() });
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const nonnegative = (n: unknown): n is number => finite(n) && n >= 0;
const id = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
const hasKind = (kind: unknown): kind is MarketingKind =>
  typeof kind === "string" && Object.hasOwn(MARKETING_TYPES, kind);
export function campaignStatus(
  s: Pick<Park, "time">,
  c: Campaign,
): "active" | "cancelled" | "finished" {
  return c.cancelledAt !== undefined ? "cancelled" : s.time >= c.endsAt ? "finished" : "active";
}
const active = (s: MarketingPark) =>
  s.marketing?.campaigns.filter((c) => campaignStatus(s, c) === "active") ?? [];
const working = (s: MarketingPark, c: Campaign, available: RideAvailable) => {
  if (!s.open) return false;
  if (c.kind !== "ride") return true;
  const b = s.buildings.find((b) => b.id === c.targetId);
  return !!b && defaultRideAvailable(s, b) && available(s, b);
};
export type MarketingQuote = {
  kind: MarketingKind;
  days: number;
  targetId?: number;
  cost: number;
  duration: number;
  error: string | null;
};
export function quoteMarketing(
  s: MarketingPark,
  kind: MarketingKind,
  days: number,
  targetId?: number,
  available: RideAvailable = defaultRideAvailable,
): MarketingQuote {
  const quote: MarketingQuote = {
    kind,
    days,
    targetId,
    cost:
      hasKind(kind) && Number.isInteger(days) && days >= 1 && days <= 3
        ? MARKETING_TYPES[kind].dailyCost * days
        : 0,
    duration: days * MARKETING_DAY,
    error: null,
  };
  const reject = (error: string) => ({ ...quote, error });
  if (!hasKind(kind) || !Number.isInteger(days) || days < 1 || days > 3)
    return reject("Wähle einen Kampagnentyp und 1–3 Spieltage.");
  if (kind === "ride") {
    const b = s.buildings.find((b) => b.id === targetId);
    if (!b || !defaultRideAvailable(s, b) || !available(s, b))
      return reject("Wähle eine geöffnete, getestete und erreichbare Attraktion.");
  } else if (targetId !== undefined)
    return reject("Nur Attraktionskampagnen haben eine Zielattraktion.");
  const running = active(s);
  if (running.some((c) => c.kind === kind))
    return reject("Von diesem Typ läuft bereits eine Kampagne.");
  if (running.length >= 2) return reject("Es können höchstens zwei Kampagnen gleichzeitig laufen.");
  if (!finite(s.cash) || s.cash < quote.cost) return reject("Das Parkbudget reicht nicht.");
  if (s.marketing && (!id(s.marketing.nextId) || s.marketing.nextId >= Number.MAX_SAFE_INTEGER))
    return reject("Die Kampagnenkennung ist ungültig.");
  if ((s.marketing?.campaigns.length ?? 0) >= 512) return reject("Die Kampagnenhistorie ist voll.");
  return quote;
}
function addTotals(out: MarketingTotals, part: MarketingTotals) {
  out.cost += part.cost;
  out.visitors += part.visitors;
  for (const k of ["ticket", "ride", "shop"] as const) out.revenue[k] += part.revenue[k];
}
/** Keep the newest 64 reports plus every campaign with a guest still in the park. */
function trimHistory(s: MarketingPark) {
  const m = s.marketing!;
  if (m.campaigns.length <= 64) return;
  const protectedIds = new Set((s.guests as MarketingGuest[]).map((g) => g.campaignId));
  const cutoff = m.campaigns.length - 64;
  m.campaigns = m.campaigns.filter((c, i) => {
    if (i >= cutoff || campaignStatus(s, c) === "active" || protectedIds.has(c.id)) return true;
    addTotals(m.archivedTotals, c);
    return false;
  });
}
export function startMarketing(
  s: MarketingPark,
  kind: MarketingKind,
  days: number,
  targetId?: number,
  available: RideAvailable = defaultRideAvailable,
): string | null {
  const quote = quoteMarketing(s, kind, days, targetId, available);
  if (quote.error) return quote.error;
  // All fallible checks precede creation, payment, counters and any archival.
  const m = s.marketing ?? { nextId: 1, campaigns: [], archivedTotals: zeroTotals() };
  const b = kind === "ride" ? s.buildings.find((b) => b.id === targetId) : undefined;
  const c: Campaign = {
    ...zeroTotals(),
    id: m.nextId,
    kind,
    days: days as 1 | 2 | 3,
    startedAt: s.time,
    endsAt: s.time + quote.duration,
    cost: quote.cost,
    ...(b ? { targetId: b.id, targetName: b.name } : {}),
  };
  s.cash -= quote.cost;
  s.expenses += quote.cost;
  s.dayExpenses += quote.cost;
  s.operatingExpensesToday = (s.operatingExpensesToday ?? 0) + quote.cost;
  m.nextId++;
  m.campaigns.push(c);
  s.marketing = m;
  trimHistory(s);
  return null;
}
export function cancelMarketing(s: MarketingPark, campaignId: number): string | null {
  const c = s.marketing?.campaigns.find((c) => c.id === campaignId);
  if (!c || campaignStatus(s, c) !== "active") return "Diese Kampagne läuft nicht mehr.";
  c.cancelledAt = s.time;
  return null;
}
export type MarketingEffects = {
  entryMultiplier: number;
  spawnMultiplier: number;
  weights: { id: number; weight: number }[];
};
export function marketingEffects(
  s: MarketingPark,
  available: RideAvailable = defaultRideAvailable,
): MarketingEffects {
  const campaigns = active(s).filter((c) => working(s, c, available));
  return {
    entryMultiplier: 1 + campaigns.reduce((sum, c) => sum + MARKETING_TYPES[c.kind].entryLift, 0),
    spawnMultiplier: 1 + campaigns.reduce((sum, c) => sum + MARKETING_TYPES[c.kind].spawnLift, 0),
    weights: campaigns.map((c) => ({
      id: c.id,
      weight: MARKETING_TYPES[c.kind].entryLift + MARKETING_TYPES[c.kind].spawnLift,
    })),
  };
}
/** Preserve zero base demand: advertising cannot make an empty/inaccessible park viable. */
export function marketingDemand(
  s: MarketingPark,
  base: number,
  available: RideAvailable = defaultRideAvailable,
) {
  return Math.min(
    1,
    Math.max(0, finite(base) ? base : 0) * marketingEffects(s, available).entryMultiplier,
  );
}
/** One simulation-assigned source per guest, never multiple counted campaign conversions.
 * Attributed share is a model allocation, NOT a measured number of incremental visitors.
 * Call once before recording the entrance-ticket payment. Null explicitly marks organic guests.
 */
export function attributeMarketingGuest(
  s: MarketingPark,
  g: MarketingGuest,
  roll = Math.random(),
  available: RideAvailable = defaultRideAvailable,
): number | null {
  if (g.campaignId !== undefined) return g.campaignId;
  g.campaignId = null;
  if (!finite(roll) || roll < 0 || roll >= 1) return null;
  const { weights } = marketingEffects(s, available),
    total = weights.reduce((n, w) => n + w.weight, 0);
  let cursor = roll * (1 + total);
  if (cursor < 1) return null;
  cursor -= 1;
  for (const w of weights) {
    if (cursor < w.weight) {
      const c = s.marketing!.campaigns.find((c) => c.id === w.id)!;
      c.visitors++;
      g.campaignId = c.id;
      return c.id;
    }
    cursor -= w.weight;
  }
  return null;
}
/** Existing guests retain their attributed campaign after it ends/cancels. Actual payment only. */
export function recordMarketingRevenue(
  s: MarketingPark,
  g: MarketingGuest,
  amount: number,
  kind: RevenueKind,
): void {
  if (!nonnegative(amount) || !["ticket", "ride", "shop"].includes(kind) || !g.campaignId) return;
  const c = s.marketing?.campaigns.find((c) => c.id === g.campaignId);
  if (c) c.revenue[kind] += amount;
}
/** Advertising changes interest only. Budget, queue, access and open checks stay in choose(). */
export function marketingRideBonus(
  s: MarketingPark,
  b: Building,
  g: MarketingGuest,
  available: RideAvailable = defaultRideAvailable,
): number {
  const c = s.marketing?.campaigns.find((c) => c.id === g.campaignId);
  return c?.kind === "ride" &&
    c.targetId === b.id &&
    defaultRideAvailable(s, b) &&
    available(s, b) &&
    !g.visited?.includes(b.id)
    ? MARKETING_TYPES.ride.rideBonus
    : 0;
}
export function marketingReport(c: Campaign) {
  return {
    visitors: c.visitors,
    cost: c.cost,
    costPerVisitor: c.visitors ? c.cost / c.visitors : null,
    attributedRevenue: c.revenue.ticket + c.revenue.ride + c.revenue.shop,
    ...c.revenue,
  };
}
export function marketingTotals(s: MarketingPark): MarketingTotals {
  const totals = zeroTotals();
  if (s.marketing) {
    addTotals(totals, s.marketing.archivedTotals);
    s.marketing.campaigns.forEach((c) => addTotals(totals, c));
  }
  return totals;
}
/** Old saves have no marketing field and no campaign source. Historical missing rides are allowed. */
export function validMarketing(s: MarketingPark): boolean {
  const m = s.marketing,
    guests = s.guests as MarketingGuest[];
  const totals = (t: MarketingTotals) =>
    !!t &&
    nonnegative(t.cost) &&
    Number.isSafeInteger(t.visitors) &&
    t.visitors >= 0 &&
    !!t.revenue &&
    (["ticket", "ride", "shop"] as const).every((k) => nonnegative(t.revenue[k]));
  if (m === undefined)
    return guests.every((g) => g.campaignId === undefined || g.campaignId === null);
  if (
    !m ||
    !id(m.nextId) ||
    !Array.isArray(m.campaigns) ||
    m.campaigns.length > 512 ||
    !totals(m.archivedTotals)
  )
    return false;
  const ids = new Set<number>(),
    activeKinds = new Set<MarketingKind>();
  let activeCount = 0;
  for (const c of m.campaigns) {
    if (
      !c ||
      !id(c.id) ||
      ids.has(c.id) ||
      c.id >= m.nextId ||
      !hasKind(c.kind) ||
      ![1, 2, 3].includes(c.days) ||
      !totals(c) ||
      !nonnegative(c.startedAt) ||
      c.startedAt > s.time ||
      !finite(c.endsAt) ||
      Math.abs(c.endsAt - c.startedAt - c.days * MARKETING_DAY) > 1e-6 ||
      c.cost !== MARKETING_TYPES[c.kind].dailyCost * c.days ||
      (c.cancelledAt !== undefined &&
        (!finite(c.cancelledAt) ||
          c.cancelledAt < c.startedAt ||
          c.cancelledAt > s.time ||
          c.cancelledAt >= c.endsAt)) ||
      (c.kind === "ride"
        ? !id(c.targetId) || typeof c.targetName !== "string" || c.targetName.length > 150
        : c.targetId !== undefined || c.targetName !== undefined) ||
      (c.visitors === 0 && Object.values(c.revenue).some((v) => v !== 0))
    )
      return false;
    ids.add(c.id);
    if (campaignStatus(s, c) === "active") {
      if (activeKinds.has(c.kind) || ++activeCount > 2) return false;
      activeKinds.add(c.kind);
    }
  }
  const seen = new Map<number, number>();
  for (const g of guests) {
    if (g.campaignId === undefined || g.campaignId === null) continue;
    if (!id(g.campaignId) || !ids.has(g.campaignId)) return false;
    seen.set(g.campaignId, (seen.get(g.campaignId) ?? 0) + 1);
  }
  return m.campaigns.every((c) => (seen.get(c.id) ?? 0) <= c.visitors);
}
