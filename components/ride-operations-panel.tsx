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
  crewPoolOf,
  crewMemberName,
  canAssignRideCrew,
} from "../game/operations";
import "./staff-cards.css";
export type CrewAssignmentHandlers = {
  onHireCrew: () => void;
  onDismissCrew: (crewId: number) => void;
  onAssignCrew: (crewId: number, buildingId: number | null) => void;
  onCrewAutomatic: (crewId: number) => void;
  onRideStaffingMode: (buildingId: number, mode: "auto" | "off") => void;
};
export function RideOperationsPanel({
  building: b,
  park,
  onRounds,
  onLocateStaff,
  ...crewActions
}: {
  building: Building;
  park?: Park;
  onRounds: (rounds: number) => void;
  onLocateStaff?: (ref: StaffRef) => void;
} & CrewAssignmentHandlers) {
  if (!needsOperator(b.kind)) return null;
  const o = operationsOf(b),
    occupied = b.riders.length > 0,
    crews = park ? crewPoolOf(park).crews : [],
    crew = crews.find((item) => item.buildingId === b.id),
    releaseError = park && crew ? canAssignRideCrew(park, crew.id, null) : null;
  return (
    <section
      className="ride-operations-panel sc sc-ride-ops"
      data-testid={`ride-operations-${b.id}`}
    >
      <h3>Fahrbetrieb</h3>
      <div className="sc-crew-status">
        <Users aria-hidden="true" />
        <span>
          {crew
            ? `Crew #${crew.id} · ${crew.mode === "manual" ? "fest zugewiesen" : "automatischer Einsatz"}`
            : "Keine Crew im Einsatz"}
        </span>
      </div>
      <div className="sc-crew-price">
        <span>Gesamte Crew / Spieltag</span>
        <b>{difficultyEuro(difficultyCost(park ?? {}, OPERATOR_WAGE, "wages"))}</b>
      </div>
      {o.staffed && (
        <div className="sc-crew-stations" aria-label="Arbeitsplätze der Fahrgeschäft-Crew">
          {OPERATOR_POSTS.map((post) => {
            const ref: StaffRef = { kind: "operator", id: b.id, crewId: crew?.id, post },
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
        Steuerhaus und Bedienpult gehören zur Anlage. Die drei Posten werden immer gemeinsam als
        Crew zugewiesen.
      </p>
      <div className="sc-assignment-mode" aria-label="Automatische Besetzung dieser Anlage">
        <button
          type="button"
          aria-pressed={o.assignment !== "off"}
          onClick={() => crewActions.onRideStaffingMode(b.id, "auto")}
          data-testid={`ride-staff-auto-${b.id}`}
        >
          Automatisch besetzen
        </button>
        <button
          type="button"
          aria-pressed={o.assignment === "off"}
          disabled={!!releaseError}
          title={releaseError ?? undefined}
          onClick={() => crewActions.onRideStaffingMode(b.id, "off")}
          data-testid={`ride-staff-off-${b.id}`}
        >
          Automatik aus
        </button>
      </div>
      <p className="sc-hint">
        {o.assignment === "off"
          ? "Diese Anlage nimmt kein Team automatisch an. Du kannst eine Crew unten fest zuweisen."
          : "Verfügbare Crews werden automatisch verteilt. Offene, getestete Anlagen haben Vorrang; feste Zuweisungen bleiben erhalten."}
      </p>
      {crew && (
        <>
          {crew.mode === "manual" && (
            <button
              type="button"
              className="sc-release"
              onClick={() => crewActions.onCrewAutomatic(crew.id)}
              data-testid={`ride-crew-unpin-${b.id}`}
            >
              Feste Bindung lösen · automatisch verteilen
            </button>
          )}
          <button
            type="button"
            className="sc-release"
            disabled={!!releaseError}
            title={releaseError ?? undefined}
            onClick={() => crewActions.onAssignCrew(crew.id, null)}
            data-testid={`ride-crew-release-${b.id}`}
          >
            <Minus aria-hidden="true" /> Crew freigeben · im Team behalten
          </button>
          {releaseError && <p className="sc-hint">{releaseError}</p>}
        </>
      )}
      <details className="sc-crew-assignment" data-testid={`ride-crew-picker-${b.id}`} open={!crew}>
        <summary>
          <span>{crew ? "Andere Crew zuweisen" : "Verfügbare Crew auswählen"}</span>
          <MapPin aria-hidden="true" />
        </summary>
        <div className="sc-assignment-options">
          {crews
            .filter((item) => item.id !== crew?.id)
            .map((item) => {
              const error = park ? canAssignRideCrew(park, item.id, b.id) : "Park nicht verfügbar",
                current = park?.buildings.find((building) => building.id === item.buildingId);
              return (
                <button
                  type="button"
                  key={item.id}
                  disabled={!!error}
                  title={error ?? undefined}
                  onClick={() => crewActions.onAssignCrew(item.id, b.id)}
                  data-testid={`ride-assign-crew-${b.id}-${item.id}`}
                >
                  <span>
                    <strong>
                      Crew #{item.id} · {crewMemberName(item.id)}
                    </strong>
                    <small>
                      {error ??
                        (crew
                          ? `Wechsel · Crew #${crew.id} ablösen${current ? ` · von ${current.name}` : " · verfügbares Team"}`
                          : current
                            ? `Wechsel von ${current.name}`
                            : "Verfügbar · hier fest zuweisen")}
                    </small>
                  </span>
                </button>
              );
            })}
        </div>
        {crews.length === (crew ? 1 : 0) && (
          <p className="sc-hint">
            Keine weitere Crew vorhanden. Neue Teams stellst du bewusst ein; die Automatik stellt
            kein Personal ein.
          </p>
        )}
        <button
          type="button"
          className="sc-hire-operator"
          onClick={crewActions.onHireCrew}
          data-testid={`ride-hire-crew-${b.id}`}
        >
          <Plus aria-hidden="true" /> Neue Crew einstellen ·{" "}
          {difficultyEuro(difficultyCost(park ?? {}, OPERATOR_WAGE, "wages"))} / Spieltag
        </button>
        <p className="sc-hint">
          Neu eingestellte Crews werden automatisch auf Anlagen mit Bedarf verteilt.
        </p>
      </details>
      {!o.staffed && (
        <p className="fit-error">
          Ohne Crew startet keine Fahrt. Warte auf ein verfügbares Team oder weise eine Crew zu.
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
