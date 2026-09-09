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
import type { Cleaner } from "../game/cleanliness";
import { assetUrl } from "../game/assets";
import { difficultyCost, difficultyEuro } from "../game/difficulty";
import {
  needsOperator,
  hasOperator,
  operatorName,
  operatorActivity,
  OPERATION_LABELS,
  operationsStats,
  OPERATOR_WAGE,
} from "../game/operations";
import {
  StaffCounter,
  ZooTeamControls,
  zooTeamTotals,
  type ZooSpecialistsHandler,
  type ZooKeeperAssignmentHandler,
} from "./zoo-panel";
import "./staff-cards.css";

const cleanerNames = ["Alex", "Jule", "Ben", "Maya", "Toni", "Nele", "Oskar", "Elif"];
function CleanerEmployeeCard({ park, worker }: { park: Park; worker: Cleaner }) {
  const name = `${cleanerNames[Math.abs(worker.id - 1) % cleanerNames.length]} · #${worker.id}`;
  const bin =
    worker.target?.kind === "bin" ? park.buildings.find((b) => b.id === worker.target?.id) : null;
  const litter =
    worker.target?.kind === "litter"
      ? park.cleanliness?.litter.find((item) => item.id === worker.target?.id)
      : null;
  const target =
    bin?.name ??
    (litter
      ? `Müll auf Feld ${litter.x + 1} / ${litter.y + 1}`
      : "Sucht den nächsten Reinigungsauftrag");
  const activity =
    worker.mode === "walk"
      ? "Unterwegs zum Auftrag"
      : worker.mode === "sweep"
        ? "Sammelt Müll auf"
        : worker.mode === "empty"
          ? "Leert einen Mülleimer"
          : "Bereit für einen Auftrag";
  return (
    <details className="sc-person sc-person--cleaner" data-testid={`staff-cleaner-${worker.id}`}>
      <summary>
        <span className="sc-portrait">
          <img src={assetUrl("cleaner-se")} alt={`Spielfigur von ${name}, Reinigungskraft`} />
        </span>
        <span className="sc-person-intro">
          <strong>{name}</strong>
          <span>Reinigung</span>
          <small className={worker.mode === "idle" ? "sc-state" : "sc-state sc-state--busy"}>
            {activity}
          </small>
        </span>
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
              {["sweep", "empty"].includes(worker.mode) && worker.workLeft > 0
                ? ` · noch ${Math.ceil(worker.workLeft)} s`
                : ""}
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
            Müll aufsammeln und Mülleimer leeren. Zuständig für erreichbare Parkwege, Ausgänge und
            Warteschlangen.
          </span>
        </p>
        <div className="sc-assignment">
          <h5>
            <MapPin aria-hidden="true" />
            Einsatzgebiet
          </h5>
          <p>
            Automatisch im ganzen Park. Die Reinigung wählt erreichbare Aufträge selbst und braucht
            keine eigene Station.
          </p>
        </div>
      </div>
    </details>
  );
}

