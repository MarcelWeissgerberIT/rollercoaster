import type { Point } from "./simulation";
import type { TrafficMode, TrafficReport, TrafficZone } from "./park-traffic";

export const HEATMAP_LABELS: Record<TrafficMode, string> = {
  crowd: "Besucherandrang",
  queues: "Wartende Gäste",
  mood: "Besucherstimmung",
  litter: "Müll im Park",
};
const colors = ["#b5c1b2", "#85c5b0", "#e6cc78", "#e5a16c", "#d87575"];
export function trafficColor(z: TrafficZone, mode: TrafficMode): string {
  if (mode === "mood")
    return z.happiness === null
      ? colors[0]
      : colors[z.happiness >= 75 ? 1 : z.happiness >= 45 ? 2 : 4];
  const n = mode === "crowd" ? z.guests : mode === "queues" ? z.waiting : z.litter;
  const limits = mode === "crowd" ? [3, 8, 15] : mode === "queues" ? [3, 7, 11] : [2, 5, 9];
  return colors[n === 0 ? 0 : n <= limits[0] ? 1 : n <= limits[1] ? 2 : n <= limits[2] ? 3 : 4];
}
export function trafficLabel(z: TrafficZone, mode: TrafficMode): string {
  return mode === "mood"
    ? z.happiness === null
      ? "–"
      : `${Math.round(z.happiness)}%`
    : String(mode === "crowd" ? z.guests : mode === "queues" ? z.waiting : z.litter);
}
/** One bounded overlay per 3×3 tile area; fixed bins keep the colors comparable over time. */
export function drawTrafficOverlay(
  ctx: CanvasRenderingContext2D,
  report: TrafficReport,
  mode: TrafficMode,
  selected: string | null,
  project: (x: number, y: number, z?: number) => Point,
  scale: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.lineJoin = "round";
  for (const zone of report.zones) {
    const points = [
      project(zone.x - 0.5, zone.y - 0.5),
      project(zone.x + zone.width - 0.5, zone.y - 0.5),
      project(zone.x + zone.width - 0.5, zone.y + zone.height - 0.5),
      project(zone.x - 0.5, zone.y + zone.height - 0.5),
    ];
    if (
      Math.max(...points.map((p) => p.x)) < 0 ||
      Math.min(...points.map((p) => p.x)) > width ||
      Math.max(...points.map((p) => p.y)) < 0 ||
      Math.min(...points.map((p) => p.y)) > height
    )
      continue;
    const color = trafficColor(zone, mode),
      value = trafficLabel(zone, mode),
      empty = mode === "mood" ? zone.happiness === null : value === "0",
      chosen = zone.id === selected;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = empty ? 0.035 : 0.67;
    ctx.fill();
    ctx.globalAlpha = chosen ? 1 : empty ? 0.06 : 0.65;
    ctx.strokeStyle = chosen ? "#fffbea" : "#fffaf0";
    ctx.lineWidth = chosen ? 3 : 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if ((!empty && scale >= 0.7) || chosen) {
      const p = project(zone.point.x, zone.point.y),
        text = value;
      ctx.font = `700 ${Math.max(11, Math.min(16, 10 * scale))}px system-ui, sans-serif`;
      const tw = ctx.measureText(text).width + 14;
      ctx.fillStyle = "#fffbed";
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.roundRect(p.x - tw / 2, p.y - 12, tw, 24, 9);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#254f44";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, p.x, p.y);
    }
  }
  ctx.restore();
}
