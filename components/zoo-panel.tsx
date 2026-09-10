"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Droplets,
  Fence,
  Heart,
  Leaf,
  PawPrint,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import {
  SPECIES,
  isHabitat,
  zooStats,
  welfare,
  habitatHasFeature,
  habitatHasElectric,
  habitatSafety,
  habitatCareStatus,
  habitatRequirements,
  SPECIALIST_ROLES,
  KEEPER_WAGE,
  CARE_PER_ANIMAL,
  ZOO_SPECIALIST_WAGE,
  ELECTRIC_FENCE_COST,
  HABITAT_INSPECTION_COST,
  type Species,
  type SpecialistRole,
  type Keeper,
  keeperAssignments,
} from "../game/zoo";
import { HABITAT_PROFILES, type HabitatFeatureId } from "../game/habitat-needs";
import { access, type Park, type Building, type Kind } from "../game/simulation";
import { ANIMAL_NAMES, animalName, animalSex } from "../game/zoo-motion";
import { assetUrl } from "../game/assets";
import { difficultyCost, difficultyEuro } from "../game/difficulty";
import { staffLocation, type StaffRef } from "../game/staff";
import "./staff-cards.css";

const euro = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export type ZooSpecialistsHandler = (role: SpecialistRole, count: number) => string | null | void;
export type ZooKeeperAssignmentHandler = (
  id: number,
  buildingId: number | null,
) => string | null | void;
export type HabitatPanelAction =
  | "adopt"
  | "rehome"
  | "care"
  | "enrichment"
  | "shelter"
  | `feature:${HabitatFeatureId}`
  | "electric-on"
  | "electric-off"
  | "inspect";
const roles = Object.entries(SPECIALIST_ROLES) as [
  SpecialistRole,
  { label: string; description: string },
][];
export function zooTeamTotals(park: Park) {
  const specialists = roles.reduce((n, [role]) => n + (park.zoo?.specialists?.[role] ?? 0), 0);
  const keepers = park.zoo?.keepers ?? 0;
  return {
    keepers,
    specialists,
    count: keepers + specialists,
    cost: difficultyCost(park, keepers * KEEPER_WAGE + specialists * ZOO_SPECIALIST_WAGE, "wages"),
  };
}

