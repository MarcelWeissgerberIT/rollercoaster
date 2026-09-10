import { recordMarketingRevenue } from "./marketing";
import { canAfford, spendCash, creditCash } from "./budget";
import type { Park, Point, Building, Guest } from "./simulation";
import { connected, exitFromCells, exitNetwork } from "./walkways";
import { podPort } from "./pods";
import { pathRoute, insideMap } from "./grid";
export type TransitKind = "train" | "shuttle";
export type TransitLine = {
  id: number;
  kind: TransitKind;
  a: number;
  b: number;
  route: Point[];
  position: number;
  direction: 1 | -1;
  wait: number;
  passengers: number[];
  trips: number;
  served: number;
  revenue: number;
  enabled: boolean;
  fault?: string;
};
export type GuestTransit = { line: number; from: number; to: number; fare?: number };
export const isTransport = (kind: string): kind is TransitKind =>
  kind === "train" || kind === "shuttle";
export const transportSpeed = (kind: TransitKind) => (kind === "train" ? 2.6 : 3.2);
export const transportCapacity = (kind: TransitKind) => (kind === "train" ? 12 : 8);
export function stopAccess(s: Park, b: Building) {
  const line = s.transitLines?.find((l) => l.a === b.id || l.b === b.id),
    saved = line && (line.a === b.id ? line.route[0] : line.route.at(-1));
  const adjacent = (p: Point) =>
    Math.abs(p.x - b.x) + Math.abs(p.y - b.y) === 1 &&
    insideMap(s, p.x, p.y) &&
    s.tiles[p.y][p.x] === "path";
  return saved && adjacent(saved)
    ? saved
    : [
        [0, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
      ]
        .map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy }))
        .find(adjacent);
}
function stopExit(s: Park, b: Building) {
  if (b.pods) {
    const p = podPort(b, 1, b.pods.exit),
      net = connected(s);
    return s.tiles[p.y]?.[p.x] === "path" && net.has(`${p.x},${p.y}`)
      ? [p]
      : exitFromCells([p], exitNetwork(s, net));
  }
  return exitFromCells(
    [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ].map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy })),
    exitNetwork(s),
  );
}
export function stopEntrance(s: Park, b: Building) {
  if (!b.pods) return stopAccess(s, b);
  const p = podPort(b, 1, b.pods.entry);
  return connected(s).has(`${p.x},${p.y}`) && ["path", "queue"].includes(s.tiles[p.y]?.[p.x])
    ? p
    : undefined;
}
export function transitPlan(s: Park, a: Building, b: Building) {
  if (!isTransport(a.kind) || b.kind !== a.kind || a.id === b.id)
    return {
      route: [] as Point[],
      cost: 0,
      error: "Wähle zwei verschiedene Halte desselben Verkehrsmittels.",
    };
  if (s.transitLines?.some((l) => [l.a, l.b].some((id) => id === a.id || id === b.id)))
    return { route: [], cost: 0, error: "Ein Halt gehört bereits zu einer Linie." };
  const start = stopAccess(s, a),
    end = stopAccess(s, b),
    route = start && end ? pathRoute(s, start, end) : [];
  if (route.length < 6)
    return {
      route,
      cost: 0,
      error: "Verbinde zwei mindestens fünf Wegfelder entfernte Halte mit durchgehenden Parkwegen.",
    };
  const cost = route.length * (a.kind === "train" ? 32 : 8);
  return {
    route,
    cost,
    error: !canAfford(s, cost) ? "Für die Linie reicht das Budget noch nicht." : null,
  };
}
export function createTransitLine(s: Park, a: Building, b: Building): string | null {
  const plan = transitPlan(s, a, b);
  if (plan.error) return plan.error;
  spendCash(s, plan.cost);
  s.expenses += plan.cost;
  s.dayExpenses += plan.cost;
  (s.transitLines ??= []).push({
    id: s.nextId++,
    kind: a.kind as TransitKind,
    a: a.id,
    b: b.id,
    route: plan.route,
    position: 0,
    direction: 1,
    wait: 4,
    passengers: [],
    trips: 0,
    served: 0,
    revenue: 0,
    enabled: true,
  });
  a.open = b.open = true;
  return null;
}
export function transportClock(line: TransitLine) {
  const v = transportSpeed(line.kind),
    length = line.route.length - 1,
    leg = length / v + 4;
  return line.direction === 1
    ? line.wait > 0
      ? 4 - line.wait
      : 4 + line.position / v
    : line.wait > 0
      ? leg + 4 - line.wait
      : leg + 4 + (length - line.position) / v;
}
export function transportPose(line: TransitLine, time?: number) {
  const length = line.route.length - 1,
    v = transportSpeed(line.kind),
    leg = length / v + 4;
  let distance = line.position,
    direction = line.direction;
  if (time !== undefined) {
    const phase = ((time % (leg * 2)) + leg * 2) % (leg * 2);
    direction = phase < leg ? 1 : -1;
    distance =
      direction === 1
        ? Math.min(length, Math.max(0, phase - 4) * v)
        : Math.max(0, length - Math.max(0, phase - leg - 4) * v);
  }
  const i = Math.min(Math.max(0, line.route.length - 2), Math.floor(distance)),
    a = line.route[i] ?? { x: 0, y: 0 },
    b = line.route[i + 1] ?? a,
    f = distance - i;
  const sample = (d: number) => {
    d = Math.max(0, Math.min(length, d));
    const j = Math.min(length - 1, Math.floor(d)),
      a = line.route[j],
      b = line.route[j + 1],
      f = d - j;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  const before = sample(distance - 0.4),
    after = sample(distance + 0.4),
    hx = after.x - before.x,
    hy = after.y - before.y,
    norm = Math.hypot(hx, hy) || 1;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    dx: (hx / norm) * direction,
    dy: (hy / norm) * direction,
    headingX: hx / norm,
    headingY: hy / norm,
    direction,
  };
}
export function transitValid(s: Park, line: TransitLine) {
  const a = s.buildings.find((b) => b.id === line.a),
    b = s.buildings.find((b) => b.id === line.b),
    start = a && stopAccess(s, a),
    end = b && stopAccess(s, b);
  return !!(
    a?.open &&
    b?.open &&
    a.kind === line.kind &&
    b.kind === line.kind &&
    start &&
    end &&
    line.route[0]?.x === start.x &&
    line.route[0]?.y === start.y &&
    line.route.at(-1)?.x === end.x &&
    line.route.at(-1)?.y === end.y &&
    line.route.length >= 6 &&
    line.route.every(
      (p, i) =>
        Number.isInteger(p.x) &&
        Number.isInteger(p.y) &&
        insideMap(s, p.x, p.y) &&
        s.tiles[p.y][p.x] === "path" &&
        (i === 0 ||
          Math.abs(p.x - line.route[i - 1].x) + Math.abs(p.y - line.route[i - 1].y) === 1),
    )
  );
}
export function releaseTransit(s: Park, g: Guest, line: TransitLine) {
  const stop = s.buildings.find(
      (b) => b.id === (line.position < (line.route.length - 1) / 2 ? line.a : line.b),
    ),
    p = stop && stopAccess(s, stop);
  const fallback = line.route.find(
    (p) => insideMap(s, p.x, p.y) && s.tiles[p.y][p.x] === "path",
  ) ?? { x: 15, y: 29 };
  if (line.passengers.includes(g.id)) {
    g.x = (p ?? fallback).x;
    g.y = (p ?? fallback).y;
  }
  g.transit = undefined;
  g.state = "walk";
  g.route = [];
  g.timer = 0;
}
/** Removing a destination does not remove someone from an unrelated moving vehicle. */
export function cancelTransitDestination(s: Park, g: Guest) {
  if (!g.transit) return false;
  g.target = null;
  g.route = [];
  if (g.state === "ride") return true;
  const from = s.buildings.find((b) => b.id === g.transit!.from);
  if (from) from.queue = from.queue.filter((id) => id !== g.id);
  g.transit = undefined;
  g.state = "walk";
  g.timer = 0;
  return true;
}
export function tickTransit(s: Park, dt: number) {
  for (const line of s.transitLines ?? []) {
    if (!line.enabled || !transitValid(s, line)) {
      line.fault = !line.enabled
        ? "Linie pausiert."
        : "Ein Halt oder ein durchgehender Parkweg fehlt.";
      for (const g of s.guests)
        if (g.transit?.line === line.id) {
          releaseTransit(s, g, line);
          g.thought = "Die Verbindung ist unterbrochen. Ich gehe zu Fuß.";
        }
      for (const b of s.buildings) if (b.id === line.a || b.id === line.b) b.queue = [];
      line.passengers = [];
      line.position = line.position < (line.route.length - 1) / 2 ? 0 : line.route.length - 1;
      line.direction = line.position === 0 ? 1 : -1;
      line.wait = 4;
      continue;
    }
    line.fault = undefined;
    let remaining = dt;
    while (remaining > 1e-9) {
      if (line.wait > 0) {
        const used = Math.min(line.wait, remaining);
        line.wait -= used;
        remaining -= used;
        if (line.wait > 0) break;
        const from = line.direction === 1 ? line.a : line.b,
          to = line.direction === 1 ? line.b : line.a,
          stop = s.buildings.find((b) => b.id === from)!;
        while (stop.queue.length && line.passengers.length < transportCapacity(line.kind)) {
          const id = stop.queue.shift()!,
            g = s.guests.find((g) => g.id === id);
          if (!g || g.transit?.line !== line.id) continue;
          if ((g.wallet ?? 60) < stop.price) {
            g.transit = undefined;
            g.state = "walk";
            g.timer = 0;
            g.thought = "Ich gehe lieber zu Fuß.";
            continue;
          }
          g.transit = { line: line.id, from, to, fare: stop.price };
          g.state = "ride";
          line.passengers.push(id);
        }
      }
      const length = line.route.length - 1,
        v = transportSpeed(line.kind),
        travel = Math.min(
          remaining,
          (line.direction === 1 ? length - line.position : line.position) / v,
        );
      line.position = Math.max(0, Math.min(length, line.position + line.direction * v * travel));
      remaining -= travel;
      if (
        (line.direction === 1 && line.position >= length) ||
        (line.direction === -1 && line.position <= 0)
      ) {
        const destination = s.buildings.find(
            (b) => b.id === (line.direction === 1 ? line.b : line.a),
          )!,
          outgoing = stopExit(s, destination),
          p = outgoing[0] ?? stopAccess(s, destination)!;
        for (const id of line.passengers) {
          const g = s.guests.find((g) => g.id === id);
          if (!g) continue;
          const fare = g.transit?.fare ?? 0,
            origin = s.buildings.find((b) => b.id === g.transit?.from);
          g.wallet = Math.max(0, (g.wallet ?? 60) - fare);
          g.x = p.x;
          g.y = p.y;
          g.state = "walk";
          g.transit = undefined;
          g.timer = 0.5;
          g.route = outgoing.slice(1);
          g.thought = "Gut angekommen – weiter zu meiner Attraktion.";
          line.served++;
          line.revenue += fare;
          recordMarketingRevenue(s, g, fare, "ride");
          creditCash(s, fare);
          s.income += fare;
          s.dayIncome += fare;
          s.operatingIncomeToday = (s.operatingIncomeToday ?? 0) + fare;
          if (origin) {
            origin.served++;
            origin.revenue += fare;
          }
        }
        line.passengers = [];
        line.trips++;
        line.direction = line.direction === 1 ? -1 : 1;
        line.wait = 4;
      }
    }
  }
}
/** Only use a transport connection when total door-to-door travel time is better than walking. */
export function chooseTransit(s: Park, g: Guest, goal: Point, walking: Point[]) {
  if (walking.length < 18) return false;
  let best: {
    line: TransitLine;
    from: Building;
    to: Building;
    walk: Point[];
    time: number;
  } | null = null;
  for (const line of s.transitLines ?? []) {
    if (!line.enabled || !transitValid(s, line)) continue;
    for (const [fromId, toId] of [
      [line.a, line.b],
      [line.b, line.a],
    ]) {
      const from = s.buildings.find((b) => b.id === fromId)!,
        to = s.buildings.find((b) => b.id === toId)!,
        a = stopEntrance(s, from),
        b = stopAccess(s, to)!;
      if (!a) continue;
      if (from.price > (g.wallet ?? 60) || from.queue.length >= 16) continue;
      const first = pathRoute(s, g, a, true),
        outgoing = stopExit(s, to),
        last = pathRoute(s, outgoing.at(-1) ?? b, goal, true);
      if (!first.length || !last.length) continue;
      const length = line.route.length - 1,
        v = transportSpeed(line.kind),
        leg = length / v + 4,
        walkSpeed = 1 + (g.id % 7) * 0.065,
        arrive = (first.length - 1) / walkSpeed;
      const phase =
        line.direction === 1
          ? line.wait > 0
            ? 4 - line.wait
            : 4 + line.position / v
          : line.wait > 0
            ? leg + 4 - line.wait
            : leg + 4 + (length - line.position) / v;
      let depart = (fromId === line.a ? 4 : leg + 4) - phase;
      while (depart < arrive - 1e-8) depart += leg * 2;
      depart += Math.floor(from.queue.length / transportCapacity(line.kind)) * leg * 2;
      const time =
        depart + length / v + (last.length - 1 + Math.max(0, outgoing.length - 1)) / walkSpeed;
      if (time < walking.length / walkSpeed - 3 && (!best || time < best.time))
        best = { line, from, to, walk: first.slice(1), time };
    }
  }
  if (!best) return false;
  g.transit = { line: best.line.id, from: best.from.id, to: best.to.id };
  g.route = best.walk;
  if (!g.route.length) {
    g.state = "queue";
    g.timer = 0;
    if (!best.from.queue.includes(g.id)) best.from.queue.push(g.id);
  }
  g.thought = `Ich nehme ${best.line.kind === "train" ? "die Parkbahn" : "den Shuttle"}.`;
  return true;
}

