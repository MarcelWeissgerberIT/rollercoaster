/** Bounded latest-photo holder. Call capture synchronously immediately AFTER
 * renderer.render(). Only one toBlob encode and one retained object URL exist.
 * The source is the current WebGL canvas, so preserveDrawingBuffer is unnecessary. */
export type RidePhoto = { url: string; filename: string };
export function createRidePhotoCapture(
  onPhoto: (photo: RidePhoto | null) => void,
  onError?: (message: string) => void,
) {
  let currentURL: string | null = null,
    busy = false,
    disposed = false,
    generation = 0;
  const revoke = () => {
    if (currentURL) {
      URL.revokeObjectURL(currentURL);
      currentURL = null;
    }
  };
  return {
    capture(canvas: HTMLCanvasElement, filename: string): boolean {
      if (disposed || busy || !canvas.width || !canvas.height) return false;
      busy = true;
      const token = generation;
      try {
        canvas.toBlob(
          (blob) => {
            busy = false;
            if (disposed || token !== generation) return;
            if (!blob) {
              onError?.("Das Foto konnte nicht gespeichert werden.");
              return;
            }
            const url = URL.createObjectURL(blob),
              old = currentURL;
            currentURL = url;
            try {
              onPhoto({ url, filename });
            } catch {
              URL.revokeObjectURL(url);
              currentURL = old;
              onError?.("Das Foto konnte nicht angezeigt werden.");
              return;
            }
            if (old) URL.revokeObjectURL(old);
          },
          "image/jpeg",
          0.9,
        );
      } catch {
        busy = false;
        onError?.("Das Foto konnte nicht aus der Mitfahrt übernommen werden.");
        return false;
      }
      return true;
    },
    clear() {
      if (disposed) return;
      generation++;
      revoke();
      onPhoto(null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      revoke();
    },
  };
}
