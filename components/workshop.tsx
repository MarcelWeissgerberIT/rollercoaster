import { useState } from "react";
import {
  designStats,
  MECHANISMS,
  THEMES,
  validDesign,
  parseDesignLibrary,
  DESIGN_LIBRARY_KEY,
  type AttractionDesign,
} from "../game/designs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { assetUrl } from "../game/assets";
const initial = (): AttractionDesign => ({
  id: crypto.randomUUID(),
  name: "Meine Mondreise",
  mechanism: "teacups",
  theme: "moon",
  color: "#8465ad",
  speed: 1,
  height: 1,
  seats: 12,
  seed: crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000,
});
type Props = {
  initialDesign?: AttractionDesign;
  onClose: () => void;
  onBuild: (d: AttractionDesign) => void;
  onPreview: (d: AttractionDesign) => void;
};
export default function Workshop({ initialDesign, onClose, onBuild, onPreview }: Props) {
  const [library, setLibrary] = useState<AttractionDesign[]>(() => {
      try {
        return parseDesignLibrary(localStorage.getItem(DESIGN_LIBRARY_KEY));
      } catch {
        return [];
      }
    }),
    [design, setDesign] = useState(() => initialDesign ?? initial()),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (d: Partial<AttractionDesign>) => setDesign({ ...design, ...d }),
    stats = designStats(design);
  const save = () => {
    if (!validDesign(design)) {
      setMessage("Bitte einen Namen und gültige Fahrwerte eintragen.");
      return false;
    }
    const copy = structuredClone(design),
      next = [copy, ...library.filter((d) => d.id !== copy.id)].slice(0, 20);
    try {
      localStorage.setItem(DESIGN_LIBRARY_KEY, JSON.stringify(next));
      setLibrary(next);
      setMessage("Entwurf in deiner parkübergreifenden Sammlung gespeichert.");
      return true;
    } catch {
      setMessage("Browserspeicher voll. Exportiere den Entwurf als Datei.");
      return false;
    }
  };
  const exportDesign = () => {
    if (!validDesign(design)) return;
    const url = URL.createObjectURL(
        new Blob(
          [JSON.stringify({ format: "coaster-grove-attraction", version: 1, design }, null, 2)],
          { type: "application/json" },
        ),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = design.name.replace(/[^\p{L}\p{N}-]/gu, "-") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importDesign = async (file?: File) => {
    if (!file) return;
    if (file.size > 220000) {
      setMessage("Entwurf zu groß. Höchstens 220 KB.");
      return;
    }
    try {
      const value = JSON.parse(await file.text());
      if (
        value.format !== "coaster-grove-attraction" ||
        value.version !== 1 ||
        !validDesign(value.design)
      )
        throw Error();
      setDesign({ ...value.design, id: crypto.randomUUID() });
      setMessage("Importiert. Du kannst den Entwurf jetzt ändern und speichern.");
    } catch {
      setMessage("Diese Datei enthält keinen gültigen Attraktionsentwurf.");
    }
  };
  const importImage = async (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/webp"].includes(file.type) || file.size > 4e6) {
      setMessage("Bitte PNG oder WebP bis 4 MB verwenden.");
      return;
    }
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 192;
      const ctx = c.getContext("2d")!,
        scale = 192 / Math.max(img.width, img.height);
      ctx.drawImage(
        img,
        (192 - img.width * scale) / 2,
        (192 - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
      const art = c.toDataURL("image/webp", 0.85);
      if (art.length > 180000) throw Error();
      patch({ art });
      setMessage("Eigenes Motiv übernommen. Es erscheint an deiner Attraktion in 2D und 3D.");
    } catch {
      setMessage("Dieses Bild konnte nicht verarbeitet werden.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="workshop-modal">
        <DialogTitle>Deine Attraktionswerkstatt</DialogTitle>
        <DialogDescription>
          Erfinde ein eigenes Fahrgeschäft. Deine Sammlung bleibt auch in neuen Parks erhalten.
        </DialogDescription>
        <div className="workshop-grid">
          <div className="workshop-form">
            <label>
              Name
              <input
                maxLength={60}
                value={design.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label>
              Fahrmechanik
              <select
                value={design.mechanism}
                onChange={(e) =>
                  patch({ mechanism: e.target.value as AttractionDesign["mechanism"] })
                }
              >
                {Object.entries(MECHANISMS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thema
              <select
                value={design.theme}
                onChange={(e) => patch({ theme: e.target.value as AttractionDesign["theme"] })}
              >
                {Object.entries(THEMES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Farbe
              <input
                type="color"
                value={design.color}
                onChange={(e) => patch({ color: e.target.value })}
              />
            </label>
            <label>
              Fahrtempo · {design.speed.toFixed(1)}×
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.1}
                value={design.speed}
                onChange={(e) => patch({ speed: +e.target.value })}
              />
            </label>
            <label>
              Größe / Hubhöhe · {design.height}
              <input
                type="range"
                min={1}
                max={3}
                step={0.5}
                value={design.height}
                onChange={(e) => patch({ height: +e.target.value })}
              />
            </label>
            <label>
              Sitzplätze · {design.seats}
              <input
                type="range"
                min={4}
                max={16}
                step={1}
                value={design.seats}
                onChange={(e) => patch({ seats: +e.target.value })}
              />
            </label>
          </div>
          <div className="workshop-preview" style={{ borderColor: design.color }}>
            <img alt="Attraktionsthema" src={design.art ?? assetUrl("theme-" + design.theme)} />
            <h3>{design.name || "Deine neue Attraktion"}</h3>
            <p>
              {MECHANISMS[design.mechanism]} · {design.seats} Plätze
            </p>
            <p>
              <strong>{stats.cost.toLocaleString("de-DE")} €</strong> · {stats.duration} s pro Runde
            </p>
            <p>
              Fahrspaß {stats.appeal.toFixed(1)} · Intensität {stats.intensity.toFixed(1)}
            </p>
            <button
              className="secondary"
              disabled={!validDesign(design)}
              onClick={() => {
                save();
                onPreview(design);
              }}
            >
              3D-Prototyp mitfahren
            </button>
            <label className="secondary file-button">
              Eigenes Motiv (PNG/WebP)
              <input
                type="file"
                accept="image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void importImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {design.art && (
              <button className="text-action" onClick={() => patch({ art: undefined })}>
                Themenmotiv verwenden
              </button>
            )}
            <p className="small">
              Das Motiv gestaltet deine Attraktion. Sitzbewegung und 3D-Geometrie entstehen aus der
              gewählten Fahrmechanik.
            </p>
          </div>
        </div>
        <div className="workshop-actions">
          <button className="secondary" onClick={save}>
            Entwurf speichern
          </button>
          <button className="secondary" disabled={!validDesign(design)} onClick={exportDesign}>
            Als Datei teilen
          </button>
          <label className="secondary file-button">
            Entwurf importieren
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void importDesign(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !validDesign(design)}
            onClick={() => {
              if (save()) onBuild(structuredClone(design));
            }}
          >
            Im Park platzieren · {stats.cost.toLocaleString("de-DE")} €
          </button>
        </div>
        {message && (
          <p role="status" className="small">
            {message}
          </p>
        )}
        <div className="design-library">
          <strong>Deine Sammlung · {library.length}/20</strong>
          <button className="text-action" onClick={() => setDesign(initial())}>
            Neuer Entwurf
          </button>
          {library.map((d) => (
            <div key={d.id}>
              <button className="secondary" onClick={() => setDesign(structuredClone(d))}>
                {d.name}
              </button>
              <button
                className="text-action"
                aria-label={`${d.name} duplizieren`}
                onClick={() =>
                  setDesign({
                    ...structuredClone(d),
                    id: crypto.randomUUID(),
                    name: d.name.slice(0, 52) + " Kopie",
                  })
                }
              >
                Kopie
              </button>
              <button
                className="text-action"
                aria-label={`${d.name} aus Sammlung löschen`}
                onClick={() => {
                  const next = library.filter((x) => x.id !== d.id);
                  try {
                    localStorage.setItem(DESIGN_LIBRARY_KEY, JSON.stringify(next));
                    setLibrary(next);
                  } catch {
                    setMessage("Sammlung konnte nicht gespeichert werden.");
                  }
                }}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
