/** Shared head anatomy for guests and staff. Metres; the face looks along -Z. */
export type HeadLook = {
  skin: string;
  hair: string;
  hairStyle: number;
  accessory?: string;
  hat?: string;
  brim?: string;
  wideBrim?: boolean;
};
export type HeadPart = {
  id: string;
  color: string;
  p: [number, number, number];
  s: [number, number, number];
};
const tint = (hex: string, amount: number) =>
  `#${[1, 3, 5].map((i) => Math.max(0, Math.min(255,
    Math.round(parseInt(hex.slice(i, i + 2), 16) + amount),
  )).toString(16).padStart(2, "0")).join("")}`;

/** Fixed slots also work in instanced crowds. Hidden accessories have zero size. */
export function personHeadParts(look: HeadLook): HeadPart[] {
  const parts: HeadPart[] = [];
  const add = (id: string, color: string, p: HeadPart["p"], s: HeadPart["s"], visible = true) =>
    parts.push({ id, color, p, s: visible ? s : [0, 0, 0] });
  const long = look.hairStyle === 2,
    pony = look.hairStyle === 3,
    cap = look.accessory === "cap",
    glasses = look.accessory === "glasses";
  add("head-neck", look.skin, [0, -0.21, 0.014], [0.058, 0.091, 0.058]);
  add("head", look.skin, [0, 0.018, 0], [0.139, 0.158, 0.13]);
  add("jaw", look.skin, [0, -0.076, -0.025], [0.108, 0.078, 0.1]);
  add("hair-back", look.hair, [0, 0.043, 0.084], [0.142, 0.123, 0.075]);
  add("hair-crown", look.hair, [0, 0.132, 0.025], [0.148, 0.065, 0.125]);
  add("hair-part", tint(look.hair, 20), [-0.045, 0.151, 0.044], [0.028, 0.034, 0.115], !cap);
  add("hair-fringe", look.hair, [look.hairStyle % 2 ? 0.071 : -0.071, 0.086, -0.106],
    [look.hairStyle === 1 ? 0.091 : 0.073, 0.061, 0.038]);
  add("hair-nape", tint(look.hair, -12), [0, -0.066, 0.11], [0.091, 0.049, 0.049]);
  add("hair-length", look.hair, [0, long ? -0.081 : -0.03, long ? 0.11 : 0.18],
    long ? [0.15, 0.131, 0.074] : [0.062, 0.141, 0.073], long || pony);
  for (const side of [-1, 1]) {
    add(`ear${side}`, look.skin, [side * 0.14, -0.009, 0.008], [0.026, 0.044, 0.028]);
    add(`eye${side}`, "#303c38", [side * 0.052, 0.019, -0.128], [0.014, 0.012, 0.009]);
    add(`brow${side}`, look.hair, [side * 0.052, 0.052, -0.124], [0.032, 0.008, 0.009]);
  }
  add("nose", look.skin, [0, -0.017, -0.144], [0.025, 0.034, 0.033]);
  add("mouth", tint(look.skin, -55), [0, -0.073, -0.118], [0.029, 0.006, 0.01]);
  if (cap) {
    add("cap", look.hat ?? "#417b89", [0, 0.163, 0.02], [0.162, 0.062, 0.15]);
    add("brim", look.brim ?? look.hat ?? "#345a68", [0, 0.133, -0.129],
      [look.wideBrim ? 0.216 : 0.161, 0.014, 0.105]);
    add("cap-strap", look.brim ?? "#40524c", [0, 0.131, 0.161], [0.064, 0.012, 0.008]);
  } else if (glasses) {
    for (const side of [-1, 1])
      add(`glasses${side}`, "#394853", [side * 0.052, 0.021, -0.148], [0.037, 0.025, 0.008]);
    add("glasses-bridge", "#394853", [0, 0.024, -0.148], [0.023, 0.005, 0.008]);
  } else {
    for (let i = 0; i < 3; i++) add(`accessory${i}`, look.hair, [0, 0, 0], [0, 0, 0]);
  }
  return parts;
}

export type HeadBitmap = { width: number; height: number; data: Uint8ClampedArray };
const bitmaps = new Map<string, HeadBitmap>();

/** Small orthographic depth raster, with the same anatomy as the actual 3D model.
 * A depth buffer hides faces behind skulls and cap brims; no flat, always-front ellipses.
 * Only direction/look changes rasterize. Gait and work retain their existing head anchors.
 */
