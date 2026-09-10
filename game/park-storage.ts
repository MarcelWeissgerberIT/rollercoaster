import { migratePark, validSave, type Park } from "./simulation";

export const PARK_SAVE_KEY = "coaster-grove-v1";
export const PREVIOUS_PARK_KEY = "coaster-grove-previous-park-v1";
type ParkStorage = Pick<Storage, "getItem" | "setItem">;

/** Write the backup before replacing the active slot. The caller only switches after success. */
export function saveParkSwitch(storage: ParkStorage, current: Park, next: Park): string | null {
  try {
    const before = JSON.stringify(current),
      after = JSON.stringify(next);
    if (!validSave(JSON.parse(before)) || !validSave(JSON.parse(after)))
      return "Der Parkwechsel konnte nicht gespeichert werden. Dein aktueller Park bleibt geöffnet.";
    storage.setItem(PREVIOUS_PARK_KEY, before);
    storage.setItem(PARK_SAVE_KEY, after);
    return null;
  } catch {
    return "Die Sicherung ist fehlgeschlagen. Dein aktueller Park bleibt geöffnet. Bitte schaffe Platz im Browserspeicher.";
  }
}

export function readPreviousPark(storage: ParkStorage): Park | null {
  try {
    const raw = storage.getItem(PREVIOUS_PARK_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return validSave(data) ? migratePark(data) : null;
  } catch {
    return null;
  }
}
