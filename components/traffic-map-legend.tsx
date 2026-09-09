import { Map, X } from "lucide-react";
import { HEATMAP_LABELS } from "../game/traffic-overlay";
import type { TrafficMode } from "../game/park-traffic";
import "./traffic-map-legend.css";

export default function TrafficMapLegend({
  mode,
  onOpen,
  onClose,
}: {
  mode: TrafficMode;
  onOpen: () => void;
  onClose: () => void;
}) {
  const range =
    mode === "crowd"
      ? "0 · 1–3 · 4–8 · 9–15 · 16+ Gäste"
      : mode === "queues"
        ? "0 · 1–3 · 4–7 · 8–11 · 12+ Wartende"
        : mode === "litter"
          ? "0 · 1–2 · 3–5 · 6–9 · 10+ Müllteile"
          : "Keine Gäste · ab 75% · 45–74% · unter 45%";
  return (
    <aside className="traffic-map-legend" aria-label="Heatmap-Legende">
      <div>
        <button onClick={onOpen} className="traffic-map-open">
          <Map size={17} />
          <span>Live · {HEATMAP_LABELS[mode]}</span>
        </button>
        <button onClick={onClose} aria-label="Heatmap ausschalten" className="traffic-map-close">
          <X size={16} />
        </button>
      </div>
      <div className={`traffic-map-scale ${mode === "mood" ? "is-mood" : ""}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <p>{range}</p>
      <small>Je Bereich mit bis zu 3 × 3 Feldern. Klicke einen Bereich für die Ursachen an.</small>
    </aside>
  );
}
