/** Unlimited construction is an explicit free-play setting, never a cash hack. */
export type BudgetState = { cash: number; mode?: string; unlimitedBudget?: boolean };
export function hasUnlimitedBudget(s: Pick<BudgetState, "mode" | "unlimitedBudget">): boolean {
  return s.mode === "sandbox" && s.unlimitedBudget === true;
}
const validAmount = (amount: number) => Number.isFinite(amount) && amount >= 0;
export function canAfford(s: BudgetState, amount: number): boolean {
  return (
    validAmount(amount) && Number.isFinite(s.cash) && (hasUnlimitedBudget(s) || s.cash >= amount)
  );
}
/** Operating bills may overdraw an ordinary park, matching the existing economy.
 * Callers record the real expense separately, including in unlimited free play. */
export function spendCash(s: BudgetState, amount: number, allowDebt = false): boolean {
  if (!validAmount(amount) || !Number.isFinite(s.cash)) return false;
  if (hasUnlimitedBudget(s)) return true;
  if ((!allowDebt && !canAfford(s, amount)) || !Number.isFinite(s.cash - amount)) return false;
  s.cash -= amount;
  return true;
}
/** Free play keeps a finite neutral cash balance while revenue ledgers still run. */
export function creditCash(s: BudgetState, amount: number): boolean {
  if (!validAmount(amount) || !Number.isFinite(s.cash)) return false;
  if (hasUnlimitedBudget(s)) return true;
  if (!Number.isFinite(s.cash + amount)) return false;
  s.cash += amount;
  return true;
}
