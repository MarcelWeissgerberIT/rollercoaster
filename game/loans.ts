import type { Park } from "./simulation";
import { hasUnlimitedBudget, spendCash, creditCash } from "./budget";

export const LOAN_LIMIT = 20000;
export const LOAN_STEP = 1000;
/** Fixed game rate, independent of the selected economic difficulty. */
export const LOAN_DAILY_RATE = 0.0025;
export const LOAN_DAY_SECONDS = 90;
export type LoanState = {
  principal: number;
  lastInterestDay: number;
  interestPaid: number;
};
type LoanPark = Pick<Park, "cash" | "time"> &
  Partial<Pick<Park, "mode" | "unlimitedBudget">> & { loan?: LoanState };
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const validMoney = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER / 100 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
const dayOf = (s: Pick<LoanPark, "time">) => Math.floor(s.time / LOAN_DAY_SECONDS);

/** Old saves with no loan remain valid and carry no debt or retroactive fees. */
export function validateLoan(s: Pick<LoanPark, "loan" | "time">): boolean {
  if (s.loan === undefined) return true;
  const loan = s.loan;
  return !!(
    loan &&
    typeof loan === "object" &&
    !Array.isArray(loan) &&
    validMoney(loan.principal) &&
    loan.principal <= LOAN_LIMIT &&
    validMoney(loan.interestPaid) &&
    Number.isFinite(s.time) &&
    s.time >= 0 &&
    Number.isSafeInteger(loan.lastInterestDay) &&
    loan.lastInterestDay >= 0 &&
    loan.lastInterestDay <= dayOf(s)
  );
}

/** Displayed next daily charge at today's balance. Principal never compounds. */
export function loanDailyCost(s: Pick<LoanPark, "loan">): number {
  const principal = s.loan?.principal ?? 0;
  return validMoney(principal) && principal <= LOAN_LIMIT
    ? roundMoney(principal * LOAN_DAILY_RATE)
    : 0;
}

export function borrowLoan(s: LoanPark, amount: number): string | null {
  if (hasUnlimitedBudget(s)) return "Im freien Spiel ist kein Kredit nötig.";
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount / LOAN_STEP))
    return "Kredite sind in Schritten von 1.000 € möglich.";
  if (!Number.isFinite(s.cash) || !Number.isFinite(s.time) || s.time < 0 || !validateLoan(s))
    return "Der aktuelle Kassen- oder Kreditstand ist ungültig.";
  const principal = s.loan?.principal ?? 0;
  if (amount > LOAN_LIMIT - principal)
    return "Es dürfen höchstens 20.000 € Kredit gleichzeitig offen sein.";
  if (!Number.isFinite(s.cash + amount)) return "Dieser Betrag kann nicht ausgezahlt werden.";
  const loan = (s.loan ??= { principal: 0, lastInterestDay: dayOf(s), interestPaid: 0 });
  loan.principal = roundMoney(principal + amount);
  creditCash(s, amount);
  return null;
}

/** Voluntary repayment moves real cash to principal; it is not an operating cost. */
export function repayLoan(s: LoanPark, amount: number): string | null {
  if (!validMoney(amount) || amount <= 0) return "Wähle einen positiven Rückzahlungsbetrag.";
  if (!Number.isFinite(s.cash) || !validateLoan(s))
    return "Der aktuelle Kassen- oder Kreditstand ist ungültig.";
  const loan = s.loan;
  if (!loan || amount > loan.principal) return "So viel Kredit ist nicht offen.";
  if (!spendCash(s, amount)) return "Für diese Rückzahlung reicht das Bargeld nicht.";
  loan.principal = roundMoney(loan.principal - amount);
  return null;
}

/** Call inside the simulation's once-per-day bill. Only loan bookkeeping changes
 * here; the caller adds the returned interest to its actual cash/expense bill.
 * The outstanding balance at day-end determines the charge, with no compounding
 * or automatic principal repayment. Repeated calls in the same day return zero. */
export function tickLoanDay(s: LoanPark): number {
  const loan = s.loan;
  if (!loan || !validateLoan(s)) return 0;
  const day = dayOf(s);
  if (day <= loan.lastInterestDay) return 0;
  const cost = loanDailyCost(s),
    totalPaid = roundMoney(loan.interestPaid + cost);
  if (!validMoney(totalPaid)) return 0;
  loan.lastInterestDay = day;
  loan.interestPaid = totalPaid;
  return cost;
}
