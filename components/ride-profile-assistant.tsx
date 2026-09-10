import { canAfford } from "../game/budget";
import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, WandSparkles, X } from "lucide-react";
import {
  RIDE_GOALS,
  RIDE_PROFILES,
  profileSource,
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
export type RideProfileAssistantProps = {
  park: Park;
  id: number;
  from: number;
  to: number;
  revision: number;
  clear: boolean;
  onPreview: (plan: RideProfilePlan | null) => void;
  /** Returning the commit error lets the assistant show it beside the action. Existing void callbacks remain valid. */
  onApply: (plan: RideProfilePlan) => string | null | void;
  /** Optional injection for isolated UI tests. Production uses the module worker. */
  workerFactory?: () => Worker;
};
const makeWorker = () =>
  new Worker(new URL("../game/ride-profile-worker.ts", import.meta.url), { type: "module" });
const money = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export default function RideProfileAssistant({
  park,
  id,
  from,
  to,
  revision,
  clear,
  onPreview,
  onApply,
  workerFactory = makeWorker,
}: RideProfileAssistantProps) {
  const [goal, setGoal] = useState<RideGoal>("fun");
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [requested, setRequested] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const job = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clock = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const feedback = useRef<HTMLDivElement>(null);
  const heading = useId();
  const latest = useRef({ park, onPreview, onApply });
  latest.current = { park, onPreview, onApply };
  const scope = JSON.stringify([id, from, to, revision, clear, goal]);
  const liveScope = useRef(scope);
  liveScope.current = scope;

  const stop = () => {
    const worker = job.current;
    job.current = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }
    clearTimeout(timeout.current);
    clearInterval(clock.current);
    timeout.current = undefined;
    clock.current = undefined;
  };
  const reset = (message = "") => {
    stop();
    setBusy(false);
    setElapsed(0);
    setResult(null);
    setNotice(message);
    latest.current.onPreview(null);
  };
  useEffect(() => {
    reset();
    return stop;
  }, [scope]);
  useEffect(
    () => () => {
      stop();
      latest.current.onPreview(null);
    },
    [],
  );
  useEffect(() => {
    if (!busy && !result && !notice) return;
    feedback.current?.focus({ preventScroll: true });
    const anchor =
      feedback.current?.querySelector<HTMLElement>(
        ".rp8-result-heading, .rp8-error, .rp8-searching, .rp8-notice",
      ) ?? feedback.current;
    anchor?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [busy, result, notice]);

  const search = (profile?: RideProfileId) => {
    reset();
    setManualOpen(false);
    setRequested(profile ? (RIDE_PROFILES.find((p) => p.id === profile)?.name ?? profile) : null);
    setBusy(true);
    const requestScope = liveScope.current,
      start = Date.now();
    try {
      const worker = workerFactory();
      job.current = worker;
      const finish = (response: ProfileResult) => {
        if (job.current !== worker || liveScope.current !== requestScope) return;
        stop();
        setBusy(false);
        let next = response;
        if (!response || (!response.plan && !response.error))
          next = {
            error: "Der Fahrassistent hat kein Ergebnis geliefert. Starte die Suche erneut.",
          };
        if (next.plan) {
          const b = latest.current.park.buildings.find((b) => b.id === id);
          if (
            !b ||
            latest.current.park.draft ||
            latest.current.park.trackEdit ||
            profileSource(b) !== next.plan.source
          )
            next = {
              error:
                "Die Bahn oder Baustelle hat sich während der Suche geändert. Berechne die Vorschau erneut.",
            };
        }
        setResult(next);
        latest.current.onPreview(next.plan ?? null);
      };
      worker.onmessage = (event) => finish(event.data as ProfileResult);
      worker.onerror = () =>
        finish({
          error:
            "Der Fahrassistent konnte nicht geladen werden. Speichere deinen Park und lade das Spiel neu.",
        });
      worker.onmessageerror = () =>
        finish({
          error: "Das berechnete Fahrprofil konnte nicht gelesen werden. Starte die Suche erneut.",
        });
      clock.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
      timeout.current = setTimeout(
        () =>
          finish({
            error:
              "Die Suche wurde nach 25 Sekunden beendet. Wähle einen kürzeren Abschnitt oder prüfe gezielt ein Fertigprofil. Es wurde nichts gebaut.",
          }),
        25000,
      );
      worker.postMessage([park, id, from, to, goal, profile, clear]);
    } catch {
      stop();
      setBusy(false);
      setResult({
        error:
          "Die Suche konnte nicht gestartet werden. Die Bahn bleibt unverändert. Speichere den Park und lade das Spiel neu.",
      });
    }
  };
  const plan = result?.plan,
    missing = plan && !canAfford(park, plan.cost) ? Math.max(0, plan.cost - park.cash) : 0;
  const apply = () => {
    if (!plan || missing) return;
    const b = latest.current.park.buildings.find((b) => b.id === plan.id);
    if (
      !b ||
      latest.current.park.draft ||
      latest.current.park.trackEdit ||
      profileSource(b) !== plan.source
    ) {
      reset();
      setResult({ error: "Die Bahn hat sich geändert. Berechne den Vorschlag erneut." });
      return;
    }
    try {
      const error = latest.current.onApply(plan);
      if (typeof error === "string" && error) {
        reset();
        setResult({ error });
      }
    } catch (error) {
      reset();
      setResult({
        error:
          error instanceof Error
            ? `Übernahme fehlgeschlagen: ${error.message}`
            : "Das Fahrprofil konnte nicht übernommen werden. Prüfe das Parkbudget und berechne die Vorschau erneut.",
      });
    }
  };
  return (
    <section className="ride-profile-assistant rp8" aria-labelledby={heading}>
      <div className="rp8-header">
        <WandSparkles size={19} />
        <div>
          <h3 id={heading}>Fahrt verbessern</h3>
          <p>
            Abschnitt {from + 1}
            {to !== from ? `–${to + 1}` : ""} · Änderungen zuerst als Vorschau
          </p>
        </div>
      </div>
      <label>
        Was soll besser werden?
        <select
          aria-label="Ziel des Fahrassistenten"
          value={goal}
          onChange={(event) => setGoal(event.target.value as RideGoal)}
        >
          {Object.entries(RIDE_GOALS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="primary rp8-search" disabled={busy} onClick={() => search()}>
        {busy ? <LoaderCircle size={17} className="rp8-spin" /> : <WandSparkles size={17} />}
        {busy ? "Fahrprofile werden geprüft …" : "Passende Verbesserung finden"}
      </button>

      {/* Feedback and the commit action deliberately precede the optional long profile list. */}
      <div
        ref={feedback}
        className="rp8-feedback"
        tabIndex={-1}
        aria-label="Rückmeldung des Fahrassistenten"
      >
        {busy && (
          <div className="rp8-searching" role="status" aria-live="polite">
            <strong>
              {requested ? `${requested} wird geprüft` : "Passende Verbesserung wird gesucht"}
            </strong>
            <p>Prüfe Streckenform, Anschluss und Kräfte der gesamten Fahrt.</p>
            <progress aria-label="Fahrprofil wird berechnet" />
            <div className="rp8-search-meta">
              <span>{elapsed} s · höchstens 25 s</span>
              <button
                className="secondary"
                onClick={() => reset("Suche abgebrochen. Deine Bahn bleibt unverändert.")}
              >
                <X size={14} />
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {notice && (
          <p className="rp8-notice" role="status">
            {notice}
          </p>
        )}
        {result?.error && (
          <div className="rp8-error" role="alert">
            <strong>Keine Änderung übernommen</strong>
            <p>{result.error}</p>
            <span>
              Versuche ein anderes Ziel, einen anderen Abschnitt oder ein einzelnes Profil unten.
            </span>
          </div>
        )}
        {plan && (
          <article className="profile-result rp8-result">
            <div className="rp8-result-heading">
              <Check size={18} />
              <div>
                <strong>Vorschau bereit: {plan.title}</strong>
                <span>Noch nicht gebaut · Gesamtkosten {money(plan.cost)}</span>
              </div>
            </div>
            <div className="rp8-applybar">
              <button className="primary" disabled={missing > 0} onClick={apply}>
                Vorschau übernehmen · {money(plan.cost)}
              </button>
              {missing > 0 && (
                <p className="rp8-budget" role="status">
                  Es fehlen {money(missing)}. Die Vorschau bleibt erhalten.
                </p>
              )}
              <button
                className="rp8-discard"
                onClick={() => reset("Vorschau verworfen. Deine Bahn bleibt unverändert.")}
              >
                Vorschau verwerfen
              </button>
            </div>
            <p>
              {plan.fit
                ? `Ersetzt Abschnitt ${plan.fit.from + 1}–${plan.fit.to + 1}; beide Enden sind verbunden.`
                : "Beschleuniger oder Bremsen werden nur auf der Auswahl geändert."}{" "}
              Rot: bisher · Türkis: Vorschau.
            </p>
            <ForceStats before={plan.before} after={plan.after} />
            <p className="small">
              Verglichen wird die gesamte Fahrt. Mehr G-Kraft bedeutet nicht automatisch mehr
              Fahrspaß.
            </p>
          </article>
        )}
      </div>
      <details
        className="rp8-presets"
        open={manualOpen}
        onToggle={(event) => setManualOpen(event.currentTarget.open)}
      >
        <summary>
          Fertigprofil selbst wählen <span>{RIDE_PROFILES.length} Profile</span>
        </summary>
        <p className="small">
          Ein Klick prüft das Profil und zeigt die Vorschau oben. Erst „Übernehmen“ baut die
          Änderung.
        </p>
        <div className="ride-profile-list">
          {RIDE_PROFILES.map((profile) => {
            const woodLoop =
              profile.id === "doubleloop" &&
              park.buildings.find((b) => b.id === id)?.track?.[0]?.style === "wood";
            return (
              <button
                className="secondary"
                key={profile.id}
                disabled={busy || woodLoop}
                title={
                  woodLoop
                    ? "Loopings sind für Holzachterbahnen nicht verfügbar."
                    : `Vorschau prüfen: ${profile.name}`
                }
                onClick={() => search(profile.id)}
              >
                <strong>{profile.name}</strong>
                <span>{woodLoop ? "Für Stahl- und Launchbahnen" : profile.detail}</span>
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}
