# OpenArt-Spielgrafiken

Alle Gebäude, Natur-, Wagen- und Besucher-Sprites wurden im OpenArt-Projekt **Coaster Grove – Park Assets** erzeugt. Die fertigen transparenten PNGs liegen unter `public/assets/` und werden von dort lokal geladen.

| Quelle                                           | Status                                                  | Verwendung                                                   |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| Gebäudeatlas, Asset-ID `RwNPqQK1PFMi3qfNmhEY`    | Bestehende OpenArt-Erzeugung übernommen                 | Panoramarad, Karussell, Burger, Getränke, Eingang, Toiletten |
| Naturatlas, Generation `rX5vuZ9bGgJSL23ymkUl`    | Bestehende fertige OpenArt-Erzeugung über MCP abgerufen | Laubbaum, Kiefer, Blumen, Bank, Achterbahnwagen              |
| Besucheratlas, Generation `nxAAeZwIlkEkkAnjAfAt` | Am 09.09.2026 über OpenArt MCP erzeugt                  | Drei Besucher mit je zwei Gehposen                           |

Natur und Besucher: **GPT Image 2**, 2016 × 1344 Pixel. Besucher: Text-to-image, 3:2, 2K, hohe Qualität. Die exakten Prompts, Original-URLs und Metadaten stehen in [`art/provenance.json`](art/provenance.json). Die drei Quellatlanten bleiben unter `art/` erhalten und werden nicht in den Website-Build kopiert.

Verarbeitung: Rasterzellen ausschneiden, Magenta-Hintergrund transparent setzen, Farbsäume technisch bereinigen, transparente Ränder trimmen und PNG speichern. Beim Kiefernausschnitt wurden 17 Pixel vom benachbarten Blumenfeld entfernt. Keine Fremdgrafiken und keine zusätzliche Bildgenerierung außerhalb von OpenArt.

Die Karte, Wege und Gleisgeometrie zeichnet die Spielengine auf Canvas; Oberflächensymbole stammen aus Lucide. Das vorhandene SVG-Favicon ist ein einfaches geometrisches Gleiszeichen.
