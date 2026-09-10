import { DoorOpen, Gauge, LogOut, MapPin, Minus, Plus, Users } from "lucide-react";
import { difficultyCost, difficultyEuro } from "../game/difficulty";
import type { Building, Park } from "../game/simulation";
import { staffLocation, type StaffRef } from "../game/staff";
import {
  needsOperator,
  operationsOf,
  operatorName,
  operatorActivity,
  OPERATION_LABELS,
  OPERATOR_WAGE,
  OPERATOR_POSTS,
} from "../game/operations";
import "./staff-cards.css";
export function RideOperationsPanel({
  building: b,
  park,
  onStaffed,
  onRounds,
  onLocateStaff,
}: {
  building: Building;
  park?: Park;
  onStaffed: (staffed: boolean) => void;
  onRounds: (rounds: number) => void;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  if (!needsOperator(b.kind)) return null;
  const o = operationsOf(b),
    occupied = b.riders.length > 0;
  return (
    <section
      className="ride-operations-panel sc sc-ride-ops"
      data-testid={`ride-operations-${b.id}`}
    >
      <h3>Fahrbetrieb</h3>
      <div className="sc-crew-status">
        <Users aria-hidden="true" />
        <span>{o.staffed ? "Crew zugewiesen · 3 Personen" : "Crew fehlt · 3 Posten"}</span>
      </div>
      <div className="sc-crew-price">
        <span>Gesamte Crew / Spieltag</span>
        <b>{difficultyEuro(difficultyCost(park ?? {}, OPERATOR_WAGE, "wages"))}</b>
      </div>
      {o.staffed && (
        <div className="sc-crew-stations" aria-label="Arbeitsplätze der Fahrgeschäft-Crew">
          {OPERATOR_POSTS.map((post) => {
            const ref: StaffRef = { kind: "operator", id: b.id, post },
              location = park ? staffLocation(park, ref) : null,
              role =
                post === "control"
                  ? "Fahrsteuerung · Steuerhaus"
                  : post === "entry"
                    ? "Einlass · Kontrolle"
                    : "Auslass · Betreuung",
              Icon = post === "control" ? Gauge : post === "entry" ? DoorOpen : LogOut;
            return (
              <button
                type="button"
                key={post}
                disabled={!location || !onLocateStaff}
                onClick={() => onLocateStaff?.(ref)}
                aria-label={`${location?.name ?? operatorName(b, post)} am ${post === "control" ? "Steuerhaus" : post === "entry" ? "Einlass" : "Auslass"} im Park zeigen`}
                data-testid={`ride-crew-locate-${b.id}-${post}`}
              >
                <Icon aria-hidden="true" />
                <span>
                  <small>{role}</small>
                  <strong>{location?.name ?? operatorName(b, post)}</strong>
                  <em>
                    {b.open
                      ? (location?.label ?? OPERATION_LABELS[operatorActivity(b)])
                      : "Fahrgeschäft geschlossen"}
                  </em>
                </span>
                <MapPin aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      <p className="sc-intro">
        Steuerhaus und Bedienpult werden mit dem Fahrgeschäft gebaut. Die drei festen Posten teilen
        sich den oben genannten Crewlohn.
      </p>
      <button
        type="button"
        className={o.staffed ? "sc-release" : "sc-hire-operator"}
        disabled={occupied && o.staffed}
        onClick={() => onStaffed(!o.staffed)}
      >
        {o.staffed ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {o.staffed ? "Gesamte Crew abziehen" : "Crew zuweisen · 3 Personen"}
      </button>
      {!o.staffed && (
        <p className="fit-error">
          Ohne Crew startet keine Fahrt. Weise die drei Posten gemeinsam zu.
        </p>
      )}
      <label className="controlrow sc-rounds-label" htmlFor={`ride-rounds-${b.id}`}>
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
          laufenden Runde. Änderungen gelten ab dem nächsten Start. Die Crew kann nach dem Ausstieg
          abgezogen werden.
        </p>
      )}
    </section>
  );
}
