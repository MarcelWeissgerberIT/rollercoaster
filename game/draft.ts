import type { Park, Point } from "./simulation";
export function draftHistoryData(history: Point[][], length: number) {
  const steps = history.filter((t) => t.length < length).slice(-128);
  return {
    history: steps.map((t) => t.length),
    historyEnds: steps.map((t) => (t.length ? { ...t.at(-1)! } : null)),
  };
}
export function restoreDraftHistory(draft: NonNullable<Park["draft"]>): Point[][] {
  return draft.history.map((n, i) => {
    const track = draft.track.slice(0, n);
    if (n && draft.historyEnds?.[i]) track[n - 1] = { ...draft.historyEnds[i]! };
    return track;
  });
}