export function StaffPanel({
  park,
  onCleaners,
  onKeepers,
  onSpecialists,
  onAssignKeeper,
  onSelectRide,
  onStaffRide,
}: {
  park: Park;
  onCleaners: (count: number) => void;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onSelectRide: (id: number) => void;
  onStaffRide: (id: number, staffed: boolean) => void;
}) {
  const ops = operationsStats(park),
    zoo = zooTeamTotals(park);
  const cleanerWage = difficultyCost(park, 80, "wages");
  const operatorWage = difficultyCost(park, OPERATOR_WAGE, "wages");
  const wages = difficultyCost(park, park.staff * 80 + ops.dailyCost, "wages") + zoo.cost;
  const cleaners = park.cleanliness?.workers ?? [];
  return (
    <section className="staff-panel z9 sc sc-staff" data-testid="staff-panel">
      <header className="sc-header">
        <span>Menschen hinter deinem Park</span>
        <h3>Dein Parkteam</h3>
        <p>Personal einstellen, Aufgaben sehen und passende Einsatzgebiete zuteilen.</p>
      </header>
      <div className="sc-overview">
        <div>
          <Users aria-hidden="true" />
          <b>{park.staff + zoo.count + ops.staffed}</b>
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
          <p>Das Team sammelt Müll und leert volle Mülleimer.</p>
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
              <CleanerEmployeeCard key={worker.id} park={park} worker={worker} />
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
      <ZooTeamControls
        park={park}
        onKeepers={onKeepers}
        onSpecialists={onSpecialists}
        onAssignKeeper={onAssignKeeper}
      />
      <section className="sc-operators" aria-label="Bedienpersonal verwalten">
        <div className="sc-section-heading">
          <h4>
            <Users aria-hidden="true" />
            Bedienpersonal
          </h4>
          <span>
            {ops.staffed} / {ops.rides} besetzt
          </span>
        </div>
        <p className="sc-intro">
          Eine Person pro Fahrgeschäft · {difficultyEuro(operatorWage)} pro Spieltag. Einlass,
          Sicherheitskontrolle und Bedienpult.
        </p>
        {ops.unstaffed > 0 && (
          <p className="sc-note sc-note--warning">
            {ops.unstaffed} {ops.unstaffed === 1 ? "Fahrgeschäft wartet" : "Fahrgeschäfte warten"}{" "}
            auf Bedienpersonal.
          </p>
        )}
        {!ops.rides && (
          <p className="sc-empty">
            Beim Bau eines Fahrgeschäfts wird Bedienpersonal zugewiesen. Hier erscheinen dann die
            Mitarbeitenden und ihr fester Arbeitsplatz.
          </p>
        )}
        <div className="sc-roster">
          {park.buildings
            .filter((b) => needsOperator(b.kind))
            .map((b) => {
              const assigned = hasOperator(b),
                occupied = b.riders.length > 0 && assigned;
              return assigned ? (
                <details
                  className="sc-person sc-person--operator"
                  key={b.id}
                  data-testid={`staff-operator-${b.id}`}
                >
                  <summary>
                    <span className="sc-portrait">
                      <img
                        src={assetUrl("keeper-se")}
                        alt={`Spielfigur von ${operatorName(b)}, Bedienpersonal bei ${b.name}`}
                      />
                    </span>
                    <span className="sc-person-intro">
                      <strong>{operatorName(b)}</strong>
                      <span>{b.name}</span>
                      <small className="sc-state sc-state--busy">
                        {b.open
                          ? OPERATION_LABELS[operatorActivity(b)]
                          : "Fahrgeschäft geschlossen"}
                      </small>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className="sc-person-body">
                    <dl className="sc-facts">
                      <div>
                        <dt>Qualifikation</dt>
                        <dd>Bedienung & Einlass</dd>
                      </div>
                      <div>
                        <dt>Lohn / Spieltag</dt>
                        <dd>{difficultyEuro(operatorWage)}</dd>
                      </div>
                    </dl>
                    <p className="sc-qualification">
                      <ShieldCheck aria-hidden="true" />
                      <span>
                        Lässt Gäste ein, kontrolliert vor der Fahrt und betreut das Bedienpult. Fest
                        diesem Fahrgeschäft zugeordnet.
                      </span>
                    </p>
                    <button
                      type="button"
                      className="sc-workplace"
                      onClick={() => onSelectRide(b.id)}
                    >
                      <img src={assetUrl(CATALOG[b.kind].sprite)} alt="" />
                      <span>
                        <small>Arbeitsplatz öffnen</small>
                        <strong>{b.name}</strong>
                      </span>
                      <MapPin aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="sc-release"
                      disabled={occupied}
                      onClick={() => onStaffRide(b.id, false)}
                      aria-label={`Bedienpersonal von ${b.name} abziehen`}
                    >
                      <Minus aria-hidden="true" />
                      Personal abziehen
                    </button>
                    {occupied && (
                      <p className="sc-hint">
                        Während einer Fahrt bleibt das Bedienpersonal zugewiesen. Nach dem Ausstieg
                        kannst du es abziehen.
                      </p>
                    )}
                  </div>
                </details>
              ) : (
                <article className="sc-vacancy" key={b.id} data-testid={`staff-vacancy-${b.id}`}>
                  <button type="button" className="sc-workplace" onClick={() => onSelectRide(b.id)}>
                    <img src={assetUrl(CATALOG[b.kind].sprite)} alt="" />
                    <span>
                      <small>Offene Stelle · Bedienpersonal</small>
                      <strong>{b.name}</strong>
                    </span>
                    <MapPin aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sc-hire-operator"
                    onClick={() => onStaffRide(b.id, true)}
                    aria-label={`Bedienpersonal für ${b.name} zuweisen`}
                  >
                    <Plus aria-hidden="true" />
                    Besetzen · {difficultyEuro(operatorWage)} / Spieltag
                  </button>
                </article>
              );
            })}
        </div>
      </section>
    </section>
  );
}
