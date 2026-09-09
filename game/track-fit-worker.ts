import { findTrackFit } from "./track-fit";
import type { Park, Point } from "./simulation";
import type { Piece } from "./prefabs";
self.onmessage = (
  event: MessageEvent<{ park: Park; draft: Point[]; piece: Piece; clear: boolean }>,
) => {
  try {
    const { park, draft, piece, clear } = event.data;
    self.postMessage(findTrackFit(park, draft, piece, clear));
  } catch {
    self.postMessage({
      checked: 0,
      error:
        "Die Einpasshilfe konnte diesen Entwurf nicht prüfen. Verändere den Gleisbereich und versuche es erneut.",
    });
  }
};
