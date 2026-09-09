import {
  SIZE,
  CATALOG,
  footprint,
  access,
  isRide,
  type Park,
  type Point,
  type Kind,
} from "./simulation";
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
};
const sprites: Record<string, HTMLImageElement> = {};
export function loadSprites(base = "/assets") {
  return Promise.all(
    [
      "wheel",
      "carousel",
      "burger",
      "drink",
      "entrance",
      "toilet",
      "tree",
      "pine",
      "flowers",
      "bench",
      "guest1",
      "guest2",
      "guest3",
      "guest1-step",
      "guest2-step",
      "guest3-step",
      "car",
    ].map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const im = new Image();
          im.onload = () => {
            sprites[name] = im;
            resolve();
          };
          im.onerror = () => reject(new Error(name));
          im.src = `${base}/${name}.png`;
        }),
    ),
  );
}
export function projection(w: number, h: number, v: View) {
  const scale = Math.min(w / 1120, h / 650) * v.zoom;
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
export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Park,
  v: View,
  realTime: number,
) {
  const { scale, tw, th, project } = projection(w, h, v);
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#c7dfd1");
  bg.addColorStop(0.6, "#e3ead9");
  bg.addColorStop(1, "#e9eee3");
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
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };
  const tile = (x: number, y: number, fill: string, border?: string, inset = 0) => {
    const p = project(x, y);
    poly(
      [
        { x: p.x, y: p.y - th + inset },
        { x: p.x + tw - inset, y: p.y },
        { x: p.x, y: p.y + th - inset },
        { x: p.x - tw + inset, y: p.y },
      ],
      fill,
      border,
    );
  };
  const a = project(-0.5, 29.5),
    b = project(29.5, 29.5),
    c = project(29.5, -0.5);
  ctx.save();
  ctx.shadowBlur = 40 * scale;
  ctx.shadowColor = "#2b584144";
  ctx.shadowOffsetY = 20 * scale;
  poly([project(-0.5, -0.5), c, b, a], "#76aa64");
  ctx.restore();
  poly([a, b, { x: b.x, y: b.y + 16 * scale }, { x: a.x, y: a.y + 16 * scale }], "#557f50");
  poly([b, c, { x: c.x, y: c.y + 16 * scale }, { x: b.x, y: b.y + 16 * scale }], "#466d45");
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const type = s.tiles[y][x];
      const n = (x * 79 + y * 53) % 13;
      tile(
        x,
        y,
        type === "water"
          ? ["#63acb2", "#67b0b4", "#6bb5b8"][n % 3]
          : type === "path"
            ? "#d9c6a1"
            : type === "queue"
              ? "#c39f78"
              : ["#90b977", "#93bd7c", "#96bf7e", "#98c082"][n % 4],
        v.grid ? "#ffffff24" : undefined,
      );
      if (type === "path" || type === "queue") {
        tile(x, y, type === "queue" ? "#ead4ad" : "#eadfc6", undefined, 1.2 * scale);
        if (type === "queue") {
          const p = project(x, y);
          ctx.strokeStyle = "#486c64";
          ctx.lineWidth = 1.6 * scale;
          ctx.beginPath();
          ctx.moveTo(p.x - tw + 2 * scale, p.y - 4 * scale);
          ctx.lineTo(p.x, p.y + th - 4 * scale);
          ctx.stroke();
        }
      }
      if (type === "water" && n % 3 === 0) {
        const p = project(x, y);
        ctx.strokeStyle = "#e5ffff33";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x - 7 * scale, p.y + Math.sin(realTime / 1500 + x) * 2);
        ctx.lineTo(p.x + 7 * scale, p.y + Math.sin(realTime / 1500 + x) * 2);
        ctx.stroke();
      }
    }
  const image = (name: string, x: number, y: number, width: number, alpha = 1) => {
    const im = sprites[name];
    if (!im) return;
    const ih = (width * im.height) / im.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x - width / 2, y - ih, width, ih);
    ctx.restore();
  };
  const track = (points: Point[], ghost = false) => {
    if (points.length < 2) return;
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        top = project(p.x, p.y, p.z ?? 0),
        bottom = project(p.x, p.y);
      if ((p.z ?? 0) > 0 && i % 2 === 0) {
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = ghost ? "#fff7" : "#d5ded0";
        ctx.beginPath();
        ctx.moveTo(bottom.x - 3 * scale, bottom.y);
        ctx.lineTo(top.x, top.y);
        ctx.lineTo(bottom.x + 5 * scale, bottom.y);
        ctx.stroke();
      }
    }
    const line = (offset: number, color: string, width: number) => {
      ctx.beginPath();
      points.forEach((p, i) => {
        const pt = project(p.x, p.y, p.z ?? 0);
        if (i) ctx.lineTo(pt.x + offset * scale, pt.y);
        else ctx.moveTo(pt.x + offset * scale, pt.y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width * scale;
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    line(0, ghost ? "#fdf5cc" : "#285b56", 9);
    line(0, ghost ? "#ffcf63" : "#dcd5b5", 5);
    line(-3, ghost ? "#fff" : "#e78153", 2.2);
    line(3, ghost ? "#fff" : "#f1a26a", 2.2);
    for (let i = 1; i < points.length; i++) {
      const a = project(points[i - 1].x, points[i - 1].y, points[i - 1].z ?? 0),
        b = project(points[i].x, points[i].y, points[i].z ?? 0);
      for (let t = 0.2; t < 1; t += 0.3) {
        ctx.strokeStyle = "#385d53";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * t - 4 * scale, a.y + (b.y - a.y) * t);
        ctx.lineTo(a.x + (b.x - a.x) * t + 4 * scale, a.y + (b.y - a.y) * t);
        ctx.stroke();
      }
    }
  };
  const objects: Array<{ depth: number; draw: () => void }> = [];
  for (const building of s.buildings) {
    const d = CATALOG[building.kind],
      n = d.size;
    objects.push({
      depth: building.x + building.y + n,
      draw: () => {
        const p = project(building.x + (n - 1) / 2, building.y + (n - 1) / 2);
        if (building.id === v.selected)
          for (const t of footprint(building)) tile(t.x, t.y, "#fff4bf66", "#f6dfa1");
        if (building.kind === "coaster") {
          track(building.track ?? []);
          if (building.track) {
            const pts = building.track;
            const progress = building.testing
              ? 1 - building.testing / 8
              : building.open && building.riders.length && access(s, building)
                ? 1 - building.cycle / d.duration
                : 0;
            const t = Math.max(0, Math.min(0.99999, progress)) * (pts.length - 1),
              i = Math.floor(t),
              f = t - i,
              pa = pts[i],
              pb = pts[i + 1];
            const q = project(
              pa.x + (pb.x - pa.x) * f,
              pa.y + (pb.y - pa.y) * f,
              (pa.z ?? 0) + ((pb.z ?? 0) - (pa.z ?? 0)) * f,
            );
            image("car", q.x, q.y + 4 * scale, 25 * scale);
          }
          const st = project(building.x, building.y);
          image("entrance", st.x, st.y + 6 * scale, 31 * scale);
        } else
          image(
            d.sprite,
            p.x,
            p.y + th * n * 0.55,
            tw *
              (building.kind === "wheel"
                ? 5.4
                : building.kind === "carousel"
                  ? 3.9
                  : building.kind === "tree"
                    ? 1.9
                    : building.kind === "pine"
                      ? 1.55
                      : building.kind === "flowers"
                        ? 1.55
                        : building.kind === "bench"
                          ? 1.3
                          : 2.15),
          );
        if (isRide(building.kind) && (!building.open || !access(s, building))) {
          ctx.fillStyle = "#fcf7e9";
          ctx.beginPath();
          ctx.arc(p.x, p.y - 25 * scale, 9 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#b67432";
          ctx.font = `bold ${12 * scale}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("!", p.x, p.y - 21 * scale);
        }
      },
    });
  }
  for (const g of s.guests) {
    if (g.state === "ride") continue;
    objects.push({
      depth: g.x + g.y + 0.8,
      draw: () => {
        const p = project(g.x + ((g.id % 5) - 0.5) * 0.045, g.y);
        const hop =
          g.state === "walk" && g.route.length ? Math.sin(s.time * 11 + g.id) * 0.9 * scale : 0;
        const walking = g.state === "walk" && g.route.length > 0;
        const pose = walking && Math.floor(s.time * 6 + g.id) % 2 === 1 ? "-step" : "";
        image("guest" + (g.skin + 1) + pose, p.x, p.y + 2 * scale + hop, 10 * scale);
      },
    });
  }
  objects.sort((a, b) => a.depth - b.depth).forEach((o) => o.draw());
  const ep = project(15, 29);
  image("entrance", ep.x, ep.y + 9 * scale, 95 * scale);
  if (v.draft.length) {
    track(v.draft, true);
    v.draft.forEach((p, i) => {
      const q = project(p.x, p.y, p.z ?? 0);
      ctx.fillStyle = i === 0 ? "#fff" : "#ffc358";
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3.3 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (v.hover && v.tool !== "select") {
    const { x, y } = v.hover;
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) {
      const d = CATALOG[v.tool as Kind];
      const n = d?.size ?? 1;
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++)
          tile(x + a, y + b, v.tool === "erase" ? "#e5756377" : "#fff4c66b", "#fffce6");
      if (d && v.tool !== "coaster") {
        const p = project(x + (n - 1) / 2, y + (n - 1) / 2);
        image(d.sprite, p.x, p.y + th * n * 0.5, tw * (n * 1.65 + 0.4), 0.65);
      }
    }
  }
}
