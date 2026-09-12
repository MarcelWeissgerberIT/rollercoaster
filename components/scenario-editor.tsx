import { useRef, useState } from "react";
import { Flag, Download, Upload, Play, Map } from "lucide-react";
import type { Park } from "../game/simulation";
import {
  createScenarioFile,
  exportScenarioFile,
  parseScenarioFile,
  scenarioTemplate,
  startCustomScenario,
  blankScenarioPark,
  type ScenarioFile,
} from "../game/scenario-editor";
import type { CustomScenario } from "../game/custom-scenario";
import "./creative-tools.css";
type Props = { park: Park; onStart: (s: Park) => void; onEditMap: (s: Park) => void };
export default function ScenarioEditor({ park, onStart, onEditMap }: Props) {
  const [settings, setSettings] = useState(() => scenarioTemplate(park)),
    [source, setSource] = useState<Park>(park),
    [status, setStatus] = useState(""),
    [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const set = (key: keyof CustomScenario, value: string | number) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setStatus("");
    setConfirm(false);
  };
  const prepare = (): ScenarioFile => createScenarioFile(source, settings);
  function exportFile() {
    try {
      const file = prepare(),
        blob = new Blob([exportScenarioFile(file)], { type: "application/json" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${settings.name.replace(/[^a-z0-9äöüß-]/gi, "-")}.coaster-scenario.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Szenario exportiert. Deine Karte und Ziele sind in der Datei enthalten.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  const fields: [keyof CustomScenario, string, number, number][] = [
    ["cash", "Startbudget (€)", 1000000, 1000],
    ["deadlineYears", "Frist (Jahre; 0 = unbegrenzt)", 20, 1],
    ["arrivals", "Besucher begrüßen", 100000, 50],
    ["rides", "Geöffnete Fahrgeschäfte", 100, 1],
    ["rating", "Zufriedenheit (%)", 100, 5],
    ["profit", "Betriebsgewinn / 90 s (€)", 100000, 50],
    ["value", "Parkwert (€)", 10000000, 1000],
    ["coasters", "Achterbahnen", 50, 1],
    ["cleanliness", "Sauberkeit (%)", 100, 5],
    ["condition", "Zustand der Attraktionen (%)", 100, 5],
    ["species", "Gesunde Tierarten", 7, 1],
    ["welfare", "Tierwohl (%)", 100, 5],
  ];
  return (
    <section className="creative-tools" aria-label="Szenarioeditor">
      <header>
        <Flag size={24} />
        <div>
          <h3>Deine Herausforderung</h3>
          <p>Baue die Startkarte, setze Ziele und teile dein Szenario.</p>
        </div>
      </header>
      <label>
        Name
        <input maxLength={60} value={settings.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label>
        Aufgabe
        <input
          maxLength={100}
          value={settings.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
        />
      </label>
      <label>
        Geschichte
        <textarea
          maxLength={1000}
          value={settings.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <div className="creative-help">
        <strong>
          Startkarte: {source.tiles[0].length} × {source.tiles.length} Felder
        </strong>
        <br />
        {source.buildings.length} Einrichtungen · {source.scenery?.length ?? 0} Themenbauteile.
        Gelände, Wege und freigeschaltete Forschung werden übernommen.
      </div>
      <div className="creative-inline">
        <button
          onClick={() => {
            setSource(park);
            setStatus("Aktueller Park als Startkarte übernommen.");
            setConfirm(false);
          }}
        >
          <Map size={17} />
          Aktuellen Park nehmen
        </button>
        <button onClick={() => onEditMap(blankScenarioPark())}>Leere Karte gestalten</button>
      </div>
      <p className="creative-help">
        Gestalte die Karte im freien Spiel und öffne diesen Editor danach erneut. Laufende Besuche
        und Statistiken beginnen beim Szenariostart bei null.
      </p>
      <div className="creative-fields">
        {fields.map(([key, label, max, step]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={0}
              max={max}
              step={step}
              value={settings[key] as number}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <p className="creative-help">
        Zielwert 0 deaktiviert das jeweilige Ziel. Alle aktiven Ziele müssen vor Ablauf der Frist
        gleichzeitig erfüllt sein. Ein Jahr dauert bei normalem Tempo 20 Minuten.
      </p>
      <div className="creative-inline">
        <button onClick={exportFile}>
          <Download size={17} />
          Exportieren
        </button>
        <button onClick={() => input.current?.click()}>
          <Upload size={17} />
          Importieren
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const next = parseScenarioFile(await f.text());
            setSettings(next.settings);
            setSource(next.park);
            setStatus(`„${next.settings.name}“ geladen – bereit zum Spielen oder Bearbeiten.`);
            setConfirm(false);
          } catch (error) {
            setStatus((error as Error).message);
          }
          e.target.value = "";
        }}
      />
      {status && (
        <p role="status" className="creative-help">
          {status}
        </p>
      )}
      {confirm && (
        <p className="creative-confirm">
          Das startet einen neuen Park. Sichere deinen aktuellen Park vorher in einem
          Spielstand-Slot.
        </p>
      )}
      <button
        className="creative-primary"
        onClick={() => {
          try {
            const next = prepare();
            if (!confirm) {
              setConfirm(true);
              return;
            }
            onStart(startCustomScenario(next));
          } catch (e) {
            setStatus((e as Error).message);
          }
        }}
      >
        <Play size={17} />
        {confirm ? "Szenario jetzt starten" : "Eigenes Szenario spielen"}
      </button>
    </section>
  );
}
