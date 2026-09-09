import type { Building, Point } from "./simulation";
export type Pod = { side: 0 | 1 | 2 | 3; offset: number };
export type PodRole = "entry" | "exit";
export type AccessPods = { entry: Pod; exit: Pod };
export const POD_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;
export const POD_SIDES = ["Ost", "Süd", "West", "Nord"];
export const usesPods = (kind: string) =>
  [
    "bumper",
    "balloonride",
    "coaster",
    "wheel",
    "carousel",
    "swing",
    "drop",
    "pirate",
    "teacups",
    "spinner",
    "custom",
    "train",
    "shuttle",
  ].includes(kind);
export const podSlots = (size: number): Pod[] =>
  [0, 1, 2, 3].flatMap((side) =>
    Array.from({ length: size }, (_, offset) => ({ side: side as Pod["side"], offset })),
  );
export const samePod = (a: Pod, b: Pod) => a.side === b.side && a.offset === b.offset;
export function podPort(b: Pick<Building, "x" | "y">, size: number, pod: Pod): Point {
  return pod.side === 0
    ? { x: b.x + size, y: b.y + pod.offset }
    : pod.side === 1
      ? { x: b.x + pod.offset, y: b.y + size }
      : pod.side === 2
        ? { x: b.x - 1, y: b.y + pod.offset }
        : { x: b.x + pod.offset, y: b.y - 1 };
}
export function podPose(b: Pick<Building, "x" | "y">, size: number, pod: Pod) {
  const port = podPort(b, size, pod),
    [dx, dy] = POD_DIRECTIONS[pod.side];
  return { x: port.x - dx * 0.68, y: port.y - dy * 0.68, dx, dy };
}
export function rotatePods(
  pods: AccessPods | undefined,
  size: number,
  turns: number,
): AccessPods | undefined {
  if (!pods) return undefined;
  const rotate = (pod: Pod): Pod => {
    let { side, offset } = pod;
    for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
      if (side === 0 || side === 2) offset = size - 1 - offset;
      side = ((side + 1) % 4) as Pod["side"];
    }
    return { side, offset };
  };
  return { entry: rotate(pods.entry), exit: rotate(pods.exit) };
}
export function validPods(value: unknown, size: number): value is AccessPods {
  if (!value || typeof value !== "object") return false;
  const pods = value as AccessPods;
  const valid = (p: Pod) =>
    p &&
    [0, 1, 2, 3].includes(p.side) &&
    Number.isInteger(p.side) &&
    Number.isInteger(p.offset) &&
    p.offset >= 0 &&
    p.offset < size;
  return !!valid(pods.entry) && !!valid(pods.exit) && !samePod(pods.entry, pods.exit);
}
