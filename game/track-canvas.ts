import { COASTER_TYPES, type CoasterType, type Point } from "./simulation";
import { prepareRoute, routePosition, type RouteMotion, type Vec } from "./motion";
import { supportClearAt, type GroundPath } from "./track-support";
import { cameraTurn, viewDepth, type IsoProject } from "./isometric-view";

/** World geometry stays in the same tile coordinates and transported frame as the train. */
export const TRACK_HALF_GAUGE = 0.15;
export const TRACK_TIE_SPACING = 0.24;
type Project = IsoProject;
type Frame = { point: Point; right: Vec; up: Vec; tangent: Vec };
export type TrackCanvasTie = Frame & { distance: number };
export type TrackCanvasSpan = {
  frames: Frame[];
  ties: TrackCanvasTie[];
  style: CoasterType;
  drive?: Point["drive"];
  lift: boolean;
  depth: number;
};
export type TrackCanvasSupport = Frame & { style: CoasterType; distance: number; depth: number };
export type TrackCanvasGeometry = { spans: TrackCanvasSpan[]; supports: TrackCanvasSupport[] };
export type TrackCanvasOptions = {
  groundPath?: GroundPath;
  /** Built track hidden by a bore; drafts/cutaway omit this predicate. */
  visibleAt?: (point: Point) => boolean;
  ghost?: boolean;
  ties?: boolean;
  /** Each sampled centreline remains selectable using the renderer's existing hit test. */
  onHit?: (a: { x: number; y: number }, b: { x: number; y: number }) => void;
};
const geometryCache = new WeakMap<Point[], TrackCanvasGeometry>();
const segmentCache = new WeakMap<Point, WeakMap<Point, TrackCanvasGeometry>>();
const offset = (p: Point, r: Vec, amount: number): Point => ({
  x: p.x + r.x * amount,
  y: p.y + r.y * amount,
  z: (p.z ?? 0) + r.z * amount,
});
const shifted = (f: Frame, sideways: number, height = 0) =>
  offset(offset(f.point, f.right, sideways), f.up, height);
const routeFrame = (route: RouteMotion, i: number): Frame => ({
  point: route.points[i],
  right: route.rights[i],
  up: route.ups[i],
  tangent: route.tangents[i],
});
const frameAt = (route: RouteMotion, distance: number): Frame => {
  const q = routePosition(route, distance);
  return { point: q, right: q.right, up: q.up, tangent: q.tangent };
};

/** Cached world frames, globally spaced sleepers and foundations, independent of zoom and time. */
export function trackCanvasGeometry(track: Point[]): TrackCanvasGeometry {
  const cached = geometryCache.get(track);
  if (cached) return cached;
  const route = prepareRoute(track),
    spans: TrackCanvasSpan[] = [],
    supports: TrackCanvasSupport[] = [];
  if (route.length < 1e-7) {
    const result = { spans, supports };
    geometryCache.set(track, result);
    return result;
  }
  let start = 0,
    nextTie = TRACK_TIE_SPACING / 2;
  for (let end = 1; end < route.points.length; end++) {
    const a = route.points[start],
      b = route.points[end],
      style = a.style ?? track[0]?.style ?? "steel";
    const next = route.points[end + 1];
    if (
      next &&
      route.distance[end] - route.distance[start] < 0.45 &&
      (next.style ?? style) === style &&
      next.drive === a.drive &&
      (route.phases[end + 1] === "lift") === (route.phases[start] === "lift")
    )
      continue;
    const frames = route.points.slice(start, end + 1).map((_, i) => routeFrame(route, start + i));
    const ties: TrackCanvasTie[] = [];
    while (nextTie <= route.distance[end] + 1e-9) {
      ties.push({ ...frameAt(route, nextTie), distance: nextTie });
      nextTie += TRACK_TIE_SPACING;
    }
    spans.push({
      frames,
      ties,
      style,
      drive: a.drive,
      lift: route.phases[start] === "lift",
      depth: (a.x + a.y + b.x + b.y) / 2 + Math.max(a.z ?? 0, b.z ?? 0) * 0.035,
    });
    start = end;
  }
  const style = track[0]?.style ?? "steel",
    spacing = style === "wood" ? 1.05 : 1.55;
  for (let distance = spacing / 2; distance < route.length; distance += spacing) {
    const frame = frameAt(route, distance);
    // Upright supports attach under ordinary rail sections, never through an inverted loop.
    if ((frame.point.z ?? 0) < 0.22 || frame.up.z < 0.3) continue;
    supports.push({
      ...frame,
      style: frame.point.style ?? style,
      distance,
      depth: frame.point.x + frame.point.y - 0.02,
    });
  }
  const result = { spans, supports };
  geometryCache.set(track, result);
  return result;
}

