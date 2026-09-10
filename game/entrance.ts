import type { Park } from "./simulation";
import { spendCash } from "./budget";
export const GATES = {
  classic: {
    name: "Waldhain-Bogen",
    sprite: "entrance",
    color: "#248b86",
    accent: "#e4ba60",
    cost: 0,
  },
  safari: {
    name: "Safari-Lodge",
    sprite: "gate-safari",
    color: "#906234",
    accent: "#e5b357",
    cost: 350,
  },
  festival: {
    name: "Festival-Eingang",
    sprite: "gate-festival",
    color: "#bc6b9c",
    accent: "#9bcacd",
    cost: 450,
  },
} as const;
export type GateStyle = keyof typeof GATES;
export const gateStyle = (s: Park): GateStyle => s.entrance?.style ?? "classic";
export function changeGate(s: Park, style: GateStyle) {
  if (!Object.hasOwn(GATES, style)) return "Unbekanntes Eingangstor.";
  const owned = s.entrance?.owned ?? ["classic"],
    cost = owned.includes(style) ? 0 : GATES[style].cost;
  if (cost > 0 && !spendCash(s, cost)) return "Das Budget reicht für dieses Tor nicht.";
  s.expenses += cost;
  s.dayExpenses += cost;
  s.entrance = { style, owned: [...new Set([...owned, style])] };
  return null;
}
export function validEntrance(s: Park) {
  const e = s.entrance;
  return (
    e === undefined ||
    (!!e &&
      Object.hasOwn(GATES, e.style) &&
      Array.isArray(e.owned) &&
      e.owned.length <= 3 &&
      new Set(e.owned).size === e.owned.length &&
      e.owned.includes(e.style) &&
      e.owned.every((x) => Object.hasOwn(GATES, x)))
  );
}
