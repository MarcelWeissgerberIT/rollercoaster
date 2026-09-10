import type { View } from "./render";
import { CATALOG, type Building, type Park, type Point } from "./simulation";
import { prepareRoute } from "./motion";
import { usesPods } from "./pods";
import { accessLayout } from "./ride-access";
import { needsOperator } from "./operations";
import { isHabitat } from "./zoo";
import parkSpecs from "./park-sprites.json";
import expansionSpecs from "./expansion-sprites.json";
import experienceSpecs from "./experience-sprites.json";
import lifeSpecs from "./life-sprites.json";
import zooSpecs from "./zoo-sprites.json";
import zooV9Specs from "./zoo-v9-sprites.json";
import zooWalkSpecs from "./zoo-walk-sprites.json";

export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 5;
export type CameraTarget = Pick<View, "zoom" | "panX" | "panY">;
export type CameraRect = { left: number; top: number; right: number; bottom: number };
type SpriteSpec = { width: number; height: number; anchorX: number; anchorY: number };

const specs: Record<string, SpriteSpec> = {
  ...zooWalkSpecs,
  ...zooV9Specs,
  ...lifeSpecs,
  ...experienceSpecs,
  ...zooSpecs,
  ...expansionSpecs,
  ...parkSpecs,
  // These base assets use the same logical dimensions as render.ts.
  wheel: { width: 152, height: 224, anchorX: 76, anchorY: 184 },
  carousel: { width: 104, height: 152, anchorX: 52, anchorY: 124 },
  burger: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  drink: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  toilet: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  bench: { width: 36, height: 30, anchorX: 18, anchorY: 15.5 },
  flowers: { width: 48, height: 40, anchorX: 24, anchorY: 19 },
  tree: { width: 64, height: 96, anchorX: 32, anchorY: 82 },
  pine: { width: 64, height: 96, anchorX: 32, anchorY: 82 },
};
const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, finite(value, 1)));
}
function viewport(width: number, height: number) {
  const w = Math.max(1, finite(width, 1)),
    h = Math.max(1, finite(height, 1));
  return { w, h, scale: Math.min(w / 1520, h / 860) };
}
/** Isometric coordinates before viewport scale/pan, including the renderer's
 * fixed 30-row vertical origin. Keep this in step with render.projection. */
function logicalPoint(p: Point) {
  return { x: (p.x - p.y) * 24, y: (p.x + p.y - 30) * 12 - (p.z ?? 0) * 24 };
}

/** Visible envelope across a complete ride cycle, in logical screen pixels.
 * Ground footprints alone miss wheel tops, swinging boats and coaster loops. */
