import { useEffect, useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import {
  RIDE_GOALS,
  RIDE_PROFILES,
  type RideGoal,
  type RideProfileId,
  type ProfileResult,
  type RideProfilePlan,
} from "../game/ride-profiles";
import type { Park } from "../game/simulation";
import type { ForceAnalysis } from "../game/gforce";
export function ForceStats({ before, after }: { before: ForceAnalysis; after: ForceAnalysis }) {
  return (
    <table className="force-comparison">
      <thead>
        <tr>
          <th>Gesamte Fahrt</th>
          <th>Vorher</th>
          <th>Vorschau</th>
        </tr>
      </thead>
      <tbody>
        {[
          ["Fahrspaß / 100", before.fun.toFixed(1), after.fun.toFixed(1)],
          [
            "G nach oben",
            `${before.peaks.vertical.toFixed(1)} g`,
            `${after.peaks.vertical.toFixed(1)} g`,
          ],
          ["G seitlich", `${before.maxLateral.toFixed(1)} g`, `${after.maxLateral.toFixed(1)} g`],
          ["Airtime", `${before.airtime.toFixed(1)} s`, `${after.airtime.toFixed(1)} s`],
          ["Komfort / 100", before.comfort.toFixed(1), after.comfort.toFixed(1)],
        ].map(([label, a, b]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>{a}</td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export default function RideProfileAssistant({
  park,
  id,
  from,
  to,
  revision,
  clear,
  onPreview,
  onApply,
}: {
  park: Park;
  id: number;
  from: number;
  to: number;
  revision: number;
  clear: boolean;
  onPreview: (p: RideProfilePlan | null) => void;
  onApply: (p: RideProfilePlan) => void;
}) {
  const [goal, setGoal] = useState<RideGoal>("fun"),
    [result, setResult] = useState<ProfileResult | null>(null),
    [busy, setBusy] = useState(false);
  const job = useRef<Worker | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = () => {
    job.current?.terminate();
    job.current = null;
    clearTimeout(timer.current);
  };
  const reset = () => {
    stop();
    setBusy(false);
    setResult(null);
    onPreview(null);
  };
  useEffect(() => {
    reset();
    return stop;
  }, [id, from, to, revision, clear, goal]);
  useEffect(() => () => onPreview(null), []);
  const search = (profile?: RideProfileId) => {
    reset();
    setBusy(true);
    try {
      const worker = new Worker(new URL("../game/ride-profile-worker.ts", import.meta.url), {
        type: "module",
      });
      job.current = worker;
      const finish = (r: ProfileResult) => {
        if (job.current !== worker) return;
        stop();
        setBusy(false);
        setResult(r);
        onPreview(r.plan ?? null);
      };
      worker.onmessage = (e) => finish(e.data);
      worker.onerror = () =>
        finish({ error: "Fahrassistent konnte nicht geladen werden. Lade das Spiel neu." });
      timer.current = setTimeout(
        () =>
          finish({
            error:
              "Die Suche ist zu aufwendig. Wähle einen kleineren Abschnitt oder ein einzelnes Fertigprofil.",
          }),
        25000,
      );
      worker.postMessage([park, id, from, to, goal, profile, clear]);
    } catch {
      stop();
      setBusy(false);
      setResult({ error: "Suche konnte nicht gestartet werden. Die Bahn bleibt erhalten." });
    }
  };
  const plan = result?.plan,
    money = (v: number) =>
      new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);
  return (
    <section className="ride-profile-assistant">
      <label>
        Was soll besser werden?
        <select
          aria-label="Ziel des Fahrassistenten"
          value={goal}
          onChange={(e) => setGoal(e.target.value as RideGoal)}
        >
          {Object.entries(RIDE_GOALS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="primary" disabled={busy} onClick={() => search()}>
        <WandSparkles size={17} />
        {busy ? "Fahrprofile vergleichen …" : "Passende Verbesserung finden"}
      </button>
      {busy && (
        <>
          <p role="status">Prüfe Streckenform, Tempo und G-Kräfte. Deine Bahn fährt weiter.</p>
          <button className="secondary" onClick={reset}>
            Suche abbrechen
          </button>
        </>
      )}
      {!plan && (
        <details>
          <summary>Fertigprofil selbst wählen</summary>
          <div className="ride-profile-list">
            {RIDE_PROFILES.map((p) => (
              <button
                className="secondary"
                key={p.id}
                disabled={
                  busy ||
                  (p.id === "doubleloop" &&
                    park.buildings.find((b) => b.id === id)?.track?.[0]?.style === "wood")
                }
                onClick={() => search(p.id)}
              >
                <strong>{p.name}</strong>
                <span>{p.detail}</span>
              </button>
            ))}
          </div>
        </details>
      )}
      {result?.error && (
        <p className="fit-error" role="status">
          {result.error}
        </p>
      )}
      {plan && (
        <div className="profile-result" role="status">
          <strong>
            {plan.title} · {money(plan.cost)}
          </strong>
          <ForceStats before={plan.before} after={plan.after} />
          <p>
            {plan.fit
              ? `Ersetzt Abschnitt ${plan.fit.from + 1}–${plan.fit.to + 1}; beide Enden verbunden.`
              : "Module werden nur auf der Auswahl geändert."}{" "}
            Rot: bisher · Türkis: Vorschau.
          </p>
          <p className="small">
            G-Kräfte und Fahrspaß beruhen auf dem Spielmodell. Mehr Belastung bedeutet nicht
            automatisch mehr Spaß.
          </p>
          {plan.cost > park.cash && <p>Es fehlen {money(plan.cost - park.cash)}.</p>}
          <button
            className="primary"
            disabled={plan.cost > park.cash}
            onClick={() => onApply(plan)}
          >
            Fahrprofil übernehmen · {money(plan.cost)}
          </button>
          <button className="secondary" onClick={reset}>
            Vorschau verwerfen
          </button>
        </div>
      )}
    </section>
  );
}
