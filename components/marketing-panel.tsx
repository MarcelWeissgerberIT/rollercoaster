import { useState } from "react";
import {
  MARKETING_TYPES,
  MARKETING_DAY,
  quoteMarketing,
  campaignStatus,
  marketingReport,
  marketingTotals,
  type MarketingKind,
} from "../game/marketing";
import { access, isAttraction, type Park } from "../game/simulation";
const euro = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
export default function MarketingPanel({
  park,
  onStart,
  onCancel,
  initialTarget,
}: {
  park: Park;
  initialTarget?: number;
  onStart: (kind: MarketingKind, days: number, target?: number) => void;
  onCancel: (id: number) => void;
}) {
  const [kind, setKind] = useState<MarketingKind>(initialTarget ? "ride" : "flyers"),
    [days, setDays] = useState(1),
    [target, setTarget] = useState<number | undefined>(initialTarget);
  const rides = park.buildings.filter(
    (b) =>
      isAttraction(b.kind) &&
      (!b.habitat || b.habitat.count > 0) &&
      b.open &&
      b.tested &&
      access(park, b),
  );
  const selected = target ?? rides[0]?.id,
    quote = quoteMarketing(
      park,
      kind,
      days,
      kind === "ride" ? selected : undefined,
      (s, b) => !!access(s, b),
    ),
    totals = marketingTotals(park),
    recent = [...(park.marketing?.campaigns ?? [])].reverse(),
    reports = [
      ...recent.filter((c) => campaignStatus(park, c) === "active"),
      ...recent.filter((c) => campaignStatus(park, c) !== "active").slice(0, 12),
    ];
  return (
    <div className="marketing-panel">
      <p>
        Mach deinen Park bekannter oder lenke Interesse auf eine Attraktion. Gute Laune, saubere
        Wege und faire Wartezeiten helfen, die neuen Gäste zu halten.
      </p>
      <div className="campaign-types" role="group" aria-label="Werbeform">
        {Object.entries(MARKETING_TYPES).map(([id, c]) => (
          <button
            key={id}
            className={kind === id ? "active" : ""}
            aria-pressed={kind === id}
            onClick={() => setKind(id as MarketingKind)}
          >
            <strong>{c.name}</strong>
            <span>
              {euro(c.dailyCost)} / {MARKETING_DAY} s
            </span>
          </button>
        ))}
      </div>
      <div className="campaign-fields">
        <label>
          Laufzeit
          <select
            aria-label="Kampagnenlaufzeit"
            value={days}
            onChange={(e) => setDays(+e.target.value)}
          >
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "Abrechnungsperiode" : "Abrechnungsperioden"} · {d * MARKETING_DAY} s
              </option>
            ))}
          </select>
        </label>
        {kind === "ride" && (
          <label>
            Beworbene Attraktion
            <select
              aria-label="Beworbene Attraktion"
              value={selected ?? ""}
              onChange={(e) => setTarget(+e.target.value)}
            >
              {!rides.length && <option value="">Keine erreichbare offene Attraktion</option>}
              {rides.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <button
        className="primary"
        disabled={!!quote.error}
        onClick={() => onStart(kind, days, kind === "ride" ? selected : undefined)}
      >
        Kampagne starten · {euro(quote.cost)}
      </button>
      {quote.error && (
        <p className="small" role="status">
          {quote.error}
        </p>
      )}
      <p className="small">
        Kosten werden einmal beim Start bezahlt. Maximal zwei Kampagnen gleichzeitig. Laufzeit folgt
        dem Spieltempo; während Pause bleibt sie stehen.
      </p>
      <div className="analysis-stats">
        <div>
          <b>{euro(totals.cost)}</b>
          <span>Werbekosten gesamt</span>
        </div>
        <div>
          <b>{totals.visitors}</b>
          <span>Zugeordnete Besucher</span>
        </div>
        <div>
          <b>{euro(totals.revenue.ticket + totals.revenue.ride + totals.revenue.shop)}</b>
          <span>Umsatz dieser Gäste</span>
        </div>
        <div>
          <b>{totals.visitors ? euro(totals.cost / totals.visitors) : "–"}</b>
          <span>Kosten pro Besucher</span>
        </div>
      </div>
      <h3>Kampagnen</h3>
      {!park.marketing?.campaigns.length && <p>Noch keine Kampagne gestartet.</p>}
      {reports.map((c) => {
        const report = marketingReport(c),
          status = campaignStatus(park, c),
          working = park.open && (c.kind !== "ride" || rides.some((b) => b.id === c.targetId));
        return (
          <article className="campaign-card" key={c.id}>
            <div>
              <strong>
                {MARKETING_TYPES[c.kind].name}
                {c.targetName ? ` · ${c.targetName}` : ""}
              </strong>
              <b>
                {status === "active"
                  ? `${Math.ceil(c.endsAt - park.time)} s verbleibend`
                  : status === "cancelled"
                    ? "Beendet"
                    : "Abgeschlossen"}
              </b>
            </div>
            <p>
              {report.visitors} Besucher zugeordnet · {euro(report.attributedRevenue)} ausgegeben ·{" "}
              {euro(report.cost)} Werbekosten
            </p>
            <small>
              Eintritt {euro(report.ticket)} · Fahrten {euro(report.ride)} · Geschäfte{" "}
              {euro(report.shop)}
            </small>
            {status === "active" && (
              <>
                {!working && (
                  <p className="fit-error">
                    Kein Werbeeffekt: Park oder beworbene Attraktion geschlossen / nicht erreichbar.
                    Die Laufzeit läuft weiter.
                  </p>
                )}
                <button className="secondary" onClick={() => onCancel(c.id)}>
                  Vorzeitig beenden · keine Erstattung
                </button>
              </>
            )}
          </article>
        );
      })}
      <p className="small">
        Die Zuordnung erfolgt im Spielmodell. Der ausgewiesene Umsatz stammt aus echten Zahlungen
        dieser Gäste; er ist kein zusätzlicher Gewinn. Werbekosten und Betriebskosten gehen in die
        Parkfinanzen ein.
      </p>
    </div>
  );
}
