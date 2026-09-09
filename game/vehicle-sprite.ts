import { wagonPaint, type Vehicle } from "./vehicles";
const cache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
/** Material-aware recolouring preserves sprite transparency, dark outlines and baked shading. */
export function paintedCar(
  image: HTMLImageElement,
  vehicle: Vehicle,
  index = 0,
): CanvasImageSource {
  if (!image.complete || !image.naturalWidth) return image;
  const v = wagonPaint(vehicle, index),
    key = JSON.stringify(v);
  let variants = cache.get(image);
  if (!variants) {
    variants = new Map();
    cache.set(image, variants);
  }
  if (variants.has(key)) return variants.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height),
    pixels = data.data;
  const colors = [v.body, v.accent, v.seats].map((c) =>
    [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
  );
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 10) continue;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2],
      hi = Math.max(r, g, b),
      lo = Math.min(r, g, b),
      sat = (hi - lo) / (hi || 1);
    if (hi < 55 || (sat < 0.15 && hi < 155)) continue;
    const warm = r > g * 1.07 && r > b * 1.2,
      gold = r > b * 1.35 && g > b * 1.2,
      cool = g > r * 1.05 || b > r * 1.08;
    let channel = -1;
    if (hi > 100 && r >= g && g / r > 0.77 && b / r > 0.43 && sat < 0.59) channel = 2;
    else if (v.model === "mine")
      channel =
        gold && r > 145 && g / r > 0.73 && b / r < 0.46 ? 1 : gold || warm ? 0 : cool ? 1 : -1;
    else if (v.model === "sport")
      channel = r > g * 1.3 && b > g * 1.2 ? 0 : cool ? 1 : gold && hi > 155 ? 2 : -1;
    else channel = warm ? 0 : cool ? 1 : gold && hi > 165 ? 2 : -1;
    if (channel < 0) continue;
    const shade = Math.max(
      0.28,
      Math.min(
        1.22,
        (0.26 * r + 0.57 * g + 0.17 * b) / (channel === 2 ? 212 : v.model === "mine" ? 159 : 139),
      ),
    );
    for (let k = 0; k < 3; k++) pixels[i + k] = Math.min(255, colors[channel][k] * shade);
  }
  ctx.putImageData(data, 0, 0);
  if (variants.size >= 48) variants.delete(variants.keys().next().value!);
  variants.set(key, canvas);
  return canvas;
}
