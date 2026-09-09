# OpenArt-Spielgrafiken

Gebäude, Umgebung, Wagen und Fahrgeschäftsteile nutzen 33 Sprites aus drei über **OpenArt MCP** erzeugten Pixel-Art-Atlanten. Alle Objekte sind für die 2:1-isometrische Spielkarte ausgelegt. Die Quelldateien, Prompts und die Verarbeitung sind unter [`art/pixel-v2/`](art/pixel-v2/) dokumentiert.

- **Umgebung:** Fahrgeschäft-Icons, Kioske, Eingang, Achterbahnstation, Bänke, Bäume und Blumen.
- **Besucher und Wagen:** vier Blickrichtungen, zwei Gehposen mit gemeinsamen Größen und Fußpunkten; eine weitere Besucherfigur und vier Wagenansichten.
- **Bewegliche Fahrgeschäfte:** Riesenradfelge, Gestell und Gondel; Karusselldach, Plattform und Pferd.

Modell: **GPT Image 2.5 Sunburst**, Text-to-image, hohe Qualität, drei Generierungen vom 09.09.2026. Die tatsächlichen Quelldateien haben 1792 × 1344, 1360 × 1360 und 2016 × 1344 Pixel. Exakte Auftragskennungen, URLs und Prompts stehen in [`provenance.json`](art/pixel-v2/provenance.json).

## Frames statt einzelner Illustrationen

[`manifest.json`](art/pixel-v2/manifest.json) enthält Zuschnitt, logische Canvasgröße, Skalierungsgruppe und Ankerpunkt jedes Sprites. Beispielsweise haben alle Besucherframes eine logische Fläche von 24 × 32 Pixeln, den Fußpunkt (12, 28) und 23–24 Pixel sichtbare Körperhöhe. Die PNGs sind exakte vierfache Vergrößerungen per Nearest Neighbor.

Die Dateien werden unter `public/assets/pixel-v2/` geladen. Der neue Pfad verhindert, dass Browser ältere Illustrationen aus dem Cache mit dem neuen Satz mischen. Gebäude und Bauvorschau verwenden dieselbe Zeichnungsfunktion. Die Engine zeichnet Riesenradfelge und Gondeln getrennt, bewegt die Karussellpferde auf ihrer Umlaufbahn und wählt Besucher- und Wagenansichten nach Bewegungsrichtung. Für laufende Besucher werden inzwischen die neuen Frames aus `walk-v3` verwendet. Beide Figuren haben richtungsabhängige Gehbilder; Schrittphase und Körperbewegung folgen der tatsächlich zurückgelegten Strecke.

Technische Verarbeitung: Rasterzellen ausschneiden, Magenta transparent setzen, transparente Ränder trimmen, gemeinsame Frames und Anker erhalten und mit Nearest Neighbor verkleinern. Die erste Rastergrenze im Umgebungsatlas wurde in die tatsächliche freie Lücke verschoben, damit die Füße des Riesenrads und das Karusselldeck vollständig erhalten bleiben. Keine fremden Spielgrafiken.

Die vorherigen hochaufgelösten Illustrationsatlanten bleiben als Quellhistorie unter `art/` erhalten. Sie werden nicht mehr im Spiel verwendet. Karte, Wege und Schienen sind Spielgeometrie auf Canvas; Bedienelemente verwenden Lucide-Symbole.

## Gehbewegungen, Version 3

32 zusätzliche Besucherframes aus zwei OpenArt-MCP-Generierungen (GPT Image 2.5 Sunburst, image-to-image mit dem bisherigen Figurenatlas als Referenz). Die beiden unveränderten Atlanten, exakten Prompts, Generierungskennungen und Verarbeitung stehen unter [`art/walk-v3/`](art/walk-v3/). Laufzeitdateien: `public/assets/walk-v3/`.

Jedes Outfit hat vier Richtungen mit je vier Bildern. Die Bilder wechseln sichtbar zwischen Schritt- und Durchgangspose; die jeweils gegenüberliegenden Kontaktphasen bleiben ähnlich. Das sind überwiegend zwei ausgeprägte Posen mit Variationen, kein anatomisch vollständiger Vierphasengang. Diese Grenze ist auch in Manifest und Provenienz festgehalten. Alle Bilder behalten 24 × 32 logische Pixel, Fußpunkt (12, 28) und dieselbe vierfache Nearest-Neighbor-Vergrößerung.

