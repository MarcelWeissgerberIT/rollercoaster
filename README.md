# Coaster Grove

Eine spielbare, eigenständige Freizeitpark-Simulation, inspiriert von RollerCoaster Tycoon. Baue deinen Park direkt im Browser: mit isometrischer Spielwelt, eigenen Achterbahnen und einer laufenden Besuchersimulation.

**[Jetzt spielen](https://marcelweissgerberit.github.io/rollercoaster/)**

## Im Spiel

- 30 × 30 Felder mit Wegen, Warteschlangen, Wasser und Dekoration.
- Achterbahn-Schnellbau mit drehbarer 6 × 4-Vorlage, eigenem Streckeneditor, Höhenstufen und automatischer Testfahrt.
- Gültige/ungültige Bauvorschau mit Gesamtkosten, optionales Deko-Freiräumen, automatischer Anschluss und Rückgängig für die letzten 30 Bauaktionen.
- Panoramarad und Karussell, Burgergarten, Limonadenbar und Toiletten.
- Gäste mit vier Blickrichtungen, Gehposen für beide Outfits, individuellen Geschwindigkeiten, Zielen, Hunger, Durst und Zufriedenheit. Wartende verteilen sich auf Queue-Felder.
- Fahrgeschäfte fahren sanft an und bremsen; Gondeln schwingen, Karussellpferde heben sich. Achterbahnzüge beschleunigen, fahren Steigungen langsam und Abfahrten schneller. Einnahmen erscheinen kurz direkt am Gebäude.
- Eintritts- und Fahrpreise, Personal, Einnahmen, Baukosten und tägliche Betriebskosten.
- Waldhain-Szenario mit 16.000 € und einem bereits geöffneten Park. Ziel: 150 Gäste begrüßen, vier Attraktionen betreiben und mindestens 75 % Zufriedenheit erreichen.
- Freies Spiel mit 100.000 € Startkapital.
- Automatisches lokales Speichern alle 20 Sekunden; manuell speichern und laden in der Parkverwaltung.

## So baust du

Wähle unten ein Werkzeug. Die grüne/rote Vorschau zeigt, ob das Bauwerk passt, und nennt den Gesamtpreis. **Deko freiräumen** entfernt störende Bäume oder Blumen für 10 € pro Objekt. Bestehende Gebäude werden dabei nicht entfernt. Nach dem Platzieren öffnet sich direkt die Verwaltung; **Anschließen & öffnen** baut einen passenden Weg oder eine Warteschlange zum bestehenden Wegenetz. Der Anschluss sucht bis zu zwölf neue Felder weit.

Eine Achterbahn kannst du im **Schnellbau** vollständig platzieren und mit **R** drehen. Ihre Testfahrt startet automatisch; nach dem Anschluss eröffnet sie sich, sobald der Test abgeschlossen ist. Unter **Eigene Strecke** kannst du weiterhin eine Station setzen, benachbarte Abschnitte ergänzen und ihre Höhe wählen. Der Rundkurs muss zur Station auf Höhe 0 zurückkehren.

Wege, Warteschlangen, Wasser und Abriss lassen sich ziehen. **Rückgängig** nimmt einen ganzen Bauzug zurück, während Besucher und Simulationszeit weiterlaufen. Die Bauhistorie gilt für die aktuelle Sitzung und wird beim Laden oder Neubeginn geleert. Einzelne Attraktionen wechseln nach dem Bauen direkt in die Verwaltung; **Shift** hält das Werkzeug für mehrere Platzierungen aktiv.

| Steuerung                                            | Aktion                                   |
| ---------------------------------------------------- | ---------------------------------------- |
| Auswahl + Ziehen, rechte Maustaste oder Alt + Ziehen | Karte verschieben                        |
| Mausrad / + / −                                      | Zum Zeiger / zur Bildschirmmitte zoomen  |
| Leertaste                                            | Pause / Weiter                           |
| R                                                    | Schnellbau-Vorlage drehen                |
| Strg / ⌘ + Z                                         | Bauaktion rückgängig                     |
| Shift + Klick                                        | Attraktion mehrfach platzieren           |
| Esc / Rechtsklick                                    | Bauwerkzeug verlassen                    |
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
