import type { Park } from "./simulation";
import type { View } from "./render";
import { mapWidth, mapHeight } from "./grid";
import { parkWeather, weatherDrop, weatherDropCount } from "./weather";

export function weatherBackground(park: Park) {
  const weather = parkWeather(park);
  return { top: weather.skyColor, bottom: weather.fogColor };
}

/** Weather overlays the canvas world only; DOM panels stay fully legible.
 * Drops are projected from the same deterministic 3D positions as the rides. */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  park: Park,
  view: Pick<View, "zoom" | "panX" | "panY">,
) {
  const weather = parkWeather(park),
    scale = Math.min(width / 1520, height / 860) * view.zoom,
    mapW = mapWidth(park),
    mapH = mapHeight(park),
    project = (x: number, y: number, z = 0) => ({
      x: width * 0.53 + view.panX + (x - y) * 24 * scale,
      y: height * 0.43 + view.panY + (x + y - 30) * 12 * scale - z * 24 * scale,
    });
  ctx.save();
  const shade = weather.cloud * 0.065 + weather.rain * 0.055;
  if (shade > 0.01) {
    ctx.fillStyle = `rgba(58,83,107,${shade})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (weather.heat > 0.05) {
    ctx.fillStyle = `rgba(249,211,117,${weather.heat * 0.045})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (weather.wetness > 0.05) {
    ctx.fillStyle = `rgba(198,222,235,${weather.wetness * 0.24})`;
    for (let y = 0; y < mapH; y++)
      for (let x = 0; x < mapW; x++) {
        if ((x * 13 + y * 7) % 17 || park.tiles[y]?.[x] !== "path") continue;
        const p = project(x + 0.1, y - 0.1);
        if (p.x < -24 || p.x > width + 24 || p.y < -12 || p.y > height + 12) continue;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 6 * scale, 2.3 * scale, -0.12, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  if (weather.rain > 0.015 && scale > 0) {
    const count = weatherDropCount(mapW, mapH);
    ctx.strokeStyle = `rgba(222,241,251,${weather.rain * 0.58})`;
    ctx.lineWidth = Math.max(0.6, Math.min(1.4, scale * 0.42));
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const drop = weatherDrop(i, park.time, mapW, mapH, weather.wind),
        p = project(drop.x, drop.y, drop.z),
        tail = project(drop.tail.x, drop.tail.y, drop.tail.z);
      if (p.x < -12 || p.x > width + 12 || p.y < -24 || p.y > height + 24) continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tail.x, tail.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
