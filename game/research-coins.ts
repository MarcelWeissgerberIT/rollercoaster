import type { Park, ResearchId } from "./simulation";
export const YEAR_SECONDS = 90 * 12;
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
};
export const coinReward = (rating: number, profit: number) =>
  rating >= 70 ? (profit > 0 ? 3 : 2) : 1;
export function initResearchCoins(s: Park) {
  if (!s.research) return;
  s.research.ledger ??= {
    coins: 3,
    year: Math.floor(s.time / YEAR_SECONDS),
    ratingTotal: 0,
    elapsed: 0,
    profit: 0,
    lastReward: 0,
  };
}
export const researchCoins = (s: Park) => s.research?.ledger?.coins ?? 3;
export function nextResearchReward(s: Park) {
  const r = s.research?.ledger;
  return {
    remaining: YEAR_SECONDS - (s.time % YEAR_SECONDS),
    coins: coinReward(
      r?.elapsed ? r.ratingTotal / r.elapsed : s.rating,
      (r?.profit ?? 0) + (s.operatingIncomeToday ?? 0) - (s.operatingExpensesToday ?? 0),
    ),
  };
}
/** Tick once after the daily ledger closes; saves keep progress and prevent duplicate awards. */
export function tickResearchCoins(s: Park, dt: number, dailyProfit = 0) {
  initResearchCoins(s);
  const r = s.research!.ledger!;
  r.ratingTotal += s.rating * dt;
  r.elapsed += dt;
  r.profit += dailyProfit;
  const year = Math.floor(s.time / YEAR_SECONDS);
  if (year > r.year) {
    r.lastReward = coinReward(r.elapsed ? r.ratingTotal / r.elapsed : s.rating, r.profit);
    r.coins += r.lastReward;
    r.year = year;
    r.ratingTotal = 0;
    r.elapsed = 0;
    r.profit = 0;
  }
}
export function validResearchCoins(s: Park) {
  const r = s.research?.ledger;
  if (r === undefined) return true;
  return (
    !!r &&
    Number.isInteger(r.coins) &&
    r.coins >= 0 &&
    r.coins <= 1000000 &&
    Number.isInteger(r.year) &&
    r.year >= 0 &&
    r.year <= Math.floor(s.time / YEAR_SECONDS) &&
    Number.isFinite(r.elapsed) &&
    r.elapsed >= 0 &&
    r.elapsed <= YEAR_SECONDS + 1 &&
    Number.isFinite(r.ratingTotal) &&
    r.ratingTotal >= 0 &&
    r.ratingTotal <= 100 * r.elapsed + 0.01 &&
    Number.isFinite(r.profit) &&
    Number.isInteger(r.lastReward) &&
    r.lastReward >= 0 &&
    r.lastReward <= 3
  );
}
