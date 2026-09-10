import { useId, useState } from "react";
import { Eye, FerrisWheel, PawPrint, Search, TrainFront, X } from "lucide-react";
import { CATALOG, isAttraction, type Park } from "../game/simulation";
import { assetUrl } from "../game/assets";
import { isTransport } from "../game/transit";
import { isHabitat } from "../game/zoo";
import "./attraction-directory.css";

export type AttractionDirectoryProps = {
  park: Park;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onFocus: (id: number) => void;
};

export function AttractionDirectory({
  park,
  selectedId,
  onSelect,
  onFocus,
}: AttractionDirectoryProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const attractions = park.buildings.filter(
    (building) => isAttraction(building.kind) || isTransport(building.kind),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const filtered = attractions.filter((building) => {
    const category = isHabitat(building.kind)
      ? "Tiere Gehege Zoo"
      : isTransport(building.kind)
        ? "Transport Haltestelle"
        : "Attraktion Fahrgeschäft";
    return `${building.name} ${CATALOG[building.kind].name} ${category}`
      .toLocaleLowerCase("de-DE")
      .includes(normalizedQuery);
  });

  return (
    <section className="attraction-directory" aria-label="Attraktionen im Park">
      <p className="ad-intro">
        Wähle eine Attraktion für ihre Details. Mit dem Auge zoomst du direkt zu ihr.
      </p>
      <label className="ad-search-label" htmlFor={searchId}>
        Im Park finden
      </label>
      <div className="ad-search">
        <Search size={17} aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name oder Attraktionsart …"
          autoComplete="off"
        />
        {query && (
          <button type="button" aria-label="Suche leeren" onClick={() => setQuery("")}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="ad-count" role="status">
        {normalizedQuery
          ? `${filtered.length} von ${attractions.length} gefunden`
          : `${attractions.length} ${attractions.length === 1 ? "Attraktion" : "Attraktionen"} im Park`}
      </p>
      {!filtered.length ? (
        <div className="ad-empty">
          {attractions.length ? <Search aria-hidden="true" /> : <FerrisWheel aria-hidden="true" />}
          <strong>
            {attractions.length ? "Keine passende Attraktion" : "Hier ist Platz für deine Ideen"}
          </strong>
          <p>
            {attractions.length
              ? "Versuche einen anderen Namen oder eine Art wie Achterbahn oder Gehege."
              : "Baue ein Fahrgeschäft, ein Gehege oder eine Haltestelle. Danach findest du es hier."}
          </p>
        </div>
      ) : (
        <ul className="ad-list">
          {filtered.map((building) => {
            const category = isHabitat(building.kind)
              ? "habitat"
              : isTransport(building.kind)
                ? "transport"
                : "ride";
            const Icon =
              category === "habitat"
                ? PawPrint
                : category === "transport"
                  ? TrainFront
                  : FerrisWheel;
            const selected = selectedId === building.id;
            return (
              <li
                className={`ad-card ad-${category}${selected ? " is-selected" : ""}`}
                key={building.id}
                data-testid={`attraction-card-${building.id}`}
              >
                <button
                  type="button"
                  className="ad-select"
                  aria-label={`${building.name} auswählen`}
                  aria-pressed={selected}
                  onClick={() => onSelect(building.id)}
                  data-testid={`attraction-select-${building.id}`}
                >
                  <span className="ad-thumbnail">
                    <img src={assetUrl(CATALOG[building.kind].sprite)} alt="" loading="lazy" />
                  </span>
                  <span className="ad-description">
                    <strong>{building.name}</strong>
                    <span className="ad-type">
                      <Icon size={12} aria-hidden="true" />
                      {CATALOG[building.kind].name}
                    </span>
                    <span className={`ad-state${building.open ? " is-open" : ""}`}>
                      <i aria-hidden="true" />
                      {building.open ? "Geöffnet" : "Geschlossen"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ad-focus"
                  aria-label={`${building.name} im Park ansehen`}
                  title={`${building.name} im Park ansehen`}
                  onClick={() => onFocus(building.id)}
                  data-testid={`attraction-focus-${building.id}`}
                >
                  <Eye size={19} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
