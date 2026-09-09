import { parkInsights, type ParkIssue } from "../game/park-insights";
import type { Park } from "../game/simulation";
export default function ParkAnalysis({
  park,
  onFocus,
  onBin,
  onStaff,
  onRide,
  moods,
  onMoods,
}: {
  park: Park;
  onFocus: (issue: ParkIssue) => void;
  onBin: () => void;
  onStaff: () => void;
  onRide: (id: number) => void;
  moods: boolean;
  onMoods: (v: boolean) => void;
}) {
  const a = parkInsights(park);
  return (
    <div className="park-analysis">
      <p className="small">
        Die farbigen Markierungen zeigen, wo du den Park verbessern kannst. Werte stammen aus dem
        laufenden Park.
      </p>
      <div className="analysis-stats">
        <div>
          <b>{a.cleanliness}%</b>
          <span>Sauberkeit</span>
        </div>
        <div>
          <b>{a.dirty}</b>
          <span>Müllteile</span>
        </div>
        <div>
          <b>{a.waiting}</b>
          <span>Wartende Gäste</span>
        </div>
        <div>
          <b>{a.avgWait} s</b>
          <span>Erwartete Wartezeit</span>
        </div>
        <div>
          <b>
            {a.happy} / {a.unhappy}
          </b>
          <span>Glücklich / unzufrieden</span>
        </div>
        <div>
          <b>
            {a.fullBins} / {a.bins}
          </b>
          <span>Volle / alle Eimer</span>
        </div>
      </div>
      <label className="vehicle-alternating">
        <input type="checkbox" checked={moods} onChange={(e) => onMoods(e.target.checked)} />
        Stimmung über den Gästen anzeigen
      </label>
      <div className="analysis-actions">
        <button className="secondary" onClick={onBin}>
          Mülleimer bauen · 65 €
        </button>
        <button className="secondary" onClick={onStaff}>
          Reinigungsteam · {park.staff} Personen
        </button>
      </div>
      <h3>Hier liegt Potenzial</h3>
      {!a.issues.length && (
        <p className="analysis-good">
          Zurzeit keine ausgeprägten Problemstellen. Beobachte neue Warteschlangen und
          Imbissbereiche.
        </p>
      )}
      {a.issues.map((issue, i) => (
        <article className={`park-issue ${issue.kind}`} key={issue.id}>
          <button className="issue-location" onClick={() => onFocus(issue)}>
            <b>
              {i + 1}. {issue.title}
            </b>
            <span>Im Park zeigen ↗</span>
          </button>
          <p>{issue.detail}</p>
          {issue.kind === "fun" && issue.buildingId && (
            <button className="secondary" onClick={() => onRide(issue.buildingId!)}>
              Fahrassistent öffnen
            </button>
          )}
        </article>
      ))}
      <p className="small">
        Lange Wartezeiten, wenig Fahrspaß, unpassende Intensität und Schmutz senken die Laune.
        Unzufriedene Gäste verlassen den Park früher; eine niedrige Bewertung senkt die Nachfrage
        und damit die Einnahmen.
      </p>
    </div>
  );
}
