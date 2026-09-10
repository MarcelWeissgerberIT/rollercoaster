import type { Guest } from "./simulation";
import { guestAppearance } from "./visitors";
import { headBitmap } from "./person-head";

type Person = Pick<Guest, "id" | "skin"> & Partial<Guest>;
const cache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The authored neck anchor follows each actual step frame, including its small
 * lateral shifts. Bodies and seated/standing poses retain their original artwork.
 */
export function guestHeadAnchor(src: string, seated = false) {
  const match = src.match(/-(se|sw|ne|nw)(?:-(\d))?\.png/);
  if (!match) return null;
  const direction = match[1], frame = Number(match[2] ?? 0),
    right = direction === "se" || direction === "ne",
    back = direction === "ne" || direction === "nw";
  // Sprite directions map to world +X,+Z,-Z,-X respectively.
  const yaw = { se: -Math.PI / 2, sw: Math.PI, ne: 0, nw: Math.PI / 2 }[direction]!;
  if (seated) return { x: right ? 38 : 46, y: back ? 39 : 35, yaw, cut: back ? 48 : 44 };
  const x = (direction === "ne" && frame === 2) ||
    (direction === "nw" && frame >= 2) ||
    ((direction === "se" || direction === "sw") && frame === 3) ||
    (direction === "sw" && frame === 1) ? 52 : 48;
  return { x, y: (frame % 2 && direction !== "ne") ? 27 : 31, yaw, cut: 40 };
}

/** Keep authored body motion/shading; replace the coarse head with shared 3D anatomy. */
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
  const anchor = guestHeadAnchor(image.src, seated);
  // Only known authored pose dimensions carry this neck convention.
  if (anchor && ((seated && canvas.width === 80 && canvas.height === 96) ||
    (!seated && canvas.width === 96 && canvas.height === 128))) {
    const head = headBitmap({ ...look, hat: look.shirt, brim: look.pants }, anchor.yaw);
    for (let y = 0; y < anchor.cut; y++)
      data.data.fill(0, y * canvas.width * 4, (y + 1) * canvas.width * 4);
    for (let y = 0; y < head.height; y++) for (let x = 0; x < head.width; x++) {
      const source = (y * head.width + x) * 4,
        px = anchor.x + x - head.width / 2, py = anchor.y + y - 18;
      if (!head.data[source + 3] || px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) continue;
      data.data.set(head.data.subarray(source, source + 4), (py * canvas.width + px) * 4);
    }
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
