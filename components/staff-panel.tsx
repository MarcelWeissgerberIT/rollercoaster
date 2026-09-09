import type { Park } from "../game/simulation";
import {
  needsOperator,
  hasOperator,
  operatorName,
  operatorActivity,
  OPERATION_LABELS,
  operationsStats,
  OPERATOR_WAGE,
} from "../game/operations";
export function StaffPanel({
  park,
  onCleaners,
  onKeepers,
  onSelectRide,
  onStaffRide,
}: {
  park: Park;
  onCleaners: (count: number) => void;
  onKeepers: (count: number) => void;
  onSelectRide: (id: number) => void;
  onStaffRide: (id: number, staffed: boolean) => void;
}) {
  const ops = operationsStats(park),
    keepers = park.zoo?.keepers ?? 0;
  const wages = park.staff * 80 + keepers * 90 + ops.dailyCost;
  return (
    <section className="staff-panel">
      <h3>Dein Parkteam</h3>
      <div className="analysis-stats">
        <div>
          <b>{park.staff + keepers + ops.staffed}</b>
          <span>Mitarbeitende</span>
        </div>
        <div>
          <b>{wages.toLocaleString("de-DE")} €</b>
          <span>Löhne pro Spieltag</span>
        </div>
      </div>
      <label className="controlrow" htmlFor="staff-cleaners">
        <span>Reinigung</span>
        <strong>{park.staff}</strong>
      </label>
      <input
        id="staff-cleaners"
        aria-label="Anzahl Reinigungskräfte"
        type="range"
        min="0"
        max="8"
        step="1"
        value={park.staff}
        onChange={(e) => onCleaners(Number(e.target.value))}
      />
      <p className="small">80 € je Person und Spieltag · Müll sammeln und Mülleimer leeren.</p>
      <label className="controlrow" htmlFor="staff-keepers">
        <span>Tierpflege</span>
        <strong>{keepers}</strong>
      </label>
      <input
        id="staff-keepers"
        aria-label="Anzahl Tierpfleger"
        type="range"
        min="0"
        max="8"
        step="1"
        value={keepers}
        onChange={(e) => onKeepers(Number(e.target.value))}
      />
      <p className="small">
        90 € je Person und Spieltag · Benötigt eine erreichbare Tierpflegerstation. Versorgung
        kostet zusätzlich 8 € pro Tier.
      </p>
      <h4>
        Bedienpersonal · {ops.staffed} / {ops.rides}
      </h4>
      <p className="small">
        Eine Person pro Fahrgeschäft · {OPERATOR_WAGE} € pro Spieltag. Einlass, Kontrolle und
        Bedienpult.
      </p>
      {ops.unstaffed > 0 && (
        <p className="fit-error">
          {ops.unstaffed} {ops.unstaffed === 1 ? "Fahrgeschäft wartet" : "Fahrgeschäfte warten"} auf
          eine Crew.
        </p>
      )}
      {!ops.rides && (
        <p className="small">
          Beim Bau eines Fahrgeschäfts wird automatisch Bedienpersonal zugewiesen.
        </p>
      )}
      <div className="staff-ride-list" style={{ maxHeight: 260, overflowY: "auto" }}>
        {park.buildings
          .filter((b) => needsOperator(b.kind))
          .map((b) => (
            <div className="controlrow" key={b.id}>
              <button className="secondary" onClick={() => onSelectRide(b.id)}>
                {b.name}
                <small style={{ display: "block" }}>
                  {hasOperator(b)
                    ? `${operatorName(b)} · ${OPERATION_LABELS[operatorActivity(b)]}`
                    : "Crew fehlt"}
                </small>
              </button>
              <label>
                <input
                  type="checkbox"
                  aria-label={`Bedienpersonal für ${b.name}`}
                  checked={hasOperator(b)}
                  disabled={b.riders.length > 0 && hasOperator(b)}
                  onChange={(e) => onStaffRide(b.id, e.target.checked)}
                />{" "}
                Zugewiesen
              </label>
            </div>
          ))}
      </div>
    </section>
  );
}
