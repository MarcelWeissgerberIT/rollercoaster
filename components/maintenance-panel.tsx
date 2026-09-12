"use client";
import { useState } from "react";
import { Wrench, MapPin, UserPlus, ClipboardCheck, Camera, Umbrella } from "lucide-react";
import { CATALOG, buildingBaseCost, type Park, type Building } from "../game/simulation";
import {
  condition,
  broken,
  maintenanceStatus,
  repairCost,
  repairAttraction,
  hireMechanic,
  dismissMechanic,
  assignMechanic,
  setInspectionInterval,
  requestInspection,
  INSPECTION_INTERVALS,
  MECHANIC_WAGE,
  FAULT_LABELS,
} from "../game/maintenance";
import { DEFAULT_PHOTO_PRICE, setPhotoPrice, UMBRELLA_PRICE } from "../game/retail";
import { difficultyCost } from "../game/difficulty";
import { staffLocation, type StaffRef } from "../game/staff";
import { staffHeadLook } from "../game/staff-animation";
import "./maintenance-panel.css";

/** Each command receives the live park; snapshots are display-only. */
export type MaintenanceCommand = (action: (live: Park) => string | null) => void;
export function MaintenancePanel({
  park,
  building,
  onCommand,
  onLocateStaff,
}: {
  park: Park;
  building?: Building;
  onCommand: MaintenanceCommand;
  onLocateStaff?: (ref: StaffRef) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const act = (action: (live: Park) => string | null, success: string) =>
    onCommand((live) => {
      const error = action(live);
      setMessage(error ?? success);
      return error;
    });
  const workers = park.maintenance?.workers ?? [];
  const onRide = (action: (s: Park, b: Building) => string | null, success: string) =>
    act((s) => {
      const b = s.buildings.find((b) => b.id === building?.id);
      return b ? action(s, b) : "Die Attraktion wurde entfernt.";
    }, success);
  return (
    <section
      className="maint-panel maintenance-card"
      aria-label={building ? "Wartung der Attraktion" : "Mechaniker verwalten"}
      tabIndex={-1}
    >
      <h4>
        <Wrench aria-hidden="true" />
        {building ? "Technik & Inspektionen" : "Mechanikerteam"}
      </h4>
      {building && (
        <>
          <div className="maint-condition">
            <strong>Zustand {Math.round(condition(building))}%</strong>
            <progress max={100} value={condition(building)} />
          </div>
          <p role="status">{maintenanceStatus(park, building)}</p>
          {building.maintenance?.fault && (
            <p className="maint-warning">
              {FAULT_LABELS[building.maintenance.fault]} · außer Betrieb
            </p>
          )}
          <fieldset>
            <legend>Inspektionsabstand</legend>
            <div className="maint-row">
              {INSPECTION_INTERVALS.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  aria-pressed={(building.maintenance?.interval ?? 180) === seconds}
                  onClick={() =>
                    onRide(
                      (s, b) => setInspectionInterval(s, b, seconds),
                      "Inspektionsplan aktualisiert.",
                    )
                  }
                >
                  {seconds} s
                </button>
              ))}
            </div>
          </fieldset>
          <div className="maint-row">
            <button
              type="button"
              disabled={!!building.maintenance?.request}
              onClick={() =>
                onRide(
                  requestInspection,
                  "Inspektion beauftragt. Der Mechaniker kommt über die Wege.",
                )
              }
            >
              <ClipboardCheck size={16} /> Prüfen
            </button>
            <button
              type="button"
              disabled={
                building.maintenance?.request === "repair" ||
                (!broken(building) && condition(building) >= 100)
              }
              onClick={() =>
                onRide(
                  (s, b) => repairAttraction(s, b, buildingBaseCost(b)),
                  "Reparatur beauftragt. Teile sind bezahlt; die Arbeit erfolgt vor Ort.",
                )
              }
            >
              Reparieren · {repairCost(building, buildingBaseCost(building))} €
            </button>
          </div>
          <small>
            Erst aussteigen lassen, dann prüfen oder reparieren. Ohne erreichbaren Weg und
            Mechaniker bleibt der Auftrag sichtbar offen. Reparaturen benötigen echte Arbeitszeit.
          </small>
        </>
      )}
      <div className="maint-hire">
        <span>
          {workers.length} / 8 Fachkräfte ·{" "}
          {difficultyCost(park, MECHANIC_WAGE, "wages").toLocaleString("de-DE")} € je Person / 90 s
        </span>
        <button
          type="button"
          disabled={workers.length >= 8}
          onClick={() =>
            act(hireMechanic, "Mechaniker eingestellt. Freie Aufträge werden automatisch verteilt.")
          }
        >
          <UserPlus size={16} /> Einstellen
        </button>
      </div>
      {!workers.length && (
        <p className="maint-warning">
          Noch kein Mechaniker. Inspektionen sind fällig, sobald ihr Zeitraum abläuft.
        </p>
      )}
      {workers.map((w) => {
        const location = staffLocation(park, { kind: "mechanic", id: w.id }),
          look = staffHeadLook({
            id: w.id,
            role: "mechanic",
            action: "idle",
            time: park.time,
            heading: 0,
          }),
          assigned = park.buildings.find((b) => b.id === w.assignment);
        return (
          <article className="maint-worker" key={w.id}>
            <button
              className="maint-locate"
              type="button"
              disabled={!onLocateStaff}
              onClick={() => onLocateStaff?.({ kind: "mechanic", id: w.id })}
              aria-label={`${w.name} im Park zeigen`}
            >
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="22" fill="#f3e2c9" />
                <path d="M8 44v-8q14-13 28 0v8" fill="#b57443" />
                <ellipse cx="22" cy="20" rx="9" ry="11" fill={look.skin} />
                <path d="M12 17v-5q10-12 20 0v5" fill="#e9ad58" />
                <path d="M9 16h27" stroke="#976735" strokeWidth="3" />
                <circle cx="19" cy="20" r="1" fill="#303f39" />
                <circle cx="25" cy="20" r="1" fill="#303f39" />
              </svg>
              <span>
                <strong>{w.name}</strong>
                <small>{w.qualification}</small>
                <small>{location?.label}</small>
              </span>
              <MapPin size={16} />
            </button>
            <small>
              {w.completed} Einsätze abgeschlossen ·{" "}
              {assigned ? `Fest: ${assigned.name}` : "Automatisch im ganzen Park"}
            </small>
            <div className="maint-row">
              <button
                type="button"
                aria-pressed={w.assignment === null}
                onClick={() =>
                  act(
                    (s) => assignMechanic(s, w.id, null),
                    "Automatische Auftragsverteilung aktiviert.",
                  )
                }
              >
                Automatisch
              </button>
              {building && (
                <button
                  type="button"
                  aria-pressed={w.assignment === building.id}
                  onClick={() =>
                    act(
                      (s) => assignMechanic(s, w.id, building.id),
                      `Zuständig für ${building.name}.`,
                    )
                  }
                >
                  Dieser Attraktion zuweisen
                </button>
              )}
              <button
                type="button"
                disabled={w.mode === "repair" || w.mode === "inspect"}
                onClick={() => act((s) => dismissMechanic(s, w.id), "Mechaniker verabschiedet.")}
              >
                Entlassen
              </button>
            </div>
            {!building && (
              <details>
                <summary>Attraktion fest zuweisen</summary>
                <div className="maint-assignments">
                  {park.buildings
                    .filter((b) => b.maintenance)
                    .map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={w.assignment === b.id}
                        onClick={() =>
                          act((s) => assignMechanic(s, w.id, b.id), `Zuständig für ${b.name}.`)
                        }
                      >
                        {b.name}
                      </button>
                    ))}
                </div>
              </details>
            )}
          </article>
        );
      })}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function RideRetailPanel({
  park,
  building,
  onCommand,
}: {
  park: Park;
  building: Building;
  onCommand: MaintenanceCommand;
}) {
  const photo = building.kind === "coaster" && building.photoPoint !== undefined,
    umbrella = building.kind === "balloon" || building.kind === "plush";
  if (!photo && !umbrella) return null;
  return (
    <section className="maint-panel" aria-label="Zusatzverkäufe">
      <h4>
        {photo ? <Camera size={19} /> : <Umbrella size={19} />}{" "}
        {photo ? "Fahrtfotos verkaufen" : "Regenschirme bei Regen"}
      </h4>
      {photo ? (
        <>
          <label>
            Fotopreis · {building.retail?.photoPrice ?? DEFAULT_PHOTO_PRICE} €
            <input
              type="range"
              min={0}
              max={15}
              step={1}
              value={building.retail?.photoPrice ?? DEFAULT_PHOTO_PRICE}
              onChange={(e) => {
                const n = +e.target.value;
                onCommand((s) => {
                  const b = s.buildings.find((x) => x.id === building.id);
                  return b ? setPhotoPrice(b, n) : "Attraktion fehlt.";
                });
              }}
            />
          </label>
          <p>
            Gäste kaufen nach der Fahrt, wenn ihnen die Bahn gefallen hat und ihr Budget reicht. 0 €
            deaktiviert den Verkauf.
          </p>
          <strong>
            {building.retail?.photoSales ?? 0} Fotos ·{" "}
            {(building.retail?.photoRevenue ?? 0).toLocaleString("de-DE")} € Umsatz
          </strong>
        </>
      ) : (
        <>
          <p>
            Bei Regen bieten deine Souvenirstände nach dem Einkauf einen Schirm für {UMBRELLA_PRICE}{" "}
            € an. Er schützt den Gast unterwegs und in der Warteschlange.
          </p>
          <strong>
            {building.retail?.umbrellaSales ?? 0} Schirme ·{" "}
            {(building.retail?.umbrellaRevenue ?? 0).toLocaleString("de-DE")} € Umsatz
          </strong>
        </>
      )}
    </section>
  );
}
