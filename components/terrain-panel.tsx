import { ArrowUp, ArrowDown, Layers, RotateCw, Mountain, Trash2 } from "lucide-react";
import type { ElevatedPath, TerrainTool } from "../game/terrain";
import "./creative-tools.css";
export type TerrainSettings = {
  mode: "terrain" | "path";
  action: TerrainTool;
  size: number;
  level: number;
  ramp: boolean;
  direction: 0 | 1 | 2 | 3;
  type: ElevatedPath["type"];
  erase: boolean;
  cutaway: boolean;
};
export const defaultTerrainSettings: TerrainSettings = {
  mode: "terrain",
  action: "raise",
  size: 1,
  level: 1,
  ramp: false,
  direction: 0,
  type: "path",
  erase: false,
  cutaway: true,
};
export default function TerrainPanel({
  value,
  onChange,
  onBuild,
}: {
  value: TerrainSettings;
  onChange: (s: TerrainSettings) => void;
  onBuild: () => void;
}) {
  const set = (patch: Partial<TerrainSettings>) => {
    onChange({ ...value, ...patch });
    onBuild();
  };
  return (
    <section className="creative-tools" aria-label="Gelände und Höhenwege">
      <header>
        <Mountain size={24} />
        <div>
          <h3>Neue Perspektiven</h3>
          <p>Terrassen formen. Brücken und Tunnel verbinden.</p>
        </div>
      </header>
      <div className="creative-inline">
        <button aria-pressed={value.mode === "terrain"} onClick={() => set({ mode: "terrain" })}>
          Gelände
        </button>
        <button aria-pressed={value.mode === "path"} onClick={() => set({ mode: "path" })}>
          Brücken & Tunnel
        </button>
      </div>
      {value.mode === "terrain" ? (
        <>
          <div className="creative-parts">
            {(
              [
                ["raise", "Anheben"],
                ["lower", "Absenken"],
                ["level", "Einebnen"],
              ] as const
            ).map(([action, label]) => (
              <button
                key={action}
                aria-pressed={value.action === action}
                onClick={() => set({ action })}
              >
                {action === "raise" ? (
                  <ArrowUp size={20} />
                ) : action === "lower" ? (
                  <ArrowDown size={20} />
                ) : (
                  <Layers size={20} />
                )}{" "}
                {label}
              </button>
            ))}
          </div>
          <label>
            Pinselgröße
            <div className="creative-inline">
              {[1, 3, 5].map((size) => (
                <button key={size} aria-pressed={value.size === size} onClick={() => set({ size })}>
                  {size} × {size}
                </button>
              ))}
            </div>
          </label>
          <p className="creative-help">
            Eine Stufe = 5 m. Nur freie Wiese wird verändert. Bestehende Gebäude bleiben auf
            sicherem Boden. Kosten: 18 € je Feld und Stufe.
          </p>
        </>
      ) : (
        <>
          <div className="creative-inline">
            {(
              [
                ["path", "Parkweg"],
                ["queue", "Eingang"],
                ["exit", "Ausgang"],
              ] as const
            ).map(([type, label]) => (
              <button key={type} aria-pressed={value.type === type} onClick={() => set({ type })}>
                {label}
              </button>
            ))}
          </div>
          <div className="creative-inline">
            <button aria-pressed={!value.ramp} onClick={() => set({ ramp: false })}>
              Gerade
            </button>
            <button aria-pressed={value.ramp} onClick={() => set({ ramp: true })}>
              Rampe +5 m
            </button>
          </div>
          {value.ramp && (
            <button
              className="creative-action"
              onClick={() =>
                set({ direction: ((value.direction + 1) % 4) as TerrainSettings["direction"] })
              }
            >
              <RotateCw size={18} /> Steigt nach{" "}
              {["Osten", "Süden", "Westen", "Norden"][value.direction]}
            </button>
          )}
          <button aria-pressed={value.erase} onClick={() => set({ erase: !value.erase })}>
            <Trash2 size={17} />{" "}
            {value.erase ? "Wege auf dieser Höhe entfernen" : "Wege auf dieser Höhe bauen"}
          </button>
          <p className="creative-help">
            Rampe auf 0 m an einen Bodenweg setzen; danach auf 5 m weiterbauen. Unter höherem
            Gelände entsteht ein Tunnel. Wege verbinden sich nur bei passender Anschlusshöhe. Brücke
            ab 38 €, Rampe 55 €, Tunnel 70 €.
          </p>
        </>
      )}
      <label className="creative-height">
        {value.mode === "path" ? "Unteres Wegende" : "Zielhöhe beim Einebnen"}
        <strong>{value.level * 5} m</strong>
        <input
          aria-label="Bauhöhe"
          type="range"
          min={-4}
          max={9}
          step={1}
          value={value.level}
          onChange={(e) => set({ level: Number(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.cutaway}
          onChange={(e) => onChange({ ...value, cutaway: e.target.checked })}
        />{" "}
        Unterirdische Wege anzeigen
      </label>
      <button className="creative-primary" onClick={onBuild}>
        Auf der Karte bauen
      </button>
    </section>
  );
}
