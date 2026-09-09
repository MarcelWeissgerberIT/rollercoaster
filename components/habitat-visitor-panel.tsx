import { Binoculars, MapPin, Play } from "lucide-react";
import type { Building, Park } from "../game/simulation";
import { viewpointStatus } from "../game/habitat-viewpoint";
import { habitatSafety } from "../game/zoo";
import "./habitat-visitor-panel.css";

export default function HabitatVisitorPanel({
  park,
  building: b,
  placing,
  plan,
  onPlace,
  onClear,
  onOpen,
}: {
  park: Park;
  building: Building;
  placing: boolean;
  plan: { cost: number; error: string | null };
  onPlace: () => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  const status = viewpointStatus(park, b),
    guests = park.guests.filter((g) => g.target === b.id && g.state !== "leave"),
    observing = guests.filter((g) => g.state === "observe").length,
    blocked =
      habitatSafety(b).status === "closed"
        ? "Die Gehegesicherung muss zuerst gewartet werden."
        : !b.habitat?.count
          ? "Nimm zuerst Tiere auf."
          : plan.error;
  return (
    <section className="habitat-visitors" aria-label="Besucher am Gehege">
      <header>
        <Binoculars size={21} />
        <div>
          <strong>Besucher am Gehege</strong>
          <span>
            {b.open
              ? status.connected
                ? "Geöffnet & erreichbar"
                : "Besucherweg fehlt"
              : "Geschlossen · Gäste kommen erst nach der Öffnung"}
          </span>
        </div>
      </header>
      <div className="habitat-visitor-counts">
        <span>
          <b>{observing}</b> beobachten
        </span>
        <span>
          <b>{guests.length - observing}</b> unterwegs
        </span>
        <span>
          <b>{b.served}</b> Besuche
        </span>
      </div>
      <p>{status.label}</p>
      {placing ? (
        <p className="habitat-visitor-instruction" role="status">
          Klicke auf ein markiertes Feld außen am Zaun. Auf Gras kostet der Besucherplatz 12 €;
          vorhandene Parkwege sind kostenlos.
        </p>
      ) : (
        <button className="secondary" onClick={onPlace}>
          <MapPin size={16} />
          {status.point ? "Beobachtungspunkt versetzen" : "Beobachtungspunkt platzieren"}
        </button>
      )}
      {status.point && !placing && (
        <button className="habitat-visitor-reset" onClick={onClear}>
          Beobachtungspunkt entfernen · alle Zaunwege nutzen
        </button>
      )}
      {(!b.open || !status.connected) && (
        <>
          <button className="primary" disabled={!!blocked} onClick={onOpen}>
            <Play size={16} />
            {plan.cost
              ? `Verbinden & öffnen · ${Math.round(plan.cost)} €`
              : "Gehege für Besucher öffnen"}
          </button>
          {blocked && <p className="habitat-visitor-blocked">{blocked}</p>}
        </>
      )}
      <small>
        Gäste bleiben außerhalb des Zauns. Ein Beobachtungspunkt bündelt die Zuschauer an bis zu
        drei verbundenen Wegfeldern.
      </small>
    </section>
  );
}
