import { useEffect, useState } from "react";
import { Save, FolderOpen, Pencil, Trash2, Plus, Clock, Trees, Info } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import type { Park } from "../game/simulation";
import { scenarioOf } from "../game/simulation";
import { calendarOf } from "../game/calendar";
import {
  readSaveSlots,
  writeSaveSlot,
  loadSaveSlot,
  renameSaveSlot,
  deleteSaveSlot,
  type SaveSlot,
} from "../game/save-slots";
import "./save-slots.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getPark: () => Park | null;
  onLoad: (park: Park) => boolean;
  onSaved: (name: string) => void;
};
export function SaveSlots({ open, onOpenChange, getPark, onLoad, onSaved }: Props) {
  const [slots, setSlots] = useState<SaveSlot[]>([]),
    [selected, setSelected] = useState(1),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<"overwrite" | "delete" | null>(null);
  const refresh = () => {
    try {
      const next = readSaveSlots(localStorage);
      setSlots(next);
      return next;
    } catch {
      setSlots([]);
      setMessage(
        "Der Browserspeicher ist nicht verfügbar. Bitte erlaube das Speichern für diese Seite.",
      );
      return [];
    }
  };
  useEffect(() => {
    if (!open) return;
    setMessage("");
    const all = refresh(),
      first = all.find((s) => s.status === "empty") ?? all[0];
    setSelected(first?.slot ?? 1);
    setName(getPark() ? scenarioOf(getPark()!).name : "");
    setConfirm(null);
  }, [open]);
  const item = slots.find((s) => s.slot === selected),
    date = item?.park ? calendarOf(item.park) : null;
  const choose = (slot: SaveSlot) => {
    setSelected(slot.slot);
    setName(slot.status === "saved" ? slot.name : getPark() ? scenarioOf(getPark()!).name : "");
    setMessage("");
    setConfirm(null);
  };
  const save = (replace = false) => {
    const park = getPark();
    if (!park) return;
    if (item?.status !== "empty" && !replace) {
      setConfirm("overwrite");
      return;
    }
    try {
      const error = writeSaveSlot(localStorage, selected, name, park, replace);
      if (error) {
        setMessage(error);
        return;
      }
      refresh();
      setConfirm(null);
      setMessage(`„${name.trim()}“ wurde auf Platz ${selected} gespeichert.`);
      onSaved(name.trim());
    } catch {
      setMessage("Der Browserspeicher ist nicht verfügbar.");
    }
  };
  const remove = () => {
    try {
      const error = deleteSaveSlot(localStorage, selected);
      if (error) {
        setMessage(error);
        return;
      }
      refresh();
      setConfirm(null);
      setMessage(`Platz ${selected} ist wieder frei.`);
    } catch {
      setMessage("Löschen fehlgeschlagen.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="save-library"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (!confirm) save();
          }
        }}
      >
        <DialogTitle>Deine Spielstände</DialogTitle>
        <DialogDescription>
          Zehn Plätze für deine Parkideen. Automatisches Speichern läuft zusätzlich und belegt
          keinen dieser Plätze.
        </DialogDescription>
        <div className="save-library-layout">
          <div className="save-slot-grid" aria-label="Zehn Speicherplätze">
            {slots.map((slot) => (
              <button
                key={slot.slot}
                className={`save-slot ${selected === slot.slot ? "selected" : ""} ${slot.status}`}
                aria-pressed={selected === slot.slot}
                onClick={() => choose(slot)}
              >
                <span className="slot-number">{String(slot.slot).padStart(2, "0")}</span>
                {slot.status === "empty" ? <Plus size={20} /> : <Trees size={20} />}
                <strong>{slot.name}</strong>
                <small>
                  {slot.park
                    ? `Jahr ${calendarOf(slot.park).year} · ${slot.park.guests.length} Gäste`
                    : slot.status === "empty"
                      ? "Hier ist Platz für einen Park"
                      : "Wähle einen anderen Stand oder überschreibe diesen Platz"}
                </small>
              </button>
            ))}
          </div>
          <section className="save-slot-details" aria-label={`Speicherplatz ${selected}`}>
            <span className="save-eyebrow">SPEICHERPLATZ {String(selected).padStart(2, "0")}</span>
            <h3>{item?.status === "saved" ? item.name : "Deine nächste Parkidee"}</h3>
            {item?.park && (
              <div className="slot-facts">
                <span>
                  <Trees size={16} />
                  {scenarioOf(item.park).name}
                </span>
                <span>
                  <Clock size={16} />
                  {date?.weekday} · Tag {date?.day} · Jahr {date?.year}
                </span>
                <small>
                  {new Date(item.savedAt!).toLocaleString("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </small>
              </div>
            )}
            <label className="slot-name">
              Name des Spielstandes
              <input
                value={name}
                maxLength={60}
                placeholder="Zum Beispiel: Mein Sommerpark"
                onChange={(e) => {
                  setName(e.target.value);
                  setConfirm(null);
                }}
              />
            </label>
            {confirm ? (
              <div className="slot-confirm" role="alert">
                <strong>
                  {confirm === "overwrite"
                    ? `„${item?.name}“ durch den aktuellen Park ersetzen?`
                    : `„${item?.name}“ aus Platz ${selected} löschen?`}
                </strong>
                <div>
                  <button onClick={() => (confirm === "overwrite" ? save(true) : remove())}>
                    {confirm === "overwrite" ? "Ja, überschreiben" : "Ja, löschen"}
                  </button>
                  <button onClick={() => setConfirm(null)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="slot-actions">
                <button
                  className="slot-save"
                  disabled={!name.trim() || !slots.length}
                  onClick={() => save()}
                >
                  <Save size={18} />
                  {item?.status === "empty"
                    ? "Aktuellen Park speichern"
                    : "Mit aktuellem Park überschreiben"}
                </button>
                <button
                  disabled={item?.status !== "saved"}
                  onClick={() => {
                    try {
                      const park = loadSaveSlot(localStorage, selected);
                      if (!park) {
                        setMessage("Dieser Spielstand lässt sich nicht laden.");
                        return;
                      }
                      if (onLoad(park)) onOpenChange(false);
                      else
                        setMessage(
                          "Der Parkwechsel konnte nicht gesichert werden. Dein aktueller Park bleibt geöffnet. Bitte prüfe den freien Browserspeicher.",
                        );
                    } catch {
                      setMessage("Dieser Spielstand lässt sich nicht laden.");
                    }
                  }}
                >
                  <FolderOpen size={18} />
                  Spielstand laden
                </button>
                <div>
                  <button
                    disabled={item?.status !== "saved" || !name.trim() || name.trim() === item.name}
                    onClick={() => {
                      try {
                        const error = renameSaveSlot(localStorage, selected, name);
                        setMessage(error ?? "Spielstand umbenannt.");
                        if (!error) refresh();
                      } catch {
                        setMessage("Umbenennen fehlgeschlagen.");
                      }
                    }}
                  >
                    <Pencil size={16} />
                    Umbenennen
                  </button>
                  <button
                    disabled={!item || item.status === "empty"}
                    onClick={() => setConfirm("delete")}
                  >
                    <Trash2 size={16} />
                    Löschen
                  </button>
                </div>
              </div>
            )}
            {message && (
              <p className="slot-message" role="status">
                <Info size={15} />
                {message}
              </p>
            )}
            <p className="slot-note">
              Beim Laden wird dein aktueller Park zusätzlich als vorheriger Park gesichert. Die
              Spielstände bleiben in diesem Browser auf diesem Gerät.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
