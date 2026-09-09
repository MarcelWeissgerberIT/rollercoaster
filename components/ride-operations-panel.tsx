import type { Building } from "../game/simulation";
import {
  needsOperator,
  operationsOf,
  operatorName,
  operatorActivity,
  OPERATION_LABELS,
  OPERATOR_WAGE,
} from "../game/operations";
export function RideOperationsPanel({
  building: b,
  onStaffed,
  onRounds,
}: {
  building: Building;
  onStaffed: (staffed: boolean) => void;
  onRounds: (rounds: number) => void;
}) {
  if (!needsOperator(b.kind)) return null;
  const o = operationsOf(b),
    occupied = b.riders.length > 0;
  return (
    <section className="ride-operations-panel">
      <h3>Fahrbetrieb</h3>
      <label className="controlrow">
        <span>{o.staffed ? `${operatorName(b)} · Bedienpersonal` : "Bedienpersonal zuweisen"}</span>
        <input
          type="checkbox"
          aria-label="Bedienpersonal zuweisen"
          checked={o.staffed}
          disabled={occupied && o.staffed}
          onChange={(e) => onStaffed(e.target.checked)}
        />
      </label>
      <p className="small">
        {OPERATION_LABELS[operatorActivity(b)]} · {OPERATOR_WAGE} € pro Spieltag
      </p>
      {!o.staffed && (
        <p className="fit-error">Ohne Crew startet keine Fahrt. Weise Bedienpersonal zu.</p>
      )}
      <label className="controlrow" htmlFor={`ride-rounds-${b.id}`}>
        <span>Runden pro Fahrt</span>
        <strong>{o.rounds}</strong>
      </label>
      <input
        id={`ride-rounds-${b.id}`}
        aria-label="Runden pro Fahrt"
        type="range"
        min="1"
        max="5"
        step="1"
        value={o.rounds}
        onChange={(e) => onRounds(Number(e.target.value))}
      />
      <p className="small">
        Einlass → Sicherheitskontrolle → {o.rounds} {o.rounds === 1 ? "Runde" : "Runden"} →
        Ausstieg. Ein Ticket gilt für das gesamte Programm.
      </p>
      {occupied && (
        <p className="small">
          Noch {o.remainingRounds} {o.remainingRounds === 1 ? "Runde" : "Runden"} einschließlich der
          laufenden Runde. Änderungen gelten ab dem nächsten Start.
        </p>
      )}
    </section>
  );
}
