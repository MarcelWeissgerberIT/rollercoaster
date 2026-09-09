import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  FerrisWheel,
  Map,
  MapPin,
  PawPrint,
  Settings2,
  ShoppingBag,
  Smile,
  Trash2,
  Users,
} from "lucide-react";
import type {
  TrafficBuilding,
  TrafficMode,
  TrafficReport,
  TrafficZone,
} from "../game/park-traffic";
import "./park-traffic.css";

type Metric = "live" | "visits" | "appeal";
type Category = TrafficBuilding["category"];
type Filter = "all" | "animals" | "rides";

const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const wholeFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const format = (value: number) => numberFormat.format(value);
const whole = (value: number) => wholeFormat.format(value);
const percent = (value: number, total: number) => (total > 0 ? `${format(value)} %` : "–");
const categoryLabels: Record<Category, string> = {
  animals: "Tiere & Gehege",
  rides: "Fahrgeschäfte",
  shops: "Versorgung",
  other: "Service & Transport",
};
const modes = [
  { id: "crowd", label: "Andrang", description: "Gäste je Bereich", Icon: Users },
  { id: "queues", label: "Wartende", description: "Gäste in der Schlange", Icon: Clock },
  { id: "mood", label: "Stimmung", description: "Durchschnittliche Laune", Icon: Smile },
  { id: "litter", label: "Müll", description: "Müllteile je Bereich", Icon: Trash2 },
] as const;
const scales: Record<TrafficMode, { label: string; color: string }[]> = {
  crowd: [
    { label: "0", color: "#b5c1b2" },
    { label: "1–3", color: "#85c5b0" },
    { label: "4–8", color: "#e6cc78" },
    { label: "9–15", color: "#e5a16c" },
    { label: "16+", color: "#d87575" },
  ],
  queues: [
    { label: "0", color: "#b5c1b2" },
    { label: "1–3", color: "#85c5b0" },
    { label: "4–7", color: "#e6cc78" },
    { label: "8–11", color: "#e5a16c" },
    { label: "12+", color: "#d87575" },
  ],
  mood: [
    { label: "Keine Gäste", color: "#b5c1b2" },
    { label: "Unter 45", color: "#d87575" },
    { label: "45–74", color: "#e6cc78" },
    { label: "Ab 75", color: "#85c5b0" },
  ],
  litter: [
    { label: "0", color: "#b5c1b2" },
    { label: "1–2", color: "#85c5b0" },
    { label: "3–5", color: "#e6cc78" },
    { label: "6–9", color: "#e5a16c" },
    { label: "10+", color: "#d87575" },
  ],
};

function CategoryIcon({ category }: { category: Category }) {
  const Icon =
    category === "animals"
      ? PawPrint
      : category === "rides"
        ? FerrisWheel
        : category === "shops"
          ? ShoppingBag
          : MapPin;
  return <Icon aria-hidden="true" />;
}

function zoneName(zone: TrafficZone) {
  return `Bereich ${zone.x + 1} / ${zone.y + 1}`;
}

function zoneValue(zone: TrafficZone, mode: TrafficMode) {
  if (mode === "mood")
    return zone.happiness === null ? "Keine Gäste" : `${whole(zone.happiness)} / 100`;
  if (mode === "litter") return `${whole(zone.litter)} Müllteile`;
  if (mode === "queues") return `${whole(zone.waiting)} Wartende`;
  return `${whole(zone.guests)} Gäste`;
}

function zoneScore(zone: TrafficZone, mode: TrafficMode) {
  if (mode === "mood") return zone.happiness === null ? -1 : 100 - zone.happiness;
  if (mode === "litter") return zone.litter;
  if (mode === "queues") return zone.waiting;
  return zone.guests;
}

