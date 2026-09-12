/** Read-only explanations from the same access, demand and operating rules used
 * by the simulation. Recommendations are offers, never automatic simulation edits. */
import {
  CATALOG,
  access,
  buildingBaseCost,
  decorative,
  effectivePods,
  exitPath,
  expectedWait,
  guestScore,
  isAttraction,
  isRide,
  queueCapacity,
  rideAppeal,
  rideCapacity,
  rideDuration,
  type Building,
  type Park,
} from "./simulation";
import { connected } from "./walkways";
import { canAfford } from "./budget";
import { broken, condition, repairAttraction, repairCost, maintenanceStatus } from "./maintenance";
import {
  assignRideCrew,
  availableRideCrews,
  canAssignRideCrew,
  hasOperator,
  needsOperator,
  operationsOf,
  programDuration,
  setRideRounds,
} from "./operations";
import {
  connectBuilding,
  planConnection,
  planPod,
  setAccessPod,
  type Connection,
} from "./construction";
import { applyExitSuggestion, suggestExit } from "./exit-assist";
import { podSlots, samePod, usesPods, type Pod } from "./pods";
import {
  isHabitat,
  habitatCareStatus,
  habitatHasFeature,
  habitatSafety,
  SPECIES,
  welfare,
} from "./zoo";
import { habitatViewingSpots } from "./zoo-access";
import { HABITAT_PROFILES } from "./habitat-needs";
import { isTransport, stopEntrance, transitValid } from "./transit";
import { FOOD, isFood } from "./park-life";
import { partyLeader, partyMembers } from "./visitors";
import { sharedExitPending } from "./shared-access";

export type AttractionAdviceNavigation =
  | "access"
  | "staff"
  | "maintenance"
  | "zoo"
  | "track"
  | "marketing"
  | "analysis"
  | "operations";
export type AttractionAdviceMutation =
  | "repair"
  | "lower-price"
  | "shorter-program"
  | "assign-crew"
  | "connect-open"
  | "connect-exit";
export type AttractionAdviceAction = {
  /** Includes the complete quoted plan/value. A stale click must not buy a different plan. */
  id: string;
  kind: AttractionAdviceNavigation | AttractionAdviceMutation;
  label: string;
  cost?: number;
  disabledReason?: string;
  value?: number;
};
export type AttractionAdviceIssue = {
  id: string;
  severity: "blocker" | "warning" | "tip";
  title: string;
  detail: string;
  action?: AttractionAdviceAction;
};
export type AttractionAdviceReport = {
  buildingId: number;
  name: string;
  status: "blocked" | "improve" | "healthy";
  headline: string;
  summary: string;
  metrics: { enRoute: number; waiting: number; active: number; served: number };
  issues: AttractionAdviceIssue[];
};
const nav = (kind: AttractionAdviceNavigation, label: string): AttractionAdviceAction => ({
  id: kind,
  kind,
  label,
});
const mutation = (
  s: Park,
  kind: AttractionAdviceMutation,
  label: string,
  cost = 0,
  value?: number,
  plan?: unknown,
): AttractionAdviceAction => ({
  id: JSON.stringify([kind, cost, value ?? null, plan ?? null]),
  kind,
  label,
  cost,
  value,
  ...(cost > 0 && !canAfford(s, cost)
    ? { disabledReason: `Dafür fehlen ${Math.ceil(cost - s.cash)} € im Parkbudget.` }
    : {}),
});
const personCount = (s: Park, ids: number[]) =>
  new Set(ids.filter((id) => s.guests.some((g) => g.id === id))).size;
