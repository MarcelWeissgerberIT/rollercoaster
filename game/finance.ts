import type { Park } from "./simulation";
import { calendarOf, BILLING_PERIOD_SECONDS } from "./calendar";

export const FINANCE_CATEGORIES = {
  ticket: { label: "Parkeintritt", flow: "income", color: "#508678" },
  rides: { label: "Fahrten & Tierbesuche", flow: "income", color: "#729fc6" },
  shops: { label: "Essen & Souvenirs", flow: "income", color: "#c49a57" },
  photos: { label: "Fahrtfotos", flow: "income", color: "#a991c2" },
  umbrellas: { label: "Regenschirme", flow: "income", color: "#70aaa8" },
  otherIncome: { label: "Weitere Einnahmen & Erstattungen", flow: "income", color: "#98a67b" },
  wages: { label: "Personal", flow: "expense", color: "#be7b73" },
  upkeep: { label: "Betrieb & Unterhalt", flow: "expense", color: "#d29469" },
  supplies: { label: "Waren & Material", flow: "expense", color: "#b9956d" },
  maintenance: { label: "Reparaturen", flow: "expense", color: "#ad82a9" },
  interest: { label: "Kreditzinsen", flow: "expense", color: "#a1a1b2" },
  otherExpense: { label: "Bau & weitere Ausgaben", flow: "expense", color: "#95a591" },
} as const;
export type FinanceCategory = keyof typeof FINANCE_CATEGORIES;
export type FinanceEntries = Partial<Record<FinanceCategory, number>>;
export type FinancePeriod = {
  time: number;
  year: number;
  day: number;
  income: number;
  expenses: number;
  profit: number;
  operatingProfit: number;
  cash: number;
  categories: FinanceEntries;
};
export type FinanceLedger = { version: 1; current: FinanceEntries; history: FinancePeriod[] };
export const financeLedger = (s: Park) =>
  (s.financeLedger ??= { version: 1, current: {}, history: [] });
/** Informational categories follow actual postings; they never manufacture money. */
export function recordFinance(s: Park, category: FinanceCategory, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const ledger = financeLedger(s);
  ledger.current[category] = (ledger.current[category] ?? 0) + amount;
}
export function periodCategories(s: Park): FinanceEntries {
  const entries = { ...(s.financeLedger?.current ?? {}) };
  for (const [flow, total, fallback] of [
    ["income", s.dayIncome, "otherIncome"],
    ["expense", s.dayExpenses, "otherExpense"],
  ] as const) {
    const known = Object.entries(entries).reduce(
      (n, [key, value]) =>
        n + (FINANCE_CATEGORIES[key as FinanceCategory]?.flow === flow ? (value ?? 0) : 0),
      0,
    );
    const residual = total - known;
    if (residual > 0.001) entries[fallback] = (entries[fallback] ?? 0) + residual;
  }
  return entries;
}
export function closeFinancePeriod(s: Park) {
  const ledger = financeLedger(s),
    calendar = calendarOf(s);
  ledger.history.push({
    time: s.time,
    year: calendar.year,
    day: calendar.day,
    income: s.dayIncome,
    expenses: s.dayExpenses,
    profit: s.dayIncome - s.dayExpenses,
    operatingProfit: s.operatingProfit ?? 0,
    cash: s.cash,
    categories: periodCategories(s),
  });
  ledger.history = ledger.history.slice(-160);
  ledger.current = {};
}
export const FINANCE_HISTORY_SECONDS = BILLING_PERIOD_SECONDS * 160;
export function validFinance(s: Park) {
  const ledger = s.financeLedger;
  if (ledger === undefined) return true;
  const validEntries = (entries: FinanceEntries) =>
    entries &&
    typeof entries === "object" &&
    !Array.isArray(entries) &&
    Object.entries(entries).every(
      ([k, v]) =>
        Object.hasOwn(FINANCE_CATEGORIES, k) && typeof v === "number" && Number.isFinite(v),
    );
  return (
    !!ledger &&
    ledger.version === 1 &&
    validEntries(ledger.current) &&
    Array.isArray(ledger.history) &&
    ledger.history.length <= 160 &&
    ledger.history.every(
      (p, i) =>
        p &&
        [p.time, p.year, p.day, p.income, p.expenses, p.profit, p.operatingProfit, p.cash].every(
          Number.isFinite,
        ) &&
        p.time >= 0 &&
        p.time <= s.time &&
        Number.isSafeInteger(p.year) &&
        Number.isSafeInteger(p.day) &&
        p.year > 0 &&
        p.day > 0 &&
        p.day <= 28 &&
        (i === 0 || p.time >= ledger.history[i - 1].time) &&
        validEntries(p.categories),
    )
  );
}
