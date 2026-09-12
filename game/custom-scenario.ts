import type { Park } from "./simulation";
import { calendarTime, YEAR_SECONDS } from "./calendar";

export type CustomScenario = {
  version: 1;
  name: string;
  subtitle: string;
  description: string;
  cash: number;
  arrivals: number;
  rides: number;
  rating: number;
  value: number;
  profit: number;
  coasters: number;
  cleanliness: number;
  condition: number;
  species: number;
  welfare: number;
  /** Zero gives unlimited time; otherwise win before this many 20-minute years. */
  deadlineYears: number;
};
export const DEFAULT_CUSTOM_SCENARIO: CustomScenario = {
  version: 1,
  name: "Mein Abenteuerpark",
  subtitle: "Deine eigene Herausforderung",
  description: "Baue einen beliebten Park und erreiche deine selbst gesetzten Ziele.",
  cash: 20000,
  arrivals: 200,
  rides: 4,
  rating: 75,
  value: 0,
  profit: 200,
  coasters: 0,
  cleanliness: 75,
  condition: 0,
  species: 0,
  welfare: 0,
  deadlineYears: 3,
};
export function validCustomScenario(value: unknown): value is CustomScenario | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as CustomScenario;
  const text = (s: unknown, max: number) =>
    typeof s === "string" && s.trim().length > 0 && s.length <= max;
  const range = (v: unknown, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
  return (
    c.version === 1 &&
    text(c.name, 60) &&
    text(c.subtitle, 100) &&
    text(c.description, 1000) &&
    range(c.cash, 1000000) &&
    range(c.arrivals, 100000) &&
    range(c.value, 10000000) &&
    range(c.profit, 100000) &&
    range(c.rides, 100) &&
    range(c.coasters, 50) &&
    range(c.species, 7) &&
    range(c.deadlineYears, 20) &&
    [c.rating, c.cleanliness, c.condition, c.welfare].every((v) => range(v, 100))
  );
}
export function customScenarioExpired(
  s: Pick<Park, "customScenario" | "time" | "calendar" | "won">,
) {
  return (
    !s.won &&
    !!s.customScenario?.deadlineYears &&
    calendarTime(s) >= s.customScenario.deadlineYears * YEAR_SECONDS
  );
}
export function customScenarioTimeLeft(s: Pick<Park, "customScenario" | "time" | "calendar">) {
  return s.customScenario?.deadlineYears
    ? Math.max(0, s.customScenario.deadlineYears * YEAR_SECONDS - calendarTime(s))
    : null;
}