function SelectedZone({
  zone,
  onFocusBuilding,
}: {
  zone: TrafficZone;
  onFocusBuilding: (id: number) => void;
}) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    card.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [zone.id]);
  return (
    <article ref={card} className="pt-selected-zone" data-testid="traffic-selected-zone">
      <div className="pt-section-heading">
        <div>
          <span className="pt-eyebrow">Im Park ausgewählt</span>
          <h3>
            <MapPin aria-hidden="true" />
            {zoneName(zone)}
          </h3>
        </div>
        <span className="pt-zone-total">
          {whole(zone.guests)}
          <small>Gäste</small>
        </span>
      </div>
      <dl className="pt-zone-stats">
        {[
          ["Unterwegs", zone.walking],
          ["Warten", zone.waiting],
          ["Bei den Tieren", zone.observing],
          ["Fahren", zone.riding],
          ["Rasten", zone.resting],
          ["Gehen heim", zone.leaving],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{whole(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <div className="pt-zone-health">
        <span>
          <Smile aria-hidden="true" />
          Laune <b>{zone.happiness === null ? "–" : `${whole(zone.happiness)} / 100`}</b>
        </span>
        <span>
          <Trash2 aria-hidden="true" />
          <b>{whole(zone.litter)}</b> Müllteile
        </span>
      </div>
      {zone.unhappy > 0 && (
        <p className="pt-zone-unhappy">{whole(zone.unhappy)} Gäste sind hier unzufrieden.</p>
      )}
      <h4>Was erklärt diesen Bereich?</h4>
      {zone.reasons.length ? (
        <ul className="pt-reasons">
          {zone.reasons.slice(0, 4).map((reason, i) => (
            <li key={`${i}-${reason}`}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="pt-note">Hier sind derzeit keine auffälligen Ursachen erkennbar.</p>
      )}
      {zone.reasons.length > 4 && (
        <details className="pt-more-reasons">
          <summary>Weitere Beobachtungen ({zone.reasons.length - 4})</summary>
          <ul className="pt-reasons">
            {zone.reasons.slice(4).map((reason, i) => (
              <li key={`${i}-${reason}`}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
      {zone.targets.length > 0 && (
        <div className="pt-zone-targets">
          <h4>Ziele der Gäste hier</h4>
          {zone.targets.slice(0, 4).map((target) => (
            <button type="button" key={target.id} onClick={() => onFocusBuilding(target.id)}>
              <span>{target.name}</span>
              <b>{whole(target.count)}</b>
              <ArrowUpRight aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function BuildingRow({
  building,
  index,
  metric,
  denominator,
  onInspect,
  onFocusBuilding,
}: {
  building: TrafficBuilding;
  index: number;
  metric: Metric;
  denominator: number;
  onInspect: (id: number) => void;
  onFocusBuilding: (id: number) => void;
}) {
  const share =
    metric === "live"
      ? building.share
      : metric === "visits"
        ? building.visitShare
        : building.appealShare;
  const count =
    metric === "live"
      ? building.targeting
      : metric === "visits"
        ? building.served
        : building.available
          ? building.appeal
          : 0;
  const unit = metric === "live" ? "Gäste" : metric === "visits" ? "Besuche" : "Modellpunkte";
  return (
    <details className="pt-building" data-testid={`traffic-building-${building.id}`}>
      <summary>
        <span className={`pt-category-icon pt-category-${building.category}`}>
          <CategoryIcon category={building.category} />
        </span>
        <span className="pt-building-main">
          <b>
            {index + 1}. {building.name}
          </b>
          <span>
            {categoryLabels[building.category]}
            {!building.available && (
              <em>
                {" "}
                ·{" "}
                {building.reasons.some((reason) => /^Geschlossen\b/.test(reason))
                  ? "geschlossen"
                  : "nicht wählbar"}
              </em>
            )}
          </span>
          <span className="pt-building-bar" aria-hidden="true">
            <i
              className={`pt-category-${building.category}`}
              style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
            />
          </span>
        </span>
        <span className="pt-building-value">
          <b>{percent(share, denominator)}</b>
          <span>
            {format(count)} {unit}
          </span>
        </span>
        <ChevronDown className="pt-chevron" aria-hidden="true" />
      </summary>
      <div className="pt-building-detail">
        <dl className="pt-building-stats">
          <div>
            <dt>Unterwegs zum Ziel</dt>
            <dd>{whole(building.enRoute)}</dd>
          </div>
          <div>
            <dt>In der Warteschlange</dt>
            <dd>{whole(building.waiting)}</dd>
          </div>
          <div>
            <dt>Erleben gerade</dt>
            <dd>{whole(building.active)}</dd>
          </div>
          <div>
            <dt>Erwartete Wartezeit</dt>
            <dd>{whole(building.expectedWait)} s</dd>
          </div>
          <div>
            <dt>Besuche seit Bau</dt>
            <dd>{whole(building.served)}</dd>
          </div>
          <div>
            <dt>Umsatz seit Bau</dt>
            <dd>{format(building.revenue)} €</dd>
          </div>
        </dl>
        <h4>Einfluss auf die Nachfrage</h4>
        {building.reasons.length ? (
          <ul className="pt-reasons">
            {building.reasons.map((reason, i) => (
              <li key={`${i}-${reason}`}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="pt-note">Derzeit keine weiteren Einflussfaktoren erfasst.</p>
        )}
        <div className="pt-building-actions">
          <button type="button" onClick={() => onFocusBuilding(building.id)}>
            <MapPin aria-hidden="true" />
            Im Park zeigen
          </button>
          <button type="button" onClick={() => onInspect(building.id)}>
            <Settings2 aria-hidden="true" />
            Verwalten
          </button>
        </div>
      </div>
    </details>
  );
}

export default function ParkTrafficPanel({
  report,
  mode,
  onMode,
  selected,
  onZone,
  onInspect,
  onFocusBuilding,
}: {
  report: TrafficReport;
  mode: TrafficMode | null;
  onMode: (mode: TrafficMode | null) => void;
  selected: TrafficZone | null;
  onZone: (zone: TrafficZone) => void;
  onInspect: (id: number) => void;
  onFocusBuilding: (id: number) => void;
}) {
  const [metric, setMetric] = useState<Metric>("live");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [lastMode, setLastMode] = useState<TrafficMode>("crowd");
  const displayMode = mode ?? lastMode;
  const idle = Math.max(0, report.totalGuests - report.totalTargeting);
  const totalAppeal = report.buildings.reduce(
    (sum, building) => sum + (building.available ? building.appeal : 0),
    0,
  );
  const denominator =
    metric === "live"
      ? report.totalTargeting
      : metric === "visits"
        ? report.totalVisits
        : totalAppeal;
  const shares = report.groups.map((group) => ({
    ...group,
    value:
      metric === "live"
        ? group.share
        : metric === "visits"
          ? group.visitShare
          : report.buildings.reduce(
              (sum, building) =>
                sum + (building.category === group.category ? building.appealShare : 0),
              0,
            ),
    count:
      metric === "live"
        ? group.targeting
        : metric === "visits"
          ? group.served
          : report.buildings.reduce(
              (sum, building) =>
                sum +
                (building.category === group.category && building.available ? building.appeal : 0),
              0,
            ),
  }));
  const ranked = report.buildings
    .filter((building) => filter === "all" || building.category === filter)
    .slice()
    .sort((a, b) => {
      const delta =
        metric === "live"
          ? b.targeting - a.targeting
          : metric === "visits"
            ? b.served - a.served
            : b.appealShare - a.appealShare;
      return delta || a.name.localeCompare(b.name, "de") || a.id - b.id;
    });
  const zones = report.zones
    .filter((zone) =>
      displayMode === "mood" ? zone.happiness !== null : zoneScore(zone, displayMode) > 0,
    )
    .slice()
    .sort((a, b) => zoneScore(b, displayMode) - zoneScore(a, displayMode) || b.guests - a.guests)
    .slice(0, 4);
  const changeMode = (nextMode: TrafficMode) => {
    setLastMode(nextMode);
    onMode(nextMode);
  };
  const metricDescription =
    metric === "live"
      ? `Anteil der aktuellen Ziele · ${whole(report.totalTargeting)} Gäste`
      : metric === "visits"
        ? `Anteil aller Besuche · ${whole(report.totalVisits)} Besuche`
        : `Anteil der Modell-Anziehung · ${format(totalAppeal)} Punkte`;

  return (
    <section
      className="pt-panel"
      data-testid="park-traffic-panel"
      aria-label="Besucherströme und Nachfrage"
    >
      <header className="pt-header">
        <div>
          <span className="pt-eyebrow">Dein Park im Blick</span>
          <h2>Besucherströme</h2>
        </div>
        <span className="pt-live">
          <i aria-hidden="true" />
          Live
        </span>
      </header>
      <div className="pt-overview">
        <div>
          <Users aria-hidden="true" />
          <b>{whole(report.totalGuests)}</b>
          <span>Gäste im Park</span>
        </div>
        <div>
          <MapPin aria-hidden="true" />
          <b>{whole(report.totalTargeting)}</b>
          <span>mit aktuellem Ziel</span>
        </div>
      </div>

      <section className="pt-heatmap" aria-label="Heatmap einstellen">
        <div className="pt-section-heading">
          <h3>
            <Map aria-hidden="true" />
            Heatmap
          </h3>
          <button
            className="pt-toggle"
            type="button"
            aria-pressed={mode !== null}
            onClick={() => onMode(mode === null ? lastMode : null)}
            data-testid="traffic-heatmap-toggle"
          >
            <span className="pt-toggle-track" aria-hidden="true">
              <i />
            </span>
            {mode === null ? "Aus" : "Aktiv"}
          </button>
        </div>
        <p className="pt-note">Entdecke, wo sich Gäste sammeln und was dort los ist.</p>
        <div className="pt-modes" role="group" aria-label="Heatmap-Modus">
          {modes.map(({ id, label, description, Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={mode === id}
              onClick={() => changeMode(id)}
              title={description}
              data-testid={`traffic-mode-${id}`}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div
          className="pt-legend"
          data-testid="traffic-legend"
          aria-label={`Legende: ${modes.find((item) => item.id === displayMode)?.description}`}
        >
          <span className="pt-legend-title">
            {modes.find((item) => item.id === displayMode)?.description}
            {displayMode === "mood" ? " · 0–100" : ""}
          </span>
          <div>
            {scales[displayMode].map((step) => (
              <span key={step.label}>
                <i style={{ background: step.color }} />
                <span>{step.label}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="pt-map-hint">
          <MapPin aria-hidden="true" />
          {mode === null
            ? "Wähle einen Modus, um die Karte einzufärben."
            : "Klicke auf einen Bereich im Park, um ihn zu untersuchen."}
        </p>
      </section>

      {selected && <SelectedZone zone={selected} onFocusBuilding={onFocusBuilding} />}

      <section className="pt-hotspots" aria-label="Auffällige Bereiche">
        <div className="pt-section-heading">
          <h3>
            {displayMode === "mood"
              ? "Niedrigste Stimmung"
              : displayMode === "litter"
                ? "Wo Müll liegen bleibt"
                : displayMode === "queues"
                  ? "Wo Gäste warten"
                  : "Wo gerade viel los ist"}
          </h3>
          <span className="pt-caption">Bereiche</span>
        </div>
        {zones.length ? (
          <div className="pt-zone-list">
            {zones.map((zone, index) => (
              <button
                type="button"
                key={zone.id}
                aria-pressed={selected?.id === zone.id}
                onClick={() => {
                  if (mode === null) onMode(displayMode);
                  onZone(zone);
                }}
                data-testid={`traffic-zone-${zone.id}`}
              >
                <span className="pt-zone-rank">{index + 1}</span>
                <span className="pt-zone-label">
                  <b>{zoneName(zone)}</b>
                  <span>
                    {zone.targets[0]?.name ??
                      (zone.litter > 0 && !zone.guests
                        ? "Zurzeit ohne Gäste"
                        : "Wege und Aufenthaltsflächen")}
                  </span>
                </span>
                <strong>{zoneValue(zone, displayMode)}</strong>
                <ArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className="pt-empty">
            {displayMode === "litter"
              ? "Hier liegt gerade kein Müll. Schön sauber!"
              : displayMode === "queues"
                ? "Zurzeit wartet niemand in einer Schlange."
                : "Sobald Gäste im Park sind, erscheinen hier die Bereiche."}
          </p>
        )}
      </section>

      <section className="pt-demand" aria-label="Nachfrage nach Angeboten">
        <div className="pt-section-heading">
          <h3>Was zieht Gäste an?</h3>
          <span className="pt-caption">Parkweit</span>
        </div>
        <div className="pt-metrics" role="group" aria-label="Kennzahl für Nachfrage">
          {(
            [
              { id: "live", label: "Ziele jetzt" },
              { id: "visits", label: "Besuche" },
              { id: "appeal", label: "Anziehung" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={metric === item.id}
              onClick={() => {
                setMetric(item.id);
                setShowAll(false);
              }}
              data-testid={`traffic-metric-${item.id}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="pt-denominator" data-testid="traffic-denominator">
          {metricDescription}
        </p>
        <div className="pt-stacked-bar" aria-hidden="true">
          {shares.map((group) => (
            <span
              className={`pt-category-${group.category}`}
              key={group.category}
              style={{ width: `${Math.max(0, Math.min(100, group.value))}%` }}
            />
          ))}
        </div>
        <dl className="pt-group-list" data-testid="traffic-category-shares">
          {shares.map((group) => (
            <div key={group.category}>
              <dt>
                <span className={`pt-group-dot pt-category-${group.category}`} />
                {categoryLabels[group.category]}
              </dt>
              <dd>
                <span>
                  {format(group.count)}{" "}
                  {metric === "live" ? "Gäste" : metric === "visits" ? "Besuche" : "Pkt."}
                </span>
                <b>{percent(group.value, denominator)}</b>
              </dd>
            </div>
          ))}
        </dl>
        <p className={`pt-metric-note${metric === "appeal" ? " pt-model-note" : ""}`}>
          {metric === "live"
            ? `${whole(idle)} Gäste ohne aktuelles Angebotsziel. Gezählt wird das momentane Ziel – auch während des Wartens oder Besuchs.`
            : metric === "visits"
              ? "Besuche seit Bau; Mehrfachbesuche zählen. Das sind keine einzigartigen Gäste."
              : "Modellwert verfügbarer Attraktionen aus Familiensicht; keine gemessene Herkunft der Gäste und keine Besucherprognose."}
        </p>

        <div className="pt-ranking-heading">
          <h4>Einzelne Angebote</h4>
          <label>
            <span className="pt-sr-only">Angebote filtern</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as Filter);
                setShowAll(false);
              }}
              data-testid="traffic-building-filter"
            >
              <option value="all">Alle Angebote</option>
              <option value="animals">Nur Tiere</option>
              <option value="rides">Nur Fahrgeschäfte</option>
            </select>
          </label>
        </div>
        {filter !== "all" && (
          <p className="pt-filter-note">
            Die Prozentwerte beziehen sich weiterhin auf den ganzen Park.
          </p>
        )}
        {ranked.length ? (
          <div className="pt-building-list">
            {(showAll ? ranked : ranked.slice(0, 6)).map((building, index) => (
              <BuildingRow
                key={building.id}
                building={building}
                index={index}
                metric={metric}
                denominator={denominator}
                onInspect={onInspect}
                onFocusBuilding={onFocusBuilding}
              />
            ))}
          </div>
        ) : (
          <p className="pt-empty">
            {filter === "animals"
              ? "Baue ein Tiergehege, um die Nachfrage nach Tieren zu vergleichen."
              : filter === "rides"
                ? "Sobald ein Fahrgeschäft gebaut ist, erscheint es hier."
                : "Baue dein erstes Angebot. Seine Nachfrage und Besuche erscheinen dann hier."}
          </p>
        )}
        {ranked.length > 6 && (
          <button
            type="button"
            className="pt-show-more"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            data-testid="traffic-show-more"
          >
            {showAll ? "Weniger anzeigen" : `${ranked.length - 6} weitere Angebote anzeigen`}
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      </section>
    </section>
  );
}
