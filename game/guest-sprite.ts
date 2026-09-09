import type { Guest } from "./simulation";
import { guestAppearance } from "./visitors";

type Person = Pick<Guest, "id" | "skin"> & Partial<Guest>;
const cache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Reuse the authored walking poses, preserving transparency, outlines and material shading. */
export function paintedGuest(
  image: HTMLImageElement,
  guest: Person,
  seated = false,
): CanvasImageSource {
  if (!image.complete || !image.naturalWidth) return image;
  const look = guestAppearance(guest);
  const key = JSON.stringify([
    look.shirt,
    look.skin,
    look.hair,
    look.pants,
    look.shoes,
    look.pattern,
    look.accessory,
    look.hairStyle,
    seated,
  ]);
  let variants = cache.get(image);
  if (!variants) cache.set(image, (variants = new Map()));
  const old = variants.get(key);
  if (old) return old;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colors = [look.shirt, look.pants, look.skin, look.hair, look.shoes].map(rgb);
  const facingBack = /-(ne|nw)(-|\.)/.test(image.src);
  for (let i = 0; i < data.data.length; i += 4) {
    const px = data.data;
    if (px[i + 3] < 16) continue;
    const r = px[i],
      g = px[i + 1],
      b = px[i + 2],
      y = Math.floor(i / 4 / canvas.width) / canvas.height;
    const max = Math.max(r, g, b);
    if (max < 40) continue;
    let material = -1;
    if (r > g * 1.6 && r > b * 1.7 && r > 105) material = 0;
    else if (b > r * 1.2 && b > g * 1.05) material = 1;
    else if (r > 125 && g > r * 0.52 && g < r * 0.92 && b < g * 0.88) material = 2;
    else if (y < (seated ? 0.44 : 0.38) && r > g * 1.1 && r > b * 1.3) material = 3;
    else if (y > 0.78 && max > 155 && Math.min(r, g, b) / max > 0.65) material = 4;
    if (material < 0) continue;
    let color = colors[material];
    let shade = Math.max(
      0.35,
      Math.min(1.25, (0.26 * r + 0.57 * g + 0.17 * b) / [118, 80, 168, 78, 200][material]),
    );
    if (material === 0 && look.pattern === "stripe" && Math.floor(y * 32) % 5 === 0) {
      color = [243, 233, 209];
      shade = 0.95;
    }
    if (material === 0 && look.accessory === "backpack" && facingBack && y > 0.37 && y < 0.62)
      color = rgb("#93613c");
    if (material === 3 && look.accessory === "cap" && y < (seated ? 0.24 : 0.23)) color = colors[0];
    for (let k = 0; k < 3; k++) px[i + k] = Math.min(255, color[k] * shade);
  }
  ctx.putImageData(data, 0, 0);
  // A park holds at most 220 visitors. The bound retains all current looks per pose.
  if (variants.size >= 256) variants.delete(variants.keys().next().value!);
  variants.set(key, canvas);
  return canvas;
}

/** Feet stay anchored; children retain a larger head relative to their shorter body. */
export function drawWalkingGuest(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  guest: Person,
  x: number,
  y: number,
  scale: number,
  lean = 0,
) {
  const look = guestAppearance(guest),
    child = look.ageGroup === "child";
  const h = look.heightScale,
    w = child ? 0.8 : 0.94 + (h - 0.92) * 0.4;
  const head = 12 * (child ? 0.88 : h),
    body = 32 * h - head,
    anchor = head + body * 0.8;
  const source = paintedGuest(image, guest);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    source,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight * 0.375,
    -12 * w * scale,
    -anchor * scale,
    24 * w * scale,
    head * scale,
  );
  ctx.drawImage(
    source,
    0,
    image.naturalHeight * 0.375,
    image.naturalWidth,
    image.naturalHeight * 0.625,
    -12 * w * scale,
    (head - anchor) * scale,
    24 * w * scale,
    body * scale,
  );
  ctx.restore();
}
