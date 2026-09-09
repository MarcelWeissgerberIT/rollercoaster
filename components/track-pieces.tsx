import { appendPiece, startTrack, PIECES, type Piece } from "../game/prefabs";
import type { Point } from "../game/simulation";
import { trackSections } from "../game/track-edit";

function plot(points: Point[], width: number, height: number) {
  const flat = points.map((p) => ({ x: (p.x - p.y) * 2, y: p.x + p.y - (p.z ?? 0) * 2.5 }));
  const xs = flat.map((p) => p.x),
    ys = flat.map((p) => p.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const scale = Math.min(
    (width - 22) / Math.max(1, Math.max(...xs) - minX),
    (height - 22) / Math.max(1, Math.max(...ys) - minY),
  );
  const dx = (width - (Math.max(...xs) - minX) * scale) / 2;
  const dy = (height - (Math.max(...ys) - minY) * scale) / 2;
  return flat.map((p) => ({ x: dx + (p.x - minX) * scale, y: dy + (p.y - minY) * scale }));
}
const path = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export function TrackPieceIcon({ piece }: { piece: Piece }) {
  const raw = appendPiece(startTrack({ x: 0, y: 0 }), piece);
  const points = plot(piece === "loop" ? raw.map((p) => ({ ...p, y: 0 })) : raw, 92, 54);
  return (
    <svg viewBox="0 0 92 54" className="track-piece-icon" aria-hidden="true">
      <path
        d={path(points)}
        fill="none"
        stroke="#244f42"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={path(points)}
        fill="none"
        stroke="#ed9659"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle {...{ cx: points[0].x, cy: points[0].y }} r="4" fill="#fff8d9" stroke="#244f42" />
      <circle
        {...{ cx: points.at(-1)!.x, cy: points.at(-1)!.y }}
        r="4"
        fill="#4bbda2"
        stroke="#244f42"
      />
    </svg>
  );
}

export function TrackPieceCatalog({
  selected,
  onSelect,
  wood = false,
}: {
  selected: Piece;
  onSelect: (piece: Piece) => void;
  wood?: boolean;
}) {
  return (
    <div
      className="prefab-grid illustrated-pieces"
      role="group"
      aria-label="Fertigteile für die Achterbahn"
    >
      {(Object.entries(PIECES) as [Piece, (typeof PIECES)[Piece]][]).map(([id, item]) => (
        <button
          key={id}
          className={selected === id ? "active" : ""}
          aria-pressed={selected === id}
          disabled={id === "loop" && wood}
          title={
            id === "loop" && wood ? "Loopings benötigen eine Stahl- oder Launch-Bahn" : item.detail
          }
          onClick={() => onSelect(id)}
        >
          <TrackPieceIcon piece={id} />
          <strong>{item.name}</strong>
          <small>{id === "loop" && wood ? "Nur Stahl / Launch" : item.detail}</small>
        </button>
      ))}
    </div>
  );
}

export function TrackRangeMap({
  track,
  from,
  to,
  onSelect,
  color = "#e35c42",
  sections: suppliedSections,
  selected,
}: {
  track: Point[];
  from: number;
  to: number;
  onSelect: (index: number, extend: boolean) => void;
  color?: string;
  sections?: ReturnType<typeof trackSections>;
  selected?: number[];
}) {
  if (track.length < 2) return null;
  const points = plot(track, 290, 150),
    sections = suppliedSections ?? trackSections(track);
  return (
    <svg
      viewBox="0 0 290 150"
      className="track-range-map"
      aria-label={
        selected
          ? "Gleisplan: Mehrfachauswahl, Klicken markiert oder löst, Umschalt ergänzt einen Bereich"
          : "Gleisplan: Abschnitt anklicken, mit Umschalt den Bereich erweitern"
      }
    >
      <path d={path(points)} fill="none" stroke="#d8e1ca" strokeWidth="9" strokeLinejoin="round" />
      {sections.map((part, i) => (
        <path
          key={i}
          d={path(points.slice(part.start, part.end + 1))}
          fill="none"
          stroke={
            (selected ? selected.includes(i) : i >= from && i <= to)
              ? color
              : track[part.start]?.drive?.kind === "boost"
                ? "#27b4ae"
                : track[part.start]?.drive?.kind === "brake"
                  ? "#e48c36"
                  : "#37674e"
          }
          strokeWidth="7"
          strokeLinecap="round"
          role="button"
          tabIndex={0}
          aria-label={`Abschnitt ${i + 1}: ${part.label}`}
          aria-pressed={selected ? selected.includes(i) : i >= from && i <= to}
          onClick={(e) => onSelect(i, e.shiftKey)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(i, e.shiftKey);
            }
          }}
        >
          <title>
            {i + 1} · {part.label}
          </title>
        </path>
      ))}
      <circle cx={points[0].x} cy={points[0].y} r="8" fill="#fff9df" stroke="#38674e" />
      <text
        x={points[0].x}
        y={points[0].y + 3}
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="#244f42"
      >
        S
      </text>
    </svg>
  );
}