export function buildingVisualBounds(park: Park, b: Building): CameraRect {
  const bounds: CameraRect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const add = (x: number, y: number, radius = 0) => {
    if (!Number.isFinite(x + y + radius)) return;
    bounds.left = Math.min(bounds.left, x - radius);
    bounds.right = Math.max(bounds.right, x + radius);
    bounds.top = Math.min(bounds.top, y - radius);
    bounds.bottom = Math.max(bounds.bottom, y + radius);
  };
  const point = (p: Point, radius = 0) => {
    const q = logicalPoint(p);
    add(q.x, q.y, radius);
  };
  const sprite = (spec: SpriteSpec | undefined, at: Point, angle = 0) => {
    if (!spec) return;
    const q = logicalPoint(at),
      c = Math.cos(angle),
      s = Math.sin(angle);
    for (const x of [-spec.anchorX, spec.width - spec.anchorX])
      for (const y of [-spec.anchorY, spec.height - spec.anchorY])
        add(q.x + x * c - y * s, q.y + x * s + y * c);
  };
  const n = CATALOG[b.kind].size,
    center = { x: b.x + (n - 1) / 2, y: b.y + (n - 1) / 2 },
    kind = b.design?.mechanism ?? b.kind;
  for (const x of [b.x - 0.5, b.x + n - 0.5])
    for (const y of [b.y - 0.5, b.y + n - 0.5]) point({ x, y });

  if (b.kind === "coaster") {
    const track = b.track ?? [];
    let route: Point[] = track;
    try {
      route = prepareRoute(track).points;
    } catch {
      /* Imported drafts still get a finite frame. */
    }
    for (const p of [...track, ...route]) {
      point(p, 40); // Rotated car/rider envelope at every rail height.
      point({ ...p, z: 0 }, 5); // Tall supports reach the actual terrain.
    }
    sprite(specs[`station-${track[0]?.style ?? "steel"}`], b);
  } else if (isHabitat(b.kind)) {
    // Animals, high fences and shelters may sit at any habitat edge.
    for (const x of [b.x - 0.5, b.x + n - 0.5])
      for (const y of [b.y - 0.5, b.y + n - 0.5]) {
        sprite(specs[CATALOG[b.kind].sprite], { x, y });
        point({ x, y, z: 1.4 }, 6);
      }
    if (b.habitat?.viewpoint) point(b.habitat.viewpoint, 24);
  } else {
    sprite(specs[CATALOG[kind].sprite], center);
    if (kind === "pirate") {
      // The articulated ship swings outside the static frame's rectangle.
      const pivot = { ...center, z: 114 / 24 };
      for (let step = 0; step <= 24; step++)
        sprite(specs["pirate-ship"], pivot, -0.9 + (step / 24) * 1.8);
    }
  }
  if (b.design) {
    const q = logicalPoint(center);
    add(q.x - 58, q.y - 38);
    add(q.x - 18, q.y + 12);
  }
  if (usesPods(b.kind)) {
    const layout = accessLayout(park, b);
    for (const post of [layout.entry, layout.exit]) {
      point(post, 30);
      point({ ...post, z: 1.25 }, 24);
      point(post.port, 24);
    }
    if (needsOperator(b.kind)) {
      point(layout.cabin, 24);
      point({ ...layout.cabin, z: 1.25 }, 24);
    }
  }
  if (!Number.isFinite(bounds.left + bounds.top + bounds.right + bounds.bottom))
    return { left: -24, right: 24, top: -24, bottom: 24 };
  return bounds;
}

function usableRectangle(rect: CameraRect, w: number, h: number): CameraRect {
  const left = Math.max(0, Math.min(w, finite(rect.left))),
    right = Math.max(0, Math.min(w, finite(rect.right, w))),
    top = Math.max(0, Math.min(h, finite(rect.top))),
    bottom = Math.max(0, Math.min(h, finite(rect.bottom, h)));
  return right > left && bottom > top
    ? { left, right, top, bottom }
    : { left: 0, right: w, top: 0, bottom: h };
}

/** Frame the whole attraction inside an overlay-free canvas rectangle. The
 * result can be assigned to the existing smooth cameraTarget animation. */
export function focusBuildingCamera(
  park: Park,
  b: Building,
  _view: CameraTarget,
  width: number,
  height: number,
  usable: CameraRect,
): CameraTarget {
  const { w, h, scale } = viewport(width, height),
    rect = usableRectangle(usable, w, h),
    bounds = buildingVisualBounds(park, b),
    roomWidth = rect.right - rect.left,
    roomHeight = rect.bottom - rect.top,
    padding = Math.min(28, roomWidth * 0.08, roomHeight * 0.08),
    zoom = clampZoom(
      Math.min(
        (roomWidth - padding * 2) / (Math.max(32, bounds.right - bounds.left) * scale),
        (roomHeight - padding * 2) / (Math.max(32, bounds.bottom - bounds.top) * scale),
      ),
    );
  return {
    zoom,
    panX:
      (rect.left + rect.right) / 2 - w * 0.53 - ((bounds.left + bounds.right) / 2) * scale * zoom,
    panY:
      (rect.top + rect.bottom) / 2 - h * 0.43 - ((bounds.top + bounds.bottom) / 2) * scale * zoom,
  };
}

/** Preserve the world position below the mouse while zooming, including the
 * scale-dependent vertical map origin used by the park renderer. */
export function zoomCameraAt(
  view: CameraTarget,
  width: number,
  height: number,
  nextZoom: number,
  anchor: Pick<Point, "x" | "y">,
): CameraTarget {
  const { w, h } = viewport(width, height),
    zoom = clampZoom(nextZoom),
    ratio = zoom / clampZoom(view.zoom),
    x = finite(anchor.x, w / 2),
    y = finite(anchor.y, h / 2);
  return {
    zoom,
    panX: x - w * 0.53 - (x - w * 0.53 - finite(view.panX)) * ratio,
    panY: y - h * 0.43 - (y - h * 0.43 - finite(view.panY)) * ratio,
  };
}
