import type { CleaningPark, Cleaner, Cell } from "./cleanliness";
import { cleanerWorkProgress, cleanerWorkTarget } from "./cleanliness";
import { staffPose, staffYaw, type StaffMotion, type V3 } from "./staff-animation";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** The exact work target owns the lid and bag transfer; no decorative fake jobs. */
export function cleanerTransfer(park: CleaningPark, worker: Cleaner) {
  if (worker.mode !== "empty" && worker.mode !== "deposit") return null;
  const point = cleanerWorkTarget(park, worker);
  if (!point) return null;
  const progress = cleanerWorkProgress(worker),
    collection = worker.target?.kind === "collection",
    target: Cell = collection ? { x: point.x + 0.4, y: point.y - 0.15 } : point,
    empty = worker.mode === "empty",
    t = empty ? clamp((progress - 0.3) / 0.34) : clamp((progress - 0.38) / 0.32);
  return {
    target,
    collection,
    progress,
    t,
    empty,
    hideHandBag: empty ? progress < 0.64 : progress >= 0.38,
    showTransfer: empty ? progress >= 0.3 && progress < 0.64 : progress >= 0.38 && progress < 0.7,
    lidOpen: Math.sin(clamp((progress - 0.24) / 0.52) * Math.PI),
  };
}
export function staffBagLocal(motion: StaffMotion): V3 {
  return (
    staffPose({ ...motion, hideBag: false }).find((p) => p.id === "bag")?.a ?? [0, 0.85, -0.38]
  );
}
export function staffLocalWorld(point: V3, motion: StaffMotion): V3 {
  const yaw = staffYaw(motion.heading),
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [point[0] * c + point[2] * s, point[1], -point[0] * s + point[2] * c];
}