export function headBitmap(look: HeadLook, yaw: number): HeadBitmap {
  const turn = ((Math.round(yaw / (Math.PI * 2) * 16) % 16) + 16) % 16;
  const key = JSON.stringify([look, turn]);
  const cached = bitmaps.get(key);
  if (cached) return cached;
  const width = 40, height = 44,
    data = new Uint8ClampedArray(width * height * 4),
    depth = new Float64Array(width * height).fill(-Infinity),
    angle = turn / 16 * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle),
    // Park isometry, viewed from +X/+Z. Raster is four source pixels per park pixel.
    sx = 48, sy = 24, sz = 60,
    dx = c - s, dy = 2 * sy / sz, dz = s + c;
  for (const part of personHeadParts(look)) {
    if (part.s.some((v) => v === 0)) continue;
    const inv = part.s.map((n) => 1 / (n * n)),
      a = dx * dx * inv[0] + dy * dy * inv[1] + dz * dz * inv[2],
      rgb = [1, 3, 5].map((i) => parseInt(part.color.slice(i, i + 2), 16));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = (x + 0.5 - width / 2) / (2 * sx),
        v = -(y + 0.5 - 18) / sz,
        ox = u * (c + s) - part.p[0], oy = v - part.p[1],
        oz = u * (s - c) - part.p[2],
        b = ox * dx * inv[0] + oy * dy * inv[1] + oz * dz * inv[2],
        q = ox * ox * inv[0] + oy * oy * inv[1] + oz * oz * inv[2] - 1,
        discriminant = b * b - a * q;
      if (discriminant < 0) continue;
      const t = (-b + Math.sqrt(discriminant)) / a, index = y * width + x;
      if (t <= depth[index]) continue;
      depth[index] = t;
      const nx = (ox + dx * t) * inv[0], ny = (oy + dy * t) * inv[1], nz = (oz + dz * t) * inv[2],
        wx = nx * c + nz * s, wz = -nx * s + nz * c,
        light = (wx * -0.45 + ny * 0.8 + wz * 0.25) / Math.hypot(nx, ny, nz),
        shade = light > 0.55 ? 1.13 : light > 0.08 ? 1 : light > -0.35 ? 0.83 : 0.69;
      for (let k = 0; k < 3; k++) data[index * 4 + k] = Math.min(255, rgb[k] * shade);
      data[index * 4 + 3] = 255;
    }
  }
  // One source-pixel silhouette, so small heads remain readable on grass and paths.
  const alpha = data.filter((_, i) => i % 4 === 3);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (!alpha[i] && [i - 1, i + 1, i - width, i + width].some((j) => alpha[j]))
      data.set([48, 58, 44, 225], i * 4);
  }
  const bitmap = { width, height, data };
  if (bitmaps.size >= 1024) bitmaps.delete(bitmaps.keys().next().value!);
  bitmaps.set(key, bitmap);
  return bitmap;
}

const canvases = new WeakMap<HeadBitmap, HTMLCanvasElement>();
export function drawPersonHead(
  ctx: CanvasRenderingContext2D, look: HeadLook, yaw: number,
  x: number, y: number, scaleX: number, scaleY: number,
) {
  const bitmap = headBitmap(look, yaw);
  let canvas = canvases.get(bitmap);
  if (!canvas && typeof document !== "undefined" && typeof ImageData !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext("2d")!.putImageData(new ImageData(bitmap.data.slice(), bitmap.width, bitmap.height), 0, 0);
    canvases.set(bitmap, canvas);
  }
  if (canvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, x - bitmap.width / 2 * scaleX, y - 18 * scaleY,
      bitmap.width * scaleX, bitmap.height * scaleY);
  } else {
    // A DOM-free renderer also keeps geometry probes and thumbnails usable.
    for (let py = 0; py < bitmap.height; py++) for (let px = 0; px < bitmap.width; px++) {
      const i = (py * bitmap.width + px) * 4;
      if (!bitmap.data[i + 3]) continue;
      ctx.fillStyle = `rgb(${bitmap.data[i]} ${bitmap.data[i + 1]} ${bitmap.data[i + 2]})`;
      ctx.fillRect(x + (px - bitmap.width / 2) * scaleX, y + (py - 18) * scaleY, scaleX, scaleY);
    }
  }
}
