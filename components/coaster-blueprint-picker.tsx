import { useMemo, type CSSProperties } from "react";
import { Check, LockKeyhole, Mountain, Route, Ruler, Zap } from "lucide-react";
import {
  COASTER_TYPES,
  trackCost,
  trackStats,
  type CoasterType,
  type Point,
} from "../game/simulation";
import {
  coasterBlueprints,
  coasterBlueprintPreview,
  type CoasterBlueprintId,
} from "../game/coaster-blueprints";
import { vehicleFor } from "../game/vehicles";
import { CarPreview } from "./vehicle-customizer";

const typeLabels: Record<CoasterType, string> = {
  steel: "Stahl & Loopings",
  wood: "Holz & Hügel",
  launch: "Launch & Tempo",
  giga: "Höhe & Airtime",
  inverted: "Hängende Sitze",
};
const typeNames: Record<CoasterType, string> = {
  steel: "Stahl",
  wood: "Holz",
  launch: "Launch",
  giga: "Giga",
  inverted: "Inverted",
};
const typeOrder: CoasterType[] = ["steel", "wood", "launch", "giga", "inverted"];
const categories = {
  compact: "Kompakt",
  scenic: "Panorama",
  thrill: "Nervenkitzel",
  extreme: "Extrem",
};
const euro = (n: number) => `${n.toLocaleString("de-DE")} €`;

export function CoasterTypePicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: CoasterType;
  onSelect: (type: CoasterType) => void;
  disabled: (type: CoasterType) => boolean;
}) {
  return (
    <div className="coaster-type-selector">
      <div className="coaster-type-picker" role="group" aria-label="Achterbahntyp">
        {typeOrder.map((type) => (
          <button
            key={type}
            className={selected === type ? "active" : ""}
            style={{ "--coaster-color": COASTER_TYPES[type].color } as CSSProperties}
            disabled={disabled(type)}
            aria-pressed={selected === type}
            aria-label={`${COASTER_TYPES[type].name} · ${typeLabels[type]}`}
            title={COASTER_TYPES[type].description}
            onClick={() => onSelect(type)}
          >
            <CarPreview single vehicle={vehicleFor({ track: [{ x: 0, y: 0, style: type }] })} />
            <strong>{typeNames[type]}</strong>
            {disabled(type) && <LockKeyhole className="coaster-type-lock" size={12} />}
          </button>
        ))}
      </div>
      <p className="coaster-type-caption">
        <strong>{COASTER_TYPES[selected].name}</strong> · {typeLabels[selected]}
      </p>
    </div>
  );
}

/** Draw the same sampled geometry that is placed in the park, including its real elevations. */
function BlueprintDrawing({ track, color }: { track: Point[]; color: string }) {
  const drawing = useMemo(() => {
    const iso = (p: Point, ground = false) => ({
      x: p.x - p.y,
      y: (p.x + p.y) * 0.48 - (ground ? 0 : (p.z ?? 0) * 0.78),
    });
    const raw = track.map((p) => iso(p)),
      base = track.map((p) => iso(p, true));
    const all = [...raw, ...base],
      xs = all.map((p) => p.x),
      ys = all.map((p) => p.y);
    const minX = Math.min(...xs),
      minY = Math.min(...ys),
      dx = Math.max(...xs) - minX,
      dy = Math.max(...ys) - minY;
    const scale = Math.min(158 / Math.max(1, dx), 84 / Math.max(1, dy));
    const fit = (p: { x: number; y: number }) => ({
      x: (180 - dx * scale) / 2 + (p.x - minX) * scale,
      y: (106 - dy * scale) / 2 + (p.y - minY) * scale,
    });
    const points = raw.map(fit),
      ground = base.map(fit);
    const path = (ps: typeof points) =>
      ps.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    return { points, ground, route: path(points), shadow: path(ground) };
  }, [track]);
  return (
    <svg viewBox="0 0 180 106" className="blueprint-drawing" aria-hidden="true">
      <path
        d={drawing.shadow}
        fill="none"
        stroke="#c5d6be"
        strokeWidth="9"
        strokeLinejoin="round"
        opacity=".6"
      />
      {drawing.points.map((p, i) =>
        i % 16 === 0 && (track[i].z ?? 0) > 0.15 ? (
          <path
            key={i}
            d={`M${p.x},${p.y}L${drawing.ground[i].x},${drawing.ground[i].y}`}
            stroke="#8c9f91"
            strokeWidth="1.2"
          />
        ) : null,
      )}
      <path
        d={drawing.route}
        fill="none"
        stroke="#304c42"
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      <path d={drawing.route} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={drawing.route} fill="none" stroke="#fff4d4" strokeWidth=".8" strokeDasharray="1 3" />
      <circle
        cx={drawing.points[0].x}
        cy={drawing.points[0].y}
        r="4"
        fill="#fff9e9"
        stroke="#315d4b"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CoasterBlueprintPicker({
  style,
  selected,
  rotation,
  onSelect,
}: {
  style: CoasterType;
  selected: CoasterBlueprintId;
  rotation: number;
  onSelect: (id: CoasterBlueprintId) => void;
}) {
  const options = useMemo(
    () =>
      coasterBlueprints(style).map((item) => {
        const track = coasterBlueprintPreview(style, item.id);
        const xs = track.map((p) => p.x),
          ys = track.map((p) => p.y);
        return {
          ...item,
          track,
          stats: trackStats(track),
          cost: trackCost(track),
          width: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)) + 1,
          depth: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) + 1,
        };
      }),
    [style],
  );
  const current = options.find((item) => item.id === selected) ?? options[0];
  return (
    <section className="blueprint-picker" aria-label="Fertige Strecken">
      <div className="blueprint-picker-heading">
        <strong>Wähle deine Strecke</strong>
        <span>{options.length} Vorlagen</span>
      </div>
      <div className="blueprint-options" role="group" aria-label="Schnellbau-Vorlage">
        {options.map((item) => (
          <button
            key={item.id}
            className={item.id === current.id ? "active" : ""}
            aria-pressed={item.id === current.id}
            onClick={() => onSelect(item.id)}
            aria-label={`${item.name} · ${categories[item.category]} · ${item.stats.length} Meter`}
          >
            <span className={`blueprint-category category-${item.category}`}>
              {categories[item.category]}
            </span>
            {item.id === current.id && <Check className="blueprint-selected" size={15} />}
            <BlueprintDrawing track={item.track} color={COASTER_TYPES[style].color} />
            <strong>{item.name}</strong>
            <small>
              {item.stats.length} m · {Math.round(item.stats.height)} m hoch
            </small>
          </button>
        ))}
      </div>
      <div className="blueprint-details" aria-live="polite" aria-atomic="true">
        <div className="blueprint-detail-title">
          <strong>{current.name}</strong>
          <b>{euro(current.cost)}</b>
        </div>
        <p>{current.description}</p>
        <div className="blueprint-metrics">
          <span>
            <Route size={13} /> {current.stats.length} m
          </span>
          <span>
            <Mountain size={13} /> {Math.round(current.stats.height)} m
          </span>
          <span>
            <Zap size={13} /> {current.stats.speed} km/h
          </span>
          <span>
            <Ruler size={13} /> {rotation % 2 ? current.depth : current.width} ×{" "}
            {rotation % 2 ? current.width : current.depth} Felder
          </span>
        </div>
      </div>
      <p className="blueprint-place-hint">
        Im Park platzieren · R dreht die Vorlage
        <br />
        Grün passt, Rot zeigt einen Baukonflikt.
      </p>
    </section>
  );
}
