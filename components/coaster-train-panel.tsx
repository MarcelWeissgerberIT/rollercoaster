import { useState } from "react";
import { TrainFront, ShieldCheck, Clock3, Users } from "lucide-react";
import { type Building, rideCapacity } from "../game/simulation";
import {
  trainProgramOf,
  trainProgramError,
  TRAIN_PHASE_LABELS,
  type TrainProgram,
} from "../game/coaster-trains";
import "./coaster-train-panel.css";

export function CoasterTrainPanel({
  building: b,
  onApply,
}: {
  building: Building;
  onApply: (program: TrainProgram) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...trainProgramOf(b, rideCapacity(b)) }));
  if (b.kind !== "coaster") return null;
  const error = trainProgramError(b, draft),
    update = (key: keyof TrainProgram, value: number) =>
      setDraft((p) => {
        const next = { ...p, [key]: value };
        if (key === "count") next.blocks = Math.max(next.blocks, value + 2);
        if (key === "minWait") next.maxWait = Math.max(value, next.maxWait);
        return next;
      });
  return (
    <section className="coaster-train-panel" aria-label="Züge und Blockbetrieb">
      <h3>
        <TrainFront size={20} /> Züge &amp; Blockbetrieb
      </h3>
      <p>
        Jeder Zug fährt eigenständig. Das nächste Signal öffnet erst, wenn auch der letzte Wagen den
        Block verlassen hat.
      </p>
      <div className="train-config-grid">
        <label>
          Züge
          <input
            aria-label="Anzahl Züge"
            type="number"
            min={1}
            max={4}
            value={draft.count}
            onChange={(e) => update("count", Number(e.target.value))}
          />
        </label>
        <label>
          Wagen je Zug
          <input
            aria-label="Wagen je Zug"
            type="number"
            min={1}
            max={8}
            value={draft.cars}
            onChange={(e) => update("cars", Number(e.target.value))}
          />
        </label>
        <label>
          <Clock3 size={14} /> Mind. warten (s)
          <input
            type="number"
            min={0}
            max={120}
            value={draft.minWait}
            onChange={(e) => update("minWait", Number(e.target.value))}
          />
        </label>
        <label>
          Max. warten (s)
          <input
            type="number"
            min={Math.max(1, draft.minWait)}
            max={120}
            value={draft.maxWait}
            onChange={(e) => update("maxWait", Number(e.target.value))}
          />
        </label>
      </div>
      <label className="train-load">
        <span>
          <Users size={15} /> Mindestbelegung <b>{draft.minLoad}%</b>
        </span>
        <input
          aria-label="Mindestbelegung"
          type="range"
          min={0}
          max={100}
          step={10}
          value={draft.minLoad}
          onChange={(e) => update("minLoad", Number(e.target.value))}
        />
      </label>
      <label className="train-blocks">
        <ShieldCheck size={17} />
        <span>Sicherheitsblöcke</span>
        <input
          aria-label="Sicherheitsblöcke"
          type="number"
          min={draft.count + 2}
          max={16}
          value={draft.blocks}
          onChange={(e) => update("blocks", Number(e.target.value))}
        />
      </label>
      <small>
        Signale und Blockbremsen werden gleichmäßig auf der Strecke eingerichtet. Nach der maximalen
        Wartezeit fährt auch ein teilweise besetzter Zug.
      </small>
      {error && (
        <p role="status" className="train-program-error">
          {error}
        </p>
      )}
      <button type="button" className="primary" disabled={!!error} onClick={() => onApply(draft)}>
        Betriebsprogramm übernehmen
      </button>
      {!!b.trainFleet && (
        <div className="train-status" aria-label="Aktuelle Züge">
          {b.trainFleet.trains.map((t) => (
            <div key={t.id}>
              <b>Zug {t.id}</b>
              <span>{TRAIN_PHASE_LABELS[t.phase]}</span>
              <small>
                {t.riders.length}/{b.trainFleet!.program.cars * 2} Gäste ·{" "}
                {Math.round(t.speed * 3.6)} km/h
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
