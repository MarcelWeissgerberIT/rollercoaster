import {
  SIZE,
  CATALOG,
  footprint,
  access,
  isRide,
  connected,
  type Guest,
  type Park,
  type Point,
  type Kind,
  type Building,
} from "./simulation";
import type { Placement, Geometry } from "./construction";
import {
  advanceSpin,
  advanceTrain,
  type TrainMotor,
  prepareRoute,
  trainDistance,
  routePosition,
  type Spin,
  type RouteMotion,
} from "./motion";
export type View = {
  zoom: number;
  panX: number;
  panY: number;
  grid: boolean;
  hover: Point | null;
  tool: string;
  selected: number | null;
  draft: Point[];
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
type SpriteSpec = { width: number; height: number; anchorX: number; anchorY: number };
const sprites: Record<string, HTMLImageElement> = {};
// Every number is in logical screen pixels for a 48 × 24 ground tile.
const specs: Record<string, SpriteSpec> = {
  wheel: { width: 152, height: 216, anchorX: 76, anchorY: 176 },
  carousel: { width: 104, height: 152, anchorX: 52, anchorY: 124 },
  burger: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  drink: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
  toilet: { width: 56, height: 88, anchorX: 28, anchorY: 60 },
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
            resolve();
          };
          im.onerror = () => reject(Error(name));
          im.src = `${name.startsWith("walk-") ? base.replace(/pixel-v2$/, "walk-v3") : base}/${name}.png`;
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
const routes = new WeakMap<Point[], RouteMotion>();
const service = new WeakMap<Building, { served: number; time: number; value: number }>();
export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Park,
  v: View,
  _realTime: number,
) {
  const net = connected(s);
  const { scale, tw, th, project } = projection(w, h, v);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#b4d6e2");
  bg.addColorStop(1, "#d8e8bd");
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
    project(29.5, -0.5),
    project(29.5, 29.5),
    project(-0.5, 29.5),
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
    x < SIZE &&
    y >= 0 &&
    y < SIZE &&
    (s.tiles[y][x] === type || (type === "path" && s.tiles[y][x] === "queue"));
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const type = s.tiles[y][x],
        n = (x * 79 + y * 53) % 13,
        p = project(x, y);
      tile(
        x,
        y,
        type === "water"
          ? ["#4babc1", "#49a6bb", "#50b2c5"][n % 3]
          : type === "path"
            ? "#d9bb83"
            : type === "queue"
              ? "#8faec0"
              : ["#7eac47", "#80af49", "#84b24b", "#83ae48"][n % 4],
        v.grid ? "#28522030" : undefined,
      );
      if (type === "path" || type === "queue") {
        // One continuous path surface, with borders only at exposed edges.
        const color = type === "queue" ? "#546e87" : "#ad925f";
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
        if (type === "queue")
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
          ])
            if (!neighbor(x + dx, y + dy, "queue") && !neighbor(x + dx, y + dy, "path")) {
              const a = project(x + dx * 0.45, y - 0.45),
                b = project(x + dx * 0.45, y + 0.45);
              line(a, { x: a.x, y: a.y - 5 * scale }, "#e9eee6", 1.4);
              line(b, { x: b.x, y: b.y - 5 * scale }, "#e9eee6", 1.4);
              line({ x: a.x, y: a.y - 5 * scale }, { x: b.x, y: b.y - 5 * scale }, "#dde6de", 1.4);
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
  ) => {
    const im = sprites[name];
    if (!im) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(
      im,
      -spec.anchorX * scale,
      -spec.anchorY * scale,
      spec.width * scale,
      spec.height * scale,
    );
    ctx.restore();
  };
  const rail = (a: Point, b: Point, ghost = false) => {
    const pa = project(a.x, a.y, a.z ?? 0),
      pb = project(b.x, b.y, b.z ?? 0);
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y,
      len = Math.hypot(dx, dy) || 1,
      nx = (-dy / len) * 3.3 * scale,
      ny = (dx / len) * 3.3 * scale;
    line(pa, pb, ghost ? "#ffc652" : "#763b2d", 9);
    for (let t = 0.12; t < 1; t += 0.24) {
      const x = pa.x + dx * t,
        y = pa.y + dy * t;
      line(
        { x: x - nx * 1.35, y: y - ny * 1.35 },
        { x: x + nx * 1.35, y: y + ny * 1.35 },
        ghost ? "#ffe4a4" : "#423d38",
        2,
      );
    }
    for (const side of [-1, 1])
      line(
        { x: pa.x + nx * side, y: pa.y + ny * side },
        { x: pb.x + nx * side, y: pb.y + ny * side },
        ghost ? "#fff3b9" : "#ed7650",
        2.1,
      );
  };
  const objects: Array<{ depth: number; draw: () => void }> = [];
  const motor = (b: Building): Spin => {
    if (b.id < 0) return { angle: 0, velocity: 0 };
    const prev = motors.get(b) ?? { angle: (b.id % 5) * 0.3, velocity: 0, time: s.time };
    const running = b.open && !!access(s, b, net) && b.riders.length > 0;
    const remaining = b.cycle,
      elapsed = CATALOG[b.kind].duration - remaining;
    const envelope = running
      ? Math.min(1, Math.max(0, elapsed / 2), Math.max(0, remaining / 3))
      : 0;
    const next = {
      ...advanceSpin(
        prev,
        (b.kind === "wheel" ? 0.34 : 1.05) * envelope,
        Math.max(0, s.time - prev.time),
        b.kind === "wheel" ? 1.5 : 0.8,
      ),
      time: s.time,
    };
    motors.set(b, next);
    return next;
  };
  // Advance each motor once; translucent placement previews never affect running rides.
  for (const b of s.buildings) if (b.kind === "wheel" || b.kind === "carousel") motor(b);
  const wheel = (b: Building, p: Point, alpha = 1) => {
    const spin = motors.get(b) ?? { angle: 0, velocity: 0 },
      angle = spin.angle,
      r = 64 * scale,
      hub = { x: p.x, y: p.y - 106 * scale };
    const im = sprites["wheel-rim"];
    if (im) {
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
        x: hub.x + Math.cos(t) * r * 0.84,
        y: hub.y + Math.cos(t) * r * 0.42 + Math.sin(t) * r,
        sway: Math.sin(t * 2) * spin.velocity * 0.12,
      };
    }).sort((a, b) => a.y - b.y);
    cabins.forEach((q) =>
      frame("wheel-cabin", q, { width: 20, height: 25, anchorX: 10, anchorY: 2.5 }, alpha, q.sway),
    );
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
        x: p.x + Math.cos(t) * 31 * scale,
        y:
          depth -
          2 * scale -
          Math.sin(angle * 2 + i * Math.PI) * 3 * scale * Math.min(1, spin.velocity),
        depth,
        mirror: Math.sin(t) > 0,
      };
    }).sort((a, b) => a.depth - b.depth);
    horses.forEach((q) =>
      frame(
        "carousel-horse",
        q,
        { width: 32, height: 44.8, anchorX: 16, anchorY: 38.4 },
        alpha,
        0,
        q.mirror,
      ),
    );
    frame(
      "carousel-roof",
      { x: p.x, y: p.y - 60 * scale },
      { width: 106.4, height: 76, anchorX: 53.2, anchorY: 38 },
      alpha,
    );
  };
  const drawBuilding = (b: Building, alpha = 1) => {
    const n = CATALOG[b.kind].size,
      p = project(b.x + (n - 1) / 2, b.y + (n - 1) / 2);
    if (b.kind === "wheel") wheel(b, p, alpha);
    else if (b.kind === "carousel") carousel(b, p, alpha);
    else frame(CATALOG[b.kind].sprite, p, specs[CATALOG[b.kind].sprite], alpha);
  };
  for (const b of s.buildings) {
    const firstObject = objects.length;
    if (b.id === v.selected) for (const p of footprint(b)) tile(p.x, p.y, "#ffef9166", "#fff0bb");
    if (b.kind === "coaster") {
      const pts = b.track ?? [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1],
          b = pts[i],
          depth = (a.x + a.y + b.x + b.y) / 2;
        if ((a.z ?? 0) > 0)
          objects.push({
            depth: a.x + a.y - 0.02,
            draw: () => {
              const top = project(a.x, a.y, a.z),
                base = project(a.x, a.y);
              line(
                { x: base.x - 3 * scale, y: base.y },
                { x: top.x - 3 * scale, y: top.y },
                "#b6c2bc",
                2,
              );
              line(
                { x: base.x + 3 * scale, y: base.y },
                { x: top.x + 3 * scale, y: top.y },
                "#647974",
                2,
              );
              line(
                { x: base.x - 3 * scale, y: base.y },
                { x: top.x + 3 * scale, y: top.y },
                "#83928b",
                1,
              );
            },
          });
        objects.push({
          depth: depth + Math.max(a.z ?? 0, b.z ?? 0) * 0.035,
          draw: () => rail(a, b),
        });
      }
      if (pts.length > 1) {
        let route = routes.get(pts);
        if (!route) {
          route = prepareRoute(pts);
          routes.set(pts, route);
        }
        const progress = b.testing
          ? 1 - b.testing / 8
          : b.open && b.riders.length && access(s, b, net)
            ? 1 - b.cycle / CATALOG.coaster.duration
            : 0;
        const desired = trainDistance(route, progress),
          running = !!b.testing || !!(b.open && b.riders.length && access(s, b, net));
        const cached = trains.get(b);
        const previous =
          cached?.track === pts
            ? cached
            : {
                angle: desired,
                velocity: 0,
                target: desired,
                time: s.time,
              };
        const motor = advanceTrain(previous, desired, running, s.time, route.length);
        trains.set(b, { ...motor, track: pts });
        const head = motor.angle;
        for (let car = 0; car < 4; car++) {
          const q = routePosition(route, head - car * 0.55);
          objects.push({
            depth: q.x + q.y + (q.z ?? 0) * 0.035 + 0.15,
            draw: () =>
              frame(
                `car-${heading(q.dx, q.dy)}`,
                project(q.x, q.y, q.z),
                { width: 48, height: 40, anchorX: 24, anchorY: 30 },
                1,
                -q.pitch * 0.12 * Math.sign(q.dx - q.dy),
              ),
          });
        }
      }
      objects.push({
        depth: b.x + b.y - 0.15,
        draw: () => frame("station", project(b.x, b.y), specs.station),
      });
    } else {
      const n = CATALOG[b.kind].size;
      objects.push({ depth: b.x + b.y + 2 * (n - 1) + 0.05, draw: () => drawBuilding(b) });
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
  for (const g of s.guests) {
    if (g.state === "ride") continue;
    const target = queued.get(g.id) ?? {
      x: g.x + ((g.id % 3) - 1) * 0.13,
      y: g.y + ((Math.floor(g.id / 3) % 3) - 1) * 0.1,
    };
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
    const name = `walk-${g.skin === 1 ? "teal" : "red"}-${old.heading}-${step}`;
    objects.push({
      depth: visual.x + visual.y + 0.12,
      draw: () => {
        const p = project(visual.x, visual.y);
        ctx.fillStyle = "#29442830";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4.3 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        if (moving) p.y -= Math.abs(Math.sin((old.phase * Math.PI) / 2)) * 0.8 * scale;
        frame(
          name,
          p,
          { width: 24, height: 32, anchorX: 12, anchorY: 28 },
          1,
          moving ? Math.sin((old.phase * Math.PI) / 2) * 0.018 : 0,
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
  objects.push({ depth: 43.9, draw: () => frame("entrance", project(15, 29), specs.entrance) });
  objects.sort((a, b) => a.depth - b.depth).forEach((o) => o.draw());
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
      const q = project(p.x, p.y, p.z ?? 0);
      ctx.fillStyle = i === 0 ? "#fff7cd" : "#ffd66b";
      ctx.fillRect(q.x - 2 * scale, q.y - 2 * scale, 4 * scale, 4 * scale);
    });
  }
  const hover = v.adjustment ? v.adjustment.geometry : v.hover;
  if (hover && v.tool !== "select") {
    const { x, y } = hover;
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) {
      const d = CATALOG[v.tool as Kind],
        n = d?.size ?? 1;
      const preview = v.preview,
        points =
          preview?.points ??
          Array.from({ length: n * n }, (_, i) => ({ x: x + (i % n), y: y + Math.floor(i / n) }));
      const invalid = !!preview?.error;
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
          frame("station", project(pending.x, pending.y), specs.station, 0.85);
        else drawBuilding(pending, 0.65);
      }
      if (d && v.tool !== "coaster")
        drawBuilding({ id: -1, kind: v.tool as Kind, x, y, open: false } as Building, 0.65);
    }
  }
}
