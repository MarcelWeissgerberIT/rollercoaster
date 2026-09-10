import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { moduleURL } from "./ts-loader.mjs";
const H = await import(moduleURL("game/person-head.ts")),
  G = await import(moduleURL("game/guest-model.ts")),
  S = await import(moduleURL("game/staff-animation.ts")),
  V = await import(moduleURL("game/visitors.ts")),
  P = await import(moduleURL("game/guest-sprite.ts"));
let passed = 0;
const test = (name, run) => { run(); console.log("PASS", name); passed++; };
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const digest = (raster) => createHash("sha256").update(raster.data).digest("hex");
const look = { skin: "#d49b6a", hair: "#493222", hairStyle: 0, accessory: "none" };

test("Heads have a readable face, smaller jaw, ear silhouette and a distinct nape in every hairstyle", () => {
  for (let hairStyle = 0; hairStyle < 4; hairStyle++) {
    const parts = H.personHeadParts({ ...look, hairStyle });
    const p = (id) => parts.find((p) => p.id === id);
    assert.equal(parts.length, 20, "Head details must fit the existing 48-part crowd budget");
    assert(p("nose").p[2] < p("head").p[2] - p("head").s[2]);
    assert(p("jaw").s[0] < p("head").s[0]);
    assert(p("hair-nape").p[2] > 0 && p("hair-nape").p[1] < 0);
    assert(p("head-neck").p[1] < p("jaw").p[1]);
    assert(p("ear-1").p[0] < -p("head").s[0]);
    assert(p("ear1").p[0] > p("head").s[0]);
    for (const part of parts) {
      assert(part.p.every(Number.isFinite));
      assert(part.s.every((n) => Number.isFinite(n) && n >= 0));
    }
  }
});

test("Directional rasters really occlude faces on back views instead of showing frontal features through hair", () => {
  const appearances = Array.from({ length: 4 }, (_, hairStyle) => ({ ...look, hairStyle }));
  const skinColors = new Set([1.13, 1, .83, .69].map((s) => [1, 3, 5].map((i) =>
    Math.round(Math.min(255, parseInt(look.skin.slice(i, i + 2), 16) * s))).join(",")));
  const skinPixels = (b) => {
    let count = 0;
    for (let i = 0; i < b.data.length; i += 4)
      if (b.data[i + 3] && skinColors.has([...b.data.subarray(i, i + 3)].join(","))) count++;
    return count;
  };
  for (const appearance of appearances) {
    const views = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((yaw) => H.headBitmap(appearance, yaw));
    assert.equal(new Set(views.map(digest)).size, 4, "Four headings must have distinct silhouettes/faces");
    assert(skinPixels(views[2]) > skinPixels(views[0]) * 1.3,
      `Front must expose more face than back: ${skinPixels(views[2])}/${skinPixels(views[0])}`);
    for (const bitmap of views) {
      assert(bitmap.data.some((value, i) => i % 4 === 3 && value > 0));
      for (let x = 0; x < bitmap.width; x++) {
        assert.equal(bitmap.data[x * 4 + 3], 0, "Hair/cap touches the raster edge");
        assert.equal(bitmap.data[((bitmap.height - 1) * bitmap.width + x) * 4 + 3], 0);
      }
    }
  }
});

test("Caps, long hair and spectacles change the silhouette without changing instance slot counts", () => {
  const cases = [look, {...look, hairStyle:2}, {...look, accessory:"cap",hat:"#315d81"},
    {...look, accessory:"glasses"}];
  assert.equal(new Set(cases.map((look) => digest(H.headBitmap(look, Math.PI)))).size, cases.length);
  assert.equal(new Set(cases.map((look) => H.personHeadParts(look).length)).size, 1);
});

test("Guest and worker models use the exact shared anatomy at their actual head anchors", () => {
  for (const id of [1, 2, 12, 34]) {
    const guest = {id, skin:1,ageGroup:"adult"}, appearance = V.guestAppearance(guest),
      expected = H.personHeadParts({...appearance,hat:appearance.shirt,brim:appearance.pants}),
      actual = G.personParts(guest, false).filter((p) => p.head);
    assert.equal(actual.length, expected.length);
    expected.forEach((part, i) => {
      assert.equal(actual[i].color, part.color);
      near(actual[i].p[0], part.p[0] * appearance.heightScale);
      near(actual[i].p[1], (1.6 + part.p[1]) * appearance.heightScale);
      near(actual[i].p[2], part.p[2] * appearance.heightScale);
      part.s.forEach((s, axis) => near(actual[i].s[axis], s * appearance.heightScale));
    });
    for (const action of ["walk", "sweep", "admit", "console"]) {
      const motion = {id,role:"cleaner",action,heading:0,time:.75,distance:.3},
        head = H.personHeadParts(S.staffHeadLook(motion)).filter((p) => p.s.every((n) => n > 0)),
        pose = S.staffPose(motion), skull = pose.find((p) => p.id === "head"),
        origin = skull.a.map((n, axis) => n - head.find((p) => p.id === "head").p[axis]);
      for (const p of head) {
        const matching = pose.find((part) => part.id === p.id);
        assert(matching?.head);
        assert.equal(matching.color, p.color);
        assert.deepEqual(matching.size, p.s);
        p.p.forEach((n, axis) => near(matching.a[axis], origin[axis] + n));
      }
    }
  }
});

test("Walking and seated sprite directions follow the same heading convention as 3D staff", () => {
  for (const [direction, heading] of [["se",0],["sw",Math.PI/2],["ne",-Math.PI/2],["nw",Math.PI]]) {
    for (const seated of [false, true]) {
      const file = seated ? `rider-red-${direction}.png` : `walk-red-${direction}-0.png`,
        anchor = P.guestHeadAnchor(file, seated);
      near(Math.sin(anchor.yaw), Math.sin(S.staffYaw(heading)));
      near(Math.cos(anchor.yaw), Math.cos(S.staffYaw(heading)));
      assert(anchor.x > 0 && anchor.y > 0);
    }
  }
  assert.notDeepEqual(P.guestHeadAnchor("walk-red-se-0.png"), P.guestHeadAnchor("walk-red-se-1.png"),
    "Authored stepping head must retain its bob instead of floating independently");
});

test("Pure cached head rasters do not consume randomness, advance time or alter appearance", () => {
  const frozen = Object.freeze({...look}), before = structuredClone(frozen), oldRandom = Math.random;
  Math.random = () => { throw Error("Head renderer consumed simulation randomness"); };
  try {
    const a = H.headBitmap(frozen, 0);
    for (let i = 0; i < 100; i++) assert.equal(H.headBitmap(frozen, Math.PI * 2), a);
    assert.deepEqual(frozen, before);
  } finally { Math.random = oldRandom; }
});
console.log(`${passed} person-head tests passed.`);
