# Coaster Grove

Eine spielbare, eigenständige Freizeitpark-Simulation, inspiriert von RollerCoaster Tycoon. Baue deinen Park direkt im Browser: mit isometrischer Spielwelt, eigenen Achterbahnen und einer laufenden Besuchersimulation.

**[Jetzt spielen](https://marcelweissgerberit.github.io/rollercoaster/)**

## Im Spiel

- 30 × 30 Felder mit Wegen, Warteschlangen, Wasser und Dekoration.
- Achterbahn-Schnellbau mit drehbarer 6 × 4-Vorlage, eigenem Streckeneditor, Höhenstufen und automatischer Testfahrt.
- Gültige/ungültige Bauvorschau mit Gesamtkosten, optionales Deko-Freiräumen, automatischer Anschluss und Rückgängig für die letzten 30 Bauaktionen.
- Bestehende Stationen auf ebene, gerade Gleisfelder versetzen; ganze Bahnen verschieben und um ihre Station drehen. Der Umbau behält ID, Fahrpreise, Testresultat und Statistik und ist rückgängig machbar.
- Panoramarad und Karussell, Burgergarten, Limonadenbar und Toiletten.
- Gäste mit vier Blickrichtungen, Gehposen für beide Outfits, individuellen Geschwindigkeiten, Zielen, Hunger, Durst und Zufriedenheit. Wartende verteilen sich auf Queue-Felder.
- Fahrgeschäfte fahren sanft an und bremsen; Gondeln schwingen, Karussellpferde heben sich. Achterbahnzüge beschleunigen, fahren Steigungen langsam und Abfahrten schneller. Einnahmen erscheinen kurz direkt am Gebäude.
- Eintritts- und Fahrpreise, Personal, Einnahmen, Baukosten und tägliche Betriebskosten.
- Waldhain-Szenario mit 16.000 € und einem bereits geöffneten Park. Ziel: 150 Gäste begrüßen, vier Attraktionen betreiben und mindestens 75 % Zufriedenheit erreichen.
- Freies Spiel mit 100.000 € Startkapital.
- Automatisches lokales Speichern alle 20 Sekunden; manuell speichern und laden in der Parkverwaltung.

## So baust du

Wähle unten ein Werkzeug. Die grüne/rote Vorschau zeigt, ob das Bauwerk passt, und nennt den Gesamtpreis. **Deko freiräumen** entfernt störende Bäume oder Blumen für 10 € pro Objekt. Bestehende Gebäude werden dabei nicht entfernt. Nach dem Platzieren öffnet sich direkt die Verwaltung; **Anschließen & öffnen** baut einen passenden Weg oder eine Warteschlange zum bestehenden Wegenetz. Ein direkt angrenzender, mit dem Parkeingang verbundener Parkweg genügt: Er bietet vier Warteplätze. Eine eigene Warteschlange wird bevorzugt und kann mehr Gäste aufnehmen. Der Anschlussplaner nutzt vorhandene Wege, füllt Lücken und sucht Verbindungen mit bis zu 30 neuen Feldern. Vorhandene Wege werden nicht umgefärbt.

Eine Achterbahn kannst du im **Schnellbau** vollständig platzieren und mit **R** drehen. Ihre Testfahrt startet automatisch; nach dem Anschluss eröffnet sie sich, sobald der Test abgeschlossen ist. Unter **Eigene Strecke** kannst du weiterhin eine Station setzen, benachbarte Abschnitte ergänzen und ihre Höhe wählen. Der Rundkurs muss zur Station auf Höhe 0 zurückkehren.

Zum Umbau eine bestehende Achterbahn auswählen: **Station versetzen** markiert geeignete gerade Abschnitte am Boden. Die Gleisform bleibt dabei unverändert. **Bahn verschieben / drehen** bewegt die gesamte Anlage; **R** dreht sie um die Station. Mausbewegung zeigt die Vorschau und mögliche Anschlusskosten. Klicke auf die Karte oder **Position übernehmen**, um den Umbau abzuschließen. **Abbrechen** und **Esc** verwerfen die Vorschau. Bei fehlendem Zugang kann das Spiel einen besseren Stationsplatz vorschlagen.

Versetzen ist kostenlos; nur geräumte Dekoration kostet 10 € pro Objekt. Bestehende Wege bleiben an ihrem bisherigen Ort. Beim Übernehmen wird die betroffene Attraktion geschlossen und entladen; anschließend den neuen Zugang prüfen und wieder öffnen. Eine laufende Testfahrt wird abgebrochen und kann neu gestartet werden. Bereits abgeschlossene Tests und Fahrwerte bleiben bei diesen geometrisch unveränderten Umbauten gültig.

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
