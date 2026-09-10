"use client";

import {
  BrushCleaning,
  ChevronDown,
  CircleUserRound,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CATALOG, type Park } from "../game/simulation";
import { cleanerWorkTarget, type Cleaner } from "../game/cleanliness";
import { assetUrl } from "../game/assets";
import { difficultyCost, difficultyEuro } from "../game/difficulty";
import { staffLocation, type StaffRef } from "../game/staff";
import {
  needsOperator,
  operationsStats,
  OPERATOR_WAGE,
  OPERATOR_POSTS,
  crewPoolOf,
  crewMemberName,
  canAssignRideCrew,
  type RideCrew,
  type OperatorPost,
} from "../game/operations";
import {
  StaffCounter,
  StaffIdentityButton,
  ZooTeamControls,
  zooTeamTotals,
  type ZooSpecialistsHandler,
  type ZooKeeperAssignmentHandler,
} from "./zoo-panel";
import type { CrewAssignmentHandlers } from "./ride-operations-panel";
import "./staff-cards.css";

const crewQualifications: Record<OperatorPost, { label: string; description: string }> = {
  control: {
    label: "Fahrsteuerung",
    description: "Bedient die Anlage vom Steuerhaus aus und überwacht das Fahrprogramm am Pult.",
  },
  entry: {
    label: "Einlass & Sicherheitskontrolle",
    description: "Begrüßt die Gäste am Einlass und begleitet die Kontrolle vor dem Fahrtbeginn.",
  },
  exit: {
    label: "Ausstiegsbetreuung",
    description: "Betreut den Auslass und begleitet die Gäste nach dem Ende der Fahrt hinaus.",
  },
};

