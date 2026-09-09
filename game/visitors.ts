import type { Building, Guest, Park } from "./simulation";
import { guestName } from "./guest-identity";
import { broken } from "./maintenance";
import { hasOperator } from "./operations";
import { podPort, podSlots, usesPods } from "./pods";
import { connected } from "./walkways";
import { habitatSafety, isHabitat, SPECIES } from "./zoo";
import { habitatViewingSpots } from "./zoo-access";

export type AgeGroup = "child" | "adult";
export type PartyKind = "family" | "couple" | "friends" | "solo";
export type VisitorParty = { id: number; kind: PartyKind; member: number; size: number };
export const PARTY_LABELS: Record<PartyKind, string> = {
  family: "Familie",
  couple: "Paar",
  friends: "Freundesgruppe",
  solo: "Allein unterwegs",
};
export const APPEARANCE_MAX = 0xffffffff;
export function appearanceSeed(id: number): number {
  let seed = Math.imul(id ^ 0x61c88647, 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  return (seed ^ (seed >>> 16)) >>> 0;
}
const shirts = [
  "#e76849",
  "#269baa",
  "#dda93e",
  "#8b65ae",
  "#6e9c52",
  "#d97b9a",
  "#426ca1",
  "#ead6b3",
  "#9c4f47",
  "#52a98f",
  "#d57936",
  "#576977",
];
const skins = ["#e9b889", "#d49b6a", "#925f43", "#f0cfb2", "#ba8058", "#684936"];
const hairs = ["#493222", "#744722", "#bd8849", "#292622", "#b6aaa0", "#a14f32"];
type AppearanceGuest = Pick<Guest, "id" | "skin"> &
  Partial<Pick<Guest, "ageGroup" | "appearance" | "party">>;
/** One persisted seed feeds both map and 3D clothing; old saves stay adult by default. */
export function guestAppearance(g?: AppearanceGuest) {
  const seed = g?.appearance ?? appearanceSeed(g?.id ?? 0);
  const ageGroup: AgeGroup =
    g?.ageGroup ?? (g?.party?.kind === "family" && g.party.member >= 2 ? "child" : "adult");
  const paletteIndex = seed % shirts.length;
  const skin = skins[g?.appearance === undefined ? (g?.skin ?? 0) : (seed >>> 7) % skins.length];
  const pants = ["#304968", "#465666", "#596247", "#885b49", "#c5b090", "#43394a"][
    (seed >>> 12) % 6
  ];
  return {
    ageGroup,
    heightScale:
      ageGroup === "child" ? 0.65 + ((seed >>> 14) % 11) / 100 : 0.92 + ((seed >>> 14) % 17) / 100,
    paletteIndex,
    skinTone: skin,
    skin,
    shirt: shirts[paletteIndex],
    trousers: pants,
    pants,
    hair: hairs[(seed >>> 18) % hairs.length],
    shoes: (seed >>> 20) % 2 ? "#f0eadb" : "#303637",
    hairStyle: (seed >>> 22) % 4,
    accessory: (["none", "cap", "glasses", "backpack"] as const)[(seed >>> 24) % 4],
    pattern: (seed >>> 27) % 3 === 0 ? ("stripe" as const) : ("plain" as const),
  };
}
export function visitorPartyLabel(g: Pick<Guest, "id" | "party">): string {
  if (!g.party || g.party.kind === "solo") return PARTY_LABELS.solo;
  const surname = guestName(g.party.id).split(" ").at(-1);
  return `${PARTY_LABELS[g.party.kind]} ${surname} · ${g.party.size} Personen`;
}

const familyKinds = new Set(["wheel", "carousel", "swing", "teacups", "balloonride", "bumper"]);
const thrillKinds = new Set(["coaster", "drop", "pirate", "spinner", "custom"]);
// Only audience-relevant buildings are inspected. Coasters use their one-cell station.
const sizes: Partial<Record<Building["kind"], number>> = {
  wheel: 3,
  carousel: 2,
  swing: 3,
  teacups: 3,
  balloonride: 3,
  bumper: 3,
  coaster: 1,
  drop: 2,
  pirate: 3,
  spinner: 3,
  custom: 3,
  playground: 3,
  picnic: 1,
  bench: 1,
};
export type AudienceAvailability = (s: Park, b: Building) => boolean;
export function visitorAudience(s: Park, available?: AudienceAvailability) {
  const net = connected(s);
  const reachable = (b: Building) => {
    if (available) return available(s, b);
    if (isHabitat(b.kind)) return habitatViewingSpots(s, b, net).length > 0;
    const size = sizes[b.kind];
    if (size === undefined) return false;
    const points =
      usesPods(b.kind) && b.pods
        ? [podPort(b, size, b.pods.entry)]
        : podSlots(size).map((p) => podPort(b, size, p));
    return points.some(
      (p) =>
        net.has(`${p.x},${p.y}`) &&
        (s.tiles[p.y]?.[p.x] === "path" ||
          ((familyKinds.has(b.kind) || thrillKinds.has(b.kind)) &&
            s.tiles[p.y]?.[p.x] === "queue")),
    );
  };
  const active = s.buildings.filter(
    (b) => b.open && hasOperator(b) && !broken(b) && b.tested && reachable(b),
  );
  const activeZoo = active.filter(
    (b) => isHabitat(b.kind) && (b.habitat?.count ?? 0) > 0 && habitatSafety(b).status !== "closed",
  ).length;
  const familyAttractions = active.filter((b) => familyKinds.has(b.kind)).length;
  const familyAmenities = active.filter((b) => ["playground", "picnic"].includes(b.kind)).length;
  const thrillAttractions = active.filter((b) => thrillKinds.has(b.kind)).length;
  const weights: Record<PartyKind, number> = {
    solo: 22,
    couple: 26 + activeZoo * 3 + familyAttractions * 2 + thrillAttractions * 2,
    friends: 18 + thrillAttractions * 12 + familyAttractions,
    family: 18 + activeZoo * 16 + familyAttractions * 6 + familyAmenities * 4,
  };
  const total = Object.values(weights).reduce((a, n) => a + n, 0);
  const percentages = Object.fromEntries(
    Object.entries(weights).map(([kind, value]) => [kind, (value / total) * 100]),
  ) as Record<PartyKind, number>;
  const expectedPartySize =
    (weights.solo + weights.couple * 2 + weights.friends * 2.5 + weights.family * 4) / total;
  const profileWeights = {
    family: 20 + activeZoo * 12 + familyAttractions * 5 + familyAmenities * 3,
    thrill: 20 + thrillAttractions * 12,
    budget: 24,
  };
  const reasons = [
    `${activeZoo} offene, erreichbare Tiergehege ziehen besonders Familien an.`,
    `${familyAttractions} Familienfahrgeschäfte und ${familyAmenities} Spiel- oder Picknickangebote unterstützen Familienbesuche.`,
    `${thrillAttractions} intensive Fahrgeschäfte erhöhen den Anteil von Freundesgruppen und Nervenkitzel-Fans.`,
  ];
  return {
    weights,
    percentages,
    expectedPartySize,
    profileWeights,
    activeZoo,
    familyAttractions,
    familyAmenities,
    thrillAttractions,
    summary:
      "Modell für neu ankommende Gruppen anhand der geöffneten, erreichbaren Angebote; keine gemessene Besucherstatistik.",
    reasons,
  };
}
export type VisitorAudience = ReturnType<typeof visitorAudience>;
/** roll is uniform within accepted arrival events; capacity never splits a family. */
export function planVisitorParty(s: Park, roll: number, audience = visitorAudience(s)) {
  const remaining = Math.max(0, 220 - s.guests.length);
  const seed = appearanceSeed(s.nextId);
  const sizes: Record<PartyKind, number> = {
    solo: 1,
    couple: 2,
    friends: 2 + (seed % 2),
    family: 4,
  };
  const kinds = (["solo", "couple", "friends", "family"] as const).filter(
    (kind) => sizes[kind] <= remaining,
  );
  if (!kinds.length) return null;
  const total = kinds.reduce((sum, kind) => sum + audience.weights[kind], 0);
  let pick = Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(roll) ? roll : 0)) * total;
  const kind = kinds.find((kind) => (pick -= audience.weights[kind]) < 0) ?? kinds.at(-1)!;
  const profileTotal = Object.values(audience.profileWeights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  let profilePick = ((seed >>> 2) / 0x40000000) * profileTotal;
  const profile =
    kind === "family"
      ? "family"
      : ((["family", "thrill", "budget"] as const).find(
          (key) => (profilePick -= audience.profileWeights[key]) < 0,
        ) ?? "budget");
  return { kind, size: sizes[kind], profile };
}
export function partyMembers(s: Park, g: Guest): Guest[] {
  return g.party && g.party.kind !== "solo"
    ? s.guests.filter((other) => other.party?.id === g.party!.id)
    : [g];
}
export function partyLeader(s: Park, g: Guest): Guest | undefined {
  return partyMembers(s, g)
    .filter((other) => other.ageGroup !== "child")
    .sort((a, b) => (a.party?.member ?? 0) - (b.party?.member ?? 0))[0];
}
export function partyWalkingSpeed(g: Guest): number {
  return g.party && g.party.kind !== "solo"
    ? 1.05 + (g.party.id % 4) * 0.035
    : 1 + (g.id % 7) * 0.065;
}
/** Only the leading walker pauses for members still walking to the same destination. */
export function partyShouldWait(s: Park, g: Guest): boolean {
  if (!g.party || g.party.kind === "solo" || g.transit || partyLeader(s, g)?.id !== g.id)
    return false;
  return partyMembers(s, g).some(
    (other) =>
      other.id !== g.id &&
      !other.transit &&
      other.state === g.state &&
      other.target === g.target &&
      other.route.length > g.route.length + 1 &&
      Math.hypot(other.x - g.x, other.y - g.y) > 3,
  );
}
export function validVisitorParties(s: Park): boolean {
  const groups = new Map<number, { kind: PartyKind; size: number; members: Set<number> }>();
  for (const g of s.guests) {
    if (g.ageGroup !== undefined && g.ageGroup !== "adult" && g.ageGroup !== "child") return false;
    if (
      g.appearance !== undefined &&
      (!Number.isSafeInteger(g.appearance) || g.appearance < 0 || g.appearance > APPEARANCE_MAX)
    )
      return false;
    if (
      g.partyVisitDone !== undefined &&
      (!g.party ||
        !Number.isSafeInteger(g.partyVisitDone) ||
        g.partyVisitDone < 1 ||
        g.partyVisitDone >= s.nextId)
    )
      return false;
    const p = g.party;
    if (g.ageGroup === "child" && (!p || p.kind !== "family" || p.member < 2)) return false;
    if (p === undefined) continue;
    if (
      !p ||
      !Number.isSafeInteger(p.id) ||
      p.id < 1 ||
      p.id >= s.nextId ||
      !Object.hasOwn(PARTY_LABELS, p.kind) ||
      !Number.isInteger(p.size) ||
      !Number.isInteger(p.member) ||
      p.member < 0 ||
      p.member >= p.size ||
      (p.kind === "solo"
        ? p.size !== 1
        : p.kind === "couple"
          ? p.size !== 2
          : p.kind === "family"
            ? p.size !== 4
            : p.size < 2 || p.size > 3) ||
      (p.member === 0 && p.id !== g.id) ||
      (p.kind === "family" && g.ageGroup !== (p.member >= 2 ? "child" : "adult"))
    )
      return false;
    const old = groups.get(p.id);
    if (old && (old.kind !== p.kind || old.size !== p.size || old.members.has(p.member)))
      return false;
    if (old) old.members.add(p.member);
    else groups.set(p.id, { kind: p.kind, size: p.size, members: new Set([p.member]) });
  }
  return true;
}