/** Native buttons make each staffing change visible and reversible. */
export function StaffCounter({
  label,
  count,
  max,
  disabled = false,
  onChange,
}: {
  label: string;
  count: number;
  max: number;
  disabled?: boolean;
  onChange: (count: number) => void;
}) {
  return (
    <div className="sc-counter" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label}: eine Person weniger`}
        disabled={disabled || count <= 0}
        onClick={() => onChange(count - 1)}
      >
        <Minus aria-hidden="true" />
      </button>
      <output aria-label={`${label}: ${count} Personen`}>{count}</output>
      <button
        type="button"
        aria-label={`${label}: eine Person einstellen`}
        disabled={disabled || count >= max}
        onClick={() => onChange(count + 1)}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/** The location action is outside the native disclosure: assignments never move the camera. */
export function StaffIdentityButton({
  staffRef,
  name,
  qualification,
  activity,
  sprite,
  busy,
  onLocateStaff,
}: {
  staffRef: StaffRef;
  name: string;
  qualification: string;
  activity: string;
  sprite: string;
  busy: boolean;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  return (
    <button
      type="button"
      className="sc-person-locate"
      onClick={() => onLocateStaff?.(staffRef)}
      disabled={!onLocateStaff}
      aria-label={`${name} im Park zeigen`}
      data-testid={`staff-locate-${staffRef.kind}-${staffRef.id}${staffRef.kind === "operator" && staffRef.post && staffRef.post !== "control" ? `-${staffRef.post}` : ""}`}
    >
      <span className="sc-portrait">
        <img src={assetUrl(sprite)} alt={`Spielfigur von ${name}, ${qualification}`} />
      </span>
      <span className="sc-person-intro">
        <strong>{name}</strong>
        <span>{qualification}</span>
        <small className={busy ? "sc-state sc-state--busy" : "sc-state"}>{activity}</small>
        <span className="sc-locate-hint">
          {onLocateStaff ? "Im Park zeigen" : "Position nicht verfügbar"}
        </span>
      </span>
      <span className="sc-locate-icon">
        <MapPin aria-hidden="true" />
      </span>
    </button>
  );
}

function KeeperEmployeeCard({
  park,
  worker,
  onAssignKeeper,
  onLocateStaff,
}: {
  park: Park;
  worker: Keeper;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  const [error, setError] = useState("");
  const location = staffLocation(park, { kind: "keeper", id: worker.id });
  const home = park.buildings.find((b) => b.id === worker.homeId);
  const target = park.buildings.find((b) => b.id === worker.targetId);
  const assigned = park.buildings.find((b) => b.id === worker.assignedHabitatId);
  const qualification = worker.role ? SPECIALIST_ROLES[worker.role].label : "Basis-Tierpflege";
  const description = worker.role
    ? SPECIALIST_ROLES[worker.role].description
    : "Versorgt Zebras, Giraffen, Flamingos und Pinguine mit Futter, Wasser und Pflege.";
  const eligible = keeperAssignments(park, worker);
  const wage = difficultyCost(park, worker.role ? ZOO_SPECIALIST_WAGE : KEEPER_WAGE, "wages");
  const activity = location?.label ?? "Position nicht verfügbar";
  const name = location?.name ?? `Tierpflege #${worker.id}`;
  const assign = (id: number | null) => {
    const result = onAssignKeeper?.(worker.id, id);
    setError(typeof result === "string" ? result : "");
  };
  return (
    <article className="sc-person sc-person--keeper" data-testid={`staff-keeper-${worker.id}`}>
      <StaffIdentityButton
        staffRef={{ kind: "keeper", id: worker.id }}
        name={name}
        qualification={qualification}
        activity={activity}
        sprite="keeper-se"
        busy={worker.mode !== "idle"}
        onLocateStaff={location ? onLocateStaff : undefined}
      />
      <details className="sc-person-details" data-testid={`staff-details-keeper-${worker.id}`}>
        <summary>
          <span>Qualifikation & Einsatz</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="sc-person-body">
          <dl className="sc-facts">
            <div>
              <dt>Qualifikation</dt>
              <dd>{qualification}</dd>
            </div>
            <div>
              <dt>Lohn / Spieltag</dt>
              <dd>{difficultyEuro(wage)}</dd>
            </div>
            <div className="sc-fact-wide">
              <dt>Station</dt>
              <dd>{home?.name ?? "Keine Station zugeordnet"}</dd>
            </div>
            <div className="sc-fact-wide">
              <dt>Aktueller Auftrag</dt>
              <dd>
                {target?.name ??
                  (worker.mode === "patrol"
                    ? "Kontrollrunde auf den Parkwegen"
                    : "Wartet auf Pflege- oder Wartungsbedarf")}
                {worker.mode === "care" && worker.workLeft > 0
                  ? ` · noch ${Math.ceil(worker.workLeft)} s`
                  : ""}
              </dd>
            </div>
          </dl>
          <p className="sc-qualification">
            <ShieldCheck aria-hidden="true" />
            <span>{description}</span>
          </p>
          <div className="sc-assignment">
            <h5>
              <MapPin aria-hidden="true" />
              Einsatzgebiet
            </h5>
            <p>
              {worker.assignedHabitatId == null
                ? "Automatisch: sucht passende Aufträge im Park."
                : assigned
                  ? `Fest zugeteilt: ${assigned.name}`
                  : "Das zugeteilte Gehege ist nicht mehr vorhanden."}
            </p>
            <div
              className="sc-assignment-options"
              role="group"
              aria-label={`Einsatzgebiet für ${name}`}
            >
              <button
                type="button"
                aria-pressed={worker.assignedHabitatId == null}
                disabled={!onAssignKeeper}
                onClick={() => assign(null)}
                data-testid={`keeper-assignment-${worker.id}-auto`}
              >
                Automatisch {worker.assignedHabitatId == null && <Check aria-hidden="true" />}
              </button>
              {eligible.map((habitat) => (
                <button
                  key={habitat.id}
                  type="button"
                  aria-pressed={worker.assignedHabitatId === habitat.id}
                  disabled={!onAssignKeeper}
                  onClick={() => assign(habitat.id)}
                  data-testid={`keeper-assignment-${worker.id}-${habitat.id}`}
                >
                  <span>{habitat.name}</span>
                  {worker.assignedHabitatId === habitat.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
            {!eligible.length && (
              <p className="sc-hint">
                Kein passendes Gehege erreichbar. Verbinde eine Anlage, die zu dieser Qualifikation
                passt, mit den Parkwegen.
              </p>
            )}
            <p className="sc-hint">
              Gezeigt werden passende, erreichbare Gehege. Die Qualifikation bleibt bei der
              Zuteilung erhalten.
            </p>
            {error && (
              <p className="sc-feedback" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </details>
    </article>
  );
}

/** Shared by the zoo overview and staff panel. Backend remains the authority on role eligibility. */
export function ZooTeamControls({
  park,
  onKeepers,
  onSpecialists,
  onAssignKeeper,
  onLocateStaff,
}: {
  park: Park;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  const [error, setError] = useState("");
  const team = zooTeamTotals(park);
  const workers = park.zoo?.workers ?? [];
  const homes = park.buildings.filter((b) => b.kind === "keeperhut" && access(park, b)).length;
  const setRole = (role: SpecialistRole, count: number) => {
    const result = onSpecialists?.(role, count);
    setError(typeof result === "string" ? result : "");
  };
  return (
    <section className="sc sc-zoo-team" aria-label="Zoo-Team verwalten">
      <div className="sc-section-heading">
        <h4>
          <Users aria-hidden="true" />
          Zoo-Team
        </h4>
        <span>
          {team.count} Personen · {difficultyEuro(team.cost)} / Tag
        </span>
      </div>
      <div className="sc-hiring-card">
        <div className="sc-hiring-heading">
          <span className="sc-role-icon">
            <PawPrint aria-hidden="true" />
          </span>
          <div>
            <strong>Tierpflege</strong>
            <p>Zebras, Giraffen, Flamingos und Pinguine.</p>
          </div>
        </div>
        <div className="sc-hiring-footer">
          <span>
            <b>{difficultyEuro(difficultyCost(park, KEEPER_WAGE, "wages"))}</b> je Person / Spieltag
            <small>Bis zu 8 Personen</small>
          </span>
          <StaffCounter label="Tierpflege" count={team.keepers} max={8} onChange={onKeepers} />
        </div>
      </div>
      <details className="sc-specialists">
        <summary>
          <span>
            Fachpersonal einstellen <b>{team.specialists}</b>
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <p className="sc-hint">Wähle das Fachgebiet, das deine Tiere oder Anlagen brauchen.</p>
        {roles.map(([role, info]) => (
          <div className="sc-hiring-card" key={role}>
            <strong>{info.label}</strong>
            <p>{info.description}</p>
            <div className="sc-hiring-footer">
              <span>
                <b>{difficultyEuro(difficultyCost(park, ZOO_SPECIALIST_WAGE, "wages"))}</b> je
                Person / Spieltag
                <small>Bis zu 4 Personen</small>
              </span>
              <StaffCounter
                label={info.label}
                count={park.zoo?.specialists?.[role] ?? 0}
                max={4}
                disabled={!onSpecialists}
                onChange={(count) => setRole(role, count)}
              />
            </div>
          </div>
        ))}
      </details>
      <p className={`sc-note ${homes ? "" : "sc-note--warning"}`}>
        <Wrench aria-hidden="true" />
        <span>
          {homes
            ? `${homes} erreichbare Tierpflegerstation${homes === 1 ? "" : "en"}.`
            : "Dem Team fehlt eine erreichbare Tierpflegerstation."}{" "}
          Futter und Pflege kosten zusätzlich {euro(CARE_PER_ANIMAL)} pro Tier je Versorgung.
        </span>
      </p>
      {error && (
        <p className="sc-feedback" role="alert">
          {error}
        </p>
      )}
      <div className="sc-roster-heading">
        <h5>Deine Mitarbeitenden</h5>
        <span>Bild anklicken · im Park zeigen</span>
      </div>
      {workers.length > 0 ? (
        <div className="sc-roster">
          {workers.map((worker) => (
            <KeeperEmployeeCard
              key={worker.id}
              park={park}
              worker={worker}
              onAssignKeeper={onAssignKeeper}
              onLocateStaff={onLocateStaff}
            />
          ))}
        </div>
      ) : (
        <p className="sc-empty">
          {team.count
            ? `${team.count} Personen eingestellt. Ihre Mitarbeiterkarten erscheinen, sobald eine erreichbare Tierpflegerstation bereitsteht.`
            : "Stelle Tierpflege oder passendes Fachpersonal ein. Hier siehst du dann jede Person, ihre Qualifikation und ihren Einsatz."}
        </p>
      )}
    </section>
  );
}

export function ZooOverview({
  park,
  onKeepers,
  onBuild,
  onSpecialists,
  onAssignKeeper,
  onLocateStaff,
}: {
  park: Park;
  onKeepers: (n: number) => void;
  onBuild: (k: Kind) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onAssignKeeper?: ZooKeeperAssignmentHandler;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  const stats = zooStats(park);
  const habitats = park.buildings.filter((b) => isHabitat(b.kind));
  const attention = habitats
    .map((b) => ({ b, missing: habitatRequirements(park, b).filter((r) => !r.met) }))
    .filter((r) => r.missing.length > 0);
  return (
    <section className="zoo-overview z9">
      <p className="z9-intro">
        Parkwege am Zaun machen Tiere sichtbar. Gäste beobachten sie von außen – ohne Warteschlange
        oder Extra-Ticket.
      </p>
      <div className="z9-summary">
        <div>
          <PawPrint size={20} />
          <b>{stats.count}</b>
          <span>Tiere · {stats.species} Arten</span>
        </div>
        <div>
          <Heart size={20} />
          <b>{stats.welfare}%</b>
          <span>Tierwohl</span>
        </div>
      </div>
      {attention.length > 0 && (
        <details className="z9-attention" open>
          <summary>
            <span>{attention.length} Gehege brauchen Aufmerksamkeit</span>
            <ChevronDown size={16} />
          </summary>
          <ul>
            {attention.map(({ b, missing }) => (
              <li key={b.id}>
                <strong>{b.name}</strong>
                <span>{missing.map((r) => r.label).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <ZooTeamControls
        park={park}
        onKeepers={onKeepers}
        onSpecialists={onSpecialists}
        onAssignKeeper={onAssignKeeper}
        onLocateStaff={onLocateStaff}
      />
      <button className="secondary z9-wide" onClick={() => onBuild("keeperhut")}>
        Tierpflegerstation bauen · 450 €
      </button>
    </section>
  );
}

const categories = [
  { id: "enrichment", label: "Beschäftigung", Icon: Leaf },
  { id: "shelter", label: "Rückzug & Schutz", Icon: Heart },
  { id: "terrain", label: "Lebensraum", Icon: Droplets },
] as const;
export function HabitatPanel({
  park,
  building: b,
  onAction,
  onManageStaff,
}: {
  park: Park;
  building: Building;
  onAction: (action: HabitatPanelAction) => string | null;
  onManageStaff?: () => void;
}) {
  const [error, setError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    setError("");
  }, [b.id]);
  useEffect(() => {
    if (error) {
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);
  if (!isHabitat(b.kind) || !b.habitat) return null;
  const kind = b.kind as Species,
    s = SPECIES[kind],
    profile = HABITAT_PROFILES[kind],
    h = b.habitat;
  const connected = !!access(park, b),
    safety = habitatSafety(b),
    care = habitatCareStatus(park, b);
  const requirements = habitatRequirements(park, b),
    missing = requirements.filter((r) => !r.met);
  const electric = !!h.safety?.electric,
    electricWorking = habitatHasElectric(b);
  const electricPrice = h.safety?.electricInstalled || electric ? 0 : ELECTRIC_FENCE_COST;
  const installed = profile.features.filter((f) => habitatHasFeature(b, f.id)).length;
  const animalLabel =
    kind === "lion" ? "Löwen & Löwinnen" : kind === "panda" ? "Große Pandas" : "Tiere";
  const adoptLabel =
    kind === "lion"
      ? h.count === 0
        ? "Löwe aufnehmen"
        : "Löwin aufnehmen"
      : `${s.animalName} aufnehmen`;
  const act = (action: HabitatPanelAction) => {
    const result = onAction(action);
    setError(typeof result === "string" ? result : "");
    if (typeof result === "string" && feedback.current) {
      feedback.current.focus({ preventScroll: true });
      feedback.current.scrollIntoView({ block: "nearest" });
    }
  };
  const carePrice = h.count * CARE_PER_ANIMAL;
  const fullyCared = Math.min(h.food, h.water, h.clean, h.health) >= 99.9;
  const careDisabled = !h.count || !connected || fullyCared || park.cash < carePrice;
  const careReason = !h.count
    ? "Noch keine Tiere im Gehege."
    : !connected
      ? "Ein erreichbarer Parkweg am Zaun fehlt."
      : fullyCared
        ? "Alle Tiere sind vollständig versorgt."
        : park.cash < carePrice
          ? `Es fehlen ${euro(carePrice - park.cash)}.`
          : "Futter und Wasser auffüllen, säubern und Gesundheit unterstützen.";
  return (
    <section className="habitat-panel z9">
      <header className="z9-habitat-title">
        <div>
          <span className="z9-eyebrow">{profile.biome}</span>
          <strong>
            {h.count} / {s.capacity} {animalLabel}
          </strong>
        </div>
        <div className="z9-welfare">
          <b>{Math.round(welfare(b))}%</b>
          <span>Tierwohl</span>
        </div>
      </header>
      {h.count > 0 && (
        <p className="z9-animal-names">
          {ANIMAL_NAMES[kind]
            .slice(0, h.count)
            .map(
              (_, i) =>
                `${animalName(kind, i)}${kind === "lion" ? (animalSex(kind, i) === "male" ? " · Löwe" : " · Löwin") : ""}`,
            )
            .join(" / ")}
        </p>
      )}
      {error && (
        <p ref={feedback} tabIndex={-1} className="z9-feedback" role="alert">
          {error}
        </p>
      )}
      <div className="z9-status-grid">
        <div className={`z9-status ${care.staffed ? "is-good" : "is-warning"}`}>
          <Users size={17} />
          <strong>Pflege</strong>
          <span>{care.label}</span>
          {onManageStaff && (
            <button className="secondary z9-manage-staff" onClick={onManageStaff}>
              Fachpersonal verwalten
            </button>
          )}
        </div>
        <div className={`z9-status ${safety.status === "safe" ? "is-good" : "is-warning"}`}>
          <ShieldCheck size={17} />
          <strong>Sicherung · {Math.round(safety.score)}%</strong>
          <span>{safety.label}</span>
        </div>
      </div>
      <details className="z9-requirements">
        <summary>
          <span>
            {missing.length ? `${missing.length} Bedürfnisse noch offen` : "Bedürfnisse erfüllt"}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <ul>
          {requirements.map((r, i) => (
            <li key={`${r.label}-${i}`} className={r.met ? "is-met" : "is-missing"}>
              <span className="z9-requirement-mark" aria-hidden="true">
                {r.met ? <Check size={14} /> : "!"}
              </span>
              <div>
                <strong>{r.label}</strong>
                <p>{r.detail}</p>
                <span className="z9-sr-only">{r.met ? "Erfüllt" : "Noch offen"}</span>
              </div>
            </li>
          ))}
        </ul>
      </details>
      <p className="z9-muted">{profile.social}</p>
      <div className="z9-section-heading">
        <h4>Versorgung</h4>
        <span>Regelmäßige Tierpflege</span>
      </div>
      <div className="z9-meters">
        {(
          [
            ["food", "Futter"],
            ["water", "Wasser"],
            ["clean", "Sauberkeit"],
            ["health", "Gesundheit"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className={h[key] < 40 ? "is-low" : ""}>
            <span>
              {label}
              <b>{Math.round(h[key])}%</b>
            </span>
            <progress aria-label={label} max={100} value={h[key]} />
          </label>
        ))}
      </div>
      <button className="secondary z9-wide" disabled={careDisabled} onClick={() => act("care")}>
        Sofortversorgung · {euro(carePrice)}
      </button>
      <p className="z9-muted">{careReason}</p>
      <div className="z9-section-heading">
        <h4>Artgerechte Ausstattung</h4>
        <span>
          {installed} / {profile.features.length} vorhanden
        </span>
      </div>
      {categories.map(({ id, label, Icon }) => {
        const features = profile.features.filter((f) => f.category === id);
        if (!features.length) return null;
        return (
          <div className="z9-feature-group" key={id}>
            <h5>
              <Icon size={15} />
              {label}
            </h5>
            {features.map((f) => {
              const owned = habitatHasFeature(b, f.id),
                lacking = park.cash < f.cost;
              return (
                <article className={`z9-feature ${owned ? "is-owned" : ""}`} key={f.id}>
                  <div>
                    <strong>{f.label}</strong>
                    <p>{f.description}</p>
                  </div>
                  <button
                    className="secondary"
                    disabled={owned || lacking}
                    onClick={() => act(`feature:${f.id}`)}
                    aria-label={
                      owned ? `${f.label}: vorhanden` : `${f.label} einbauen für ${euro(f.cost)}`
                    }
                  >
                    {owned ? (
                      <>
                        <Check size={14} />
                        Vorhanden
                      </>
                    ) : (
                      <>
                        <span>Einbauen</span>
                        <b>{euro(f.cost)}</b>
                      </>
                    )}
                  </button>
                  {!owned && lacking && (
                    <small className="z9-budget">Es fehlen {euro(f.cost - park.cash)}.</small>
                  )}
                </article>
              );
            })}
          </div>
        );
      })}
      <div className="z9-section-heading">
        <h4>
          <Fence size={16} /> Absicherung
        </h4>
        <span>{profile.barrierLabel}</span>
      </div>
      <div className="z9-security">
        <p>{safety.label}</p>
        <button
          className="secondary z9-wide"
          disabled={
            !connected || (h.safety?.condition ?? 100) >= 100 || park.cash < HABITAT_INSPECTION_COST
          }
          onClick={() => act("inspect")}
        >
          {(h.safety?.condition ?? 100) >= 100
            ? "Sicherung vollständig gewartet"
            : `Sicherung prüfen & warten · ${euro(HABITAT_INSPECTION_COST)}`}
        </button>
        {!connected ? (
          <small className="z9-budget">Für den Fachservice fehlt ein erreichbarer Parkweg.</small>
        ) : (
          (h.safety?.condition ?? 100) < 100 &&
          park.cash < HABITAT_INSPECTION_COST && (
            <small className="z9-budget">
              Es fehlen {euro(HABITAT_INSPECTION_COST - park.cash)}.
            </small>
          )
        )}
        {profile.electric ? (
          <div className="z9-electric">
            <div>
              <Zap size={17} />
              <strong>Elektrische Zusatzsicherung</strong>
              <span className={`z9-badge ${electricWorking ? "is-good" : ""}`}>
                {electric
                  ? electricWorking
                    ? "Aktiv"
                    : "Wartung nötig"
                  : electricPrice === 0
                    ? "Ausgeschaltet"
                    : "Optional"}
              </span>
            </div>
            <p>
              Ergänzt die artgeeignete Grundbegrenzung. Für Einbau und Aktivierung braucht es Zaun-
              & Anlagentechnik. Ein intakter Zaun und Wartung bleiben nötig.
            </p>
            <button
              className="secondary z9-wide"
              disabled={!electric && park.cash < electricPrice}
              onClick={() => act(electric ? "electric-off" : "electric-on")}
            >
              {electric
                ? "Zusatzsicherung ausschalten"
                : electricPrice === 0
                  ? "Zusatzsicherung einschalten · kostenlos"
                  : `Zusatzsicherung einbauen · ${euro(electricPrice)}`}
            </button>
            {!electric && park.cash < electricPrice && (
              <small className="z9-budget">Es fehlen {euro(electricPrice - park.cash)}.</small>
            )}
          </div>
        ) : (
          <p className="z9-muted">
            Für diese Art ist keine elektrische Zusatzsicherung vorgesehen.
          </p>
        )}
      </div>
      <div className="z9-adoption">
        <button
          className="primary z9-wide"
          disabled={h.count >= s.capacity || park.cash < s.adoption}
          onClick={() => act("adopt")}
        >
          {adoptLabel} · {euro(s.adoption)}
        </button>
        <p className="z9-muted">
          {h.count >= s.capacity
            ? "Das Gehege ist voll."
            : park.cash < s.adoption
              ? `Für ein weiteres Tier fehlen ${euro(s.adoption - park.cash)}.`
              : !h.count
                ? "Richte zuerst das Gehege ein. Mit Tieren kann es für Besucher öffnen."
                : "Prüfe vor jeder Aufnahme den Platz und die Versorgung."}
        </p>
      </div>
      {h.count > 0 && (
        <details className="z9-rehome">
          <summary>Tierbestand verwalten</summary>
          <button className="text-button" onClick={() => act("rehome")}>
            Ein Tier an Partnerzoo abgeben · ohne Erstattung
          </button>
        </details>
      )}
    </section>
  );
}
