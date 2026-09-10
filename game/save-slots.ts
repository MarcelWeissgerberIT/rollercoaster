import { migratePark, validSave, type Park } from "./simulation";

export const SAVE_SLOT_COUNT = 10;
export const saveSlotKey = (slot: number) => `coaster-grove-slot-v1-${slot}`;
type SlotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SaveSlot = {
  slot: number;
  status: "empty" | "saved" | "damaged";
  name: string;
  savedAt?: string;
  park?: Park;
};
type SlotRecord = { version: 1; name: string; savedAt: string; park: Park };
const validSlot = (slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOT_COUNT;
const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 60);

export function readSaveSlots(storage: SlotStorage): SaveSlot[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
    const slot = i + 1;
    let raw: string | null;
    // A blocked browser store is not an empty park collection.
    raw = storage.getItem(saveSlotKey(slot));
    if (!raw) return { slot, status: "empty", name: "Freier Speicherplatz" };
    try {
      const data = JSON.parse(raw) as SlotRecord;
      if (
        data.version !== 1 ||
        typeof data.name !== "string" ||
        !cleanName(data.name) ||
        typeof data.savedAt !== "string" ||
        !Number.isFinite(Date.parse(data.savedAt)) ||
        !validSave(data.park)
      )
        throw Error();
      return {
        slot,
        status: "saved",
        name: cleanName(data.name),
        savedAt: data.savedAt,
        park: migratePark(data.park),
      };
    } catch {
      return { slot, status: "damaged", name: "Spielstand nicht lesbar" };
    }
  });
}

/** Each slot is a single atomic browser write; a quota error preserves its previous park. */
export function writeSaveSlot(
  storage: SlotStorage,
  slot: number,
  name: string,
  park: Park,
  overwrite = false,
  now = new Date(),
): string | null {
  if (!validSlot(slot)) return "Wähle einen Speicherplatz von 1 bis 10.";
  const title = cleanName(name);
  if (!title) return "Gib deinem Spielstand einen Namen.";
  try {
    if (storage.getItem(saveSlotKey(slot)) && !overwrite)
      return "Dieser Speicherplatz ist belegt. Bestätige das Überschreiben.";
    const record = { version: 1, name: title, savedAt: now.toISOString(), park };
    const encoded = JSON.stringify(record);
    if (!validSave(JSON.parse(encoded).park))
      return "Der aktuelle Park konnte nicht sicher gespeichert werden.";
    storage.setItem(saveSlotKey(slot), encoded);
    return null;
  } catch {
    return "Speichern fehlgeschlagen. Der bisherige Spielstand bleibt erhalten. Im Browserspeicher ist möglicherweise zu wenig Platz.";
  }
}

export function loadSaveSlot(storage: SlotStorage, slot: number): Park | null {
  if (!validSlot(slot)) return null;
  const saved = readSaveSlots(storage).find((item) => item.slot === slot);
  return saved?.status === "saved" ? saved.park! : null;
}

export function renameSaveSlot(storage: SlotStorage, slot: number, name: string): string | null {
  if (!validSlot(slot) || !cleanName(name))
    return "Gib einen Namen für einen belegten Speicherplatz ein.";
  try {
    const raw = storage.getItem(saveSlotKey(slot));
    if (!raw) return "Der Speicherplatz ist leer.";
    const data = JSON.parse(raw) as SlotRecord;
    if (data.version !== 1 || !validSave(data.park))
      return "Dieser Spielstand lässt sich nicht umbenennen.";
    storage.setItem(saveSlotKey(slot), JSON.stringify({ ...data, name: cleanName(name) }));
    return null;
  } catch {
    return "Umbenennen fehlgeschlagen. Der bisherige Name bleibt erhalten.";
  }
}

export function deleteSaveSlot(storage: SlotStorage, slot: number): string | null {
  if (!validSlot(slot)) return "Unbekannter Speicherplatz.";
  try {
    storage.removeItem(saveSlotKey(slot));
    return null;
  } catch {
    return "Der Spielstand konnte nicht gelöscht werden.";
  }
}
