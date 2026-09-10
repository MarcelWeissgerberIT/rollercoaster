import type { Park, ResearchId } from "./simulation";
import { calendarTime, initCalendar, LEGACY_YEAR_SECONDS, YEAR_SECONDS } from "./calendar";
export { YEAR_SECONDS } from "./calendar";
export const COIN_COST: Record<ResearchId, number> = {
  zoo: 1,
  savanna: 2,
  polar: 2,
  family: 1,
  thrill: 1,
  launch: 2,
  festival: 1,
  transport: 2,
  orbital: 2,
  workshop: 3,
};
export type CoinLedger = {
  coins: number;
  year: number;
  ratingTotal: number;
  elapsed: number;
  profit: number;
  lastReward: number;
  /** Last sampled open billing period; prevents a period spanning New Year counting twice. */
  operatingBalance?: number;
};
export const coinReward = (rating: number, profit: number) =>
  rating >= 70 ? (profit > 0 ? 3 : 2) : 1;
export function initResearchCoins(s: Park) {
  if (!s.research) return;
  const legacy = s.calendar === undefined;
  initCalendar(s);
  if (legacy && s.research.ledger) {
    const r = s.research.ledger,
      elapsed = Math.min(YEAR_SECONDS, (r.elapsed * YEAR_SECONDS) / LEGACY_YEAR_SECONDS);
    r.ratingTotal = r.elapsed > 0 ? (r.ratingTotal * elapsed) / r.elapsed : 0;
    r.elapsed = elapsed;
  }
  s.research.ledger ??= {
    coins: 3,
    year: Math.floor(calendarTime(s) / YEAR_SECONDS),
    ratingTotal: 0,
    elapsed: 0,
    profit: 0,
    lastReward: 0,
    operatingBalance: 0,
  };
}
export const researchCoins = (s: Park) => s.research?.ledger?.coins ?? 3;
export function nextResearchReward(s: Park) {
  const r = s.research?.ledger;
  return {
    remaining: YEAR_SECONDS - (calendarTime(s) % YEAR_SECONDS),
    coins: coinReward(
      r?.elapsed ? r.ratingTotal / r.elapsed : s.rating,
      (r?.profit ?? 0) +
        (s.operatingIncomeToday ?? 0) -
        (s.operatingExpensesToday ?? 0) -
        (r?.operatingBalance ?? 0),
    ),
  };
}
/** Sample actual operating changes after billing; calendar years need not align with bills. */
export function tickResearchCoins(s: Park, dt: number, dailyProfit = 0) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  initResearchCoins(s);
  const r = s.research!.ledger!;
  const now = calendarTime(s),
    year = Math.floor(now / YEAR_SECONDS),
    carry = year > r.year ? Math.min(dt, Math.max(0, now - year * YEAR_SECONDS)) : 0;
  r.ratingTotal += s.rating * (dt - carry);
  r.elapsed += dt - carry;
  const balance = (s.operatingIncomeToday ?? 0) - (s.operatingExpensesToday ?? 0);
  r.profit += dailyProfit + balance - (r.operatingBalance ?? 0);
  r.operatingBalance = balance;
  if (year > r.year) {
    r.lastReward = coinReward(r.elapsed ? r.ratingTotal / r.elapsed : s.rating, r.profit);
    r.coins += r.lastReward;
    r.year = year;
    r.ratingTotal = s.rating * carry;
    r.elapsed = carry;
    r.profit = 0;
  }
}
export function validResearchCoins(s: Park) {
  const r = s.research?.ledger;
  if (r === undefined) return true;
  const yearSeconds = s.calendar === undefined ? LEGACY_YEAR_SECONDS : YEAR_SECONDS;
  return (
    !!r &&
    Number.isInteger(r.coins) &&
    r.coins >= 0 &&
    r.coins <= 1000000 &&
    Number.isInteger(r.year) &&
    r.year >= 0 &&
    r.year <= Math.floor(calendarTime(s) / yearSeconds) &&
    Number.isFinite(r.elapsed) &&
    r.elapsed >= 0 &&
    r.elapsed <= yearSeconds + 1 &&
    Number.isFinite(r.ratingTotal) &&
    r.ratingTotal >= 0 &&
    r.ratingTotal <= 100 * r.elapsed + 0.01 &&
    Number.isFinite(r.profit) &&
    (r.operatingBalance === undefined || Number.isFinite(r.operatingBalance)) &&
    Number.isInteger(r.lastReward) &&
    r.lastReward >= 0 &&
    r.lastReward <= 3
  );
}