const palette = (style: CoasterType, ghost = false) =>
  ghost
    ? {
        rail: "#ffe097",
        railDark: "#c28e31",
        shine: "#fff7ce",
        beam: "#c79d50",
        light: "#f5d991",
        dark: "#a47e3c",
        tie: "#f4cf83",
      }
    : style === "wood"
      ? {
          rail: "#d9d4b8",
          railDark: "#665545",
          shine: "#fff2cc",
          beam: COASTER_TYPES.wood.color,
          light: "#c39154",
          dark: "#765032",
          tie: "#bd8a50",
        }
      : {
          rail: COASTER_TYPES[style].color,
          railDark: style === "launch" ? "#14656d" : "#873e30",
          shine: style === "launch" ? "#a7eee1" : "#ffbe94",
          beam: "#426e70",
          light: "#77a09a",
          dark: "#2b4b50",
          tie: "#6d8d88",
        };

function painter(ctx: CanvasRenderingContext2D, project: Project, scale: number) {
  const path = (points: Point[], color: string, width: number) => {
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = project(p.x, p.y, p.z ?? 0);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const polygon = (points: Point[], color: string) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = project(p.x, p.y, p.z ?? 0);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  return { path, polygon };
}

export function drawTrackSpan(
  ctx: CanvasRenderingContext2D,
  span: TrackCanvasSpan,
  project: Project,
  scale: number,
  options: TrackCanvasOptions = {},
) {
  const colors = palette(span.style, options.ghost),
    { path } = painter(ctx, project, scale);
  ctx.save();
  // A recessed spine leaves visible space between the two continuous running rails.
  path(
    span.frames.map((f) => shifted(f, 0, -0.1)),
    colors.dark,
    span.style === "wood" ? 4.4 : 3.6,
  );
  path(
    span.frames.map((f) => shifted(f, 0, -0.09)),
    colors.beam,
    span.style === "wood" ? 2.8 : 2.2,
  );
  if (options.ties !== false)
    for (const f of span.ties) {
      const ends = [shifted(f, -0.205, -0.035), shifted(f, 0.205, -0.035)];
      path(ends, colors.dark, 2.4);
      path(ends, colors.tie, 1.3);
    }
  if (span.drive || span.lift) {
    const color = options.ghost
      ? colors.shine
      : span.drive?.kind === "boost"
        ? "#55decd"
        : "#d5ad68";
    path(
      span.frames.map((f) => shifted(f, 0, -0.012)),
      colors.dark,
      2.8,
    );
    path(
      span.frames.map((f) => shifted(f, 0, 0)),
      color,
      1.2,
    );
    for (const f of span.ties)
      path(
        [
          offset(shifted(f, 0, 0.015), f.tangent, -0.035),
          offset(shifted(f, 0, 0.015), f.tangent, 0.035),
        ],
        options.ghost ? colors.shine : "#f4e2a6",
        0.65,
      );
  }
  for (const side of [-1, 1]) {
    const rail = span.frames.map((f) => shifted(f, side * TRACK_HALF_GAUGE));
    path(rail, colors.railDark, 3.1);
    path(rail, colors.rail, 2.1);
    path(
      span.frames.map((f) => shifted(f, side * TRACK_HALF_GAUGE, 0.025)),
      colors.shine,
      0.7,
    );
  }
  if (options.onHit)
    for (let i = 1; i < span.frames.length; i++) {
      const a = span.frames[i - 1].point,
        b = span.frames[i].point;
      options.onHit(project(a.x, a.y, a.z), project(b.x, b.y, b.z));
    }
  ctx.restore();
}

export function drawTrackSupport(
  ctx: CanvasRenderingContext2D,
  support: TrackCanvasSupport,
  project: Project,
  scale: number,
) {
  const colors = palette(support.style),
    { path, polygon } = painter(ctx, project, scale),
    wood = support.style === "wood",
    h = Math.max(0.08, (support.point.z ?? 0) - 0.1),
    flat = Math.hypot(support.right.x, support.right.y) || 1,
    right = { x: support.right.x / flat, y: support.right.y / flat, z: 0 },
    half = wood ? 0.24 : 0.2,
    at = (side: number, z: number) => offset({ ...support.point, z }, right, side);
  ctx.save();
  for (const side of [-1, 1]) {
    const base = at(side * half, 0),
      top = at(side * (wood ? 0.22 : 0.15), h),
      r = wood ? 0.12 : 0.13;
    const corners = [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ].map(([x, y]) => ({ x: base.x + x, y: base.y + y, z: 0.055 }));
    const front = (2 - cameraTurn(project.turn) + 4) % 4,
      visible = [(front + 3) % 4, front, (front + 1) % 4].map((i) => corners[i]);
    polygon([...visible, ...visible.toReversed().map((p) => ({ ...p, z: 0 }))], "#8c9483");
    polygon(corners, "#d2cfb7");
    path([base, top], colors.dark, wood ? 4.4 : 4.7);
    path([base, top], colors.beam, wood ? 2.9 : 3.1);
    path([offset(base, right, -0.025), offset(top, right, -0.025)], colors.light, 0.7);
    // Steel flange plates / timber shoes visibly join each column to its pad.
    path(
      [offset({ ...base, z: 0.08 }, right, -0.085), offset({ ...base, z: 0.08 }, right, 0.085)],
      colors.dark,
      2.2,
    );
  }
  path([at(-0.27, h), at(0.27, h)], colors.dark, 4.2);
  path([at(-0.27, h + 0.015), at(0.27, h + 0.015)], colors.light, 2);
  if (wood) {
    const levels = Math.max(1, Math.ceil(h / 0.65));
    for (let i = 0; i < levels; i++) {
      const bottom = 0.1 + ((h - 0.1) * i) / levels,
        top = 0.1 + ((h - 0.1) * (i + 1)) / levels;
      path([at(-0.22, bottom), at(0.22, top)], colors.dark, 2.3);
      path([at(0.22, bottom), at(-0.22, top)], colors.light, 1.7);
      if (i) path([at(-0.23, bottom), at(0.23, bottom)], colors.beam, 2);
    }
  } else if (h > 0.8) {
    path([at(-0.19, 0.18), at(0.16, h * 0.72)], colors.light, 1.7);
    path([at(-0.18, h * 0.5), at(0.18, h * 0.5)], colors.beam, 1.8);
  }
  ctx.restore();
}

/** Clip at the actual terrain crossing instead of dropping a whole rail span. */
function visibleSpans(
  span: TrackCanvasSpan,
  visibleAt?: (point: Point) => boolean,
): TrackCanvasSpan[] {
  if (!visibleAt) return [span];
  const result: TrackCanvasSpan[] = [];
  let frames: Frame[] = [];
  const finish = () => {
    if (frames.length > 1)
      result.push({ ...span, frames, ties: span.ties.filter((tie) => visibleAt(tie.point)) });
    frames = [];
  };
  for (let i = 0; i < span.frames.length; i++) {
    const f = span.frames[i],
      visible = visibleAt(f.point),
      previous = span.frames[i - 1];
    if (previous && visibleAt(previous.point) !== visible) {
      const mix = (t: number): Frame => ({
        ...f,
        point: {
          ...f.point,
          x: previous.point.x + (f.point.x - previous.point.x) * t,
          y: previous.point.y + (f.point.y - previous.point.y) * t,
          z: (previous.point.z ?? 0) + ((f.point.z ?? 0) - (previous.point.z ?? 0)) * t,
        },
      });
      let lo = 0,
        hi = 1;
      for (let n = 0; n < 22; n++) {
        const middle = (lo + hi) / 2;
        if (visibleAt(mix(middle).point) === visible) hi = middle;
        else lo = middle;
      }
      frames.push(mix((lo + hi) / 2));
      if (!visible) finish();
    }
    if (visible) frames.push(f);
  }
  finish();
  return result;
}

/** Keep depth objects separate so elevated rail, supports and moving trains can interleave. */
export function trackCanvasLayers(
  ctx: CanvasRenderingContext2D,
  track: Point[],
  project: Project,
  scale: number,
  options: TrackCanvasOptions = {},
): Array<{ depth: number; draw: () => void }> {
  const geometry = trackCanvasGeometry(track);
  return [
    ...(options.ghost
      ? []
      : geometry.supports
          .filter(
            (support) =>
              (!options.visibleAt || options.visibleAt(support.point)) &&
              supportClearAt(support.point.x, support.point.y, options.groundPath),
          )
          .map((support) => ({
            depth: viewDepth(project, support.point.x, support.point.y) - 0.02,
            draw: () => drawTrackSupport(ctx, support, project, scale),
          }))),
    ...geometry.spans
      .flatMap((span) => visibleSpans(span, options.visibleAt))
      .map((span) => {
        const a = span.frames[0].point,
          b = span.frames[span.frames.length - 1].point;
        return {
          depth:
            (viewDepth(project, a.x, a.y) + viewDepth(project, b.x, b.y)) / 2 +
            Math.max(a.z ?? 0, b.z ?? 0) * 0.035,
          draw: () => drawTrackSpan(ctx, span, project, scale, options),
        };
      }),
  ];
}

/** Open draft/edit spans avoid prepareRoute's closed legacy-track smoothing. */
export function drawTrackSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  project: Project,
  scale: number,
  options: TrackCanvasOptions = {},
) {
  let ends = segmentCache.get(a);
  if (!ends) {
    ends = new WeakMap();
    segmentCache.set(a, ends);
  }
  let geometry = ends.get(b);
  if (!geometry) {
    geometry = trackCanvasGeometry([a, b]);
    ends.set(b, geometry);
  }
  for (const span of geometry.spans) drawTrackSpan(ctx, span, project, scale, options);
}
