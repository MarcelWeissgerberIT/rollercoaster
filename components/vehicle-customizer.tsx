import { useEffect, useRef, useState } from "react";
import { PAINTS, VEHICLES, vehicleFor, type Vehicle } from "../game/vehicles";
import { paintedCar } from "../game/vehicle-sprite";
import { assetUrl } from "../game/assets";
import type { Building } from "../game/simulation";
export function CarPreview({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.src = assetUrl(`car-${VEHICLES[vehicle.model].sprite}-se`);
    const draw = () => {
      const ctx = canvas.current?.getContext("2d");
      if (!alive || !ctx) return;
      ctx.clearRect(0, 0, 384, 180);
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < 2; i++)
        ctx.drawImage(paintedCar(image, vehicle, i), i * 170 + 10, 8, 192, 160);
    };
    image.onload = draw;
    if (image.complete) draw();
    return () => {
      alive = false;
    };
  }, [vehicle]);
  return (
    <canvas
      className={className}
      width={384}
      height={180}
      ref={canvas}
      role="img"
      aria-label={`${VEHICLES[vehicle.model].name}, Vorschau der Wagenfarben`}
    />
  );
}
export default function VehicleCustomizer({
  building,
  onApply,
}: {
  building: Building;
  onApply: (v: Vehicle) => void;
}) {
  const [v, setV] = useState(() => ({ ...vehicleFor(building) }));
  useEffect(() => setV({ ...vehicleFor(building) }), [building.id, building.vehicle]);
  return (
    <details className="vehicle-customizer">
      <summary>Wagen & Farben</summary>
      <CarPreview vehicle={v} />
      <div className="vehicle-models" role="group" aria-label="Wagenmodell">
        {Object.entries(VEHICLES).map(([id, item]) => (
          <button
            key={id}
            className={v.model === id ? "active" : ""}
            aria-pressed={v.model === id}
            title={item.detail}
            onClick={() => setV({ ...v, model: id as Vehicle["model"] })}
          >
            {item.name}
          </button>
        ))}
      </div>
      <p className="small">{VEHICLES[v.model].detail} · für alle Bahntypen</p>
      <div className="vehicle-colors">
        {(
          [
            ["body", "Karosserie"],
            ["accent", "Akzente"],
            ["seats", "Sitze"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="color"
              aria-label={`Wagenfarbe ${label}`}
              value={v[key]}
              onChange={(e) => setV({ ...v, [key]: e.target.value })}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="paint-swatches">
        {PAINTS.map((p) => (
          <button
            key={p.name}
            title={p.name}
            aria-label={`Lackierung ${p.name}`}
            onClick={() => setV({ ...v, body: p.body, accent: p.accent, seats: p.seats })}
            style={{ background: `linear-gradient(135deg,${p.body} 50%,${p.accent} 50%)` }}
          />
        ))}
      </div>
      <label className="vehicle-alternating">
        <input
          type="checkbox"
          checked={v.alternating}
          onChange={(e) => setV({ ...v, alternating: e.target.checked })}
        />
        Wagen abwechselnd färben
      </label>
      <button
        className="primary"
        disabled={JSON.stringify(vehicleFor(building)) === JSON.stringify(v)}
        onClick={() => onApply(v)}
      >
        Wagendesign übernehmen · kostenlos
      </button>
      <p className="small">
        Vorschau vor dem Übernehmen · Kapazität und Fahrverhalten bleiben gleich.
      </p>
    </details>
  );
}
