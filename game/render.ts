import { birdCanvasLayers } from "./bird-canvas";
import { groundPathAt } from "./track-support";
import { trackCanvasLayers, drawTrackSegment } from "./track-canvas";
import { drawWeather, weatherBackground } from "./weather-canvas";
import { drawWeatherObject, isWeatherObject } from "./weather-objects";
import { RESTROOM_SPRITE } from "./restroom";
import { drawCleanerAreas, type CleanerAreaOverlay } from "./cleaner-area-overlay";
import zooWalkSpecs from "./zoo-walk-sprites.json";
import { guestAppearance } from "./visitors";
import { guestWalkPosition } from "./guest-walk";
import { drawHeldSouvenir } from "./souvenir-canvas";
import { paintedGuest, drawWalkingGuest } from "./guest-sprite";
import zooV9Specs from "./zoo-v9-sprites.json";
import { drawStationDirection } from "./station-direction";
import { makeRidePath } from "./ride-path";
import { photoHardwarePoints, isPhotoPoint } from "./coaster-photo";
import { GATES, gateStyle } from "./entrance";
import { staffLocation, type StaffRef } from "./staff";
import { staffMotion } from "./staff-visual";
import { drawStaff } from "./staff-canvas";
import { OPERATOR_POSTS, needsOperator } from "./operations";
import { accessLayout, gateMotion, withAccessLayoutCache } from "./ride-access";
import { drawAccessPod, drawAccessCabin, type AccessHitPolygon } from "./access-canvas";
import { cleanerTransfer, staffBagLocal, staffLocalWorld } from "./staff-work";
import lifeSpecs from "./life-sprites.json";
import { bumperPose, balloonPose } from "./family-rides";
import { FOOD, isFood, restPose, PATH_STYLES, pathStyleAt } from "./park-life";
import { isRotatableFurniture } from "./building-orientation";
import { drawFurniture, FURNITURE_HEIGHT_PIXELS } from "./furniture";
import { drawFurnitureGuest } from "./furniture-guest";
import { dogCompanionOwners, dogCompanionPose } from "./guest-dogs";
import { drawDogCompanion, dogLeashGrip } from "./dog-canvas";
import zooSpecs from "./zoo-sprites.json";
import { isHabitat } from "./zoo";
import { animalPose, animalSprite } from "./zoo-motion";
import { habitatSceneryLayers } from "./zoo-canvas";
import type { ParkIssue } from "./park-insights";
import { drawTrafficOverlay } from "./traffic-overlay";
import type { TrafficMode, TrafficReport } from "./park-traffic";
import experienceSpecs from "./experience-sprites.json";
import { vehicleFor, VEHICLES } from "./vehicles";
import { paintedCar } from "./vehicle-sprite";
import parkSpecs from "./park-sprites.json";
import { podPort, podPose, podSlots, usesPods, type Pod, type PodRole } from "./pods";
import { mapWidth, mapHeight, insideMap } from "./grid";
import { transportPose, transportCarPose } from "./transit";
import expansionSpecs from "./expansion-sprites.json";
import {
  SIZE,
  rideDuration,
  rideCapacity,
  CATALOG,
  footprint,
  access,
  isRide,
  connected,
  exitNetwork,
  effectivePods,
  type Guest,
  type Park,
  type Point,
  type Kind,
  type Building,
} from "./simulation";
import { planPod, type Placement, type Geometry } from "./construction";
import {
  advanceSpin,
  type TrainMotor,
  prepareRoute,
  trainDistance,
  routePosition,
  type Spin,
} from "./motion";
const photoPaths = new WeakMap<Point[], ReturnType<typeof makeRidePath>>();
export type View = {
  cleanerAreas?: CleanerAreaOverlay[];
  staffFocus?: { ref: StaffRef; until: number };
  stationDirection?: Building;
  showMoods?: boolean;
  issues?: ParkIssue[];
  traffic?: { report: TrafficReport; mode: TrafficMode; selected: string | null };
  viewpointEdit?: Point[];
  podEdit?: { id: number; role: PodRole; clear?: boolean };
  zoom: number;
  panX: number;
  panY: number;
  grid: boolean;
  hover: Point | null;
  tool: string;
  selected: number | null;
  draft: Point[];
  trackCuts?: Point[][];
  cutConnections?: Point[][];
  cutColor?: string;
  hoveredId?: number | null;
  hitTargets?: HitTarget[];
  fitPreview?: { removed: Point[]; added: Point[] };
  candidate?: { points: Point[]; error: boolean };
  height: number;
  preview?: Placement | null;
  connection?: Point[];
  adjustment?: {
    mode: "station" | "move";
    building: Building;
    geometry: Geometry;
    candidates: Point[];
  };
};
type HitTarget =
  | { id: number; a: Point; b: Point; pod?: PodRole }
  | {
      id: number;
      polygons: AccessHitPolygon[];
      bounds: { left: number; right: number; top: number; bottom: number };
      pod?: PodRole;
    }
  | {
      id: number;
      name: string;
      p: Point;
      spec: SpriteSpec;
      scale: number;
      rotation: number;
      mirror: boolean;
      transform?: [number, number, number, number];
    };
const masks = new Map<string, { data: Uint8ClampedArray; width: number; height: number }>();
function insideHitPolygon(points: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j],
      b = points[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy,
      t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
    if (Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 0.00001) return true;
    if (a.y > y !== b.y > y && x < a.x + ((y - a.y) * dx) / dy) inside = !inside;
  }
  return inside;
}
function hitTargetAt(v: View, x: number, y: number): HitTarget | undefined {
  for (let i = (v.hitTargets?.length ?? 0) - 1; i >= 0; i--) {
    const hit = v.hitTargets![i];
    if ("polygons" in hit) {
      if (
        x < hit.bounds.left ||
        x > hit.bounds.right ||
        y < hit.bounds.top ||
        y > hit.bounds.bottom
      )
        continue;
      if (hit.polygons.some((polygon) => insideHitPolygon(polygon, x, y))) return hit;
      continue;
    }
    if ("a" in hit) {
      const dx = hit.b.x - hit.a.x,
        dy = hit.b.y - hit.a.y,
        t = Math.max(
          0,
          Math.min(1, ((x - hit.a.x) * dx + (y - hit.a.y) * dy) / (dx * dx + dy * dy || 1)),
        );
      if (Math.hypot(x - hit.a.x - t * dx, y - hit.a.y - t * dy) < 6) return hit;
      continue;
    }
    const dx = x - hit.p.x,
      dy = y - hit.p.y,
      c = Math.cos(hit.rotation),
      s = Math.sin(hit.rotation);
    const m = hit.transform ?? [c, s, -s, c],
      det = m[0] * m[3] - m[1] * m[2];
    const px =
        (((dx * m[3] - dy * m[2]) / det) * (hit.mirror ? -1 : 1)) / hit.scale + hit.spec.anchorX,
      py = (-dx * m[1] + dy * m[0]) / det / hit.scale + hit.spec.anchorY;
    if (px < 0 || py < 0 || px >= hit.spec.width || py >= hit.spec.height) continue;
    const mask = masks.get(hit.name);
    if (
      !mask ||
      mask.data[
        (Math.floor((py / hit.spec.height) * mask.height) * mask.width +
          Math.floor((px / hit.spec.width) * mask.width)) *
          4 +
          3
      ] > 30
    )
      return hit;
  }
}
export function hitBuildingAt(v: View, x: number, y: number): number | null {
  return hitTargetAt(v, x, y)?.id ?? null;
}
export function hitAccessPodAt(v: View, x: number, y: number): PodRole | undefined {
  const hit = hitTargetAt(v, x, y);
  return hit && "pod" in hit ? hit.pod : undefined;
}
type SpriteSpec = { width: number; height: number; anchorX: number; anchorY: number };
/** Placement ghosts use the same renderer, with a complete, empty ride state. */
export function previewBuilding(kind: Kind, x: number, y: number): Building {
  return {
    id: -1,
    kind,
    x,
    y,
    name: CATALOG[kind].name,
    open: false,
    price: 0,
    served: 0,
    revenue: 0,
    queue: [],
    riders: [],
    cycle: 0,
    tested: false,
  };
}
const sprites: Record<string, HTMLImageElement> = {};
// Every number is in logical screen pixels for a 48 × 24 ground tile.
const specs: Record<string, SpriteSpec> = {
  ...zooWalkSpecs,
  ...zooV9Specs,
  ...lifeSpecs,
  ...experienceSpecs,
  ...zooSpecs,
  ...expansionSpecs,
  ...parkSpecs,
  wheel: { width: 152, height: 216, anchorX: 76, anchorY: 176 },
  carousel: { width: 104, height: 152, anchorX: 52, anchorY: 124 },
  burger: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  drink: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  toilet: RESTROOM_SPRITE,
  station: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  entrance: { width: 112, height: 176, anchorX: 56, anchorY: 136 },
  bench: { width: 36, height: 30, anchorX: 18, anchorY: 15.5 },
  flowers: { width: 48, height: 40, anchorX: 24, anchorY: 19 },
  tree: { width: 64, height: 96, anchorX: 32, anchorY: 82 },
  pine: { width: 64, height: 96, anchorX: 32, anchorY: 82 },
};
const directions = ["se", "sw", "nw", "ne"] as const;
type Direction = (typeof directions)[number];
const extra = [
  "wheel-rim",
  "wheel-support",
  "wheel-cabin",
  "carousel-roof",
  "carousel-base",
  "carousel-horse",
  ...directions.flatMap((d) => [`guest-${d}-a`, `guest-${d}-b`, `guest2-${d}`, `car-${d}`]),
];
const walkNames = ["red", "teal"].flatMap((c) =>
  directions.flatMap((d) => Array.from({ length: 4 }, (_, i) => `walk-${c}-${d}-${i}`)),
);
export function loadSprites(base = "/assets/pixel-v2") {
  return Promise.all(
    [...Object.keys(specs), ...extra, ...walkNames].map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const im = new Image();
          im.onload = () => {
            sprites[name] = im;
            const canvas = document.createElement("canvas");
            canvas.width = im.naturalWidth;
            canvas.height = im.naturalHeight;
            const context = canvas.getContext("2d");
            if (context) {
              context.drawImage(im, 0, 0);
              masks.set(name, {
                data: context.getImageData(0, 0, canvas.width, canvas.height).data,
                width: canvas.width,
                height: canvas.height,
              });
            }
            resolve();
          };
          im.onerror = () => reject(Error(name));
          im.src = `${name in zooWalkSpecs ? base.replace(/pixel-v2$/, "zoo-walk-v10") : name in zooV9Specs ? base.replace(/pixel-v2$/, "zoo-v9") : name in lifeSpecs ? base.replace(/pixel-v2$/, "park-v8") : name in zooSpecs ? base.replace(/pixel-v2$/, "zoo-v7") : name in experienceSpecs ? base.replace(/pixel-v2$/, "experience-v6") : name in parkSpecs ? base.replace(/pixel-v2$/, "park-v5") : name in expansionSpecs ? base.replace(/pixel-v2$/, "expansion-v4") : name.startsWith("walk-") ? base.replace(/pixel-v2$/, "walk-v3") : base}/${name}.png`;
        }),
    ),
  );
}
export function projection(w: number, h: number, v: View) {
  const scale = Math.min(w / 1520, h / 860) * v.zoom;
  const tw = 24 * scale,
    th = 12 * scale;
  const ox = w * 0.53 + v.panX,
    oy = h * 0.43 - 30 * th + v.panY;
  return {
    scale,
    tw,
    th,
    project: (x: number, y: number, z = 0) => ({
      x: ox + (x - y) * tw,
      y: oy + (x + y) * th - z * 24 * scale,
    }),
    unproject: (x: number, y: number) => ({
      x: Math.round(((x - ox) / tw + (y - oy) / th) / 2),
      y: Math.round(((y - oy) / th - (x - ox) / tw) / 2),
    }),
  };
}
function heading(dx: number, dy: number): Direction {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "se" : "nw") : dy >= 0 ? "sw" : "ne";
}
const guestMotion = new WeakMap<
  Guest,
  { x: number; y: number; phase: number; heading: Direction; time: number; queued: boolean }