export function repairTransitPlan(s: Park, line: TransitLine) {
  const a = s.buildings.find((b) => b.id === line.a),
    b = s.buildings.find((b) => b.id === line.b);
  if (!a || !b) return { route: [] as Point[], cost: 0, error: "Ein Halt fehlt." };
  const virtual = {
      ...s,
      mode: "sandbox" as const,
      unlimitedBudget: true,
      transitLines: s.transitLines?.filter((l) => l.id !== line.id),
    },
    plan = transitPlan(virtual, a, b);
  const known = new Set(line.route.map((p) => `${p.x},${p.y}`)),
    cost =
      plan.route.filter((p) => !known.has(`${p.x},${p.y}`)).length *
      (line.kind === "train" ? 32 : 8);
  return {
    ...plan,
    cost,
    error:
      plan.error ??
      (!canAfford(s, cost) ? "Das Budget reicht für die neue Verbindung noch nicht." : null),
  };
}
export function repairTransit(s: Park, line: TransitLine) {
  const plan = repairTransitPlan(s, line);
  if (plan.error) return plan.error;
  for (const g of s.guests) if (g.transit?.line === line.id) releaseTransit(s, g, line);
  for (const b of s.buildings)
    if (b.id === line.a || b.id === line.b) {
      b.queue = [];
      b.open = true;
    }
  line.route = plan.route;
  line.position = 0;
  line.direction = 1;
  line.wait = 4;
  line.passengers = [];
  line.enabled = true;
  line.fault = undefined;
  spendCash(s, plan.cost);
  s.expenses += plan.cost;
  s.dayExpenses += plan.cost;
  return null;
}

/** Keep an articulated train entirely on the route, including both terminal platforms. */
export function transportCarPose(line: TransitLine, car: number, time?: number) {
  if (line.kind !== "train") return transportPose(line, time);
  const pose = transportPose(line, time),
    length = line.route.length - 1,
    span = 2.7;
  // Recover the same clock's travelled distance without relying on x/y (a route can turn).
  const leg = length / transportSpeed(line.kind) + 4,
    phase = time === undefined ? transportClock(line) : ((time % (leg * 2)) + leg * 2) % (leg * 2);
  const distance =
    phase < leg
      ? Math.min(length, Math.max(0, phase - 4) * transportSpeed(line.kind))
      : Math.max(0, length - Math.max(0, phase - leg - 4) * transportSpeed(line.kind));
  const position = (distance / Math.max(1, length)) * (length - span) + span - car * 0.9;
  return transportPose({ ...line, position, direction: pose.direction });
}
