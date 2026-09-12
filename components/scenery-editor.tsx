import { RotateCw, Trash2, Layers, MoveUp } from "lucide-react";
import {
  SCENERY_PARTS,
  SCENERY_THEMES,
  type SceneryDraft,
  type SceneryPiece,
} from "../game/modular-scenery";
import "./creative-tools.css";
type Props = {
  draft: SceneryDraft;
  onChange: (p: SceneryDraft) => void;
  pieces: SceneryPiece[];
  onRotate: (id: number) => void;
  onRemove: (id: number) => void;
  onFocus?: (p: SceneryPiece) => void;
};
export default function SceneryEditor({
  draft,
  onChange,
  pieces,
  onRotate,
  onRemove,
  onFocus,
}: Props) {
  return (
    <section className="creative-tools" aria-label="Themenbaukasten">
      <header>
        <Layers size={24} />
        <div>
          <h3>Themenbaukasten</h3>
          <p>Fassaden, Dächer und kleine Details. Dein eigener Stil.</p>
        </div>
      </header>
      <div className="creative-swatches">
        {Object.entries(SCENERY_THEMES).map(([key, t]) => (
          <button
            key={key}
            aria-pressed={draft.theme === key}
            onClick={() => onChange({ ...draft, theme: key as SceneryDraft["theme"] })}
          >
            <span style={{ background: t.wall, borderColor: t.roof }} />
            {t.name}
          </button>
        ))}
      </div>
      <div className="creative-parts">
        {Object.entries(SCENERY_PARTS).map(([key, p]) => (
          <button
            key={key}
            aria-pressed={draft.part === key}
            onClick={() => onChange({ ...draft, part: key as SceneryDraft["part"] })}
          >
            <strong>{p.name}</strong>
            <small>
              {p.cost} € · {p.height * 5} m
            </small>
          </button>
        ))}
      </div>
      <label className="creative-height">
        <MoveUp size={17} /> Bauhöhe <strong>{draft.z * 5} m</strong>
        <input
          aria-label="Höhe des Themenbauteils"
          type="range"
          min={-4}
          max={14}
          step={0.5}
          value={draft.z}
          onChange={(e) => onChange({ ...draft, z: Number(e.target.value) })}
        />
      </label>
      <button
        className="creative-action"
        onClick={() =>
          onChange({
            ...draft,
            orientation: ((draft.orientation + 1) % 4) as SceneryDraft["orientation"],
          })
        }
      >
        <RotateCw size={17} /> Seite drehen · {draft.orientation * 90}°
      </button>
      <p className="creative-help">
        Klicke auf ein Feld zum Bauen. Für ein Obergeschoss die Höhe anheben. Wände stehen am
        Feldrand; Durchgänge halten Wege offen.
      </p>
      <details>
        <summary>{pieces.length} gebaute Teile verwalten</summary>
        <div className="creative-built">
          {pieces
            .slice(-100)
            .reverse()
            .map((p) => (
              <div key={p.id}>
                <button onClick={() => onFocus?.(p)}>
                  <strong>{SCENERY_PARTS[p.part].name}</strong>
                  <small>
                    {p.x}, {p.y} · {p.z * 5} m
                  </small>
                </button>
                <button aria-label={`Bauteil ${p.id} drehen`} onClick={() => onRotate(p.id)}>
                  <RotateCw size={16} />
                </button>
                <button aria-label={`Bauteil ${p.id} entfernen`} onClick={() => onRemove(p.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        </div>
      </details>
    </section>
  );
}
