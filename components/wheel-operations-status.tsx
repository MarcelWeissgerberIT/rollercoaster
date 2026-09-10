import { FerrisWheel, UserRound } from "lucide-react";
import type { Building } from "../game/simulation";
import { wheelVisualState } from "../game/wheel-boarding";
import "./wheel-operations-status.css";

export function WheelOperationsStatus({ building }: { building: Building }) {
  const wheel = wheelVisualState(building);
  const occupied = wheel.gondolas.filter((id) => id !== null).length;
  const atPlatform = wheel.phase === "loading" || wheel.phase === "unloading";
  return (
    <div className="wheel-operations-status" aria-label="Gondelbetrieb">
      <div className="wheel-status-heading">
        <FerrisWheel size={19} aria-hidden="true" />
        <strong>{wheel.label}</strong>
      </div>
      <p>
        {occupied} / {wheel.gondolas.length} Gondeln belegt
        {atPlatform && ` · Gondel ${wheel.currentGondola + 1} an der Plattform`}
      </p>
      <div className="wheel-gondola-list" aria-label="Belegung der einzelnen Gondeln">
        {wheel.gondolas.map((guestId, index) => (
          <span
            key={index}
            className={`wheel-gondola${guestId !== null ? " occupied" : ""}${atPlatform && index === wheel.currentGondola ? " at-platform" : ""}`}
            aria-label={`Gondel ${index + 1}: ${guestId !== null ? "belegt" : "frei"}${atPlatform && index === wheel.currentGondola ? ", an der Plattform" : ""}`}
            title={`Gondel ${index + 1} · ${guestId !== null ? "belegt" : "frei"}`}
          >
            <UserRound size={13} aria-hidden="true" />
            <small>{index + 1}</small>
          </span>
        ))}
      </div>
      <small>
        Gondel für Gondel einsteigen, dann die gewählten Runden fahren. Ohne weitere Wartende
        startet das Rad auch mit freien Plätzen. Danach steigen die Gäste nacheinander aus.
      </small>
    </div>
  );
}
