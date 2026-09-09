import assert from "node:assert/strict";
import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  C = await import(moduleURL("game/construction.ts"));
if (!E.batchTrackRemovalPlan || !E.removeTrackSections) throw Error("Batch API not ready");
const batchPlan = (s, id, indices, clear = true) =>
  E.batchTrackRemovalPlan(
    s,
    s.buildings.find((b) => b.id === id),
    indices,
    clear,
  );
const fixture = (style) => {
  const s = S.newPark("sandbox");
  s.guests = [];
  s.cash = 1e6;
  const b = s.buildings.find((b) => b.kind === "coaster");
  if (style) {
    s.buildings = [b];
    s.tiles = Array.from({ length: 30 }, () => Array(30).fill("grass"));
    b.x = 14;
    b.y = 14;
    b.track = P.prefabBlueprint(b, 0, style);
  }
  b.open = true;
  b.tested = true;
  return { s, b };
};
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)) < 1e-8;
const rows = [];
for (const [style, indices] of [
  [null, [0, 4, 10]],
  ["steel", [1, 2, 7, 12]],
  ["launch", [2, 8, 14]],
]) {
  const { s, b } = fixture(style),
    before = JSON.stringify(s),
    original = E.editableTrack(b),
    sections = E.trackSections(original),
    selected = new Set(indices),
    start = performance.now(),
    plan = batchPlan(s, b.id, indices),
    ms = performance.now() - start;
  const row = { style: style ?? "legacy", indices, ms, ...plan };
  delete row.track;
  row.connectionPoints = plan.connections.map((x) => x.length);
  delete row.connections;
  assert.equal(JSON.stringify(s), before, "Planning mutated source");
  assert.equal(plan.error, null, plan.error);
  if (!plan.error) {
    assert.equal(
      S.validateTrack({ ...s, buildings: s.buildings.filter((x) => x.id !== b.id) }, plan.track),
      null,
    );
    assert.equal(plan.connections.length, plan.groups.length);
    [...plan.groups].reverse().forEach((group, i) => {
      const connector = plan.connections[i];
      assert(same(connector[0], original[sections[group.from].start]));
      assert(same(connector.at(-1), original[sections[group.to].end]));
    });
    let kept = 0;
    sections.forEach((sec, i) => {
      if (!selected.has(i))
        for (let j = sec.start; j < sec.end; j++) {
          const a = original[j],
            c = original[j + 1],
            at = plan.track.findIndex(
              (p, k) => k < plan.track.length - 1 && same(a, p) && same(c, plan.track[k + 1]),
            );
          assert(at >= 0, `Lost original unselected edge section${i} point${j}`);
          assert.deepEqual(plan.track[at].drive, a.drive);
          kept++;
        }
    });
    row.keptEdges = kept;
    const cash = s.cash,
      track = JSON.stringify(b.track),
      rec = C.recordEdit(s, "multiple cuts", () => {
        assert.equal(E.removeTrackSections(s, b, indices, true), null);
      });
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
    S.tick(s, 0.5);
    const time = s.time;
    C.undoEdits(s, [rec]);
    assert.equal(JSON.stringify(b.track), track);
    assert.equal(s.cash, cash);
    assert.equal(s.time, time);
    assert(b.open && b.tested);
    row.undo = "pass";
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
{
  const { s, b } = fixture("steel");
  s.cash = 0;
  const before = JSON.stringify(s),
    plan = batchPlan(s, b.id, [1, 7]);
  assert(plan.error);
  assert.equal(JSON.stringify(s), before);
  rows.push({
    test: "Insufficient total budget atomic",
    pass: true,
    cost: plan.cost,
    error: plan.error,
  });
}
{
  const { s, b } = fixture("steel"),
    before = JSON.stringify(s),
    plan = batchPlan(s, b.id, [1, 999]);
  assert(plan.error);
  assert.equal(JSON.stringify(s), before);
  rows.push({ test: "Invalid multi-selection atomic", pass: true, error: plan.error });
}
{
  const { s, b } = fixture("steel");
  const before = JSON.stringify(s),
    a = batchPlan(s, b.id, [12, 1, 7, 1, 12]),
    c = batchPlan(s, b.id, [1, 7, 12]);
  assert.equal(a.error, null);
  assert.deepEqual(a.track, c.track);
  assert.equal(a.cost, c.cost);
  assert.equal(JSON.stringify(s), before);
  rows.push({ test: "Duplicate reversed selections deterministic", pass: true });
}
{
  const { s, b } = fixture("steel");
  s.cash = 0;
  const before = JSON.stringify(s);
  assert(E.removeTrackSections(s, b, [1, 7], true));
  assert.equal(JSON.stringify(s), before);
  rows.push({ test: "Failed mutation is fully atomic", pass: true });
}
{
  const { s, b } = fixture("steel");
  E.beginTrackEdit(s, b, 1, 1);
  const before = JSON.stringify(s);
  assert(batchPlan(s, b.id, [7, 12]).error);
  assert(E.removeTrackSections(s, b, [7, 12], true));
  assert.equal(JSON.stringify(s), before);
  rows.push({ test: "Existing draft untouched on rejected multi-edit", pass: true });
}
{
  const { s, b } = fixture("steel");
  const value = { kind: "boost", speed: 71, strength: 3 };
  E.installTrackDrive(s, b, 17, 17, value);
  const payload = b.track.filter((p) => p.drive).map((p) => [p.x, p.y, p.z, p.drive]);
  assert.equal(E.removeTrackSections(s, b, [1, 7, 12], true), null);
  assert.deepEqual(
    b.track.filter((p) => p.drive).map((p) => [p.x, p.y, p.z, p.drive]),
    payload,
  );
  rows.push({ test: "Unselected booster metadata fully retained", pass: true });
}
{
  const { s, b } = fixture("steel");
  const a = b.track[0],
    c = b.track[1],
    extra = Array.from({ length: 1790 }, (_, i) => {
      const t = 0.4 + (0.08 * (i + 1)) / 1791;
      return {
        ...a,
        x: a.x + (c.x - a.x) * t,
        y: a.y + (c.y - a.y) * t,
        z: (a.z ?? 0) + ((c.z ?? 0) - (a.z ?? 0)) * t,
      };
    });
  b.track = [a, ...extra, ...b.track.slice(1)];
  const before = JSON.stringify(s),
    start = performance.now();
  const plan = batchPlan(s, b.id, [1, 4, 7, 12, 15]);
  assert(plan.error);
  assert.equal(JSON.stringify(s), before);
  assert(E.removeTrackSections(s, b, [1, 4, 7, 12, 15], true));
  assert.equal(JSON.stringify(s), before);
  rows.push({
    test: "Late point-limit failure after internal successes stays atomic",
    pass: true,
    ms: performance.now() - start,
    error: plan.error,
  });
}
{
  for (const style of [undefined, "steel", "launch"]) {
    const { s, b } = fixture(style),
      count = E.trackSections(E.editableTrack(b)).length,
      original = E.editableTrack(b),
      oldAnchor = { x: b.x, y: b.y },
      before = JSON.stringify(s);
    const plan = batchPlan(s, b.id, [0, count - 1]);
    assert.equal(plan.error, null, plan.error);
    assert.equal(JSON.stringify(s), before);
    assert.equal(E.removeTrackSections(s, b, [0, count - 1], true), null);
    assert.deepEqual({ x: b.x, y: b.y }, oldAnchor);
    assert(same(b.track[0], original[0]));
    assert(same(b.track.at(-1), b.track[0]));
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
    rows.push({
      test: "First and last section selected together " + (style ?? "legacy"),
      pass: true,
      cost: plan.cost,
    });
  }
}
{
  for (const style of [undefined, "steel"]) {
    const { s, b } = fixture(style),
      count = E.trackSections(E.editableTrack(b)).length,
      indices = Array.from({ length: count }, (_, i) => i),
      before = JSON.stringify(s);
    const plan = batchPlan(s, b.id, indices);
    assert(plan.error, "All-selected plan must fail");
    assert(E.removeTrackSections(s, b, indices, true), "All-selected mutation must fail");
    assert.equal(JSON.stringify(s), before);
    rows.push({
      test: "All-selected rejected atomically " + (style ?? "legacy"),
      pass: true,
      error: plan.error,
    });
  }
}
{
  const { s, b } = fixture("steel"),
    rich = batchPlan(s, b.id, [1, 7, 12]);
  assert.equal(rich.error, null);
  s.cash = 0;
  const poor = batchPlan(s, b.id, [1, 7, 12]);
  assert(poor.error);
  assert.equal(poor.cost, rich.cost, "Budget preview should retain full total");
  rows.push({ test: "Insufficient budget still quotes full total", pass: true, cost: poor.cost });
}

console.log(`${rows.length}/${rows.length} API scenarios passed`);
