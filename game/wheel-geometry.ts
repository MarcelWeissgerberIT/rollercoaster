/** Unit-radius cabin anchors in the wheel's vertical world-X/Y plane.
 * Gondola zero is at the lower boarding platform when angle is zero. */
export function wheelGondolaPose(index: number, angle: number, count: number) {
  const theta = angle + (index * Math.PI * 2) / count;
  return { x: Math.sin(theta), y: -Math.cos(theta), theta };
}

/** Explicit 3D test-ride timeline only. The live park reads wheelVisualState.
 * Integrated smooth acceleration at both ends preserves whole revolutions. */
export function wheelPreviewProgress(time: number, duration: number): number {
  if (!(duration > 0)) return 0;
  const t = Math.max(0, Math.min(duration, time)),
    ramp = Math.min(2, duration / 4),
    acceleratedDistance = (seconds: number) => {
      const u = seconds / ramp;
      return ramp * (u ** 3 - u ** 4 / 2);
    },
    fullDistance = duration - ramp,
    distance =
      t < ramp
        ? acceleratedDistance(t)
        : t > duration - ramp
          ? fullDistance - acceleratedDistance(duration - t)
          : t - ramp / 2;
  return distance / fullDistance;
}

/** Progress belongs to the real boarding/unloading stop, never a render clock. */
export function wheelTransferMotion(direction: "boarding" | "alighting", progress: number) {
  const p = Math.max(0, Math.min(1, progress)),
    seated = direction === "boarding" ? p >= 0.82 : p <= 0.18,
    travel = direction === "boarding" ? Math.min(1, p / 0.82) : Math.max(0, (p - 0.18) / 0.82),
    towardSeat = direction === "boarding" ? travel : 1 - travel;
  return { seated, towardSeat, walking: !seated && p > 0 && p < 1, gait: travel * Math.PI * 6 };
}
