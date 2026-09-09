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
} from "../game/zoo";
import { HABITAT_PROFILES, type HabitatFeatureId } from "../game/habitat-needs";
import { access, type Park, type Building, type Kind } from "../game/simulation";
import { ANIMAL_NAMES, animalName, animalSex } from "../game/zoo-motion";

const euro = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export type ZooSpecialistsHandler = (role: SpecialistRole, count: number) => string | null | void;
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
    cost: keepers * KEEPER_WAGE + specialists * ZOO_SPECIALIST_WAGE,
  };
}

/** Shared by the zoo overview and staff panel. Backend remains the authority on role eligibility. */
export function ZooTeamControls({
  park,
  onKeepers,
  onSpecialists,
}: {
  park: Park;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
}) {
  const [error, setError] = useState("");
  const team = zooTeamTotals(park);
  const homes = park.buildings.filter((b) => b.kind === "keeperhut" && access(park, b)).length;
  const setRole = (role: SpecialistRole, count: number) => {
    const result = onSpecialists?.(role, count);
    setError(typeof result === "string" ? result : "");
  };
  return (
    <div className="z9-team">
      <div className="z9-section-heading">
        <h4>
          <Users size={16} /> Zoo-Team
        </h4>
        <span>{euro(team.cost)} / Spieltag</span>
      </div>
      <div className="z9-team-role">
        <div>
          <strong>Tierpflege</strong>
          <p>Basisversorgung für Zebras, Giraffen, Flamingos und Pinguine.</p>
          <small>{euro(KEEPER_WAGE)} je Person und Spieltag</small>
        </div>
        <label>
          <span className="z9-sr-only">Anzahl Tierpfleger</span>
          <select
            aria-label="Anzahl Tierpfleger"
            value={team.keepers}
            onChange={(e) => onKeepers(Number(e.target.value))}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="z9-specialists">
        <summary>
          <span>
            Fachpersonal <b>{team.specialists}</b>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <p className="z9-muted">
          Fachpflege übernimmt die Versorgung ihres Fachgebiets. Zauntechnik kümmert sich um die
          Sicherung.
        </p>
        {roles.map(([role, info]) => (
          <div className="z9-team-role" key={role}>
            <div>
              <strong>{info.label}</strong>
              <p>{info.description}</p>
              <small>{euro(ZOO_SPECIALIST_WAGE)} je Person und Spieltag</small>
            </div>
            <label>
              <span className="z9-sr-only">Anzahl {info.label}</span>
              <select
                aria-label={`Anzahl ${info.label}`}
                disabled={!onSpecialists}
                value={park.zoo?.specialists?.[role] ?? 0}
                onChange={(e) => setRole(role, Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </details>
      <p className={`z9-note ${homes ? "" : "z9-note--warning"}`}>
        <Wrench size={16} aria-hidden="true" />
        <span>
          {homes
            ? `${homes} erreichbare Tierpflegerstation${homes === 1 ? "" : "en"}.`
            : "Dem Team fehlt eine erreichbare Tierpflegerstation."}{" "}
          Futter und Pflege kosten zusätzlich {euro(CARE_PER_ANIMAL)} pro Tier je Versorgung.
        </span>
      </p>
      {error && (
        <p className="z9-feedback" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ZooOverview({
  park,
  onKeepers,
  onBuild,
  onSpecialists,
}: {
  park: Park;
  onKeepers: (n: number) => void;
  onBuild: (k: Kind) => void;
  onSpecialists?: ZooSpecialistsHandler;
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
      <ZooTeamControls park={park} onKeepers={onKeepers} onSpecialists={onSpecialists} />
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