const mechanical = (b: Building) => isRide(b.kind) && !["bumper", "balloonride"].includes(b.kind);
const centerDistance = (b: Building, p: { x: number; y: number }) => {
  const d = (CATALOG[b.kind].size - 1) / 2;
  return Math.hypot(b.x + d - p.x, b.y + d - p.y);
};
const euro = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`;

type EntryPlan = Connection & { entry?: Pod };
/** Keep a usable chosen entry. Only search other sides when that entry cannot
 * reach a path and nobody would have to be released or rerouted by relocation. */
function entryPlan(s: Park, b: Building): EntryPlan {
  const original = planConnection(s, b, false);
  if (
    !original.error ||
    original.points.length ||
    !usesPods(b.kind) ||
    isTransport(b.kind) ||
    b.queue.length ||
    b.riders.length ||
    b.testing ||
    b.autoOpen ||
    s.guests.some((g) => g.target === b.id || g.transit?.from === b.id)
  )
    return original;
  const pods = b.sharedAccess && b.pods ? b.pods : effectivePods(s, b);
  let best: EntryPlan | null = null;
  for (const entry of podSlots(CATALOG[b.kind].size)) {
    if (samePod(entry, pods.entry) || planPod(s, b, "entry", entry, false).error) continue;
    const candidate = { ...b, pods: { ...pods, entry } };
    const virtual = {
      ...s,
      buildings: s.buildings.map((item) => (item.id === b.id ? candidate : item)),
    };
    const plan = planConnection(virtual, candidate, false);
    if (plan.error && !plan.points.length) continue;
    if (!best || plan.cost < best.cost) best = { ...plan, entry: { ...entry } };
  }
  return best ?? original;
}

/** No migration, crew assignment, random sampling or visitor movement is allowed here. */
export function attractionAdvice(s: Park, buildingId: number): AttractionAdviceReport | null {
  const b = s.buildings.find((b) => b.id === buildingId);
  if (!b || !CATALOG[b.kind] || decorative(b.kind)) return null;
  const habitat = isHabitat(b.kind),
    transport = isTransport(b.kind),
    ride = isRide(b.kind);
  const net = connected(s),
    entrance = transport ? stopEntrance(s, b) : access(s, b, net);
  const editing = s.trackEdit?.buildingId === b.id;
  const targeting = s.guests.filter((g) => g.state !== "leave" && g.target === b.id);
  const line = transport ? s.transitLines?.find((l) => l.a === b.id || l.b === b.id) : undefined;
  const metrics = {
    enRoute: transport
      ? s.guests.filter((g) => g.transit?.from === b.id && g.state === "walk").length
      : targeting.filter((g) => g.state === "walk" || !!g.transit).length,
    waiting: transport
      ? personCount(s, b.queue)
      : targeting.filter((g) => g.state === "queue" && !g.transit).length,
    active: transport
      ? s.guests.filter((g) => g.transit?.from === b.id && g.state === "ride").length
      : targeting.filter((g) => ["ride", "observe", "rest"].includes(g.state) && !g.transit).length,
    served: Math.max(0, b.served),
  };
  const issues: AttractionAdviceIssue[] = [];
  const add = (
    id: string,
    severity: AttractionAdviceIssue["severity"],
    title: string,
    detail: string,
    action?: AttractionAdviceAction,
  ) => issues.push({ id, severity, title, detail, action });
  const safety = habitat ? habitatSafety(b) : null;
  const readyToOpen =
    !editing &&
    !broken(b) &&
    hasOperator(b) &&
    (!habitat || (!!b.habitat?.count && safety?.status !== "closed")) &&
    !transport;
  const openAction = (): AttractionAdviceAction | undefined => {
    if (!readyToOpen) return undefined;
    const plan = entryPlan(s, b);
    if (plan.error && !plan.points.length) return undefined;
    const testing = b.kind === "coaster" && !b.tested;
    return mutation(
      s,
      "connect-open",
      plan.entry
        ? testing
          ? "Einlass versetzen, anschließen & nach Test öffnen"
          : "Einlass versetzen, anschließen & öffnen"
        : plan.points.length
          ? testing
            ? "Anschließen & nach Test öffnen"
            : "Anschließen & öffnen"
          : testing
            ? "Testfahrt starten & danach öffnen"
            : "Attraktion öffnen",
      plan.cost,
      undefined,
      {
        points: plan.points,
        clearIds: plan.clearIds,
        entry: plan.entry,
        tested: b.tested,
        testing: !!b.testing,
      },
    );
  };

  if (editing)
    add(
      "track-edit",
      "blocker",
      "Streckenumbau ist noch offen",
      "Während des Umbaus nimmt diese Bahn keine Fahrgäste auf. Verbinde die offenen Enden, übernimm den Umbau und führe anschließend eine Testfahrt durch.",
      nav("track", "Umbau fortsetzen"),
    );
  if (b.maintenance?.request)
    add(
      "maintenance",
      "blocker",
      "Wartungsauftrag offen",
      maintenanceStatus(s, b),
      nav("staff", "Mechaniker verwalten"),
    );
  if (broken(b) && b.maintenance?.request !== "repair")
    add(
      "repair",
      "blocker",
      "Attraktion ist defekt",
      `Der technische Zustand liegt bei ${Math.round(condition(b))} %. Unter 25 % bleibt das Fahrgeschäft außer Betrieb. Eine Reparatur stellt den Zustand wieder her; danach kannst du es öffnen.`,
      mutation(s, "repair", "Reparatur beauftragen", repairCost(b, buildingBaseCost(b))),
    );
  if (needsOperator(b.kind) && !hasOperator(b)) {
    const crew = availableRideCrews(s).find((c) => !canAssignRideCrew(s, c.id, b.id));
    add(
      "staff",
      "blocker",
      "Bedienpersonal fehlt",
      "Ohne eine zugewiesene Crew werden keine Gäste eingelassen und keine Fahrten gestartet. Eine Crew besetzt Steuerung, Einlass und Ausstieg.",
      crew
        ? mutation(s, "assign-crew", "Freie Crew zuweisen", 0, crew.id)
        : nav("staff", "Personal zuweisen oder einstellen"),
    );
  }
  if (habitat && !b.habitat?.count)
    add(
      "animals",
      "blocker",
      "Im Gehege leben noch keine Tiere",
      "Leere Gehege werden bei der Besucherauswahl übersprungen. Nimm zunächst passende Tiere auf und prüfe die Pflegeversorgung.",
      nav("zoo", "Tiere aufnehmen"),
    );
  if (safety?.status === "closed")
    add(
      "safety",
      "blocker",
      "Gehege wegen Sicherheit gesperrt",
      `Die Barriere hat nur ${safety.score} % Zustand. Lass sie durch die Anlagentechnik prüfen, bevor du das Gehege öffnest.`,
      nav("zoo", "Sicherheit & Tierpflege prüfen"),
    );
  if (!entrance)
    add(
      "access",
      "blocker",
      habitat ? "Besucher erreichen das Gehege nicht" : "Eingang ist nicht erreichbar",
      habitat
        ? b.habitat?.viewpoint
          ? "Der festgelegte Aussichtspunkt ist nicht mit dem Parkeingang verbunden. Ein normaler Parkweg muss genau diesen Platz am äußeren Zaun erreichen."
          : "Besucher brauchen einen verbundenen normalen Parkweg am äußeren Gehegerand. Blaue Warteschlangen und rote Ausgänge dienen hier nicht als Aussichtspunkt."
        : "Vom Parkeingang führt kein erreichbarer Weg zum Einlass. Verbinde den Eingangspod mit dem Parkwegenetz oder versetze ihn auf eine freie Seite.",
      openAction() ?? nav("access", "Zugang und Pods bearbeiten"),
    );

  if (!editing && !broken(b) && isAttraction(b.kind) && !b.tested)
    add(
      "test",
      "blocker",
      b.testing ? "Testfahrt läuft" : "Freigabe durch Testfahrt fehlt",
      b.testing
        ? `Noch etwa ${Math.ceil(b.testing)} s Testfahrt. ${b.autoOpen ? "Danach öffnet die Bahn automatisch, sobald der Eingang erreichbar ist." : "Öffne die Bahn nach erfolgreicher Testfahrt."}`
        : "Ungetestete Fahrgeschäfte werden von Gästen nicht ausgewählt. Der Anschlussassistent startet eine Testfahrt und öffnet danach automatisch.",
      b.testing
        ? undefined
        : entrance
          ? (openAction() ?? nav("operations", "Betrieb & Testfahrt prüfen"))
          : nav("access", "Zuerst Zugang herstellen"),
    );
  if (!b.open && !editing && !broken(b) && (!isAttraction(b.kind) || b.tested) && !transport)
    add(
      "closed",
      "blocker",
      "Für Besucher geschlossen",
      "Diese Einrichtung nimmt im geschlossenen Zustand keine neuen Besucher an. Behebe zuerst die aufgeführten Betriebsprobleme und öffne sie anschließend.",
      entrance
        ? (openAction() ?? nav(habitat ? "zoo" : "operations", "Betrieb prüfen"))
        : undefined,
    );
  if (!s.open)
    add(
      "park-closed",
      "blocker",
      "Der Park ist geschlossen",
      "Neue Gäste kommen erst wieder nach der Parköffnung. Noch anwesende Besucher treten bei ihrer nächsten Entscheidung den Heimweg an.",
      nav("operations", "Parköffnung prüfen"),
    );

  if (usesPods(b.kind) && !b.sharedAccess && !exitPath(s, b, net).length && !editing) {
    const exitPlan = suggestExit(s, b, false);
    const busy =
      b.queue.length > 0 ||
      b.riders.length > 0 ||
      targeting.length > 0 ||
      !!b.testing ||
      !!b.autoOpen;
    add(
      "exit",
      "warning",
      "Ausgang hat keinen eigenen Anschluss",
      "Der Ausgang endet ohne Verbindung zum Parkweg. Gäste gehen derzeit über den Eingang zurück. Ein eigener Ausgang vermeidet Gegenverkehr." +
        (exitPlan?.moved ? " Eine besser erreichbare Pod-Seite ist verfügbar." : "") +
        (busy ? " Den Pod erst versetzen, wenn keine Gäste mehr unterwegs oder darin sind." : ""),
      exitPlan && !busy && !transport
        ? mutation(
            s,
            "connect-exit",
            exitPlan.moved ? "Ausgang versetzen & verbinden" : "Ausgang verbinden",
            exitPlan.cost,
            undefined,
            exitPlan,
          )
        : nav("access", "Ausgangslösung ansehen"),
    );
    if (needsOperator(b.kind))
      add(
        "shared-space",
        "tip",
        "Ein- und Ausgang können einen Weg teilen",
        "Ein gemeinsamer Pod spart den zusätzlichen Ausgangsweg. Rot führt hinaus, Blau hinein. Der Einlass wartet, bis die vorherigen Gäste den gemeinsamen Weg verlassen haben.",
        nav("access", "Gemeinsamen Zugang einrichten"),
      );
  }
  if (b.sharedAccess && sharedExitPending(s, b))
    add(
      "shared-exit",
      "tip",
      "Aussteigende Gäste haben Vorrang",
      "Die vorherigen Fahrgäste verlassen gerade die rote Spur. Sobald sie den Parkweg erreicht haben, beginnt der Einlass über die blaue Spur.",
      nav("access", "Gemeinsamen Zugang ansehen"),
    );
  if (transport) {
    if (!line)
      add(
        "transport-line",
        "blocker",
        "Haltestelle hat noch keine Linie",
        "Parkbahn und Shuttle werden für längere Wege zu anderen Angeboten genutzt. Verbinde zwei Halte desselben Verkehrsmittels mit einer Linie.",
        nav("operations", "Transportlinie einrichten"),
      );
    else if (!line.enabled || !transitValid(s, line) || !b.open)
      add(
        "transport-line",
        "blocker",
        "Transportlinie ist nicht betriebsbereit",
        line.fault ||
          "Prüfe beide geöffneten Haltestellen und den durchgehenden Parkweg der Linie. Unterbrochene oder deaktivierte Linien werden nicht gewählt.",
        nav("operations", "Linie und Haltestellen prüfen"),
      );
    else
      add(
        "transport-demand",
        "tip",
        "Eine Linie braucht passende Reiseziele",
        "Einzelgäste nutzen die Linie bei mindestens 18 Wegfeldern Fußweg und mehr als 3 Sekunden Zeitersparnis einschließlich Warten. Familien, Paare und Freundesgruppen gehen gemeinsam zu Fuß. Fahre zu gefragten Angeboten und halte Fahrpreis und Wartezeit niedrig.",
        nav("analysis", "Besucherströme ansehen"),
      );
  }

  if (transport && line?.enabled && transitValid(s, line)) {
    if (b.queue.length >= 16)
      add(
        "queue-full",
        "warning",
        "Wartebereich der Haltestelle ist voll",
        `${b.queue.length} Gäste warten bei 16 Warteplätzen. Weitere Gäste wählen den Transport erst wieder, wenn Plätze frei werden.`,
        nav("operations", "Linie und Wartezeit prüfen"),
      );
    const walking = s.guests.filter(
      (g) => g.state === "walk" && !g.transit && g.rides < 5 && g.happiness >= 25,
    );
    const solos = walking.filter((g) => !g.party || g.party.kind === "solo");
    if (walking.length >= 3 && !solos.length)
      add(
        "transport-audience",
        "warning",
        "Gerade sind nur Gruppen unterwegs",
        "Familien, Paare und Freundesgruppen gehen gemeinsam zu Fuß. Die Linie kann derzeit nur von Einzelgästen gewählt werden.",
        nav("analysis", "Besuchergruppen ansehen"),
      );
    const unaffordable = solos.filter((g) => (g.wallet ?? 60) < b.price).length;
    if (solos.length >= 3 && unaffordable >= solos.length * 0.35) {
      const wallets = solos.map((g) => g.wallet ?? 60).sort((a, b) => a - b);
      const price = Math.max(
        1,
        Math.min(b.price - 1, CATALOG[b.kind].price, wallets[Math.floor(wallets.length / 2)]),
      );
      add(
        "price",
        "warning",
        "Der Fahrpreis überschreitet viele Budgets",
        `${unaffordable} von ${solos.length} laufenden Einzelgästen können ${euro(b.price)} nicht bezahlen. Ein günstigerer Fahrpreis macht die Linie für mehr Gäste nutzbar.`,
        price < b.price
          ? mutation(s, "lower-price", `Fahrpreis auf ${euro(price)} senken`, 0, price)
          : nav("operations", "Fahrpreis prüfen"),
      );
    }
  }

  if (habitat && b.habitat?.count) {
    const h = b.habitat,
      care = habitatCareStatus(s, b),
      profile = HABITAT_PROFILES[b.kind as keyof typeof SPECIES];
    if (!care.staffed)
      add(
        "zoo-staff",
        "warning",
        "Passende Tierpflege fehlt",
        `${care.label}. Die Pflegekräfte müssen über verbundene Wege von ihrer Station zum Gehege gelangen. Fehlende Pflege senkt mit der Zeit Versorgung und Tierwohl.`,
        nav("staff", "Tierpflege zuweisen"),
      );
    if (h.health < 30 || welfare(b) < 70)
      add(
        "welfare",
        "warning",
        h.health < 30 ? "Tiere sind stark angeschlagen" : "Tierwohl kann Besucher begeistern",
        `Tierwohl ${welfare(b)} %, Gesundheit ${Math.round(h.health)} %, Futter ${Math.round(h.food)} %, Wasser ${Math.round(h.water)} %, Sauberkeit ${Math.round(h.clean)} %. ${h.health < 30 ? "Unter 30 % Gesundheit fällt der berechnete Besuchsreiz auf null." : "Das Tierwohl geht direkt in die Attraktivität des Geheges ein."}`,
        nav("zoo", "Versorgung und Tierwohl verbessern"),
      );
    if (safety?.status === "warning")
      add(
        "safety",
        "warning",
        "Gehegebarriere braucht Wartung",
        `Zustand ${safety.score} %. Unter 30 % schließt das Gehege automatisch.`,
        nav("zoo", "Anlagentechnik prüfen"),
      );
    const missing = profile.features.filter((f) => !habitatHasFeature(b, f.id));
    if (missing.length)
      add(
        "enrichment",
        "tip",
        "Mehr passende Beschäftigung und Rückzug",
        `${missing
          .slice(0, 3)
          .map((f) => f.label)
          .join(
            ", ",
          )} fehlen noch. Artgerechte Gehegeausstattung verbessert das Tierwohl und damit den Besuchsreiz.`,
        nav("zoo", "Gehegeausstattung auswählen"),
      );
    const spots = habitatViewingSpots(s, b, net);
    if (spots.length === 1 && metrics.enRoute + metrics.active >= 4)
      add(
        "viewing-space",
        "warning",
        "Viele Gäste teilen einen Aussichtspunkt",
        `${metrics.enRoute + metrics.active} Gäste sind unterwegs oder beobachten an nur einem erreichbaren Wegfeld. Ergänze benachbarte normale Parkwege auf dieser Zaunseite.`,
        nav("access", "Aussichtsfläche erweitern"),
      );
  }
  if (mechanical(b) && !broken(b) && condition(b) < 70 && b.maintenance?.request !== "repair")
    add(
      "repair",
      "warning",
      "Verschleiß mindert den Fahrspaß",
      `Zustand ${Math.round(condition(b))} %. Im Auswahlmodell sinkt der Besuchsreiz mit dem Verschleiß; unter 25 % fällt das Fahrgeschäft aus.`,
      mutation(s, "repair", "Reparatur beauftragen", repairCost(b, buildingBaseCost(b))),
    );
  if (!habitat && !transport) {
    const capacity = ride ? queueCapacity(s, b) : 6,
      wait = expectedWait(b);
    if (capacity > 0 && b.queue.length >= capacity)
      add(
        "queue-full",
        "warning",
        "Warteschlange ist voll",
        `${b.queue.length} Gäste warten bei ${capacity} Warteplätzen. Solange die Schlange voll ist, wird dieses Angebot von weiteren Gästen übersprungen.`,
        nav("access", ride ? "Warteschlange erweitern" : "Stand & Besucherfluss ansehen"),
      );
    if (b.queue.length > 0 && wait > 30)
      add(
        "wait",
        "warning",
        "Die Wartezeit schreckt Gäste ab",
        `Geschätzt ${Math.ceil(wait)} s bis zum Einstieg, ${rideCapacity(b)} Plätze je Durchgang. Wartezeit senkt den Auswahlwert und langes Anstehen die Laune.` +
          (needsOperator(b.kind) && operationsOf(b).rounds > 1
            ? ` Das Programm umfasst ${operationsOf(b).rounds} Runden (${Math.ceil(programDuration(b, rideDuration(b)))} s plus Ein- und Ausstieg). Eine Runde wird ab dem nächsten Programm wirksam.`
            : ""),
        needsOperator(b.kind) && operationsOf(b).rounds > 1
          ? mutation(s, "shorter-program", "Nächste Programme auf 1 Runde setzen", 0, 1)
          : nav("operations", "Kapazität & Programm prüfen"),
      );
  }

  const blockers = issues.some((i) => i.severity === "blocker");
  if (!blockers && !transport) demandAdvice(s, b, metrics, add);
  const nearby = s.guests.filter(
    (g) =>
      g.state !== "ride" &&
      g.state !== "leave" &&
      centerDistance(b, g) <= CATALOG[b.kind].size / 2 + 4,
  );
  const litter = (s.cleanliness?.litter ?? [])
    .filter((l) => centerDistance(b, l) <= CATALOG[b.kind].size / 2 + 3)
    .reduce((n, l) => n + l.amount, 0);
  if (litter >= 3)
    add(
      "litter",
      "warning",
      "Müll rund um die Attraktion",
      `${litter} Müllteile liegen in der Nähe. Müll senkt die Laune von Gästen direkt daneben; daraus lässt sich kein bestimmter verlorener Besuch ableiten. Weise Reinigungskräften diesen Bereich zu und prüfe die Mülleimer.`,
      nav("analysis", "Sauberkeit & Arbeitsbereiche ansehen"),
    );
  if (nearby.length >= 3) {
    const needs = [
      { label: "hungrig", count: nearby.filter((g) => g.hunger >= 65).length },
      { label: "durstig", count: nearby.filter((g) => g.thirst >= 65).length },
      { label: "auf Toilettensuche", count: nearby.filter((g) => (g.bladder ?? 0) >= 70).length },
    ].filter((n) => n.count >= 3);
    if (needs.length)
      add(
        "needs",
        "tip",
        "Gäste in der Nähe brauchen Versorgung",
        `${needs.map((n) => `${n.count} ${n.label}`).join(", ")}. Bedürfnisse verändern die Wahl zwischen Fahrgeschäften und Versorgung. Prüfe erreichbare und bezahlbare Angebote in der Umgebung.`,
        nav("analysis", "Bedürfnisse in der Umgebung ansehen"),
      );
  }
  issues.sort(
    (a, b) =>
      ({ blocker: 0, warning: 1, tip: 2 })[a.severity] -
      { blocker: 0, warning: 1, tip: 2 }[b.severity],
  );
  const status = blockers
    ? "blocked"
    : issues.some((i) => i.severity === "warning")
      ? "improve"
      : "healthy";
  const total = metrics.enRoute + metrics.waiting + metrics.active;
  const blockerCount = issues.filter((i) => i.severity === "blocker").length;
  return {
    buildingId: b.id,
    name: b.name || CATALOG[b.kind].name,
    status,
    headline:
      status === "healthy"
        ? total
          ? "Besucher nutzen das Angebot"
          : "Betrieb bereit – Nachfrage beobachten"
        : issues[0].title,
    summary: blockers
      ? `${blockerCount} Betriebsproblem${blockerCount === 1 ? " verhindert" : "e verhindern"} derzeit einen normalen Besuch.`
      : `${total} ${total === 1 ? "Gast unterwegs, wartend oder vor Ort" : "Gäste unterwegs, wartend oder vor Ort"}.`,
    metrics,
    issues,
  };
}

function demandAdvice(
  s: Park,
  b: Building,
  metrics: AttractionAdviceReport["metrics"],
  add: (
    id: string,
    severity: AttractionAdviceIssue["severity"],
    title: string,
    detail: string,
    action?: AttractionAdviceAction,
  ) => void,
) {
  // Only actual decision-makers; party members follow their leader and the
  // least-funded member limits the whole party's affordable options.
  const choosing = s.guests.filter(
    (g) =>
      g.state === "walk" &&
      !g.transit &&
      g.rides < 5 &&
      g.happiness >= 25 &&
      (!g.party || g.party.kind === "solo" || partyLeader(s, g)?.id === g.id),
  );
  const budgets = choosing.map((g) => Math.min(...partyMembers(s, g).map((m) => m.wallet ?? 60)));
  const scores = choosing.map((g) => guestScore(b, g, s));
  const unaffordable = budgets.filter((n) => n < b.price).length;
  const minimumPrice = isFood(b.kind)
    ? Math.floor(FOOD[b.kind].supplies) + 1
    : b.kind === "plush"
      ? 5
      : b.kind === "balloon"
        ? 2
        : 1;
  const sortedBudgets = [...budgets].sort((a, b) => a - b);
  const priceTarget = Math.max(
    minimumPrice,
    Math.min(
      b.price - 1,
      CATALOG[b.kind].price || b.price - 1,
      sortedBudgets[Math.floor(sortedBudgets.length / 2)] ?? b.price - 1,
    ),
  );
  const priceAction =
    priceTarget < b.price
      ? mutation(s, "lower-price", `Preis auf ${euro(priceTarget)} senken`, 0, priceTarget)
      : nav("operations", "Preis & Angebot prüfen");
  const samples = choosing.length;
  if (samples >= 3 && unaffordable / samples >= 0.35)
    add(
      "price",
      "warning",
      "Der Preis überschreitet viele Budgets",
      `${unaffordable} von ${samples} aktuell laufenden Besuchsgruppen können ${euro(b.price)} nicht bezahlen. Bei Familien und Paaren zählt das kleinste Restbudget. Ein niedrigerer Preis kann den Zugang erleichtern, garantiert aber keinen höheren Gewinn.`,
      priceAction,
    );
  else if (samples >= 3 && scores.filter((n) => n + 1.4 <= -0.5).length >= samples * 0.5)
    add(
      "demand-score",
      "warning",
      "Das Angebot passt momentan zu wenigen Gästen",
      `Für ${scores.filter((n) => n + 1.4 <= -0.5).length} von ${samples} betrachteten Besuchsgruppen liegt der Auswahlwert selbst mit dem Zufallsbonus unter der Besuchsschwelle. Er berücksichtigt Vorlieben beziehungsweise Hunger/Durst, Preis, Entfernung, Wartezeit und frühere Besuche.`,
      b.price > CATALOG[b.kind].price
        ? priceAction
        : nav(
            b.kind === "coaster" ? "track" : "operations",
            b.kind === "coaster" ? "Fahrprofil verbessern" : "Preis & Angebot prüfen",
          ),
    );
  if (isRide(b.kind) && samples >= 3) {
    const disappointed = choosing.filter(
      (g) => (rideAppeal(b, g.profile) - 4) * 2 - b.price * 0.12 < 0,
    );
    if (disappointed.length >= samples * 0.6)
      add(
        "ride-fit",
        "warning",
        "Fahrt und Gästewünsche passen schlecht zusammen",
        `Bei ${disappointed.length} von ${samples} betrachteten Besuchsgruppen wäre der aktuelle Freude-Effekt nach der Fahrt negativ. Intensität, Fahrspaß, Zustand und Preis bestimmen diesen Wert. Prüfe ${b.kind === "coaster" ? "ein abwechslungsreiches Fahrprofil" : "den Preis und passende Alternativen für deine Gäste"}.`,
        nav(
          b.kind === "coaster" ? "track" : "operations",
          b.kind === "coaster" ? "Fahrt verbessern" : "Angebot an Gäste anpassen",
        ),
      );
  }
  if (metrics.enRoute + metrics.waiting + metrics.active === 0) {
    if (samples < 3)
      add(
        "sample",
        "tip",
        "Noch wenig Nachfrage zu beurteilen",
        "Es gibt gerade zu wenige laufende Besuchsgruppen für eine belastbare Preis- oder Vorliebenprüfung. Lass den Park etwas weiterlaufen und beobachte die aktuellen Ziele in der Parkanalyse.",
        nav("analysis", "Besucherströme beobachten"),
      );
    else if (
      !isHabitat(b.kind) &&
      (isFood(b.kind) || ["balloon", "plush", "toilet"].includes(b.kind))
    )
      add(
        "shop-demand",
        "tip",
        "Stände werden nach Bedarf besucht",
        "Gäste mit Essen in der Hand oder einem Souvenir kaufen davon nicht sofort erneut. Hunger, Durst, Toilettenbedarf und Restbudget entscheiden mit. Leere Bedienplätze allein bedeuten daher keinen Defekt.",
        nav("analysis", "Bedarf in der Umgebung prüfen"),
      );
    else
      add(
        "discovery",
        "tip",
        "Sichtbarkeit und Konkurrenz prüfen",
        "Technisch kann das Angebot besucht werden. Gäste vergleichen erreichbare Angebote; eine Momentaufnahme ohne Zielgäste beweist keinen Fehler. Prüfe Besucherströme und gegebenenfalls eine gezielte Attraktionskampagne.",
        nav(
          isAttraction(b.kind) ? "marketing" : "analysis",
          isAttraction(b.kind) ? "Passende Werbung prüfen" : "Besucherströme ansehen",
        ),
      );
  }
}

/** Apply only a still-current explicit offer. Caller records undo and displays errors.
 * Pass the action id rendered in the UI so a changed quote cannot be accepted silently. */
export function applyAttractionAdvice(
  s: Park,
  buildingId: number,
  issueId: string,
  expectedActionId?: string,
): string | null {
  const report = attractionAdvice(s, buildingId),
    issue = report?.issues.find((i) => i.id === issueId),
    action = issue?.action;
  const b = s.buildings.find((b) => b.id === buildingId);
  if (!b || !action)
    return "Dieser Vorschlag ist nicht mehr aktuell. Lass die Attraktion erneut prüfen.";
  if (expectedActionId && action.id !== expectedActionId)
    return "Der Vorschlag hat sich geändert. Prüfe Preis und Lösung erneut.";
  if (action.disabledReason) return action.disabledReason;
  switch (action.kind) {
    case "repair":
      return repairAttraction(s, b, buildingBaseCost(b));
    case "assign-crew":
      return assignRideCrew(s, action.value!, b.id);
    case "shorter-program":
      return setRideRounds(b, action.value!);
    case "lower-price":
      b.price = action.value!;
      return null;
    case "connect-open": {
      const plan = entryPlan(s, b);
      if (plan.error) return plan.error;
      if (plan.entry) {
        const error = setAccessPod(s, b, "entry", plan.entry, false);
        if (error) return error;
      }
      return connectBuilding(s, b, false);
    }
    case "connect-exit": {
      const proposal = suggestExit(s, b, false);
      if (!proposal) return "Für diesen Ausgang gibt es gerade keine freie Lösung.";
      const wasOpen = b.open;
      const error = applyExitSuggestion(s, b, proposal, false);
      // Pod relocation resets an idle ride. Preserve its previous operating choice;
      // this action is never offered when guests or a test would be interrupted.
      if (!error) b.open = wasOpen;
      return error;
    }
    default:
      return "Öffne für diesen Hinweis den passenden Verwaltungsbereich.";
  }
}