function RideCrewCard({
  park,
  crew,
  onLocateStaff,
  onSelectRide,
  ...actions
}: {
  park: Park;
  crew: RideCrew;
  onLocateStaff?: (ref: StaffRef) => void;
  onSelectRide: (id: number) => void;
} & CrewAssignmentHandlers) {
  const building = park.buildings.find((b) => b.id === crew.buildingId),
    wage = difficultyEuro(difficultyCost(park, OPERATOR_WAGE, "wages")),
    releaseError = canAssignRideCrew(park, crew.id, null),
    rides = park.buildings.filter((b) => needsOperator(b.kind));
  return (
    <article
      className={`sc-crew${building ? "" : " sc-crew--available"}`}
      data-testid={`staff-crew-${crew.id}`}
    >
      <div className="sc-crew-heading">
        <strong>
          Crew #{crew.id} <small>3 Personen</small>
        </strong>
        <span
          className={`sc-assignment-badge${crew.mode === "manual" ? " sc-assignment-badge--manual" : ""}`}
        >
          {crew.mode === "auto"
            ? "Automatisch"
            : building
              ? "Fest zugewiesen"
              : "Manuell verfügbar"}
        </span>
      </div>
      {building ? (
        <button type="button" className="sc-workplace" onClick={() => onSelectRide(building.id)}>
          <img src={assetUrl(CATALOG[building.kind].sprite)} alt="" />
          <span>
            <small>Aktueller Einsatz</small>
            <strong>{building.name}</strong>
          </span>
          <MapPin aria-hidden="true" />
        </button>
      ) : (
        <p className="sc-available-note">Verfügbar · aktuell ohne Fahrgeschäft</p>
      )}
      <div className="sc-crew-price">
        <span>Gesamte Crew / Spieltag</span>
        <b>{wage}</b>
      </div>
      <div className="sc-crew-people">
        {OPERATOR_POSTS.map((post) => {
          const ref: StaffRef = { kind: "operator", id: building?.id ?? 0, crewId: crew.id, post },
            location = staffLocation(park, ref),
            qualification = crewQualifications[post];
          return (
            <article
              className={`sc-person sc-person--operator sc-person--${post}`}
              key={post}
              data-testid={`staff-crew-member-${crew.id}-${post}`}
            >
              <StaffIdentityButton
                staffRef={ref}
                name={location?.name ?? crewMemberName(crew.id, post)}
                qualification={location?.role ?? qualification.label}
                activity={
                  !building
                    ? "Verfügbar für einen Einsatz"
                    : building.open
                      ? (location?.label ?? "Bereit am Arbeitsplatz")
                      : "Fahrgeschäft geschlossen"
                }
                sprite="keeper-se"
                busy={!!building?.open && !!location && location.activity !== "idle"}
                onLocateStaff={location ? onLocateStaff : undefined}
              />
              <details
                className="sc-person-details"
                data-testid={`staff-details-crew-${crew.id}-${post}`}
              >
                <summary>
                  <span>Qualifikation & Aufgabe</span>
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div className="sc-person-body">
                  <dl className="sc-facts">
                    <div className="sc-fact-wide">
                      <dt>Qualifikation</dt>
                      <dd>{qualification.label}</dd>
                    </div>
                    <div className="sc-fact-wide">
                      <dt>Aktueller Arbeitsplatz</dt>
                      <dd>
                        {building
                          ? `${building.name} · ${post === "control" ? "Steuerhaus" : post === "entry" ? "Einlass" : "Auslass"}`
                          : "Noch keinem Fahrgeschäft zugewiesen"}
                      </dd>
                    </div>
                  </dl>
                  <p className="sc-qualification">
                    <ShieldCheck aria-hidden="true" />
                    <span>{qualification.description}</span>
                  </p>
                  <p className="sc-hint">
                    Der gemeinsame Crewlohn umfasst alle drei Personen und fällt auch ohne Einsatz
                    an.
                  </p>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      {!building && (
        <p className="sc-hint">
          Sobald das Team eine Anlage übernimmt, kannst du seine Mitarbeitenden im Park zeigen.
        </p>
      )}
      <details className="sc-crew-assignment" data-testid={`crew-assignment-${crew.id}`}>
        <summary>
          <span>Einsatz ändern</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="sc-assignment-options">
          <button
            type="button"
            aria-pressed={crew.mode === "auto"}
            onClick={() => actions.onCrewAutomatic(crew.id)}
            data-testid={`crew-auto-${crew.id}`}
          >
            <span>
              <strong>Automatisch verteilen</strong>
              <small>Offene, getestete Anlagen zuerst</small>
            </span>
          </button>
          {rides.map((ride) => {
            const error = canAssignRideCrew(park, crew.id, ride.id),
              current = crew.buildingId === ride.id,
              replaced = crewPoolOf(park).crews.find(
                (item) => item.buildingId === ride.id && item.id !== crew.id,
              );
            return (
              <button
                type="button"
                key={ride.id}
                disabled={!!error}
                title={error ?? undefined}
                aria-pressed={current && crew.mode === "manual"}
                onClick={() => actions.onAssignCrew(crew.id, ride.id)}
                data-testid={`crew-assign-${crew.id}-${ride.id}`}
              >
                <span>
                  <strong>{ride.name}</strong>
                  <small>
                    {error ??
                      (current
                        ? crew.mode === "manual"
                          ? "Hier fest zugewiesen"
                          : "Aktueller Einsatz · hier fest zuweisen"
                        : replaced
                          ? `Wechsel · Crew #${replaced.id} ablösen · hier fest zuweisen`
                          : "Hier fest zuweisen")}
                  </small>
                </span>
                <MapPin aria-hidden="true" />
              </button>
            );
          })}
          {!rides.length && (
            <p className="sc-hint">Baue ein Fahrgeschäft, um dieser Crew einen Einsatz zu geben.</p>
          )}
        </div>
        {building && (
          <button
            type="button"
            className="sc-release"
            disabled={!!releaseError}
            title={releaseError ?? undefined}
            onClick={() => actions.onAssignCrew(crew.id, null)}
            data-testid={`crew-release-${crew.id}`}
          >
            <Minus aria-hidden="true" /> Freigeben · Crew behalten
          </button>
        )}
        {releaseError && <p className="sc-hint">{releaseError}</p>}
        <p className="sc-hint">
          Feste Zuweisungen bleiben erhalten. Freigeben behält das Team und schaltet die Automatik
          seiner bisherigen Anlage aus.
        </p>
        <button
          type="button"
          className="sc-dismiss"
          disabled={!!releaseError}
          title={releaseError ?? undefined}
          onClick={() => actions.onDismissCrew(crew.id)}
          data-testid={`crew-dismiss-${crew.id}`}
        >
          Crew entlassen
        </button>
      </details>
    </article>
  );
}

function CleanerEmployeeCard({
  park,
  worker,
  onLocateStaff,
}: {
  park: Park;
  worker: Cleaner;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  const location = staffLocation(park, { kind: "cleaner", id: worker.id });
  const name = location?.name ?? `Reinigungskraft #${worker.id}`;
  const bin =
    worker.target?.kind === "bin" || worker.target?.kind === "deposit"
      ? park.buildings.find((b) => b.id === worker.target?.id)
      : null;
  const litter =
    worker.target?.kind === "litter"
      ? park.cleanliness?.litter.find((item) => item.id === worker.target?.id)
      : null;
  const workTarget = cleanerWorkTarget(park, worker);
  const carried = worker.carried ?? 0;
  const target =
    worker.target?.kind === "collection" && workTarget
      ? `Müll-Sammelstelle · Feld ${Math.round(workTarget.x) + 1} / ${Math.round(workTarget.y) + 1}`
      : (bin?.name ??
        (litter
          ? `Müll auf Feld ${litter.x + 1} / ${litter.y + 1}`
          : worker.mode === "patrol"
            ? "Kontrollgang auf den Parkwegen"
            : "Sucht den nächsten Reinigungsauftrag"));
  const activity = location?.label ?? "Position nicht verfügbar";
  return (
    <article className="sc-person sc-person--cleaner" data-testid={`staff-cleaner-${worker.id}`}>
      <StaffIdentityButton
        staffRef={{ kind: "cleaner", id: worker.id }}
        name={name}
        qualification="Reinigung"
        activity={activity}
        sprite="cleaner-se"
        busy={worker.mode !== "idle"}
        onLocateStaff={location ? onLocateStaff : undefined}
      />
      <details className="sc-person-details" data-testid={`staff-details-cleaner-${worker.id}`}>
        <summary>
          <span>Qualifikation & Einsatz</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="sc-person-body">
          <dl className="sc-facts">
            <div>
              <dt>Qualifikation</dt>
              <dd>Parkreinigung</dd>
            </div>
            <div>
              <dt>Lohn / Spieltag</dt>
              <dd>{difficultyEuro(difficultyCost(park, 80, "wages"))}</dd>
            </div>
            <div className="sc-fact-wide">
              <dt>Aktueller Auftrag</dt>
              <dd>
                {target}
                {["sweep", "empty", "deposit"].includes(worker.mode) && worker.workLeft > 0
                  ? ` · noch ${Math.ceil(worker.workLeft)} s`
                  : ""}
              </dd>
            </div>
            <div className="sc-fact-wide">
              <dt>Trägt gerade</dt>
              <dd>
                {carried > 0
                  ? `${carried} Müllteile${worker.toCollection ? " im Müllbeutel zur Sammlung" : " zur Entsorgung"}`
                  : "Keinen gesammelten Müll"}
              </dd>
            </div>
            <div className="sc-fact-wide">
              <dt>Aktueller Standort</dt>
              <dd>
                Feld {Math.round(worker.x) + 1} / {Math.round(worker.y) + 1}
              </dd>
            </div>
          </dl>
          <p className="sc-qualification">
            <ShieldCheck aria-hidden="true" />
            <span>
              Müll aufsammeln, volle Beutel auswechseln und den gesammelten Müll entsorgen.
              Zuständig für erreichbare Parkwege, Ausgänge und Warteschlangen.
            </span>
          </p>
          <div className="sc-assignment">
            <h5>
              <MapPin aria-hidden="true" />
              Einsatzgebiet
            </h5>
            <p>
              Automatisch im ganzen Park. Die Reinigung kontrolliert die Wege und bringt Müll zu
              freien Tonnen oder einer erreichbaren Sammelstelle.
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}

export function StaffPanel({
  park,
  onCleaners,
  onKeepers,
  onSpecialists,
  onAssignKeeper,
  onSelectRide,
  onLocateStaff,
  ...crewActions
}: {
  park: Park;
  onCleaners: (count: number) => void;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onSelectRide: (id: number) => void;
  onLocateStaff?: (ref: StaffRef) => void;
} & CrewAssignmentHandlers) {
  const ops = operationsStats(park),
    zoo = zooTeamTotals(park);
  const cleanerWage = difficultyCost(park, 80, "wages");
  const operatorWage = difficultyCost(park, OPERATOR_WAGE, "wages");
  const wages = difficultyCost(park, park.staff * 80 + ops.dailyCost, "wages") + zoo.cost;
  const cleaners = park.cleanliness?.workers ?? [];
  const crews = crewPoolOf(park).crews;
  return (
    <section className="staff-panel z9 sc sc-staff" data-testid="staff-panel">
      <header className="sc-header">
        <span>Menschen hinter deinem Park</span>
        <h3>Dein Parkteam</h3>
        <p>
          Bild oder Namen anklicken, um Mitarbeitende im Park zu finden. Qualifikation und Einsatz
          separat aufklappen.
        </p>
      </header>
      <div className="sc-overview">
        <div>
          <Users aria-hidden="true" />
          <b>{park.staff + zoo.count + ops.personCount}</b>
          <span>Mitarbeitende</span>
        </div>
        <div>
          <CircleUserRound aria-hidden="true" />
          <b>{difficultyEuro(wages)}</b>
          <span>Löhne pro Spieltag</span>
        </div>
      </div>
      <section className="sc-cleaners" aria-label="Reinigungsteam verwalten">
        <div className="sc-section-heading">
          <h4>
            <BrushCleaning aria-hidden="true" />
            Reinigung
          </h4>
          <span>{park.staff} Personen</span>
        </div>
        <div className="sc-hiring-card">
          <strong>Saubere Wege, zufriedene Gäste</strong>
          <p>
            Freie Kräfte übernehmen automatisch die nächsten erreichbaren Reinigungsaufträge im
            ganzen Park.
          </p>
          <div className="sc-hiring-footer">
            <span>
              <b>{difficultyEuro(cleanerWage)}</b> je Person / Spieltag
              <small>Bis zu 8 Personen</small>
            </span>
            <StaffCounter
              label="Reinigungskräfte"
              count={park.staff}
              max={8}
              onChange={onCleaners}
            />
          </div>
        </div>
        {cleaners.length ? (
          <div className="sc-roster">
            {cleaners.map((worker) => (
              <CleanerEmployeeCard
                key={worker.id}
                park={park}
                worker={worker}
                onLocateStaff={onLocateStaff}
              />
            ))}
          </div>
        ) : (
          <p className="sc-empty">
            {park.staff
              ? "Das Team erscheint, sobald ein begehbarer Parkweg verfügbar ist."
              : "Stelle über + die erste Reinigungskraft ein. Auf ihrer Karte siehst du den aktuellen Auftrag."}
          </p>
        )}
      </section>
      <p className="sc-intro sc-team-automation">
        Tierpflege verteilt Aufgaben automatisch nach Qualifikation. Auf den Personenkarten kannst
        du ein passendes Gehege fest zuweisen.
      </p>
      <ZooTeamControls
        park={park}
        onKeepers={onKeepers}
        onSpecialists={onSpecialists}
        onAssignKeeper={onAssignKeeper}
        onLocateStaff={onLocateStaff}
      />
      <section className="sc-operators" aria-label="Bedienpersonal verwalten">
        <div className="sc-section-heading">
          <h4>
            <Users aria-hidden="true" />
            Fahrgeschäft-Crews
          </h4>
          <span>
            {ops.crewCount} Crews · {ops.availableCrews} verfügbar
          </span>
        </div>
        <p className="sc-intro">
          Verfügbare Teams übernehmen offene Anlagen automatisch. Jede Crew umfasst Fahrsteuerung,
          Einlass und Auslass; gemeinsam {difficultyEuro(operatorWage)} pro Spieltag.
        </p>
        {ops.unstaffed > 0 && (
          <p className="sc-note sc-note--warning">
            {ops.unstaffed} {ops.unstaffed === 1 ? "Fahrgeschäft ist" : "Fahrgeschäfte sind"} ohne
            Crew.
          </p>
        )}
        <div className="sc-pool-summary" data-testid="crew-pool-summary">
          <span>
            <b>{ops.staffed}</b> im Einsatz
          </span>
          <span>
            <b>{ops.availableCrews}</b> verfügbar
          </span>
          <span>
            <b>{ops.manualCrews}</b> manuell
          </span>
        </div>
        <button
          type="button"
          className="sc-hire-operator"
          onClick={crewActions.onHireCrew}
          data-testid="staff-hire-crew"
        >
          <Plus aria-hidden="true" /> Neue Crew einstellen · {difficultyEuro(operatorWage)} /
          Spieltag
        </button>
        <p className="sc-hint">
          Der Bau einer Anlage stellt kein zusätzliches Team ein. Freie Crews bleiben bezahlt; ihre
          Zuweisung kannst du jederzeit ändern, sobald keine Fahrt läuft.
        </p>
        {!crews.length && (
          <p className="sc-empty">
            Noch keine Fahrgeschäft-Crew eingestellt. Stelle eine Crew ein, damit drei Mitarbeitende
            gemeinsam eine Anlage übernehmen können.
          </p>
        )}
        <div className="sc-roster">
          {crews.map((crew) => (
            <RideCrewCard
              key={crew.id}
              park={park}
              crew={crew}
              onLocateStaff={onLocateStaff}
              onSelectRide={onSelectRide}
              {...crewActions}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
