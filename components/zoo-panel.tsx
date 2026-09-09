import { SPECIES, isHabitat, zooStats, welfare, type Species } from "../game/zoo";
import { access, type Park, type Building, type Kind } from "../game/simulation";
import { ANIMAL_NAMES } from "../game/zoo-motion";
const euro = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export function ZooOverview({
  park,
  onKeepers,
  onBuild,
}: {
  park: Park;
  onKeepers: (n: number) => void;
  onBuild: (k: Kind) => void;
}) {
  const stats = zooStats(park),
    hasHome = park.buildings.some((b) => b.kind === "keeperhut" && access(park, b));
  return (
    <section className="zoo-overview">
      <p>
        Baue ein Gehege, verbinde seinen Eingang mit einem Weg und nimm Tiere auf. Gäste beobachten
        sie von außen; Tiere bleiben innerhalb der Zäune.
      </p>
      <div className="analysis-stats">
        <div>
          <b>{stats.count}</b>
          <span>Tiere · {stats.species} Arten</span>
        </div>
        <div>
          <b>{stats.welfare}%</b>
          <span>Tierwohl</span>
        </div>
      </div>
      <label>
        Tierpfleger · {park.zoo?.keepers ?? 0}
        <input
          aria-label="Anzahl Tierpfleger"
          type="range"
          min="0"
          max="8"
          step="1"
          value={park.zoo?.keepers ?? 0}
          onChange={(e) => onKeepers(Number(e.target.value))}
        />
      </label>
      <p className="small">
        90 € pro Tierpfleger und Spieltag · Pflegebedarf: 8 € pro Tier je Versorgung.{" "}
        {stats.working} unterwegs oder bei der Arbeit.
      </p>
      {!hasHome && (
        <p className="fit-error">
          Baue eine Tierpflegerstation an einen erreichbaren Parkweg, damit dein Team arbeiten kann.
        </p>
      )}
      <button className="secondary" onClick={() => onBuild("keeperhut")}>
        Tierpflegerstation bauen · 450 €
      </button>
    </section>
  );
}
export function HabitatPanel({
  park,
  building: b,
  onAction,
}: {
  park: Park;
  building: Building;
  onAction: (action: "adopt" | "rehome" | "care" | "enrichment" | "shelter") => void;
}) {
  if (!isHabitat(b.kind)) return null;
  const kind = b.kind as Species,
    s = SPECIES[kind],
    h = b.habitat!,
    connected = !!access(park, b);
  return (
    <section className="habitat-panel">
      <div className="habitat-title">
        <strong>
          {h.count} / {s.capacity} Tiere
        </strong>
        <b>Tierwohl {Math.round(welfare(b))}%</b>
      </div>
      {h.count > 0 && (
        <p className="animal-names">{ANIMAL_NAMES[kind].slice(0, h.count).join(" · ")}</p>
      )}
      <div className="habitat-meters">
        {(
          [
            ["food", "Futter"],
            ["water", "Wasser"],
            ["clean", "Sauberkeit"],
            ["health", "Gesundheit"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <span>
              {label}
              <b>{Math.round(h[key])}%</b>
            </span>
            <progress max="100" value={h[key]} />
          </label>
        ))}
      </div>
      <button
        className="primary"
        disabled={h.count >= s.capacity || park.cash < s.adoption}
        onClick={() => onAction("adopt")}
      >
        {s.animalName} aufnehmen · {euro(s.adoption)}
      </button>
      {!h.count && (
        <p className="small">
          Das Gehege ist leer. Erst mit Tieren kannst du es für Besucher öffnen.
        </p>
      )}
      <div className="habitat-upgrades">
        <button
          className="secondary"
          disabled={h.enrichment || park.cash < 350}
          onClick={() => onAction("enrichment")}
        >
          {h.enrichment ? "✓ Beschäftigung vorhanden" : "Beschäftigung · 350 €"}
        </button>
        <button
          className="secondary"
          disabled={h.shelter || park.cash < 500}
          onClick={() => onAction("shelter")}
        >
          {h.shelter ? "✓ Rückzugsort vorhanden" : "Rückzugsort · 500 €"}
        </button>
      </div>
      <button
        className="secondary"
        disabled={!h.count || !connected || park.cash < h.count * 8}
        onClick={() => onAction("care")}
      >
        Sofortversorgung · {euro(h.count * 8)}
      </button>
      <p className="small">
        Tierpfleger füllen Futter und Wasser nach, säubern das Gehege und unterstützen die
        Gesundheit. Ohne Pflege leiden Tiere und Besucherzufriedenheit.
      </p>
      {h.count > 0 && (
        <button className="text-button" onClick={() => onAction("rehome")}>
          Ein Tier an Partnerzoo abgeben · ohne Erstattung
        </button>
      )}
    </section>
  );
}
