/**
 * Economic difficulty changes real operating charges, never recorded revenue.
 * Construction, adoption, shop supplies, animal care, repairs, marketing, loans,
 * admission prices and visitor choice retain their existing rules. Missing
 * values in older saves use Normal.
 *
 * Call difficultyCost exactly once, before checking affordability and recording
 * the debit. UI quotes must use the same helper as the actual transaction.
 */
export type Difficulty = "relaxed" | "normal" | "challenging";
export type DifficultyCostKind = "wages" | "upkeep";
export type DifficultyState = { difficulty?: Difficulty };

export const DEFAULT_DIFFICULTY: Difficulty = "normal";
export const DIFFICULTIES = {
  relaxed: {
    label: "Entspannt",
    description: "Viel Spielraum zum Bauen und Lernen. Ein gut besuchter Park trägt sich leichter.",
    costDescription: "Löhne & Unterhalt −55 %",
    multipliers: { wages: 0.45, upkeep: 0.45 },
  },
  normal: {
    label: "Normal",
    description:
      "Fairer Einstieg für kleine Parks. Gute Wege, Preise und passende Teams bleiben wichtig.",
    costDescription: "Löhne & Unterhalt −35 %",
    multipliers: { wages: 0.65, upkeep: 0.65 },
  },
  challenging: {
    label: "Anspruchsvoll",
    description:
      "Die bisherigen vollen Betriebskosten. Plane Personal, Angebote und Auslastung genau.",
    costDescription: "Volle Löhne & voller Unterhalt",
    multipliers: { wages: 1, upkeep: 1 },
  },
} as const satisfies Record<
  Difficulty,
  {
    label: string;
    description: string;
    costDescription: string;
    multipliers: Record<DifficultyCostKind, number>;
  }
>;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === "string" && Object.hasOwn(DIFFICULTIES, value);

/** Read-only fallback; loading or changing a setting never grants cash. */
export function difficultyOf(state: object): Difficulty {
  const value = "difficulty" in state ? state.difficulty : undefined;
  return isDifficulty(value) ? value : DEFAULT_DIFFICULTY;
}

/** Optional legacy field is accepted; malformed explicit values must be rejected. */
export function validDifficulty(state: object): boolean {
  return (
    !("difficulty" in state) || state.difficulty === undefined || isDifficulty(state.difficulty)
  );
}

/** Applies immediately to subsequent charges, without resetting the running day. */
export function setDifficulty(state: DifficultyState, value: unknown): string | null {
  if (!isDifficulty(value)) return "Wähle Entspannt, Normal oder Anspruchsvoll.";
  state.difficulty = value;
  return null;
}

/** A single cent-rounded amount for both the affordability check and all ledgers. */
export function difficultyCost(state: object, base: number, kind: DifficultyCostKind): number {
  if (!Number.isFinite(base) || base < 0)
    throw new RangeError("Operating base cost must be a finite nonnegative number.");
  const rates = DIFFICULTIES[difficultyOf(state)].multipliers;
  if (!Object.hasOwn(rates, kind)) throw new RangeError("Unknown operating cost category.");
  return Math.round((base * rates[kind] + Number.EPSILON) * 100) / 100;
}

/** Keep cent-accurate quotes legible when the chosen difficulty yields half euros. */
export function difficultyEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