>();
const motors = new WeakMap<Building, Spin & { time: number }>();
const trains = new WeakMap<Building, TrainMotor & { track: Point[] }>();
const service = new WeakMap<Building, { served: number; time: number; value: number }>();
function drawPark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Park,
  v: View,
  _realTime: number,
) {
  v.hitTargets = [];
  let hitOwner: number | undefined;
  const net = connected(s),
    exits = exitNetwork(s, net);
  const { scale, tw, th, project } = projection(w, h, v);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  const sky = weatherBackground(s);
  bg.addColorStop(0, sky.top);
  bg.addColorStop(1, sky.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const poly = (pts: Point[], fill: string, stroke?: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.7, scale);
      ctx.stroke();
    }
  };
  const line = (a: Point, b: Point, color: string, width: number) => {
    if (hitOwner !== undefined && width >= 2.5) v.hitTargets!.push({ id: hitOwner, a, b });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const tile = (x: number, y: number, fill: string, stroke?: string) => {
    const p = project(x, y);
    poly(
      [
        { x: p.x, y: p.y - th },
        { x: p.x + tw, y: p.y },
        { x: p.x, y: p.y + th },
        { x: p.x - tw, y: p.y },
      ],
      fill,
      stroke,
    );
  };
  const corners = [
    project(-0.5, -0.5),
    project(mapWidth(s) - 0.5, -0.5),
    project(mapWidth(s) - 0.5, mapHeight(s) - 0.5),
    project(-0.5, mapHeight(s) - 0.5),
  ];
  ctx.save();
  ctx.shadowBlur = 30 * scale;
  ctx.shadowColor = "#21452a40";
  ctx.shadowOffsetY = 18 * scale;
  poly(corners, "#4e8233");
  ctx.restore();
  for (const [a, b] of [
    [corners[1], corners[2]],
    [corners[2], corners[3]],
  ])
    poly(
      [a, b, { x: b.x, y: b.y + 14 * scale }, { x: a.x, y: a.y + 14 * scale }],
      "#6c5837",
      "#4f6636",
    );
  const neighbor = (x: number, y: number, type: string) =>
    x >= 0 &&
    x < mapWidth(s) &&
    y >= 0 &&
    y < mapHeight(s) &&
    (s.tiles[y][x] === type || (type === "path" && ["queue", "exit"].includes(s.tiles[y][x])));
  for (let y = 0; y < mapHeight(s); y++)
    for (let x = 0; x < mapWidth(s); x++) {
      const type = s.tiles[y][x],
        n = (x * 79 + y * 53) % 13,
        p = project(x, y);
      tile(
        x,
        y,
        type === "water"
          ? ["#4babc1", "#49a6bb", "#50b2c5"][n % 3]
          : type === "path"
            ? PATH_STYLES[pathStyleAt(s, x, y)].color
            : type === "queue"
              ? "#79aadd"
              : type === "exit"
                ? "#db8b81"
                : ["#7eac47", "#80af49", "#84b24b", "#83ae48"][n % 4],
        v.grid ? "#28522030" : undefined,
      );
      if (type === "path" || type === "queue" || type === "exit") {
        // One continuous path surface, with borders only at exposed edges.
        const color = type === "queue" ? "#36699f" : type === "exit" ? "#a54540" : "#ad925f";
        const edges = [
          [0, -1, -1, 0, 0, -1],
          [1, 0, 0, -1, 1, 0],
          [0, 1, 1, 0, 0, 1],
          [-1, 0, 0, 1, -1, 0],
        ];
        for (const [dx, dy, ax, ay, bx, by] of edges)
          if (!neighbor(x + dx, y + dy, type))
            line(
              { x: p.x + ax * tw, y: p.y + ay * th },
              { x: p.x + bx * tw, y: p.y + by * th },
              color,
              1.2,
            );
        if (type === "path") {
          const style = pathStyleAt(s, x, y),
            edge = PATH_STYLES[style].edge;
          if (style !== "garden")
            for (const f of style === "boardwalk" ? [-0.3, -0.1, 0.1, 0.3] : [-0.16, 0.17])
              line(
                project(x - 0.48, y + f),
                project(x + 0.48, y + f),
                edge,
                style === "boardwalk" ? 0.7 : 0.55,
              );
          if (style === "brick" || style === "stone")
            for (const f of [-0.25, 0.25])
              line(project(x + f, y - 0.48), project(x + f, y + 0.48), edge, 0.5);
        }
        if (type === "queue" || type === "exit")
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
          ])
            if (!neighbor(x + dx, y + dy, type) && s.tiles[y + dy]?.[x + dx] !== "path") {
              const a = project(x + dx * 0.45, y - 0.45),
                b = project(x + dx * 0.45, y + 0.45);
              line(a, { x: a.x, y: a.y - 5 * scale }, "#e9eee6", 1.4);
              line(b, { x: b.x, y: b.y - 5 * scale }, "#e9eee6", 1.4);
              line({ x: a.x, y: a.y - 5 * scale }, { x: b.x, y: b.y - 5 * scale }, "#dde6de", 1.4);
            }
        if (type === "exit") {
          const next = exits.get(`${x},${y}`);
          if (next) {
            const dx = next.x - x,
              dy = next.y - y;
            const a = project(x - dx * 0.24, y - dy * 0.24),
              b = project(x + dx * 0.24, y + dy * 0.24);
            line(a, b, "#fff5e4", 2);
            for (const side of [-1, 1])
              line(
                b,
                project(x + dx * 0.04 - dy * side * 0.18, y + dy * 0.04 + dx * side * 0.18),
                "#fff5e4",
                2,
              );
          } else {
            for (const side of [-1, 1])
              line(
                project(x - 0.15, y - side * 0.15),
                project(x + 0.15, y + side * 0.15),
                "#973f3a",
                1.5,
              );
          }
        }
      }
      if (type === "water" && n % 3 === 0) {
        const off = Math.sin(s.time / 1.6 + x) * 2 * scale;
        line(
          { x: p.x - 6 * scale, y: p.y + off },
          { x: p.x + 6 * scale, y: p.y + off },
          "#bdebf18c",
          1,
        );
      }
    }
  const frame = (
    name: string,
    p: Point,
    spec: SpriteSpec,
    alpha = 1,
    rotation = 0,
    mirror = false,
    paint?: { vehicle: ReturnType<typeof vehicleFor>; index: number },
  ) => {
    const im = sprites[name];
    if (!im) return;
    if (hitOwner !== undefined)
      v.hitTargets!.push({ id: hitOwner, name, p, spec, scale, rotation, mirror });
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(
      paint ? paintedCar(im, paint.vehicle, paint.index) : im,
      -spec.anchorX * scale,
      -spec.anchorY * scale,
      spec.width * scale,
      spec.height * scale,
    );
    ctx.restore();
  };
  const trackHit = (a: Point, b: Point) => {
    if (hitOwner !== undefined) v.hitTargets!.push({ id: hitOwner, a, b });
  };
  const rail = (a: Point, b: Point, ghost = false, ties = true) =>
    drawTrackSegment(ctx, a, b, project, scale, { ghost, ties, onHit: trackHit });
  const objects: Array<{ depth: number; draw: () => void; owner?: number }> = [];
  const registerAccessHits = (id: number, polygons: AccessHitPolygon[], pod?: PodRole) => {
    if (!polygons.length) return;
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const polygon of polygons)
      for (const p of polygon) {
        bounds.left = Math.min(bounds.left, p.x);
        bounds.right = Math.max(bounds.right, p.x);
        bounds.top = Math.min(bounds.top, p.y);
        bounds.bottom = Math.max(bounds.bottom, p.y);
      }
    v.hitTargets!.push({ id, polygons, bounds, pod });
  };
  const drawPod = (b: Building, role: PodRole, pod: Pod, ghost = false) => {
    const clearIds = ghost ? planPod(s, b, role, pod, v.podEdit?.clear).clearIds : [],
      previewPark = clearIds.length
        ? { ...s, buildings: s.buildings.filter((item) => !clearIds.includes(item.id)) }
        : s,
      rendered = ghost ? { ...b, pods: { ...(b.pods ?? effectivePods(s, b)), [role]: pod } } : b,
      layout = accessLayout(previewPark, rendered),
      q = podPose(b, CATALOG[b.kind].size, pod),
      pose = { ...q, tx: -q.dy, ty: q.dx, port: podPort(b, CATALOG[b.kind].size, pod) },
      side =
        Math.sign(
          (layout.posts.entry.x - layout.entry.x) * layout.entry.tx +
            (layout.posts.entry.y - layout.entry.y) * layout.entry.ty,
        ) || -1;
    ctx.save();
    ctx.globalAlpha *= ghost ? 0.55 : 1;
    if (ghost) {
      const layers = [
        {
          depth: q.x + q.y + 0.15,
          draw: () =>
            drawAccessPod(
              ctx,
              pose,
              role,
              gateMotion(previewPark, rendered, role),
              project,
              scale,
              side,
            ),
        },
      ];
      if (needsOperator(b.kind)) {
        layers.push({
          depth: layout.cabin.x + layout.cabin.y - 0.1,
          draw: () => drawAccessCabin(ctx, layout, project, scale, "back", b.open),
        });
        layers.push({
          depth: layout.cabin.x + layout.cabin.y + 0.4,
          draw: () => drawAccessCabin(ctx, layout, project, scale, "front", b.open),
        });
      }
      layers.sort((a, b) => a.depth - b.depth).forEach((layer) => layer.draw());
    } else {
      const hits: AccessHitPolygon[] = [];
      drawAccessPod(ctx, pose, role, gateMotion(s, rendered, role), project, scale, side, hits);
      registerAccessHits(b.id, hits, role);
    }
    ctx.restore();
  };
  const motor = (b: Building): Spin => {
    if (b.id < 0) return { angle: 0, velocity: 0 };
    const prev = motors.get(b) ?? { angle: (b.id % 5) * 0.3, velocity: 0, time: s.time };
    const running = b.open && !!access(s, b, net) && b.riders.length > 0;
    const remaining = b.cycle,
      elapsed = rideDuration(b) - remaining;
    const envelope = running
      ? Math.min(1, Math.max(0, elapsed / 2), Math.max(0, remaining / 3))
      : 0;
    const next = {
      ...advanceSpin(
        prev,
        (b.kind === "wheel" ? 0.34 : 1.05) * (b.design?.speed ?? 1) * envelope,
        Math.max(0, s.time - prev.time),
        b.kind === "wheel" ? 1.5 : 0.8,
      ),
      time: s.time,
    };
    motors.set(b, next);
    return next;
  };
  // Advance each motor once; translucent placement previews never affect running rides.
  for (const b of s.buildings) if (isRide(b.kind) && b.kind !== "coaster") motor(b);
  const rider = (
    id: number | undefined,
    p: Point,
    direction: Direction = "se",
    alpha = 1,
    rotation = 0,
    size = 1.2,
  ) => {
    if (id === undefined) return;
    const guest = s.guests.find((g) => g.id === id),
      im = sprites[`rider-red-${direction}`];
    if (!im) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    const personScale = guestAppearance(guest).ageGroup === "child" ? 0.8 : 1;
    ctx.scale(size * personScale, size * personScale);
    ctx.drawImage(
      guest ? paintedGuest(im, guest, true) : im,
      0,
      0,
      80,
      68,
      -10 * scale,
      -16 * scale,
      20 * scale,
      17 * scale,
    );
    ctx.restore();
  };
  const wheel = (b: Building, p: Point, alpha = 1) => {
    const spin = motors.get(b) ?? { angle: 0, velocity: 0 },
      angle = spin.angle,
      r = 64 * scale,
      hub = { x: p.x, y: p.y - 106 * scale };
    const im = sprites["wheel-rim"];
    if (im) {
      if (hitOwner !== undefined) {
        const c = Math.cos(angle),
          t = Math.sin(angle);
        v.hitTargets!.push({
          id: hitOwner,
          name: "wheel-rim",
          p: hub,
          spec: { width: 128, height: 128, anchorX: 64, anchorY: 64 },
          scale,
          rotation: 0,
          mirror: false,
          transform: [0.84 * c, 0.42 * c + t, -0.84 * t, -0.42 * t + c],
        });
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(hub.x, hub.y);
      ctx.transform(0.84, 0.42, 0, 1, 0, 0);
      ctx.rotate(angle);
      ctx.drawImage(im, -r, -r, 2 * r, 2 * r);
      ctx.restore();
    }
    const cabins = Array.from({ length: 10 }, (_, i) => {
      const t = angle + (i * Math.PI) / 5;
      return {
        i,
        x: hub.x + Math.cos(t) * r * 0.84,
        y: hub.y + Math.cos(t) * r * 0.42 + Math.sin(t) * r,
        sway: Math.sin(t * 2) * spin.velocity * 0.12,
      };
    }).sort((a, b) => a.y - b.y);
    cabins.forEach((q) => {
      frame("wheel-cabin", q, { width: 20, height: 25, anchorX: 10, anchorY: 2.5 }, alpha, q.sway);
      rider(b.riders[q.i], { x: q.x, y: q.y + 13 * scale }, "se", alpha, q.sway);
    });
    frame("wheel-support", p, { width: 128, height: 176, anchorX: 64, anchorY: 164 }, alpha);
  };
  const carousel = (b: Building, p: Point, alpha = 1) => {
    const spin = motors.get(b) ?? { angle: 0, velocity: 0 },
      angle = spin.angle;
    frame("carousel-base", p, { width: 100.8, height: 72, anchorX: 50.4, anchorY: 36 }, alpha);
    const horses = Array.from({ length: 6 }, (_, i) => {
      const t = angle + (i * Math.PI) / 3,
        depth = p.y + Math.sin(t) * 15 * scale;
      return {
        i,
        x: p.x + Math.cos(t) * 31 * scale,
        y:
          depth -
          2 * scale -
          Math.sin(angle * 2 + i * Math.PI) * 3 * scale * Math.min(1, spin.velocity),
        depth,
        mirror: Math.sin(t) > 0,
      };
    }).sort((a, b) => a.depth - b.depth);
    horses.forEach((q) => {
      frame(
        "carousel-horse",
        q,
        { width: 32, height: 44.8, anchorX: 16, anchorY: 38.4 },
        alpha,
        0,
        q.mirror,
      );
      rider(b.riders[q.i], { x: q.x, y: q.y - 10 * scale }, q.mirror ? "sw" : "ne", alpha);
    });
    frame(
      "carousel-roof",
      { x: p.x, y: p.y - 60 * scale },
      { width: 106.4, height: 76, anchorX: 53.2, anchorY: 38 },
      alpha,
    );
  };
  const habitatLayers = (b: Building, alpha = 1) => {
    const layers = habitatSceneryLayers(b, {
      ctx,
      project,
      scale,
      alpha,
      registerLine: (a, end) => {
        if (hitOwner !== undefined) v.hitTargets!.push({ id: hitOwner, a, b: end });
      },
    });
    if (b.habitat?.viewpoint) {
      const q = b.habitat.viewpoint;
      layers.push({
        depth: q.x + q.y + 0.15,
        draw: () => {
          const p = project(q.x, q.y);
          ctx.save();
          ctx.globalAlpha = alpha;
          v.hitTargets!.push({
            id: b.id,
            a: { x: p.x, y: p.y - 29 * scale },
            b: { x: p.x, y: p.y - 12 * scale },
          });
          tile(q.x, q.y, "#a8d4c355", "#eef6da");
          ctx.fillStyle = "#7b6245";
          ctx.fillRect(p.x - 1.5 * scale, p.y - 20 * scale, 3 * scale, 18 * scale);
          ctx.fillStyle = "#326b5a";
          ctx.strokeStyle = "#f9e6b0";
          ctx.lineWidth = 1.2 * scale;
          ctx.beginPath();
          ctx.roundRect(p.x - 12 * scale, p.y - 29 * scale, 24 * scale, 15 * scale, 3 * scale);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "#f9edc9";
          ctx.lineWidth = 1.5 * scale;
          for (const x of [-4, 4]) {
            ctx.beginPath();
            ctx.arc(p.x + x * scale, p.y - 21 * scale, 3.3 * scale, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(p.x - 2 * scale, p.y - 23 * scale);
          ctx.lineTo(p.x + 2 * scale, p.y - 23 * scale);
          ctx.stroke();
          ctx.restore();
        },
      });
    }
    for (let i = 0; i < (b.habitat?.count ?? 0); i++) {
      const animal = animalPose(b, i, s.time),
        dir = heading(animal.dx, animal.dy),
        name =
          b.kind === "elephant"
            ? `elephant-walk-${dir}-${animal.walk ? ((Math.floor((animal.gait / (Math.PI * 2)) * 4) % 4) + 4) % 4 : 1}`
            : animalSprite(b.kind, i, dir);
      layers.push({
        depth: animal.x + animal.y + 0.1,
        draw: () => {
          const p = project(animal.x, animal.y);
          ctx.fillStyle = "#32462c30";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 7 * scale, 3 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          p.y -= animal.bob * (b.kind === "elephant" ? 2 : 4.8) * scale;
          frame(name, p, specs[name], alpha);
        },
      });
    }
    return layers;
  };
  const drawBuilding = (b: Building, alpha = 1) => {
    const n = CATALOG[b.kind].size,
      p = project(b.x + (n - 1) / 2, b.y + (n - 1) / 2);
    const kind = b.design?.mechanism ?? b.kind;
    if (isHabitat(b.kind))
      habitatLayers(b, alpha)
        .sort((a, b) => a.depth - b.depth)
        .forEach((layer) => layer.draw());
    else if (kind === "bumper" || kind === "balloonride") {
      const phase =
        b.open && b.riders.length
          ? ((rideDuration(b) - Math.max(0, b.cycle)) / rideDuration(b)) % 1
          : 0;
      if (kind === "bumper") frame("bumper-pavilion", p, specs["bumper-pavilion"], alpha);
      else {
        const top = project(b.x + (n - 1) / 2, b.y + (n - 1) / 2, 1.5);
        line(p, top, "#448985", 6);
        ctx.fillStyle = "#e5c781";
        ctx.beginPath();
        ctx.arc(top.x, top.y, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      const cars = Array.from({ length: 4 }, (_, i) => ({
        i,
        ...(kind === "bumper" ? bumperPose(i, phase) : balloonPose(i, phase)),
      })).sort((a, b) => a.x + a.z - b.x - b.z);
      for (const car of cars) {
        const q = project(b.x + (n - 1) / 2 + car.x / 5, b.y + (n - 1) / 2 + car.z / 5, car.y / 5);
        const name =
          kind === "bumper" ? (car.yaw > 0 ? "bumper-car-se" : "bumper-car-sw") : "balloon-gondola";
        frame(name, q, specs[name], alpha);
        for (let side = 0; side < 2; side++) {
          const seat =
            kind === "bumper"
              ? name.endsWith("se")
                ? side
                  ? [12.21, 29.3]
                  : [16.36, 31.15]
                : side
                  ? [27.79, 29.3]
                  : [23.64, 31.15]
              : side
                ? [26.25, 57.69]
                : [20.78, 57.69];
          rider(
            b.riders[car.i * 2 + side],
            {
              x: q.x + (seat[0] - specs[name].anchorX) * scale,
              y: q.y + (seat[1] - specs[name].anchorY) * scale,
            },
            name.endsWith("sw") ? "sw" : "se",
            alpha,
          );
        }
        if (kind === "balloonride")
          frame("balloon-gondola-front", q, specs["balloon-gondola-front"], alpha);
      }
      if (kind === "bumper")
        frame("bumper-pavilion-front", p, specs["bumper-pavilion-front"], alpha);
    } else if (kind === "wheel") wheel(b, p, alpha);
    else if (kind === "carousel") carousel(b, p, alpha);
    else if (kind === "swing") {
      const phase = motor(b).angle,
        spec = specs["swing-canopy"];
      const center = { x: p.x + (64 - spec.anchorX) * scale, y: p.y + (67 - spec.anchorY) * scale };
      const seats = Array.from({ length: rideCapacity(b) }, (_, i) => {
        const a = phase + (i * Math.PI * 2) / rideCapacity(b);
        return {
          i,
          x: center.x + Math.cos(a) * 53 * scale,
          y: center.y + Math.sin(a) * 16 * scale,
          back: Math.sin(a) < 0,
          angle: Math.cos(a) * Math.min(0.35, motor(b).velocity * 0.2),
        };
      });
      const chair = (q: (typeof seats)[number]) => {
        frame("swing-seat", q, { ...specs["swing-seat"], anchorX: 14, anchorY: 4 }, alpha, q.angle);
        rider(b.riders[q.i], { x: q.x, y: q.y + 38 * scale }, q.back ? "ne" : "se", alpha, q.angle);
      };
      seats.filter((q) => q.back).forEach(chair);
      frame("swing-canopy", p, spec, alpha);
      seats.filter((q) => !q.back).forEach(chair);
    } else if (kind === "drop") {
      const spec = specs["drop-tower"];
      frame("drop-tower", p, spec, alpha);
      const phase = b.open && b.riders.length ? 1 - b.cycle / rideDuration(b) : 0;
      const elevation =
        phase < 0.6 ? phase / 0.6 : phase < 0.72 ? 1 : Math.max(0, 1 - ((phase - 0.72) / 0.2) ** 2);
      frame(
        "drop-gondola",
        {
          x: p.x + (48 - spec.anchorX) * scale,
          y: p.y + (170 - elevation * 115 - spec.anchorY) * scale,
        },
        { ...specs["drop-gondola"], anchorX: 40, anchorY: 32 },
        alpha,
      );
      const anchors = [
        [40, 21],
        [18, 26],
        [62, 26],
        [15, 39],
        [65, 39],
        [40, 49],
        [33, 48],
        [47, 48],
      ];
      b.riders.forEach((id, i) => {
        const [x, y] =
          b.riders.length <= 8
            ? anchors[i]
            : [
                40 + Math.cos((i * Math.PI * 2) / rideCapacity(b)) * 26,
                35 + Math.sin((i * Math.PI * 2) / rideCapacity(b)) * 14,
              ];
        rider(
          id,
          {
            x: p.x + (48 - spec.anchorX + x - 40) * scale,
            y: p.y + (170 - elevation * 115 - spec.anchorY + y - 32) * scale,
          },
          i < 3 ? "nw" : "se",
          alpha,
          0,
          1.4,
        );
      });
    } else if (kind === "pirate") {
      const spec = specs["pirate-frame"],
        spin = motor(b);
      frame("pirate-frame", p, spec, alpha);
      frame(
        "pirate-ship",
        { x: p.x + (80 - spec.anchorX) * scale, y: p.y + (46 - spec.anchorY) * scale },
        { ...specs["pirate-ship"], anchorX: 72, anchorY: 16 },
        alpha,
        Math.sin(spin.angle) * Math.min(0.9, spin.velocity),
      );
      const a = Math.sin(spin.angle) * Math.min(0.9, spin.velocity),
        origin = { x: p.x + (80 - spec.anchorX) * scale, y: p.y + (46 - spec.anchorY) * scale };
      const benches = [
        [42, 100],
        [62, 105],
        [83, 105],
        [104, 100],
      ];
      b.riders.forEach((id, i) => {
        const rowSize = Math.ceil(rideCapacity(b) / 4),
          bench = benches[Math.floor(i / rowSize) % 4],
          x = bench[0] - 72 + ((i % rowSize) - (rowSize - 1) / 2) * 5,
          y = bench[1] - 16;
        rider(
          id,
          {
            x: origin.x + (x * Math.cos(a) - y * Math.sin(a)) * scale,
            y: origin.y + (x * Math.sin(a) + y * Math.cos(a)) * scale,
          },
          "se",
          alpha,
          a,
          1.2,
        );
      });
    } else if (kind === "teacups") {
      frame("teacup-base", p, specs["teacup-base"], alpha);
      const angle = motor(b).angle,
        center = { x: p.x, y: p.y - 37 * scale };
      Array.from({ length: Math.ceil(rideCapacity(b) / 3) }, (_, i) => {
        const a = angle + (i * Math.PI * 2) / Math.ceil(rideCapacity(b) / 3);
        return {
          i,
          a,
          x: center.x + Math.cos(a) * 43 * scale,
          y: center.y + Math.sin(a) * 17 * scale,
        };
      })
        .sort((a, b) => a.y - b.y)
        .forEach((q) => {
          frame("teacup-cup", q, specs["teacup-cup"], alpha, Math.sin(angle * 3 + q.i) * 0.09);
          for (let j = 0; j < 3; j++) {
            const a = angle * 2 + (j * Math.PI * 2) / 3;
            rider(
              b.riders[q.i * 3 + j],
              { x: q.x + Math.cos(a) * 7 * scale, y: q.y + (-11 + Math.sin(a) * 3) * scale },
              heading(Math.cos(a), Math.sin(a)),
              alpha,
            );
          }
        });
    } else if (kind === "spinner") {
      const spec = specs["spinner-base"],
        hub = { x: p.x + (55 - spec.anchorX) * scale, y: p.y + (28 - spec.anchorY) * scale },
        angle = motor(b).angle;
      frame("spinner-base", p, spec, alpha);
      Array.from({ length: 3 }, (_, i) => {
        const a = angle + (i * Math.PI * 2) / 3;
        return { i, x: hub.x + Math.cos(a) * 54 * scale, y: hub.y + Math.sin(a) * 22 * scale };
      })
        .sort((a, b) => a.y - b.y)
        .forEach((q) => {
          const dx = (q.x - hub.x) / scale,
            dy = (q.y - hub.y) / scale,
            base = Math.atan2(29, 48),
            turn = Math.atan2(dy, dx) - base;
          frame(
            "spinner-arm",
            hub,
            {
              ...specs["spinner-arm"],
              width: (96 * Math.hypot(dx, dy)) / 56,
              height: (64 * Math.hypot(dx, dy)) / 56,
              anchorX: (12 * Math.hypot(dx, dy)) / 56,
              anchorY: (16 * Math.hypot(dx, dy)) / 56,
            },
            alpha,
            turn,
          );
          frame(
            "spinner-gondola",
            q,
            specs["spinner-gondola"],
            alpha,
            Math.sin(angle + q.i) * 0.15,
          );
          for (let j = 0; j < Math.ceil(rideCapacity(b) / 3); j++)
            rider(
              b.riders[q.i * Math.ceil(rideCapacity(b) / 3) + j],
              { x: q.x + (j % 2 ? 5 : -5) * scale, y: q.y + (17 + Math.floor(j / 2) * 6) * scale },
              "se",
              alpha,
            );
        });
    } else if (isWeatherObject(b.kind)) {
      const hits = drawWeatherObject(ctx, b, project, scale, alpha);
      if (hitOwner !== undefined) registerAccessHits(hitOwner, hits);
    } else if (isRotatableFurniture(b.kind)) {
      const hits = drawFurniture(ctx, b, project, scale, alpha);
      if (hitOwner !== undefined) registerAccessHits(hitOwner, hits);
    } else if (b.kind === "bin") {
      frame((b.binFill ?? 0) >= 12 ? "bin-full" : "bin-empty", p, specs["bin-empty"], alpha);
      const worker = s.cleanliness?.workers.find(
        (worker) =>
          worker.target?.id === b.id && (worker.mode === "empty" || worker.mode === "deposit"),
      );
      const transfer = worker && cleanerTransfer(s, worker);
      if (transfer && transfer.lidOpen > 0.01) {
        ctx.fillStyle = "#263e32";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 17 * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        poly(
          [
            { x: p.x - 5 * scale, y: p.y - 17 * scale },
            { x: p.x + 5 * scale, y: p.y - 17 * scale },
            { x: p.x + 4 * scale, y: p.y - (19 + 8 * transfer.lidOpen) * scale },
            { x: p.x - 4 * scale, y: p.y - (19 + 8 * transfer.lidOpen) * scale },
          ],
          "#568c64",
          "#294d3b",
        );
      }
    } else frame(CATALOG[b.kind].sprite, p, specs[CATALOG[b.kind].sprite], alpha);
    if (b.design) {
      const emblem = { x: p.x - 38 * scale, y: p.y + 7 * scale };
      line(
        { x: emblem.x - 17 * scale, y: emblem.y + 3 * scale },
        { x: emblem.x + 17 * scale, y: emblem.y + 3 * scale },
        b.design.color,
        5,
      );
      frame(
        `theme-${b.design.theme}`,
        emblem,
        { width: 32, height: 40, anchorX: 16, anchorY: 34 },
        alpha,
      );
      if (b.design.art) {
        let im = sprites[b.design.id + b.design.art.length];
        if (!im) {
          im = new Image();
          im.src = b.design.art;
          sprites[b.design.id + b.design.art.length] = im;
        }
        if (im.complete && im.naturalWidth > 0)
          ctx.drawImage(im, emblem.x - 18 * scale, emblem.y - 42 * scale, 36 * scale, 42 * scale);
      } else
        frame(
          `theme-${b.design.theme}`,
          emblem,
          { width: 32, height: 40, anchorX: 16, anchorY: 34 },
          alpha,
        );
    }
  };
  for (const b of s.buildings) {
    const firstObject = objects.length;
    if (b.id === v.selected || b.id === v.hoveredId)
      for (const p of footprint(b)) tile(p.x, p.y, "#ffef9166", "#fff0bb");
    if (b.id === s.trackEdit?.buildingId) {
      const e = s.trackEdit;
      objects.push({
        depth: b.x + b.y,
        draw: () => {
          for (const track of [e.prefix, e.suffix])
            for (let i = 1; i < track.length; i++) rail(track[i - 1], track[i]);
          frame(
            `station-${b.track?.[0]?.style ?? "steel"}`,
            project(b.x, b.y),
            specs[`station-${b.track?.[0]?.style ?? "steel"}`],
          );
          for (const p of [e.prefix.at(-1)!, e.suffix[0]]) {
            const a = project(p.x, p.y, p.z);
            ctx.fillStyle = "#35d9c7";
            ctx.beginPath();
            ctx.arc(a.x, a.y, 5 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      });
      continue;
    }
    if (isHabitat(b.kind)) {
      objects.push(...habitatLayers(b));
    } else if (b.kind === "coaster") {
      const track = b.track ?? [];
      const shared = prepareRoute(track);
      const pts = shared.points;
      objects.push(
        ...trackCanvasLayers(ctx, track, project, scale, {
          onHit: trackHit,
          groundPath: (x, y) => groundPathAt(s, x, y),
        }),
      );
      if (pts.length > 1) {
        const route = shared;
        const progress = b.testing
          ? 1 - b.testing / (b.testDuration ?? 8)
          : b.open && b.riders.length && access(s, b, net)
            ? 1 - b.cycle / rideDuration(b)
            : 0;
        const running = !!b.testing || !!(b.open && b.riders.length && access(s, b, net));
        const previous = trains.get(b),
          dt = previous ? Math.max(0, s.time - previous.time) : 0;
        const desired = trainDistance(route, progress);
        const velocity = running
          ? routePosition(route, desired).speed / 5
          : (previous?.velocity ?? 0) * Math.exp(-dt / 0.35);
        const head = running
          ? desired
          : previous?.track === track
            ? (previous.angle + velocity * dt) % route.length
            : 0;
        trains.set(b, { angle: head, velocity, time: s.time, target: desired, track });
        for (let car = 0; car < Math.ceil(rideCapacity(b) / 2); car++) {
          const q = routePosition(route, head - car * 0.74);
          objects.push({
            depth: q.x + q.y + (q.z ?? 0) * 0.035 + 0.15,
            draw: () => {
              const direction = heading(q.dx * (q.up.z < 0 ? -1 : 1), q.dy * (q.up.z < 0 ? -1 : 1)),
                p = project(q.x, q.y, q.z),
                rotation = Math.atan2((q.up.x - q.up.y) * 24, q.up.z * 24 - (q.up.x + q.up.y) * 12);
              frame(
                `car-${VEHICLES[vehicleFor(b).model].sprite}-${direction}`,
                p,
                { width: 48, height: 40, anchorX: 24, anchorY: 30 },
                1,
                rotation,
                false,
                { vehicle: vehicleFor(b), index: car },
              );
              const sport = vehicleFor(b).model === "sport";
              const seats = (
                {
                  se: [
                    [26, 19],
                    [20, 17],
                  ],
                  sw: [
                    [22, 19],
                    [28, 17],
                  ],
                  nw: [
                    [22, 16],
                    [27, 19],
                  ],
                  ne: [
                    [26, 16],
                    [21, 19],
                  ],
                } as const
              )[direction];
              for (const side of sport && (direction === "se" || direction === "sw")
                ? [1, 0]
                : [0, 1]) {
                const x = sport ? seats[side][0] - 24 : side ? 4 : -4,
                  y = sport ? seats[side][1] - 30 : -12 + (side ? 2 : -2);
                rider(
                  b.riders[car * 2 + side],
                  {
                    x: p.x + (x * Math.cos(rotation) - y * Math.sin(rotation)) * scale,
                    y: p.y + (x * Math.sin(rotation) + y * Math.cos(rotation)) * scale,
                  },
                  direction,
                  1,
                  rotation,
                );
              }
            },
          });
        }
      }
      objects.push({
        depth: b.x + b.y - 0.15,
        draw: () =>
          frame(
            `station-${pts[0]?.style ?? "steel"}`,
            project(b.x, b.y),
            specs[`station-${pts[0]?.style ?? "steel"}`],
          ),
      });
    } else {
      const n = CATALOG[b.kind].size;
      objects.push({ depth: b.x + b.y + 2 * (n - 1) + 0.05, draw: () => drawBuilding(b) });
    }
    if (usesPods(b.kind)) {
      const pods = effectivePods(s, b, net, exits);
      for (const role of ["entry", "exit"] as const) {
        const p = podPose(b, CATALOG[b.kind].size, pods[role]);
        objects.push({ depth: p.x + p.y + 0.15, draw: () => drawPod(b, role, pods[role]) });
      }
    }
    if (needsOperator(b.kind)) {
      const layout = accessLayout(s, b),
        c = layout.cabin;
      objects.push({
        depth: c.x + c.y - 0.1,
        draw: () => {
          const hits: AccessHitPolygon[] = [];
          drawAccessCabin(ctx, layout, project, scale, "back", b.open, hits);
          registerAccessHits(b.id, hits);
        },
      });
      objects.push({
        depth: c.x + c.y + 0.4,
        draw: () => {
          const hits: AccessHitPolygon[] = [];
          drawAccessCabin(ctx, layout, project, scale, "front", b.open, hits);
          registerAccessHits(b.id, hits);
        },
      });
    }
    if (isRide(b.kind) && (!b.open || !access(s, b, net)))
      objects.push({
        depth: 1000,
        draw: () => {
          const p = project(b.x, b.y);
          ctx.fillStyle = "#fff2d2";
          ctx.fillRect(p.x - 6 * scale, p.y - 40 * scale, 12 * scale, 14 * scale);
          ctx.fillStyle = "#9d4429";
          ctx.font = `bold ${12 * scale}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("!", p.x, p.y - 29 * scale);
        },
      });
    for (const object of objects.slice(firstObject)) object.owner = b.id;
    if (v.adjustment?.mode === "move" && v.adjustment.building.id === b.id) {
      for (const object of objects.slice(firstObject)) {
        const paint = object.draw;
        object.draw = () => {
          ctx.save();
          ctx.globalAlpha = 0.28;
          paint();
          ctx.restore();
        };
      }
    }
  }
  // Queue guests occupy successive spaces along the actual queue, instead of stacking on one tile.
  const queued = new Map<number, Point>();
  for (const b of s.buildings)
    if (b.queue.length) {
      const start = access(s, b, net);
      if (!start) continue;
      const cells = [start],
        seen = new Set([`${start.x},${start.y}`]);
      for (
        let i = 0;
        s.tiles[start.y][start.x] === "queue" && i < cells.length && cells.length < 40;
        i++
      )
        for (const [dx, dy] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          const p = { x: cells[i].x + dx, y: cells[i].y + dy },
            key = `${p.x},${p.y}`;
          if (s.tiles[p.y]?.[p.x] === "queue" && !seen.has(key)) {
            seen.add(key);
            cells.push(p);
          }
        }
      b.queue.forEach((id, i) => {
        const cell = cells[Math.min(cells.length - 1, Math.floor(i / 4))];
        queued.set(id, {
          x: cell.x + ((i % 2) - 0.5) * 0.32,
          y: cell.y + (Math.floor((i % 4) / 2) - 0.5) * 0.32,
        });
      });
    }
  for (const transit of s.transitLines ?? []) {
    if (transit.kind === "train")
      for (let i = 1; i < transit.route.length; i++) {
        const a = transit.route[i - 1],
          b = transit.route[i];
        objects.push({
          depth: Math.min(a.x + a.y, b.x + b.y) - 0.05,
          draw: () => {
            const pa = project(a.x, a.y),
              pb = project(b.x, b.y);
            line(pa, pb, "#786c50", 2);
          },
        });
      }
    for (let car = 0; car < (transit.kind === "train" ? 4 : 1); car++) {
      const q = transportCarPose(transit, car);
      objects.push({
        depth: q.x + q.y + 0.2,
        draw: () => {
          const p = project(q.x, q.y),
            d = heading(q.headingX, q.headingY),
            train = transit.kind === "train",
            wagon = train && car > 0;
          const name = `${wagon ? "car-wood" : train ? "train-loco" : "shuttle"}-${d}`;
          frame(name, p, wagon ? { width: 48, height: 40, anchorX: 24, anchorY: 30 } : specs[name]);
          if (!train || wagon)
            for (let seat = 0; seat < (train ? 4 : 8); seat++) {
              const id = transit.passengers[(train ? (car - 1) * 4 : 0) + seat],
                side = seat % 2 ? 1 : -1,
                row = Math.floor(seat / 2) - (train ? 0.5 : 1.5);
              const forward = { x: q.headingX - q.headingY, y: (q.headingX + q.headingY) * 0.5 },
                cross = { x: -(q.headingX + q.headingY), y: (q.headingX - q.headingY) * 0.5 };
              rider(
                id,
                {
                  x: p.x + (row * 8 * forward.x + side * 4 * cross.x) * scale,
                  y: p.y + (-13 + row * 8 * forward.y + side * 4 * cross.y) * scale,
                },
                d,
                1,
                0,
                1,
              );
            }
        },
      });
    }
  }

  const dogOwners = dogCompanionOwners(s);
  for (const g of s.guests) {
    if (
      g.state === "ride" &&
      !s.buildings.some((b) => isHabitat(b.kind) && b.riders.includes(g.id))
    )
      continue;
    const restBuilding =
      g.state === "rest" ? s.buildings.find((b) => b.id === g.target) : undefined;
    const sitting = restBuilding ? restPose(restBuilding, g, s.time) : undefined;
    const target = sitting ?? queued.get(g.id) ?? guestWalkPosition(s, g);
    const old = guestMotion.get(g) ?? {
      x: g.x,
      y: g.y,
      time: s.time,
      queued: false,
      phase: g.id * 0.73,
      heading: "se" as Direction,
    };
    const isQueued = queued.has(g.id),
      distance = Math.hypot(target.x - old.x, target.y - old.y);
    const factor =
      isQueued || old.queued
        ? Math.min(1, (Math.max(0, s.time - old.time) * 1.8) / Math.max(0.001, distance))
        : 1;
    const visual = {
      x: old.x + (target.x - old.x) * factor,
      y: old.y + (target.y - old.y) * factor,
    };
    const moved = Math.hypot(visual.x - old.x, visual.y - old.y),
      next = g.route.find((p) => Math.hypot(p.x - g.x, p.y - g.y) > 0.025);
    if ((isQueued || old.queued) && moved > 0.001)
      old.heading = heading(visual.x - old.x, visual.y - old.y);
    else if (next) old.heading = heading(next.x - g.x, next.y - g.y);
    if (g.state === "observe") {
      const b = s.buildings.find((b) => b.id === g.target);
      if (b && isHabitat(b.kind)) {
        const center = (CATALOG[b.kind].size - 1) / 2;
        old.heading = heading(b.x + center - g.x, b.y + center - g.y);
      }
    }
    old.phase += Math.min(0.3, moved) * 9;
    old.time = s.time;
    old.queued = isQueued || (old.queued && distance > 0.1);
    old.x = visual.x;
    old.y = visual.y;
    guestMotion.set(g, old);
    const moving =
      isQueued || old.queued
        ? moved > 0.001
        : (g.state === "walk" || g.state === "leave") && g.route.length > 0 && g.timer <= 0;
    const step = moving ? Math.floor(old.phase) % 4 : 1;
    const name = `walk-red-${old.heading}-${step}`,
      look = guestAppearance(g);
    if (dogOwners.has(g.id)) {
      const dog = dogCompanionPose(s, g, {
        position: visual,
        direction: next ? { x: visual.x + next.x - g.x, y: visual.y + next.y - g.y } : undefined,
        moving,
      });
      if (dog) {
        const ownerPoint = project(visual.x, visual.y),
          handPhase = (old.phase * Math.PI) / 2;
        if (moving) ownerPoint.y -= Math.abs(Math.sin(handPhase)) * 0.8 * scale;
        const grip = dogLeashGrip(
          g,
          ownerPoint.x,
          ownerPoint.y,
          scale,
          old.heading,
          handPhase,
          moving,
        );
        objects.push({
          depth: dog.x + dog.y + 0.1,
          draw: () => drawDogCompanion(ctx, dog, project, scale, grip),
        });
      }
    }
    objects.push({
      depth: visual.x + visual.y + 0.12,
      draw: () => {
        const p = project(visual.x, visual.y);
        ctx.fillStyle = "#29442830";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4.3 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        if (moving) p.y -= Math.abs(Math.sin((old.phase * Math.PI) / 2)) * 0.8 * scale;
        if (sitting) p.y -= sitting.height * (sitting.seated ? FURNITURE_HEIGHT_PIXELS : 4) * scale;
        if (sitting?.seated) {
          const image =
            sprites[`rider-red-${heading(-Math.sin(sitting.yaw), -Math.cos(sitting.yaw))}`];
          if (image) drawFurnitureGuest(ctx, image, g, p.x, p.y, scale);
        } else if (sprites[name])
          drawWalkingGuest(
            ctx,
            sprites[name],
            g,
            p.x,
            p.y,
            scale,
            moving ? Math.sin((old.phase * Math.PI) / 2) * 0.018 : 0,
          );
        if (g.food) {
          const food = FOOD[g.food.kind],
            lift = Math.max(0, Math.sin(s.time * 2.8 + g.id)) * 3;
          ctx.save();
          ctx.translate(p.x + 3 * scale, p.y - (12 * look.heightScale + lift) * scale);
          ctx.scale(scale, scale);
          ctx.fillStyle = food.color;
          if (food.drink) {
            ctx.fillRect(-2, -4, 4, 6);
            ctx.fillStyle = "#f4edda";
            ctx.fillRect(-2, -5, 4, 1);
          } else if (g.food.kind === "hotdog") {
            ctx.fillRect(-4, -1, 8, 3);
            ctx.fillStyle = "#ac503c";
            ctx.fillRect(-3, -1, 6, 1);
            ctx.fillStyle = "#f1d75d";
            ctx.fillRect(-2, -1, 3, 1);
          } else if (g.food.kind === "icecream") {
            ctx.fillStyle = "#ba8d55";
            ctx.beginPath();
            ctx.moveTo(-2, 0);
            ctx.lineTo(2, 0);
            ctx.lineTo(0, 5);
            ctx.fill();
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(0, -1, 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-3, -2, 6, 4);
            ctx.fillStyle = "#f6e4b9";
            ctx.fillRect(-3, -3, 6, 2);
          }
          ctx.restore();
        }
        // Four seconds per twenty-second cycle, staggered by stable guest IDs.
        // Simulation time keeps the cues still when paused and stable across saves.
        const moodPhase = (s.time + ((g.id * 7) % 20)) % 20;
        const moodAlpha = Math.max(0, Math.min(1, moodPhase / 0.35, (4 - moodPhase) / 0.5));
        if (v.showMoods !== false && moodAlpha > 0) {
          ctx.save();
          ctx.globalAlpha *= moodAlpha;
          ctx.translate(p.x, p.y - (28 * look.heightScale + 2) * scale);
          ctx.scale(scale, scale);
          ctx.fillStyle = g.happiness >= 75 ? "#b8e38d" : g.happiness >= 45 ? "#ffe195" : "#f3967a";
          ctx.strokeStyle = "#395542";
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#304c3b";
          ctx.fillRect(-2, -1.7, 0.8, 1);
          ctx.fillRect(1.2, -1.7, 0.8, 1);
          ctx.beginPath();
          if (g.happiness >= 65) ctx.arc(0, 0, 2.5, 0.2, Math.PI - 0.2);
          else if (g.happiness < 45) ctx.arc(0, 3.5, 2.5, Math.PI + 0.2, Math.PI * 2 - 0.2);
          else {
            ctx.moveTo(-2, 1.5);
            ctx.lineTo(2, 1.5);
          }
          ctx.stroke();
          ctx.restore();
        }
        if (g.souvenir && !sitting?.seated)
          drawHeldSouvenir(
            ctx,
            g,
            p.x,
            p.y,
            scale,
            s.time,
            old.heading,
            (old.phase * Math.PI) / 2,
            moving,
          );
      },
    });
  }
  for (const litter of s.cleanliness?.litter ?? [])
    objects.push({
      depth: litter.x + litter.y + 0.05,
      draw: () => {
        const p = project(litter.x, litter.y);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(litter.id * 1.7);
        ctx.fillStyle = litter.kind === "cup" ? "#c87b4c" : "#f0e5bd";
        ctx.strokeStyle = "#82735d";
        ctx.lineWidth = scale * 0.6;
        ctx.fillRect(-2 * scale, -1.5 * scale, 4 * scale, 3 * scale);
        ctx.strokeRect(-2 * scale, -1.5 * scale, 4 * scale, 3 * scale);
        ctx.restore();
      },
    });
  for (const b of s.buildings) {
    if (!b.track || !isPhotoPoint(b.photoPoint)) continue;
    let path = photoPaths.get(b.track);
    if (!path) {
      path = makeRidePath(b.track);
      photoPaths.set(b.track, path);
    }
    const q = photoHardwarePoints(path, b.photoPoint)!;
    const proj = (p: { x: number; y: number; z: number }) => {
      const v = project(p.x / 5, p.z / 5);
      v.y -= ((p.y - 1.1) / 5) * 24 * scale;
      return v;
    };
    objects.push({
      depth: q.center.x / 5 + q.center.z / 5 + 0.3,
      draw: () => {
        const line = (a: typeof q.center, b: typeof q.center, color: string, width: number) => {
          const pa = proj(a),
            pb = proj(b);
          ctx.strokeStyle = color;
          ctx.lineWidth = width * scale;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        };
        line(q.leftBase, q.leftTop, "#34494b", 2);
        line(q.rightBase, q.rightTop, "#34494b", 2);
        line(q.leftTop, q.rightTop, "#edc75c", 2);
        line(q.beamA, q.beamB, "#61e3ed", 1);
        const cam = proj(q.camera);
        ctx.fillStyle = "#263d46";
        ctx.fillRect(cam.x - 3 * scale, cam.y - 2 * scale, 6 * scale, 4 * scale);
        ctx.fillStyle = "#a5ecf0";
        ctx.fillRect(cam.x - 2 * scale, cam.y - scale, 2 * scale, 2 * scale);
      },
    });
  }
  const staffRefs: StaffRef[] = [
    ...s.buildings.flatMap((b) =>
      OPERATOR_POSTS.map((post) => ({ kind: "operator" as const, id: b.id, post })),
    ),
    ...(s.zoo?.workers ?? []).map((worker) => ({ kind: "keeper" as const, id: worker.id })),
    ...(s.cleanliness?.workers ?? []).map((worker) => ({
      kind: "cleaner" as const,
      id: worker.id,
    })),
  ];
  for (const ref of staffRefs) {
    const location = staffLocation(s, ref),
      motion = staffMotion(s, ref);
    if (!location || !motion) continue;
    objects.push({
      depth: location.x + location.y + 0.13,
      draw: () => {
        const p = project(location.x, location.y);
        drawStaff(ctx, motion, p.x, p.y, scale);
      },
    });
  }
  const collectionPoints = new Set<string>();
  for (const worker of s.cleanliness?.workers ?? []) {
    const transfer = cleanerTransfer(s, worker);
    if (!transfer) continue;
    const target = project(transfer.target.x, transfer.target.y);
    if (transfer.collection && !collectionPoints.has(`${transfer.target.x},${transfer.target.y}`)) {
      collectionPoints.add(`${transfer.target.x},${transfer.target.y}`);
      objects.push({
        depth: transfer.target.x + transfer.target.y,
        draw: () => {
          poly(
            [
              { x: target.x - 8 * scale, y: target.y - 13 * scale },
              { x: target.x + 6 * scale, y: target.y - 13 * scale },
              { x: target.x + 5 * scale, y: target.y - 2 * scale },
              { x: target.x - 6 * scale, y: target.y - 2 * scale },
            ],
            "#617b63",
            "#344c3c",
          );
          line(
            { x: target.x - 7 * scale, y: target.y - 14 * scale },
            { x: target.x + 8 * scale, y: target.y - 14 * scale },
            "#d4c392",
            2,
          );
          for (const side of [-1, 1]) {
            ctx.fillStyle = "#34423b";
            ctx.beginPath();
            ctx.arc(target.x + side * 5 * scale, target.y, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      });
    }
    if (!transfer.showTransfer) continue;
    const ref: StaffRef = { kind: "cleaner", id: worker.id },
      location = staffLocation(s, ref),
      motion = staffMotion(s, ref);
    if (!location || !motion) continue;
    const base = project(location.x, location.y),
      local = staffLocalWorld(staffBagLocal(motion), motion),
      hand = {
        x: base.x + (local[0] - local[2]) * 9 * scale,
        y: base.y + ((local[0] + local[2]) * 4.5 - local[1] * 15) * scale,
      },
      bin = { x: target.x, y: target.y - (transfer.collection ? 13 : 18) * scale },
      a = transfer.empty ? bin : hand,
      b = transfer.empty ? hand : bin,
      bag = {
        x: a.x + (b.x - a.x) * transfer.t,
        y: a.y + (b.y - a.y) * transfer.t - Math.sin(transfer.t * Math.PI) * 5 * scale,
      };
    objects.push({
      depth: Math.max(location.x + location.y, transfer.target.x + transfer.target.y) + 0.25,
      draw: () => {
        ctx.fillStyle = "#4c5c49";
        ctx.strokeStyle = "#2b4034";
        ctx.lineWidth = 0.5 * scale;
        ctx.beginPath();
        ctx.ellipse(bag.x, bag.y, 2.4 * scale, 3.3 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        line(
          { x: bag.x, y: bag.y - 3 * scale },
          { x: bag.x, y: bag.y - 4.3 * scale },
          "#c1c99b",
          1,
        );
      },
    });
  }
  for (const b of s.buildings) {
    const event = service.get(b) ?? { served: b.served, time: -10, value: 0 };
    if (event.served !== b.served) {
      event.value = (b.served - event.served) * b.price;
      event.served = b.served;
      event.time = s.time;
    }
    service.set(b, event);
    const age = s.time - event.time;
    if (age >= 0 && age < 2.4 && event.value > 0)
      objects.push({
        depth: 1001,
        draw: () => {
          const p = project(b.x, b.y);
          ctx.save();
          ctx.globalAlpha = Math.min(1, (2.4 - age) * 2);
          ctx.font = `bold ${12 * scale}px sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = 3 * scale;
          ctx.strokeStyle = "#fff9dd";
          ctx.strokeText(`+${Math.round(event.value)} €`, p.x, p.y - (35 + age * 10) * scale);
          ctx.fillStyle = "#28583e";
          ctx.fillText(`+${Math.round(event.value)} €`, p.x, p.y - (35 + age * 10) * scale);
          ctx.restore();
        },
      });
  }
  const gate = GATES[gateStyle(s)].sprite;
  objects.push({ depth: 43.9, draw: () => frame(gate, project(15, 29), specs[gate]) });
  objects.push(...birdCanvasLayers(ctx, s, project, scale));
  objects
    .sort((a, b) => a.depth - b.depth)
    .forEach((o) => {
      hitOwner = o.owner;
      o.draw();
    });
  hitOwner = undefined;
  drawWeather(ctx, w, h, s, v);
  if (v.staffFocus && _realTime < v.staffFocus.until) {
    const person = staffLocation(s, v.staffFocus.ref);
    if (person) {
      const p = project(person.x, person.y),
        pulse = 1 + Math.sin(_realTime / 180) * 0.09;
      ctx.save();
      ctx.strokeStyle = "#fff9d8";
      ctx.fillStyle = "#ffe18e55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + scale, 11 * scale * pulse, 5 * scale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Redraw only the selected person above scenery so they can be found behind a tree.
      const motion = staffMotion(s, v.staffFocus.ref);
      if (motion) drawStaff(ctx, motion, p.x, p.y, scale);
      const label = `${person.name} · ${person.label}`;
      ctx.font = "600 13px sans-serif";
      ctx.textAlign = "center";
      const width = Math.min(w - 32, ctx.measureText(label).width + 24),
        lx = Math.max(width / 2 + 8, Math.min(w - width / 2 - 8, p.x)),
        ly = Math.max(36, p.y - 34 * scale);
      ctx.fillStyle = "#fffbed";
      ctx.fillRect(lx - width / 2, ly - 21, width, 30);
      ctx.strokeStyle = "#b69446";
      ctx.strokeRect(lx - width / 2, ly - 21, width, 30);
      ctx.fillStyle = "#294e42";
      ctx.fillText(label, lx, ly - 1, width - 12);
      ctx.restore();
    }
  }
  if (v.cleanerAreas) drawCleanerAreas(ctx, v.cleanerAreas, project);
  if (v.traffic)
    drawTrafficOverlay(
      ctx,
      v.traffic.report,
      v.traffic.mode,
      v.traffic.selected,
      project,
      scale,
      w,
      h,
    );
  for (const p of v.viewpointEdit ?? [])
    tile(p.x, p.y, s.tiles[p.y]?.[p.x] === "path" ? "#7bd0b577" : "#f4d48277", "#fff6de");
  const stationFocus =
    v.stationDirection ?? s.buildings.find((b) => b.id === v.selected && b.kind === "coaster");
  if (stationFocus)
    drawStationDirection(
      ctx,
      stationFocus,
      project,
      scale,
      v.stationDirection ? "#bc7849" : "#238471",
    );
  for (const [i, issue] of (v.issues ?? []).entries()) {
    const p = project(issue.point.x, issue.point.y);
    ctx.fillStyle =
      issue.kind === "dirt"
        ? "#dc8b45cc"
        : issue.kind === "wait"
          ? "#db5d59cc"
          : issue.kind === "fun"
            ? "#8157bccc"
            : "#d9ae42cc";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 36 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${16 * scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), p.x, p.y + 5 * scale);
  }
  if (v.podEdit) {
    const b = s.buildings.find((b) => b.id === v.podEdit!.id);
    if (b) {
      const size = CATALOG[b.kind].size;
      for (const slot of podSlots(size)) {
        const p = podPort(b, size, slot);
        if (!insideMap(s, p.x, p.y)) continue;
        const error = planPod(s, b, v.podEdit.role, slot, v.podEdit.clear).error;
        tile(
          p.x,
          p.y,
          error ? "#53625966" : v.podEdit.role === "entry" ? "#58a9f499" : "#ee786e99",
          error ? "#7a8978" : "#fff5da",
        );
        const q = project(p.x, p.y);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.fillText(v.podEdit.role === "entry" ? "E" : "A", q.x, q.y + 3 * scale);
        if (!error && v.hover?.x === p.x && v.hover?.y === p.y)
          drawPod(b, v.podEdit.role, slot, true);
      }
    }
  }
  for (const segment of v.trackCuts ?? [])
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1],
        b = segment[i];
      line(project(a.x, a.y, a.z), project(b.x, b.y, b.z), v.cutColor ?? "#ff634d", 9);
    }
  for (const segment of v.cutConnections ?? [])
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1],
        b = segment[i];
      line(project(a.x, a.y, a.z), project(b.x, b.y, b.z), "#43d9d2", 4);
    }

  if (v.connection) for (const p of v.connection) tile(p.x, p.y, "#83e6c6aa", "#e5fff3");
  if (v.selected !== null) {
    const b = s.buildings.find((b) => b.id === v.selected);
    if (b?.kind === "coaster") {
      const p = project(b.x, b.y);
      ctx.save();
      ctx.fillStyle = "#fff8d9";
      ctx.strokeStyle = "#315d45";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 5 * scale, 7 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#315d45";
      ctx.font = `bold ${9 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("S", p.x, p.y + 8 * scale);
      ctx.restore();
    }
  }
  if (v.adjustment?.mode === "station")
    for (const p of v.adjustment.candidates) tile(p.x, p.y, "#52d99b90", "#e3ffee");
  if (v.draft.length && v.adjustment?.mode !== "station") {
    for (let i = 1; i < v.draft.length; i++) rail(v.draft[i - 1], v.draft[i], true);
    v.draft.forEach((p, i) => {
      if (i !== 0 && i !== v.draft.length - 1 && p.smooth) return;
      const q = project(p.x, p.y, p.z ?? 0);
      ctx.fillStyle = i === 0 ? "#fff7cd" : "#ffd66b";
      ctx.fillRect(q.x - 2 * scale, q.y - 2 * scale, 4 * scale, 4 * scale);
    });
  }
  if (v.draft.length && v.tool === "coaster") {
    const end = v.draft.at(-1)!,
      a = project(end.x, end.y, end.z ?? 0),
      heading = end.heading ?? 0,
      b = project(end.x + Math.cos(heading) * 0.8, end.y + Math.sin(heading) * 0.8, end.z ?? 0);
    line(a, b, "#fff1a6", 4);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    line(
      b,
      { x: b.x - Math.cos(angle - 0.6) * 9 * scale, y: b.y - Math.sin(angle - 0.6) * 9 * scale },
      "#fff1a6",
      3,
    );
    line(
      b,
      { x: b.x - Math.cos(angle + 0.6) * 9 * scale, y: b.y - Math.sin(angle + 0.6) * 9 * scale },
      "#fff1a6",
      3,
    );
  }
  if (v.candidate && v.tool === "coaster" && !v.fitPreview) {
    const points = v.candidate.points;
    for (let i = 1; i < points.length; i++) {
      const a = project(points[i - 1].x, points[i - 1].y, points[i - 1].z),
        b = project(points[i].x, points[i].y, points[i].z);
      line(a, b, v.candidate.error ? "#c44a42" : "#2f8b69", 9);
      line(a, b, v.candidate.error ? "#ffd6c9" : "#aeffe0", 3);
    }
  }
  if (v.fitPreview)
    for (const [points, color, width] of [
      [v.fitPreview.removed, "#df624f", 9],
      [v.fitPreview.added, "#30d8ba", 5],
    ] as const)
      for (let i = 1; i < points.length; i++)
        line(
          project(points[i - 1].x, points[i - 1].y, points[i - 1].z),
          project(points[i].x, points[i].y, points[i].z),
          color,
          width,
        );
  const hover = v.adjustment ? v.adjustment.geometry : v.hover;
  if (hover && v.tool !== "select" && !v.tool.startsWith("pod-")) {
    const { x, y } = hover;
    if (x >= 0 && y >= 0 && x < mapWidth(s) && y < mapHeight(s)) {
      const d = CATALOG[v.tool as Kind],
        n = d?.size ?? 1;
      const preview = v.preview,
        points =
          preview?.points ??
          Array.from({ length: n * n }, (_, i) => ({ x: x + (i % n), y: y + Math.floor(i / n) }));
      const invalid =
        !!preview?.error ||
        (v.tool === "viewpoint" && !v.viewpointEdit?.some((p) => p.x === x && p.y === y));
      for (const p of points)
        tile(
          p.x,
          p.y,
          invalid || v.tool === "erase" ? "#e3655490" : "#66dca878",
          invalid ? "#ffdad0" : "#d7ffe9",
        );
      if (preview)
        for (const id of preview.clearIds) {
          const b = s.buildings.find((b) => b.id === id);
          if (b) {
            const q = project(b.x, b.y);
            line(
              { x: q.x - 5 * scale, y: q.y - 8 * scale },
              { x: q.x + 5 * scale, y: q.y + 2 * scale },
              "#ffe297",
              2,
            );
            line(
              { x: q.x + 5 * scale, y: q.y - 8 * scale },
              { x: q.x - 5 * scale, y: q.y + 2 * scale },
              "#ffe297",
              2,
            );
          }
        }
      if (v.adjustment && !v.preview?.error) {
        const pending = { ...v.adjustment.building, ...v.adjustment.geometry, id: -1, open: false };
        if (pending.kind === "coaster")
          frame(
            `station-${pending.track?.[0]?.style ?? "steel"}`,
            project(pending.x, pending.y),
            specs[`station-${pending.track?.[0]?.style ?? "steel"}`],
            0.85,
          );
        else drawBuilding(pending, 0.65);
      }
      if (d && v.tool !== "coaster") drawBuilding(previewBuilding(v.tool as Kind, x, y), 0.65);
    }
  }
}

/** Cache immutable access geometry once per frame; all visible actors keep live work phases. */
export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Park,
  v: View,
  realTime: number,
) {
  return withAccessLayoutCache(s, () => drawPark(ctx, w, h, s, v, realTime));
}
