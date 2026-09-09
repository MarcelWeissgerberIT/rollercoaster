import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { WandSparkles } from "lucide-react";
import { PIECES, type Piece } from "../game/prefabs";
import type { Park, Point } from "../game/simulation";
import type { FitResult, TrackFit } from "../game/track-fit";
export type FitAssistantHandle = { search: () => void };
type Props = {
  park: Park;
  draft: Point[];
  piece: Piece;
  clear: boolean;
  revision: number;
  ref?: Ref<FitAssistantHandle>;
  onPreview: (fit: TrackFit | null) => void;
  onApply: (fit: TrackFit) => void;
};
const money = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
export default function TrackFitAssistant(props: Props) {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<FitResult | null>(null);
  const worker = useRef<Worker | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    host = useRef<HTMLDivElement>(null);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timeout.current);
  };
  const reset = () => {
    stop();
    setBusy(false);
    setResult(null);
    props.onPreview(null);
  };
  useEffect(() => {
    reset();
    return stop;
  }, [props.draft, props.piece, props.clear, props.revision, props.park.trackEdit?.buildingId]);
  useEffect(
    () => () => {
      props.onPreview(null);
    },
    [],
  );
  const search = () => {
    reset();
    setBusy(true);
    host.current?.scrollIntoView({ block: "nearest" });
    try {
      const job = new Worker(new URL("../game/track-fit-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = job;
      const finish = (value: FitResult) => {
        if (worker.current !== job) return;
        stop();
        setBusy(false);
        setResult(value);
        props.onPreview(value.solution ?? null);
      };
      job.onmessage = (e: MessageEvent<FitResult>) => finish(e.data);
      job.onerror = () =>
        finish({
          checked: 0,
          error:
            "Die Einpasshilfe konnte nicht geladen werden. Lade das Spiel neu und versuche es noch einmal.",
        });
      timeout.current = setTimeout(
        () =>
          finish({
            checked: 0,
            error: "Die Suche ist zu aufwendig. Wähle einen kleineren oder anderen Gleisbereich.",
          }),
        15000,
      );
      job.postMessage({
        park: props.park,
        draft: props.draft,
        piece: props.piece,
        clear: props.clear,
      });
    } catch {
      stop();
      setBusy(false);
      setResult({
        checked: 0,
        error: "Die Einpasshilfe konnte nicht gestartet werden. Dein Entwurf bleibt erhalten.",
      });
    }
  };
  useEffect(() => {
    if (result) host.current?.scrollIntoView({ block: "nearest" });
  }, [result]);
  useImperativeHandle(props.ref, () => ({ search }));
  const fit = result?.solution;
  return (
    <div className="track-fit-assistant" ref={host}>
      <button className="primary" disabled={busy} onClick={search}>
        <WandSparkles size={17} />
        {busy ? "Passenden Umbau suchen …" : `${PIECES[props.piece].name} automatisch einpassen`}
      </button>
      {busy && (
        <>
          <p role="status">
            Prüfe Einbaustellen, größere Lücken und Verbindungen. Dein Entwurf bleibt während der
            Suche erhalten.
          </p>
          <button className="text-action" onClick={reset}>
            Suche abbrechen
          </button>
        </>
      )}
      {result?.error && (
        <p role="status" className="fit-error">
          {result.error}
        </p>
      )}
      {fit && (
        <div className="fit-result" role="status">
          <strong>Passender Umbau gefunden · {money(fit.cost)}</strong>
          <p>
            Abschnitt {fit.from + 1}–{fit.to + 1}:{" "}
            {fit.extraBefore + fit.extraAfter
              ? `${fit.extraBefore} davor und ${fit.extraAfter} danach zusätzlich ersetzen.`
              : "Die gewählte Lücke reicht aus."}
          </p>
          <p>
            {fit.approach.length
              ? `${fit.approach.map((p) => PIECES[p].name).join(" + ")} vor dem ${PIECES[fit.piece].name}. `
              : ""}
            Beide Enden sind verbunden.{" "}
            {fit.clearIds.length
              ? `${fit.clearIds.length} Deko-Objekte freiräumen; im Preis enthalten.`
              : ""}
          </p>
          <p className="fit-legend">
            <span>Rot: ersetzen</span>
            <span>Türkis: neuer Verlauf</span>
          </p>
          {fit.cost > props.park.cash && (
            <p>Es fehlen noch {money(fit.cost - props.park.cash)}. Die Vorschau ist kostenlos.</p>
          )}
          <button
            className="primary"
            disabled={fit.cost > props.park.cash}
            onClick={() => props.onApply(fit)}
          >
            Lösung übernehmen · {money(fit.cost)}
          </button>
          <button className="secondary" onClick={reset}>
            Vorschau verwerfen
          </button>
        </div>
      )}
      {!busy && !result && (
        <p>
          Das Spiel sucht eine vollständig verbundene Lösung. Du prüfst den Verlauf und den Preis
          vor dem Umbau.
        </p>
      )}
    </div>
  );
}
