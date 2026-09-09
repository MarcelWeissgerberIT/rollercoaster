# Coaster Grove

Eine spielbare, eigenständige Freizeitpark-Simulation, inspiriert von RollerCoaster Tycoon. Baue deinen Park direkt im Browser: mit isometrischer Spielwelt, eigenen Achterbahnen und einer laufenden Besuchersimulation.

**[Jetzt spielen](https://marcelweissgerberit.github.io/rollercoaster/)**

## Im Spiel

- 30 × 30 Felder mit Wegen, Warteschlangen, Wasser und Dekoration.
- Achterbahneditor mit Höhenstufen, Kollisionsprüfung, Rundkursvorlage und Testfahrten.
- Panoramarad und Karussell, Burgergarten, Limonadenbar und Toiletten.
- Gäste mit vier Blickrichtungen, Zielen, Hunger, Durst und Zufriedenheit. Mehrteilige Züge fahren entlang deiner Strecke; Riesenrad und Karussell bewegen sich.
- Eintritts- und Fahrpreise, Personal, Einnahmen, Baukosten und tägliche Betriebskosten.
- Waldhain-Szenario mit 16.000 € und einem bereits geöffneten Park. Ziel: 150 Gäste begrüßen, vier Attraktionen betreiben und mindestens 75 % Zufriedenheit erreichen.
- Freies Spiel mit 100.000 € Startkapital.
- Automatisches lokales Speichern alle 20 Sekunden; manuell speichern und laden in der Parkverwaltung.

## So baust du

Wähle ein Werkzeug unten und klicke auf freie Wiese. Attraktionen benötigen eine braune Warteschlange zum normalen Wegenetz; Geschäfte benötigen einen normalen Weg. Mit **Auswahl** kannst du ein Gebäude anklicken, Preise ändern und es eröffnen.

Für eine Achterbahn setzt du zunächst eine Station. Ergänze benachbarte Abschnitte mit den Pfeilen oder einem Klick auf die Karte. Die Gleishöhe gilt für den nächsten Abschnitt. Schließe die Strecke auf Stationshöhe, baue sie, starte eine Testfahrt und eröffne sie. Die **Waldflug-Vorlage** erstellt einen kompakten 6 × 4 Rundkurs.

| Steuerung                                            | Aktion                                   |
| ---------------------------------------------------- | ---------------------------------------- |
| Auswahl + Ziehen, rechte Maustaste oder Alt + Ziehen | Karte verschieben                        |
| Mausrad / + / −                                      | Zoomen                                   |
| Leertaste                                            | Pause / Weiter                           |
| Esc                                                  | Bauwerkzeug verlassen                    |
| Strg / ⌘ + S                                         | Park speichern                           |
| Parkverwaltung                                       | Eintritt, Personal, Finanzen, neuer Park |

## Lokal starten

Node.js **24** und npm:

```sh
npm ci
npm run dev
```

Die lokale Adresse enthält den Pfad `/rollercoaster/`. Produktionsbuild und Prüfungen:

```sh
npm test
npm run check:assets
npm run build
npm run preview
```

React, TypeScript, Canvas 2D und Vite. GitHub Pages liefert nur statische Dateien aus; kein Backend und keine Zugangsdaten werden für das Spiel benötigt. Spielstände liegen im Browser (`coaster-grove-v1`) und werden nicht zwischen Geräten synchronisiert.

## Veröffentlichung

Pushes auf `main` starten `.github/workflows/pages.yml`: Installation, Simulationstests, Assetprüfung, TypeScript-Prüfung, Vite-Build und Veröffentlichung auf GitHub Pages. Im Repository ist Pages auf **GitHub Actions** eingestellt. Der Vite-Basispfad ist `/rollercoaster/`.

## Grafik und Umfang

Die Spielsprites stammen ausschließlich aus dem OpenArt-Projekt des Nutzers. Die aktive Grafik wurde über den **OpenArt MCP** als einheitlicher Pixel-Art-Satz neu erzeugt, mit festen Größen, Ankerpunkten, Richtungsansichten und beweglichen Fahrgeschäftsteilen. Quellen, Prompts und Verarbeitung stehen in [ASSETS.md](ASSETS.md). Es werden keine Originalgrafiken oder Spieldateien von RollerCoaster Tycoon verwendet.

Dies ist eine kompakte Browser-Parksimulation. Fahrphysik und Wirtschaft sind vereinfachte Spielmodelle; sie enthalten beispielsweise keine Gelände-Höhenbearbeitung, vertikalen Loopings oder Mehrspielerfunktion.
