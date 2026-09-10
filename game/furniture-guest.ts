import type { Guest } from "./simulation";
import { guestAppearance } from "./visitors";
import { paintedGuest } from "./guest-sprite";

/** Full authored sitting pose with the hips on the cushion; ride vehicles use a separate leg crop. */
export function drawFurnitureGuest(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  guest: Guest,
  x: number,
  y: number,
  scale: number,
) {
  const personScale = guestAppearance(guest).heightScale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(personScale, personScale);
  ctx.drawImage(
    paintedGuest(image, guest, true),
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    -10 * scale,
    -16 * scale,
    20 * scale,
    24 * scale,
  );
  ctx.restore();
}
