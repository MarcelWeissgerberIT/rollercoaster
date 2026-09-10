import { ArrowDown, ArrowUp, GitMerge, Pause, Split } from "lucide-react";
import type { Building, Park } from "../game/simulation";
import { operationsOf } from "../game/operations";
import {
  sharedAccessBusy,
  sharedAccessChangeError,
  sharedAccessRoute,
  sharedExitPending,
} from "../game/shared-access";
import "./shared-access-control.css";

export function SharedAccessControl({
  park,
  building,
  onChange,
  onClose,
  onBuildPath,
}: {
  park: Park;
  building: Building;
  onChange: (enabled: boolean) => void;
  onClose: () => void;
  onBuildPath: () => void;
}) {
  const active = !!building.sharedAccess;
  const error = sharedAccessChangeError(park, building, !active);
  const route = active ? sharedAccessRoute(park, building) : [];
  const exiting = active && sharedExitPending(park, building);
  const phase = operationsOf(building).phase;
  return (
    <section
      className="shared-access-control"
      aria-label="Ein- und Ausgang zusammenlegen"
      tabIndex={-1}
    >
      <h4>
        <GitMerge size={17} /> Platzsparender Zugang
      </h4>
      <div className="shared-access-modes" role="group" aria-label="Zugangsart">
        <button
          type="button"
          aria-pressed={!active}
          disabled={active && !!error}
          onClick={() => onChange(false)}
        >
          <Split size={17} />
          <span>Getrennt</span>
        </button>
        <button
          type="button"
          aria-pressed={active}
          disabled={!active && !!error}
          onClick={() => onChange(true)}
        >
          <GitMerge size={17} />
          <span>Gemeinsam</span>
        </button>
      </div>
      <p>
        Ein Pod, ein Weg: Rot führt hinaus, Blau hinein. Erst aussteigen lassen, dann neu
        einsteigen. Die blaue Hälfte bietet zwei Warteplätze pro Feld.
      </p>
      {!active && !error && (
        <p>Leere Pods kannst du sofort zusammenlegen. Den gemeinsamen Weg baust du danach.</p>
      )}
      <div
        className="shared-access-diagram"
        aria-label="Gemeinsamer Weg mit getrennter Einlass- und Auslassspur"
      >
        <div className="shared-access-lane out">
          <ArrowDown size={18} />
          <span>Aussteigen</span>
        </div>
        <div className="shared-access-lane in">
          <ArrowUp size={18} />
          <span>Einsteigen</span>
        </div>
      </div>
      {active && (
        <p className={`shared-access-status${!route.length ? " needs-path" : ""}`} role="status">
          {exiting
            ? "Auslass hat Vorrang · Einlass wartet."
            : !route.length
              ? "Pods zusammengelegt · Anschlussweg fehlt. Verbinde den Pod mit einem blauen Eingangsweg zum Parkweg."
              : building.kind === "wheel" && building.wheel?.phase === "indexing-load"
                ? "Nächste Gondel fährt zur Plattform · Einlass geschlossen."
                : phase === "boarding" || (building.kind !== "wheel" && phase === "checking")
                  ? "Blauer Einlass aktiv · roter Auslass geschlossen."
                  : "Gemeinsamer Zugang aktiv · getrennte Spuren."}
        </p>
      )}
      {active && !route.length && (
        <button type="button" className="secondary shared-access-connect" onClick={onBuildPath}>
          <ArrowUp size={15} /> Gemeinsamen Weg anschließen
        </button>
      )}
      {error && (
        <div className="shared-access-blocked">
          <p>{error}</p>
          {building.open && sharedAccessBusy(park, building) && (
            <button type="button" className="secondary" onClick={onClose}>
              <Pause size={14} /> Für Umbau schließen
            </button>
          )}
        </div>
      )}
      <small>
        Die Umstellung ist kostenlos. Frühere rote Wege bleiben stehen und können bei Bedarf
        abgerissen werden.
      </small>
    </section>
  );
}