Die Engine steuert Anfahren und Bremsen der Fahrgeschäfte über gedämpfte Motorbewegung. Riesenradfelge und Gondelaufhängungen teilen dieselbe Projektion. Der Zug hält feste Wagenabstände entlang der Strecke und benötigt bergauf mehr Zeit. Sämtliche Weltbewegungen folgen der Simulationszeit einschließlich Pause und 3×-Tempo.

## Erweiterung, Version 4

24 zusätzliche PNGs aus drei OpenArt-MCP-Generierungen: zwölf Wagenansichten (je vier für Stahl-, Holz- und Launch-Coaster), drei Stationen, drei Attraktionsicons und sechs montierbare Teile für Kettenkarussell, Fallturm und Piratenschaukel. Laufzeitdateien unter `public/assets/expansion-v4/`; Quellen, exakte Prompts und Montagepunkte unter [`art/expansion-v4/`](art/expansion-v4/).

Die Wagen behalten 48 × 40 logische Pixel und Anker (24,30); Stationen nutzen 72 × 96 und (36,80). Die Engine bewegt Sitze an ihren Aufhängungen, die Turmgondel auf ihrer vertikalen Achse und das Schiff um seinen oberen Drehpunkt. Stahl-/Launch-Schienen und Holztragwerke sind konstruktive Spielgeometrie. Die 3D-Mitfahrt erzeugt Schienen, Schwellen und Stützen aus derselben gespeicherten Strecke; die Parkumgebung wird mit vereinfachten 3D-Modellen dargestellt.

## Park expansion, transport and seated guests (v5)

OpenArt generated three atlases for this release: transport/shops, animated attraction parts/themes, and seated red/teal guests in four directions. 32 normalized sprites plus two small accessories extracted from the shop art are served from `public/assets/park-v5`. Source atlases, prompts, job IDs and extraction provenance are in `art/park-v5`. Render dimensions and anchors live in `game/park-sprites.json`.

The runtime combines these components with animated geometry and actual guest IDs. Workshop images are user-imported PNG/WebP motifs, stored inside the design and save. No OpenArt credentials or generation API run in the published client.

## Wagen und Parkpflege, Version 6

Zwei neue **OpenArt-MCP**-Generierungen mit GPT Image 2.5 Flare liefern zehn Laufzeit-Sprites unter `public/assets/experience-v6/`: vier Richtungen der Sportrakete, leere/volle Mülleimer und vier Richtungen einer Reinigungskraft mit Kappe und Besen. Unveränderte Atlanten, Prompts, Kennungen und Zuschnittmanifeste liegen unter [`art/experience-v6/sport/`](art/experience-v6/sport/) und [`art/experience-v6/cleaning/`](art/experience-v6/cleaning/). Jobs: `jYMfh6RnojaWYXCOd2iN` und `NOLzDwIyYmi7rOyVftfF`, erzeugt am 09.09.2026.

Die Sportrakete nutzt 48 × 40 logische Pixel mit Anker (24, 30). OpenArt lieferte Tandemsitze; diese Anordnung ist in 2D und 3D übernommen. Eine Materialmaske färbt Karosserie, Akzente und Sitze um und erhält Schattierung, Transparenz und dunkle Mechanik. Die drei 3D-Wagenmodelle sind eigenständige Spielgeometrie mit passenden Sitzankern, Radgruppen, Haltebügeln und Modellmerkmalen.

Mülleimer und Personal nutzen 24 × 32 logische Pixel mit Fußpunkt (12, 28), jeweils exakt vierfach vergrößert. Reinigungskräfte besitzen eine Pose pro Richtung mit leichter Lauf-/Kehrbewegung zur Laufzeit; dies ist kein vollständiger Gehzyklus. Müllteile, Smileys und Analysemarkierungen zeichnet die Engine. Schreie und Jubel werden ausschließlich prozedural über Web Audio erzeugt; es werden keine aufgenommenen Stimmen verwendet.
