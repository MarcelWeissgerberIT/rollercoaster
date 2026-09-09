import type { Building, Point } from "./simulation";
import { habitatLayout, fixtureWorld, type HabitatFixture } from "./zoo-layout";
export type HabitatLayer = { depth: number; draw: () => void };
type Options = {
  ctx: CanvasRenderingContext2D;
  project: (x: number, y: number, z?: number) => Point;
  scale: number;
  alpha?: number;
  registerLine?: (a: Point, b: Point) => void;
};

/** Canvas furniture shares exact tile footprints and vertical metres with the 3D model. */
export function habitatSceneryLayers(
  b: Building,
  { ctx, project, scale, alpha = 1, registerLine }: Options,
): HabitatLayer[] {
  const layout = habitatLayout(b),
    n = layout.size,
    species = layout.species;
  const layers: HabitatLayer[] = [];
  const p = (x: number, y: number, h = 0) => project(x, y, h / 5);
  const polygon = (points: Point[], color: string, stroke?: string) => {
    ctx.beginPath();
    points.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.55, scale * 0.65);
      ctx.stroke();
    }
  };
  const line = (a: Point, d: Point, color: string, width = 1) => {
    if (width >= 2) registerLine?.(a, d);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(d.x, d.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.4, width * scale);
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const ring = (x: number, y: number, rx: number, ry: number, color: string, h = 0.05) => {
    polygon(
      Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return p(x + Math.cos(a) * rx, y + Math.sin(a) * ry, h);
      }),
      color,
    );
  };
  const prism = (
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    top: string,
    left: string,
    right: string,
    base = 0,
  ) => {
    const footprint = [
      { x: x - w / 2, y: y - d / 2 },
      { x: x + w / 2, y: y - d / 2 },
      { x: x + w / 2, y: y + d / 2 },
      { x: x - w / 2, y: y + d / 2 },
    ];
    const low = footprint.map((q) => p(q.x, q.y, base)),
      high = footprint.map((q) => p(q.x, q.y, base + h));
    polygon([low[1], low[2], high[2], high[1]], right);
    polygon([low[2], low[3], high[3], high[2]], left);
    polygon(high, top);
  };
  const rock = (x: number, y: number, w: number, d: number, h: number, color = "#a99f83") => {
    const base = [
        p(x - w * 0.5, y - d * 0.2),
        p(x - w * 0.3, y + d * 0.45),
        p(x + w * 0.3, y + d * 0.4),
        p(x + w * 0.5, y - d * 0.1),
      ],
      top = [
        p(x - w * 0.28, y - d * 0.25, h * 0.7),
        p(x + w * 0.02, y - d * 0.37, h),
        p(x + w * 0.34, y, h * 0.75),
      ];
    polygon([base[0], base[1], top[0]], "#8a886f");
    polygon([base[1], base[2], top[2], top[0]], color);
    polygon([base[2], base[3], top[2]], "#8d947f");
    polygon([base[0], top[0], top[2], top[1]], species === "penguin" ? "#d7ddce" : "#c1b18d");
  };
  const post = (x: number, y: number, height: number, color: string, width: number, base = 0) =>
    line(p(x, y, base), p(x, y, base + height), color, width);
  const guarded = (fn: () => void) => () => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    try {
      fn();
    } finally {
      ctx.restore();
    }
  };
  layers.push({
    depth: -100,
    draw: guarded(() => {
      polygon(
        [
          p(b.x - 0.48, b.y - 0.48),
          p(b.x + n - 0.52, b.y - 0.48),
          p(b.x + n - 0.52, b.y + n - 0.52),
          p(b.x - 0.48, b.y + n - 0.52),
        ],
        layout.ground,
      );
      for (let j = 0; j < 18; j++) {
        const x = b.x - 0.5 + n * (0.1 + ((j * 0.381966) % 1) * 0.8),
          y = b.y - 0.5 + n * (0.1 + ((j * 0.618034 + 0.22) % 1) * 0.8);
        ring(
          x,
          y,
          0.09 + (j % 3) * 0.035,
          0.07 + (j % 2) * 0.025,
          species === "penguin" ? "#bcc2b6" : species === "panda" ? "#759257" : "#a7a36c",
        );
      }
      for (const f of layout.fixtures) {
        const q = fixtureWorld(b, f);
        if (f.kind !== "pool" && f.kind !== "mud" && f.kind !== "foraging")
          ring(q.x + 0.07, q.y + 0.07, q.width * 0.56, q.depth * 0.57, "#52614332");
        if (f.kind === "pool" || f.kind === "mud") {
          ring(
            q.x,
            q.y,
            q.width * 0.55,
            q.depth * 0.55,
            f.kind === "mud" ? "#968261" : species === "penguin" ? "#e0e2ca" : "#c9bb87",
          );
          ring(
            q.x,
            q.y,
            q.width * 0.5,
            q.depth * 0.5,
            f.kind === "mud" ? "#837659" : "#358fa0",
            0.06,
          );
          ring(
            q.x - q.width * 0.025,
            q.y - q.depth * 0.025,
            q.width * 0.445,
            q.depth * 0.44,
            f.kind === "mud" ? "#9e8c68" : "#69b8c3",
            0.07,
          );
          if (f.kind === "pool")
            for (let j = 0; j < 4; j++) {
              const x = q.x + (j - 1.5) * q.width * 0.16,
                y = q.y + Math.sin(j * 2) * q.depth * 0.23;
              line(p(x, y, 0.1), p(x + q.width * 0.1, y, 0.1), "#c4e3d6", 0.7);
            }
        }
      }
    }),
  });
  const fenceHeight =
    layout.barrier === "glass"
      ? species === "lion"
        ? 3.4
        : 2.1
      : layout.barrier === "reinforced"
        ? 3.1
        : 1.9;
  const corners = [
    { x: b.x - 0.5, y: b.y - 0.5 },
    { x: b.x + n - 0.5, y: b.y - 0.5 },
    { x: b.x + n - 0.5, y: b.y + n - 0.5 },
    { x: b.x - 0.5, y: b.y + n - 0.5 },
  ];
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < n; i++) {
      const a = corners[side],
        e = corners[(side + 1) % 4],
        v = { x: a.x + ((e.x - a.x) * i) / n, y: a.y + ((e.y - a.y) * i) / n },
        u = { x: a.x + ((e.x - a.x) * (i + 1)) / n, y: a.y + ((e.y - a.y) * (i + 1)) / n };
      layers.push({
        depth: (v.x + v.y + u.x + u.y) / 2 + 0.18,
        draw: guarded(() => {
          const dark = layout.barrier === "wood" ? "#76573a" : "#40564f",
            light = layout.barrier === "wood" ? "#ad8a59" : "#73897c";
          if (layout.barrier === "glass") {
            polygon(
              [
                p(v.x, v.y, 0.22),
                p(u.x, u.y, 0.22),
                p(u.x, u.y, fenceHeight),
                p(v.x, v.y, fenceHeight),
              ],
              "#bddfdb39",
            );
            for (const t of [0.34, 0.7])
              line(
                p(v.x + (u.x - v.x) * t, v.y + (u.y - v.y) * t, 0.65),
                p(v.x + (u.x - v.x) * (t + 0.1), v.y + (u.y - v.y) * (t + 0.1), 1.5),
                "#d5ebe3ad",
                0.8,
              );
          }
          prism(v.x, v.y, 0.11, 0.11, 0.26, "#8c927e", "#707763", "#5e6f60");
          post(v.x, v.y, fenceHeight + 0.12, dark, 2.1);
          for (const h of layout.barrier === "wood" ? [0.55, 1.32] : [0.28, fenceHeight])
            line(p(v.x, v.y, h), p(u.x, u.y, h), light, 1.25);
          if (layout.barrier === "reinforced") {
            for (let j = 1; j < 6; j++)
              post(
                v.x + ((u.x - v.x) * j) / 6,
                v.y + ((u.y - v.y) * j) / 6,
                fenceHeight,
                "#5e7269",
                0.7,
              );
            line(p(v.x, v.y, fenceHeight * 0.53), p(u.x, u.y, fenceHeight * 0.53), light, 1.0);
          }
          if (layout.electricInstalled) {
            for (const h of [fenceHeight * 0.38, fenceHeight * 0.73, fenceHeight + 0.12]) {
              line(p(v.x, v.y, h), p(u.x, u.y, h), layout.electric ? "#c7bc7b" : "#7d887a", 0.65);
              const a = p(v.x, v.y, h);
              ctx.fillStyle = "#e8cf64";
              ctx.fillRect(a.x - scale, a.y - scale, 2 * scale, 2 * scale);
            }
            if (i === 1) {
              const q = p((v.x + u.x) / 2, (v.y + u.y) / 2, fenceHeight * 0.78);
              ctx.fillStyle = layout.safety === "closed" ? "#d2684c" : "#e3c44b";
              ctx.fillRect(q.x - 2 * scale, q.y - 2 * scale, 4 * scale, 4 * scale);
              line({ x: q.x, y: q.y - scale }, { x: q.x, y: q.y + scale }, "#5a5030", 0.7);
            }
          }
          if (layout.safety === "closed" && side === 2 && i === Math.floor(n / 2)) {
            const q = p((v.x + u.x) / 2, (v.y + u.y) / 2, 1.3);
            ctx.fillStyle = "#d65c48";
            ctx.fillRect(q.x - 3 * scale, q.y - 2 * scale, 6 * scale, 4 * scale);
            line({ x: q.x - 2 * scale, y: q.y }, { x: q.x + 2 * scale, y: q.y }, "#fff0d0", 0.8);
          }
        }),
      });
    }
  const drawFixture = (f: HabitatFixture) => {
    const q = fixtureWorld(b, f),
      x = q.x,
      y = q.y,
      w = q.width,
      d = q.depth,
      h = q.height;
    if (f.kind === "filter") {
      prism(x, y, w, d, 0.92, "#abbca4", "#647966", "#859680");
      for (let j = 0; j < 3; j++)
        line(
          p(x - w * 0.3, y + d * 0.52, 0.35 + j * 0.13),
          p(x + w * 0.3, y + d * 0.52, 0.35 + j * 0.13),
          "#4d6456",
          0.65,
        );
      post(x + w * 0.33, y, 1.12, "#546e5c", 0.75);
    } else if (f.kind === "trough") {
      prism(x, y, w, d, 0.55, "#687f77", "#6a7469", "#929c8c");
      prism(x, y, w * 0.77, d * 0.8, 0.03, "#87cfcb", "#4d8790", "#509eaa", 0.56);
    } else if (["feeder", "browse", "bamboo", "meat", "fish"].includes(f.kind)) {
      const deck = f.kind === "browse" ? h - 0.65 : 0.55;
      if (f.kind === "browse") post(x, y, deck, "#75583b", 2.1);
      prism(x, y, w, d, 0.24, "#b79b60", "#745237", "#9b7b46", deck);
      for (const side of [-1, 1])
        prism(x, y + side * d * 0.44, w, 0.025, 0.28, "#b99962", "#7f603e", "#947849", deck + 0.2);
      for (let j = 0; j < 5; j++) {
        const fx = x + (j - 2) * w * 0.16,
          fy = y + ((j % 2) - 0.5) * d * 0.25;
        if (f.kind === "meat")
          prism(fx, fy, w * 0.13, d * 0.32, 0.23, "#bc8465", "#8e493c", "#a86a50", deck + 0.25);
        else if (f.kind === "fish")
          line(
            p(fx - 0.035, fy, deck + 0.28),
            p(fx + 0.035, fy + 0.025, deck + 0.28),
            "#c7d6cb",
            1.7,
          );
        else {
          line(
            p(fx, fy - d * 0.18, deck + 0.23),
            p(fx + 0.035, fy + d * 0.18, deck + 0.5),
            f.kind === "bamboo" || f.kind === "browse" ? "#78974c" : "#d1c778",
            1.7,
          );
          if (f.kind === "browse") ring(fx, fy, w * 0.1, d * 0.2, "#5a8345", deck + 0.54);
        }
      }
    } else if (f.kind === "cave") {
      prism(x, y - d * 0.28, w * 0.78, 0.08, h * 0.72, "#797360", "#424a3d", "#625e4d");
      prism(x, y, w * 0.88, d * 0.85, 0.12, "#b6a16f", "#786d50", "#a89666", 0.08);
      rock(x - w * 0.35, y, w * 0.37, d, h * 0.92);
      rock(x + w * 0.35, y, w * 0.37, d, h * 0.94);
      const opening = [
        p(x - w * 0.18, y + d * 0.22, 0.13),
        p(x + w * 0.18, y + d * 0.22, 0.13),
        p(x + w * 0.15, y + d * 0.1, h * 0.65),
        p(x - w * 0.13, y + d * 0.1, h * 0.65),
      ];
      polygon(opening, "#394336");
      prism(x, y + d * 0.12, w * 0.07, 0.1, h * 0.67, "#b0a082", "#8d876c", "#9f957a");
      prism(
        x,
        y - d * 0.06,
        w * 0.79,
        d * 0.9,
        h * 0.21,
        species === "penguin" ? "#dde1cf" : "#c0ae8a",
        "#94896f",
        "#a3987d",
        h * 0.84,
      );
    } else if (f.kind === "shade") {
      ring(x, y, w * 0.33, d * 0.33, "#c9b77f", 0.08);
      for (const dx of [-0.4, 0.4])
        for (const dy of [-0.4, 0.4]) post(x + w * dx, y + d * dy, h * 0.96, "#765437", 1.8);
      prism(x, y, w, d, 0.2, "#b89e67", "#7c5d3f", "#9d8051", h);
      for (let j = 0; j < 8; j++)
        line(
          p(x - w * 0.48 + (j * w) / 8, y - d * 0.48, h + 0.2),
          p(x - w * 0.48 + (j * w) / 8, y + d * 0.48, h + 0.2),
          j % 2 ? "#d0b681" : "#9f8556",
          0.75,
        );
    } else if (f.kind === "rock") {
      rock(x - w * 0.18, y, w * 0.7, d, h * 0.8);
      rock(x + w * 0.2, y - d * 0.1, w * 0.58, d * 0.75, h * 0.7);
    } else if (f.kind === "log") {
      line(p(x - w * 0.44, y, 0.4), p(x + w * 0.44, y, h * 0.66), "#7e603d", 3.4);
      post(x - w * 0.15, y, h, "#785638", 3);
      for (let j = 0; j < 4; j++)
        line(p(x - w * 0.2, y, 0.65 + j * 0.18), p(x - w * 0.1, y, 0.65 + j * 0.18), "#b7a07a", 1);
    } else if (f.kind === "climbing") {
      for (const dx of [-0.38, 0.38])
        for (const dy of [-0.37, 0.37]) post(x + dx * w, y + dy * d, h * 0.91, "#785437", 1.8);
      prism(x, y, w * 0.9, d * 0.83, 0.18, "#ba9b63", "#7a5e3a", "#9a7d4e", h * 0.69);
      for (let j = 0; j < 5; j++)
        line(
          p(x - w * 0.34, y + d * (0.49 - j * 0.0275), 0.3 + j * h * 0.125),
          p(x + w * 0.34, y + d * (0.49 - j * 0.0275), 0.3 + j * h * 0.125),
          "#c4a874",
          1.1,
        );
      line(p(x - w * 0.48, y - d * 0.36, h), p(x + w * 0.48, y - d * 0.36, h), "#72573a", 1.6);
      for (let j = 0; j < 5; j++)
        post(x + (j - 2) * w * 0.16, y - d * 0.36, 0.5, "#c9b887", 0.55, h * 0.73);
    } else if (f.kind === "nest") {
      for (let j = 0; j < 3; j++) {
        const nx = x + (j - 1) * w * 0.27;
        ring(nx, y, w * 0.18, d * 0.35, "#b0a079", 0.12);
        ring(nx, y, w * 0.11, d * 0.22, "#746e54", 0.17);
        ring(nx, y, w * 0.052, d * 0.12, "#e0d7aa", 0.22);
      }
    } else if (f.kind === "foraging") {
      ring(x, y, w * 0.5, d * 0.5, "#bcae74", 0.07);
      for (let j = 0; j < 9; j++) {
        const a = j * 2.4,
          r = ((j % 3) + 1) / 3;
        ring(
          x + Math.cos(a) * w * 0.43 * r,
          y + Math.sin(a) * d * 0.43 * r,
          0.026,
          0.026,
          species === "lion" ? "#b3744c" : "#d5c982",
          0.18,
        );
      }
    } else if (f.kind === "pool") {
      for (let j = 0; j < 6; j++) {
        const a = j * 1.6;
        rock(
          x + Math.cos(a) * w * 0.51,
          y + Math.sin(a) * d * 0.5,
          0.16 + (j % 2) * 0.04,
          0.13,
          0.45,
        );
      }
      if (species === "flamingo")
        for (let j = 0; j < 8; j++) {
          const a = j * 0.29;
          post(
            x + Math.cos(a) * w * 0.49,
            y + Math.sin(a) * d * 0.49,
            0.65 + (j % 3) * 0.15,
            "#758f4b",
            0.7,
          );
        }
    } else if (f.kind === "planting") {
      const bamboo = species === "panda",
        reeds = species === "flamingo",
        acacia = species === "giraffe" || species === "zebra",
        count = bamboo ? 18 : reeds ? 20 : acacia ? 3 : 10;
      for (let j = 0; j < count; j++) {
        const px = x + Math.sin(j * 2.39) * w * 0.37,
          py = y + Math.cos(j * 1.87) * d * 0.38,
          ph = h * (0.6 + (j % 4) * 0.11);
        if (bamboo || reeds) {
          post(px, py, ph, bamboo ? "#5c7c43" : "#849659", bamboo ? 1.1 : 0.8);
          for (let k = 1; k < 4; k++) {
            const q = p(px, py, (ph * k) / 4);
            line(
              { x: q.x - scale * 0.8, y: q.y },
              { x: q.x + scale * 0.8, y: q.y },
              "#c0cb91",
              0.6,
            );
            polygon(
              [
                q,
                { x: q.x + (k % 2 ? 3 : -3) * scale, y: q.y - 2 * scale },
                { x: q.x + (k % 2 ? 4 : -4) * scale, y: q.y },
              ],
              j % 2 ? "#558243" : "#769950",
            );
          }
        } else if (acacia) {
          post(px, py, ph * 0.86, "#806640", 1.1);
          ring(px, py, Math.min(w * 0.45, 0.32), Math.min(d * 0.6, 0.26), "#557646", ph * 0.8);
          ring(
            px - 0.03,
            py - 0.03,
            Math.min(w * 0.33, 0.22),
            Math.min(d * 0.45, 0.18),
            "#7c9855",
            ph * 0.95,
          );
        } else {
          const q = p(px, py);
          polygon(
            [
              { x: q.x - 3 * scale, y: q.y },
              { x: q.x - 2 * scale, y: q.y - ph * 4.8 * scale * 0.6 },
              { x: q.x, y: q.y - ph * 4.8 * scale },
              { x: q.x + 3 * scale, y: q.y - ph * 4.8 * scale * 0.3 },
              { x: q.x + 2 * scale, y: q.y + scale },
            ],
            j % 2 ? "#718a4d" : "#567441",
          );
        }
      }
    }
  };
  for (const f of layout.fixtures) {
    if (f.kind === "mud") continue;
    const q = fixtureWorld(b, f);
    layers.push({ depth: q.x + q.y + 0.1, draw: guarded(() => drawFixture(f)) });
  }
  return layers;
}
