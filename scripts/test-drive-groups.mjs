import assert from "node:assert/strict";

import { moduleURL } from "./ts-loader.mjs";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
const S = await import(moduleURL("game/simulation.ts")),
  E = await import(moduleURL("game/track-edit.ts")),
  C = await import(moduleURL("game/construction.ts")),
  P = await import(moduleURL("game/prefabs.ts")),
  M = await import(moduleURL("game/motion.ts"));
if (!E.driveSections || !E.trackDriveGroups)
  throw Error("Root API not available yet: driveSections / trackDriveGroups");
const A = { kind: "boost", speed: 53, strength: 7 },
  B = { kind: "boost", speed: 71, strength: 3 },
  BRAKE = { kind: "brake", speed: 8, strength: 1 };
const fixture = (legacy = true) => {
  const s = S.newPark("sandbox");
  s.guests = [];
  const b = s.buildings.find((b) => b.kind === "coaster");
  if (!legacy) b.track = P.prefabBlueprint({ x: 14, y: 14 }, 0, "steel");
  s.cash = 1e6;
  return { s, b };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
const len = (t) =>
  t.slice(0, -1).reduce((sum, p, i) => sum + (p.drive ? distance(p, t[i + 1]) : 0), 0);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const groups = (b) => E.trackDriveGroups(b);
const currentGroup = (b, drive) => groups(b).find((g) => same(g.drive, drive));
const strip = (t) => JSON.parse(JSON.stringify(t.map(({ drive, ...p }) => p)));
const tests = [];
const test = (name, fn) => {
  try {
    tests.push({ name, pass: true, evidence: fn() });
  } catch (e) {
    tests.push({ name, pass: false, error: e.message.slice(0, 1200) });
  }
};
function seedLegacyModule(b) {
  const start = b.track.findIndex((p) => p.x === 24 && p.y === 6),
    end = b.track.findIndex((p) => p.x === 24 && p.y === 7);
  assert(start >= 0 && end > start);
  b.track = b.track.map((p, i) => ({
    ...p,
    ...(i >= start && i < end ? { drive: { ...A } } : {}),
  }));
  b.track[b.track.length - 1] = { ...b.track[0] };
}
function wholeGroupUpdate(s, b, which, value) {
  const g = currentGroup(b, which);
  assert(g, `No group ${JSON.stringify(which)}; ${JSON.stringify(groups(b))}`);
  const plan = E.trackDrivePlan(b, g.from, g.to, value);
  assert.equal(plan.error, null);
  assert.equal(E.installTrackDrive(s, b, g.from, g.to, value), null);
  return plan;
}
for (const legacy of [true, false]) {
  test(`${legacy ? "legacy" : "prefab"} new installation exactly covers selected dense edges`, () => {
    const { s, b } = fixture(legacy),
      before = E.editableTrack(b),
      sec = E.driveSections(before)[4];
    const expected = before.slice(sec.start, sec.end).map((p) => [p.x, p.y, p.z]);
    assert.equal(E.installTrackDrive(s, b, 4, 4, A), null);
    assert.deepEqual(strip(b.track), strip(before));
    const actual = b.track
      .slice(0, -1)
      .filter((p) => p.drive)
      .map((p) => [p.x, p.y, p.z]);
    assert.deepEqual(actual, expected);
    assert.equal(groups(b).length, 1);
    return { edges: actual.length, group: groups(b)[0] };
  });
  test(`${legacy ? "legacy" : "prefab"} grouped settings update for zero cash and remove all`, () => {
    const { s, b } = fixture(legacy);
    assert.equal(E.installTrackDrive(s, b, 4, 5, A), null);
    const geo = strip(b.track),
      cash = s.cash;
    assert.equal(groups(b).length, 1);
    assert.equal(wholeGroupUpdate(s, b, A, B).cost, 0);
    assert.equal(s.cash, cash);
    assert.equal(groups(b).length, 1);
    assert.equal(groups(b)[0].drive.speed, 71);
    assert(
      b.track
        .slice(0, -1)
        .filter((p) => p.drive)
        .every((p) => same(p.drive, B)),
    );
    const plan = wholeGroupUpdate(s, b, B, null);
    assert(plan.cost < 0);
    assert.equal(len(b.track), 0);
    assert.equal(groups(b).length, 0);
    assert.deepEqual(strip(b.track), geo);
    assert.deepEqual(b.track[0], b.track.at(-1));
    assert(S.validSave(JSON.parse(JSON.stringify(s))));
  });
  test(`${legacy ? "legacy" : "prefab"} adjacent different modules remain independently editable`, () => {
    const { s, b } = fixture(legacy);
    assert.equal(E.installTrackDrive(s, b, 4, 4, A), null);
    assert.equal(E.installTrackDrive(s, b, 5, 5, B), null);
    assert.equal(groups(b).length, 2);
    const second = b.track.filter((p) => same(p.drive, B)).map((p) => [p.x, p.y, p.z]);
    wholeGroupUpdate(s, b, A, null);
    assert.equal(groups(b).length, 1);
    assert.deepEqual(
      b.track.filter((p) => same(p.drive, B)).map((p) => [p.x, p.y, p.z]),
      second,
    );
    wholeGroupUpdate(s, b, B, BRAKE);
    assert.equal(groups(b).length, 1);
    assert(currentGroup(b, BRAKE));
  });
  test(`${legacy ? "legacy" : "prefab"} live undo restores removed settings, cash, geometry and open state`, () => {
    const { s, b } = fixture(legacy);
    assert.equal(E.installTrackDrive(s, b, 4, 5, A), null);
    b.tested = true;
    b.open = true;
    const track = JSON.stringify(b.track),
      cash = s.cash;
    const record = C.recordEdit(s, "remove module", () => wholeGroupUpdate(s, b, A, null));
    assert(record);
    S.tick(s, 0.5);
    const time = s.time;
    C.undoEdits(s, [record]);
    assert.equal(JSON.stringify(b.track), track);
    assert.equal(s.cash, cash);
    assert.equal(s.time, time);
    assert(b.open && b.tested);
  });
}
test("Pre-release legacy shifted module becomes one directly editable complete group", () => {
  const { s, b } = fixture();
  seedLegacyModule(b);
  const before = E.editableTrack(b),
    oldlen = len(before);
  const g = currentGroup(b, A);
  assert(g);
  const sections = E.driveSections(before);
  const selected = before.slice(sections[g.from].start, sections[g.to].end + 1);
  assert(Math.abs(len(selected) - oldlen) < 1e-8);
  assert.equal(wholeGroupUpdate(s, b, A, B).cost, 0);
  assert(Math.abs(len(b.track) - oldlen) < 1e-8);
  assert(!b.track.some((p) => p.drive?.speed === 53));
  wholeGroupUpdate(s, b, B, null);
  assert.equal(len(b.track), 0);
  return { oldlen, from: g.from, to: g.to };
});
test("Legacy old module survives unrelated station installation and removes without remnant", () => {
  const { s, b } = fixture();
  seedLegacyModule(b);
  const oldlen = len(E.editableTrack(b));
  assert.equal(E.installTrackDrive(s, b, 0, 0, BRAKE), null);
  assert.equal(groups(b).length, 2);
  const brakeLength = b.track
    .slice(0, -1)
    .reduce((sum, p, i) => sum + (p.drive?.kind === "brake" ? distance(p, b.track[i + 1]) : 0), 0);
  wholeGroupUpdate(s, b, A, null);
  assert(!b.track.some((p) => p.drive?.kind === "boost"));
  assert(Math.abs(len(b.track) - brakeLength) < 1e-8);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  return { oldlen, brakeLength };
});
test("Groups at station start/end remain removable with duplicate metadata consistent", () => {
  const { s, b } = fixture(false);
  const n = E.driveSections(E.editableTrack(b)).length;
  E.installTrackDrive(s, b, 0, 0, A);
  E.installTrackDrive(s, b, n - 1, n - 1, A);
  let count = 0;
  while (groups(b).length) {
    const g = groups(b)[0];
    assert.equal(E.installTrackDrive(s, b, g.from, g.to, null), null);
    if (++count > 3) throw Error("Group removal made no progress");
  }
  assert.equal(len(b.track), 0);
  assert.deepEqual(b.track.at(-1), b.track[0]);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  return { operations: count };
});
test("Save/resume retains exact groups and updates existing old module", () => {
  const { s, b } = fixture();
  seedLegacyModule(b);
  assert(S.validSave(JSON.parse(JSON.stringify(s))));
  const loaded = S.migratePark(JSON.parse(JSON.stringify(s)));
  const live = loaded.buildings.find((x) => x.id === b.id);
  assert.deepEqual(groups(live), groups(b));
  wholeGroupUpdate(loaded, live, A, B);
  assert(S.validSave(JSON.parse(JSON.stringify(loaded))));
  wholeGroupUpdate(loaded, live, B, null);
  assert.equal(len(live.track), 0);
});
test("Segment hit selects module beginning rather than previous shared vertex", () => {
  for (const legacy of [true, false]) {
    const { s, b } = fixture(legacy);
    if (legacy) seedLegacyModule(b);
    else E.installTrackDrive(s, b, 1, 1, A);
    const dense = E.editableTrack(b),
      sections = E.driveSections(dense),
      g = currentGroup(b, A),
      start = sections[g.from].start;
    const a = dense[start],
      c = dense[start + 1],
      project = (x, y, z = 0) => ({ x: 24 * (x - y), y: 12 * (x + y) - 24 * z });
    const click = project((a.x + c.x) / 2, (a.y + c.y) / 2, ((a.z ?? 0) + (c.z ?? 0)) / 2);
    assert.equal(E.pickTrackSection(dense, sections, click, project), g.from);
    assert.equal(E.pickTrackSection(dense, sections, { x: -10000, y: -10000 }, project), -1);
  }
});
for (const t of tests)
  console[t.pass ? "log" : "error"](t.pass ? "PASS" : "FAIL", t.name, t.error ?? "");
process.exitCode = tests.some((t) => !t.pass) ? 1 : 0;
