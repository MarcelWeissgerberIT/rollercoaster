export const PIECES = {
  short: { name: "Kurze Gerade", glyph: "━", detail: "1 Feld · 5 m" },
  straight: { name: "Gerade", glyph: "━", detail: "2 Felder" },
  rise: { name: "Steigung", glyph: "╱", detail: "+5 m · Kettenlift" },
  fall: { name: "Abfahrt", glyph: "╲", detail: "−5 m" },
  left: { name: "Linkskurve", glyph: "↰", detail: "90° · Radius 2" },
  right: { name: "Rechtskurve", glyph: "↱", detail: "90° · Radius 2" },
  loop: { name: "Looping", glyph: "↻", detail: "20 m · Inversion" },
  hill: { name: "Hügel", glyph: "⌒", detail: "4 Felder · +5 m" },
  airtime: { name: "Airtime-Hügel", glyph: "⌒", detail: "6 Felder · sanfter 5-m-Kamm" },
  bunny: { name: "Bunny-Hops", glyph: "∿", detail: "8 Felder · zwei kleine Hügel" },
  helixleft: { name: "Helix links", glyph: "↶", detail: "180° · Radius 3 · +5 m" },
  helixright: { name: "Helix rechts", glyph: "↷", detail: "180° · Radius 3 · +5 m" },
  doubleloop: { name: "Doppel-Looping", glyph: "∞", detail: "Zwei Inversionen · 20 m" },
  sbend: { name: "S-Kurve", glyph: "∿", detail: "4 × 4 Felder" },
} as const;
export type Piece = keyof typeof PIECES;

export const invertingPiece = (p: Piece) => p === "loop" || p === "doubleloop";
