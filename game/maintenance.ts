import type { Building, Park } from "./simulation";
import { spendCash } from "./budget";

const mechanical = (b: Building) =>
  [
    "coaster",
    "wheel",
    "carousel",
    "swing",
    "drop",
    "pirate",
    "teacups",
    "spinner",
    "custom",
  ].includes(b.kind);
export const condition = (b: Building) => b.condition ?? 100;
export const broken = (b: Building) => mechanical(b) && condition(b) < 25;
export function maintenanceScore(s: Park) {
  const rides = s.buildings.filter(mechanical);
  return rides.length
    ? Math.round(rides.reduce((n, b) => n + condition(b), 0) / rides.length)
    : 100;
}
export function repairCost(b: Building, baseCost: number) {
  return condition(b) >= 100
    ? 0
    : Math.max(45, Math.ceil((baseCost * 0.12 * (100 - condition(b))) / 100));
}
export function repairAttraction(s: Park, b: Building, baseCost: number): string | null {
  if (!s.buildings.includes(b) || !mechanical(b)) return "Wähle ein Fahrgeschäft zum Reparieren.";
  const cost = repairCost(b, baseCost);
  if (!cost) return "Diese Attraktion ist bereits in gutem Zustand.";
  if (!spendCash(s, cost)) return "Für die Reparatur reicht das Parkbudget nicht.";
  s.expenses += cost;
  s.dayExpenses += cost;
  s.operatingExpensesToday = (s.operatingExpensesToday ?? 0) + cost;
  b.condition = 100;
  return null;
}
export function tickMaintenance(s: Park, dt: number) {
  for (const b of s.buildings) {
    if (!mechanical(b)) continue;
    if (b.open && b.riders.length) b.condition = Math.max(0, condition(b) - dt / 180);
    if (broken(b)) {
      b.open = false;
      b.autoOpen = false;
      b.testing = undefined;
    }
  }
}
