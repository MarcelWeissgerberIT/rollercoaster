"use client";

import { BrushCleaning, CircleUserRound, Users } from "lucide-react";
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
import { ZooTeamControls, zooTeamTotals, type ZooSpecialistsHandler } from "./zoo-panel";

export function StaffPanel({
  park,
  onCleaners,
  onKeepers,
  onSpecialists,
  onSelectRide,
  onStaffRide,
}: {
  park: Park;
  onCleaners: (count: number) => void;
  onKeepers: (count: number) => void;
  onSpecialists?: ZooSpecialistsHandler;
  onSelectRide: (id: number) => void;
  onStaffRide: (id: number, staffed: boolean) => void;
}) {
  const ops = operationsStats(park),
    zoo = zooTeamTotals(park);
  const wages = park.staff * 80 + zoo.cost + ops.dailyCost;
  return (
    <section className="staff-panel z9">
      <h3>Dein Parkteam</h3>
      <div className="z9-summary">
        <div>
          <Users size={20} />
          <b>{park.staff + zoo.count + ops.staffed}</b>
          <span>Mitarbeitende</span>
        </div>
        <div>
          <CircleUserRound size={20} />
          <b>{wages.toLocaleString("de-DE")} €</b>
          <span>Löhne pro Spieltag</span>
        </div>
      </div>
      <div className="z9-team-role z9-cleaners">
        <div>
          <strong>
            <BrushCleaning size={16} /> Reinigung
          </strong>
          <p>Müll sammeln und Mülleimer leeren.</p>
          <small>80 € je Person und Spieltag</small>
        </div>
        <label>
          <span className="z9-sr-only">Anzahl Reinigungskräfte</span>
          <select
            aria-label="Anzahl Reinigungskräfte"
            value={park.staff}
            onChange={(e) => onCleaners(Number(e.target.value))}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ZooTeamControls park={park} onKeepers={onKeepers} onSpecialists={onSpecialists} />
      <div className="z9-section-heading">
        <h4>Bedienpersonal</h4>
        <span>
          {ops.staffed} / {ops.rides} besetzt
        </span>
      </div>
      <p className="z9-muted">
        Eine Person pro Fahrgeschäft · {OPERATOR_WAGE} € pro Spieltag. Einlass, Kontrolle und
        Bedienpult.
      </p>
      {ops.unstaffed > 0 && (
        <p className="z9-note z9-note--warning">
          {ops.unstaffed} {ops.unstaffed === 1 ? "Fahrgeschäft wartet" : "Fahrgeschäfte warten"} auf
          Bedienpersonal.
        </p>
      )}
      {!ops.rides && (
        <p className="z9-note">
          Beim Bau eines Fahrgeschäfts wird automatisch Bedienpersonal zugewiesen.
        </p>
      )}
      <div className="z9-ride-staff">
        {park.buildings
          .filter((b) => needsOperator(b.kind))
          .map((b) => {
            const assigned = hasOperator(b),
              occupied = b.riders.length > 0 && assigned;
            return (
              <article key={b.id}>
                <button className="z9-ride-link" onClick={() => onSelectRide(b.id)}>
                  <strong>{b.name}</strong>
                  <span>
                    {assigned
                      ? `${operatorName(b)} · ${OPERATION_LABELS[operatorActivity(b)]}`
                      : "Bedienpersonal fehlt"}
                  </span>
                </button>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Bedienpersonal für ${b.name}`}
                    checked={assigned}
                    disabled={occupied}
                    onChange={(e) => onStaffRide(b.id, e.target.checked)}
                  />
                  <span>Zugewiesen</span>
                </label>
                {occupied && (
                  <small>Während einer Fahrt bleibt das Bedienpersonal zugewiesen.</small>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
