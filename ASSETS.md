# OpenArt-Spielgrafiken

Die aktive Grafik nutzt 33 Sprites aus drei über **OpenArt MCP** erzeugten Pixel-Art-Atlanten. Alle Objekte sind für die 2:1-isometrische Spielkarte ausgelegt. Die Quelldateien, Prompts und die Verarbeitung sind unter [`art/pixel-v2/`](art/pixel-v2/) dokumentiert.

- **Umgebung:** Fahrgeschäft-Icons, Kioske, Eingang, Achterbahnstation, Bänke, Bäume und Blumen.
- **Besucher und Wagen:** vier Blickrichtungen, zwei Gehposen mit gemeinsamen Größen und Fußpunkten; eine weitere Besucherfigur und vier Wagenansichten.
- **Bewegliche Fahrgeschäfte:** Riesenradfelge, Gestell und Gondel; Karusselldach, Plattform und Pferd.

Modell: **GPT Image 2.5 Sunburst**, Text-to-image, hohe Qualität, drei Generierungen vom 09.09.2026. Die tatsächlichen Quelldateien haben 1792 × 1344, 1360 × 1360 und 2016 × 1344 Pixel. Exakte Auftragskennungen, URLs und Prompts stehen in [`provenance.json`](art/pixel-v2/provenance.json).

## Frames statt einzelner Illustrationen

[`manifest.json`](art/pixel-v2/manifest.json) enthält Zuschnitt, logische Canvasgröße, Skalierungsgruppe und Ankerpunkt jedes Sprites. Beispielsweise haben alle Besucherframes eine logische Fläche von 24 × 32 Pixeln, den Fußpunkt (12, 28) und 23–24 Pixel sichtbare Körperhöhe. Die PNGs sind exakte vierfache Vergrößerungen per Nearest Neighbor.

Die Dateien werden unter `public/assets/pixel-v2/` geladen. Der neue Pfad verhindert, dass Browser ältere Illustrationen aus dem Cache mit dem neuen Satz mischen. Gebäude und Bauvorschau verwenden dieselbe Zeichnungsfunktion. Die Engine zeichnet Riesenradfelge und Gondeln getrennt, bewegt die Karussellpferde auf ihrer Umlaufbahn und wählt Besucher- und Wagenansichten nach Bewegungsrichtung. Die zweite Besucherfigur hat Richtungsframes; ihre Bewegung nutzt einen leichten Gehversatz.

Technische Verarbeitung: Rasterzellen ausschneiden, Magenta transparent setzen, transparente Ränder trimmen, gemeinsame Frames und Anker erhalten und mit Nearest Neighbor verkleinern. Die erste Rastergrenze im Umgebungsatlas wurde in die tatsächliche freie Lücke verschoben, damit die Füße des Riesenrads und das Karusselldeck vollständig erhalten bleiben. Keine fremden Spielgrafiken.

Die vorherigen hochaufgelösten Illustrationsatlanten bleiben als Quellhistorie unter `art/` erhalten. Sie werden nicht mehr im Spiel verwendet. Karte, Wege und Schienen sind Spielgeometrie auf Canvas; Bedienelemente verwenden Lucide-Symbole.
