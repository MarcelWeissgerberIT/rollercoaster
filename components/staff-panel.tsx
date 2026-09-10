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
import { CATALOG, type Building, type Park } from "../game/simulation";
import { cleanerWorkTarget, type Cleaner } from "../game/cleanliness";
import { assetUrl } from "../game/assets";
import { difficultyCost, difficultyEuro } from "../game/difficulty";
import { staffLocation, type StaffRef } from "../game/staff";
import {
  needsOperator,
  hasOperator,
  operatorName,
  operatorActivity,
  OPERATION_LABELS,
  operationsStats,
  OPERATOR_WAGE,
  OPERATOR_POSTS,
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
  building: b,
  onLocateStaff,
  onSelectRide,
  onStaffRide,
}: {
  park: Park;
  building: Building;
  onLocateStaff?: (ref: StaffRef) => void;
  onSelectRide: (id: number) => void;
  onStaffRide: (id: number, staffed: boolean) => void;
}) {
  const assigned = hasOperator(b),
    occupied = b.riders.length > 0 && assigned,
    wage = difficultyEuro(difficultyCost(park, OPERATOR_WAGE, "wages"));
  return (
    <article
      className={`sc-crew${assigned ? "" : " sc-crew--vacant"}`}
      data-testid={`staff-crew-${b.id}`}
    >
      <button type="button" className="sc-workplace" onClick={() => onSelectRide(b.id)}>
        <img src={assetUrl(CATALOG[b.kind].sprite)} alt="" />
        <span>
          <small>{assigned ? "Feste Crew · 3 Personen" : "Crew fehlt · 3 offene Posten"}</small>
          <strong>{b.name}</strong>
        </span>
        <MapPin aria-hidden="true" />
      </button>
      <div className="sc-crew-price">
        <span>Gesamte Crew / Spieltag</span>
        <b>{wage}</b>
      </div>
      {assigned ? (
        <>
          <div className="sc-crew-people">
            {OPERATOR_POSTS.map((post) => {
              const ref: StaffRef = { kind: "operator", id: b.id, post },
                location = staffLocation(park, ref),
                qualification = crewQualifications[post],
                suffix = post === "control" ? `${b.id}` : `${b.id}-${post}`;
              return (
                <article
                  className={`sc-person sc-person--operator sc-person--${post}`}
                  key={post}
                  data-testid={`staff-operator-${suffix}`}
                >
                  <StaffIdentityButton
                    staffRef={ref}
                    name={location?.name ?? operatorName(b, post)}
                    qualification={location?.role ?? qualification.label}
                    activity={
                      b.open
                        ? (location?.label ?? OPERATION_LABELS[operatorActivity(b)])
                        : "Fahrgeschäft geschlossen"
                    }
                    sprite="keeper-se"
                    busy={b.open && !!location && location.activity !== "idle"}
                    onLocateStaff={location ? onLocateStaff : undefined}
                  />
                  <details
                    className="sc-person-details"
                    data-testid={`staff-details-operator-${suffix}`}
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
                          <dt>Fester Arbeitsplatz</dt>
                          <dd>
                            {b.name} ·{" "}
                            {post === "control"
                              ? "Steuerhaus"
                              : post === "entry"
                                ? "Einlass"
                                : "Auslass"}
                          </dd>
                        </div>
                      </dl>
                      <p className="sc-qualification">
                        <ShieldCheck aria-hidden="true" />
                        <span>{qualification.description}</span>
                      </p>
                      <p className="sc-hint">
                        Teil der gemeinsamen Crew. Der oben angezeigte Crewlohn umfasst alle drei
                        Personen.
                      </p>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          <p className="sc-hint">
            Steuerhaus und Bedienpult gehören zum Fahrgeschäft und werden automatisch mitgebaut.
          </p>
          <button
            type="button"
            className="sc-release"
            disabled={occupied}
            onClick={() => onStaffRide(b.id, false)}
            aria-label={`Gesamte Crew von ${b.name} abziehen`}
          >
            <Minus aria-hidden="true" /> Gesamte Crew abziehen
          </button>
          {occupied && (
            <p className="sc-hint">
              Während einer Fahrt bleibt die Crew zugewiesen. Nach dem Ausstieg kannst du sie
              abziehen.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="sc-intro">
            Fahrsteuerung, Einlass und Auslass werden gemeinsam besetzt. Ohne Crew startet keine
            Fahrt.
          </p>
          <button
            type="button"
            className="sc-hire-operator"
            onClick={() => onStaffRide(b.id, true)}
            aria-label={`Crew für ${b.name} zuweisen`}
            data-testid={`staff-vacancy-${b.id}`}
          >
            <Plus aria-hidden="true" /> Crew zuweisen · 3 Personen
          </button>
        </>
      )}
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
  onStaffRide,
  onLocateStaff,
}: {
  park: Park;
  onCleaners: (count: number) => void;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onSelectRide: (id: number) => void;
  onStaffRide: (id: number, staffed: boolean) => void;
  onLocateStaff?: (ref: StaffRef) => void;
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
            {ops.staffed} / {ops.rides} Crews · {ops.personCount} Personen
          </span>
        </div>
        <p className="sc-intro">
          Drei Personen pro Fahrgeschäft: Fahrsteuerung, Einlass und Auslass. Gemeinsam{" "}
          {difficultyEuro(operatorWage)} pro Crew und Spieltag.
        </p>
        {ops.unstaffed > 0 && (
          <p className="sc-note sc-note--warning">
            {ops.unstaffed} {ops.unstaffed === 1 ? "Fahrgeschäft wartet" : "Fahrgeschäfte warten"}{" "}
            auf eine Crew.
          </p>
        )}
        {!ops.rides && (
          <p className="sc-empty">
            Beim Bau eines Fahrgeschäfts werden eine Crew mit drei Personen sowie das Steuerhaus
            zugewiesen. Hier erscheinen ihre Namen und festen Arbeitsplätze.
          </p>
        )}
        <div className="sc-roster">
          {park.buildings
            .filter((b) => needsOperator(b.kind))
            .map((b) => (
              <RideCrewCard
                key={b.id}
                park={park}
                building={b}
                onLocateStaff={onLocateStaff}
                onSelectRide={onSelectRide}
                onStaffRide={onStaffRide}
              />
            ))}
        </div>
      </section>
    </section>
  );
}
