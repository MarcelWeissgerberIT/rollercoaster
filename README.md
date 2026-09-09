# Coaster Grove

Eine spielbare, eigenständige Freizeitpark-Simulation, inspiriert von RollerCoaster Tycoon. Baue deinen Park direkt im Browser: mit isometrischer Spielwelt, eigenen Achterbahnen und einer laufenden Besuchersimulation.

**[Jetzt spielen](https://marcelweissgerberit.github.io/rollercoaster/)**

## Parkleben, Fahrbetrieb und Forschung

- Das Pastell-Halbrad gruppiert Bauen, Zoo, Park und Verwaltung. Der Bulldozer ist direkt erreichbar; das runde Forschungsicon öffnet einen Baum mit sichtbaren Voraussetzungen.
- Forschung kostet Coins: 3 Start-Coins, danach pro 12 Spieltagen maximal 3. Es gibt 1 fürs abgeschlossene Jahr, 2 ab 70 % durchschnittlicher Zufriedenheit und 3 bei zusätzlichem positivem Jahresbetriebsgewinn. Bau-/Verkaufserlöse beeinflussen den Gewinnbonus nicht.
- Autoscooter und Ballonfahrt haben eigene Bewegungen und 3D-Sitzkameras. Elefanten, Löwen und Pandas erweitern den Zoo auf sieben Arten, mit eigenen Modellen und Tierlauten. 27 neue OpenArt-Sprites sind unter `art/park-v8/` dokumentiert.
- Hotdogs, Eis, Popcorn und Kaffee ergänzen das Angebot. Gäste tragen und essen ihre Bestellung, nutzen Bänke und Picknickplätze zur Erholung sowie den Spielplatz. Vier Wegbeläge lassen sich bauen oder für 6 € je Feld wechseln.
- Die Personalübersicht verwaltet Reinigung, Tierpflege und Bedienpersonal. Fahrgeschäfte benötigen eine Crew (70 €/Spieltag), lassen Gäste ein, prüfen und absolvieren 1–5 einstellbare Runden pro Ticket.
- Das Eingangstor bietet drei Gestaltungen, Öffnung und Eintrittspreis. Bereits gekaufte Gestaltungen sind kostenlos wechselbar.
- Ausgangsprobleme lassen sich mit einem geprüften Vorschlag samt Preis beheben. Die Suche bewahrt blaue Wege, Wasser und funktionale Einrichtungen. Die Station kann ihre Fahrtrichtung um 180° umkehren; Antriebe, Loopings und Fotopunkt folgen korrekt. Danach ist eine neue Testfahrt erforderlich.
- Ein Foto-Laser kostet 180 €, lässt sich auf einem ausgewählten Gleisabschnitt montieren, verschieben und entfernen. Die 3D-Mitfahrt nimmt beim Passieren ein Foto von Zug und Gästen auf und bietet einen lokalen Download. Es werden keine Fotos hochgeladen.
- Der Fahrprofil-Assistent zeigt Suchstatus, Fehler und Übernehmen direkt oberhalb der Profilauswahl. Alle Bauänderungen bleiben überprüfbar und rückgängig machbar.

## Im Spiel

- Je nach Kampagne 30 × 30, 36 × 36 oder 42 × 42 Felder mit Wegen, Warteschlangen, Wasser und Dekoration; Gelände nach Osten und Süden bis 54 × 54 zukaufen.
- Drei Achterbahntypen mit eigenen Wagen, Stationen, Preisen und Kapazitäten: Stahlfalke, Holzexpress und Blitzstart. Drehbare Rundkurs-Vorlagen sowie automatisch andockende Geraden, Steigungen, Abfahrten, Links-/Rechtskurven und echte räumliche Loopings.
- Kompakter Baukasten mit festen Aktionen, Vorschau des nächsten Bauteils und sofortiger Kollisionsprüfung. Entwürfe samt Bauteil-Undo bleiben beim Werkzeugwechsel und Laden erhalten. Gültige/ungültige Bauvorschau mit Gesamtkosten, optionales Deko-Freiräumen, automatischer Anschluss und Rückgängig für die letzten 30 Bauaktionen.
- Bestehende Stationen auf ebene, gerade Gleisfelder versetzen; ganze Bahnen verschieben und um ihre Station drehen. Der Umbau behält ID, Fahrpreise, Testresultat und Statistik und ist rückgängig machbar.
- Panoramarad, Karussell, Wellenflug, Himmelssturz, Piratenschaukel, Tanzende Tassen und Orbitalwirbel; Burgergarten, Limonadenbar, Toiletten, Luftballons und Kuscheltiere.
- Gäste mit dauerhaft gespeicherten Zufallsnamen, sichtbaren Mitfahrern und Souvenirs sowie vier Blickrichtungen, Gehposen für beide Outfits, individuellen Geschwindigkeiten, Zielen, Hunger, Durst, Toilettenbedarf und Zufriedenheit. Familien, Thrill-Fans und Sparfüchse wählen nach echten Fahrwerten, Preis, Wegstrecke, Wartezeit und ihrem Budget. Wartende verteilen sich auf Queue-Felder.
- Fahrgeschäfte fahren sanft an und bremsen; Gondeln schwingen, Karussellpferde heben sich. Achterbahnzüge beschleunigen, fahren Steigungen langsam und Abfahrten schneller. Einnahmen erscheinen kurz direkt am Gebäude.
- 3D-Probefahrt auf der tatsächlich gebauten Strecke: Frontkamera, Verfolger, dreh-/zoombarer Parkblick, Zeitregler, Pause und Neustart. Eine gemeinsame Geometrie-/Geschwindigkeitstabelle treibt 2D, 3D und Testfahrten an. Die Szene zeigt alle Bahnen, animierte Gäste, eigenständige Attraktionen und unterschiedliche Baumarten. Der Park pausiert währenddessen. WebGL 2 ist erforderlich; die 3D-Umgebung ist eine vereinfachte räumliche Darstellung des Parks.
- Originale, prozedurale Parkmusik mit vier Phrasen, Harmoniewechseln und Ruhepassagen, Bau-/Kassentöne sowie Kettenlift, Launch, Rollen, Bremsen und geschwindigkeitsabhängiger Fahrtwind. Sound startet nach Aktivierung; Gesamt-, Musik- und Effektlautstärke werden getrennt gespeichert.
- Eintritts- und Fahrpreise, Personal, Einnahmen, Baukosten, Parkwert und tägliche Betriebskosten. Geschäfte arbeiten mit realer Kapazität, Wartezeit und Wareneinsatz; bezahlt wird nach dem Service. Betriebsgewinn wird getrennt von Bau, Verkauf und Forschung ausgewiesen.
- Zehn Forschungsprojekte schalten zusätzliche Bahnen, Fahrgeschäfte, Souvenirs, Transport und die eigene Attraktionswerkstatt frei. Alte Spielstände behalten bisherige Freischaltungen; neue Inhalte werden zusätzlich erforscht.
- Waldhain-Szenario mit 16.000 € und einem bereits geöffneten Park. Ziel: 150 Gäste begrüßen, vier Attraktionen betreiben und mindestens 75 % Zufriedenheit erreichen.
- Seeblick-Szenario: 12.000 €, zusätzlicher See, fünf Attraktionen, 250 Ankünfte und Ziele für Parkwert, Betriebsgewinn und Zufriedenheit.
- Gipfelrausch-Szenario: 20.000 €, zunächst nur eine Bahn; entwickle einen rentablen Park mit drei Achterbahnen.
- Freies Spiel mit 100.000 € Startkapital und allen Freischaltungen.
- Automatisches lokales Speichern alle 20 Sekunden; manuell speichern und laden in der Parkverwaltung.

## Fertige Kampagnen und Zoo

**Parkmenü → Kampagnen spielen** öffnet die Auswahl. **Kampagnenziele** im Parkmenü zeigt den Fortschritt auch auf kleinen Bildschirmen. Ein neuer Start ersetzt den bisherigen lokalen Park; die Auswahl weist darauf hin. Die drei bisherigen Szenarien und das freie Spiel bleiben vorhanden.

| Neue Kampagne | Ausgangslage | Aufgabe |
| --- | --- | --- |
| Rosenhain erwacht | 8.000 €, geschlossener maroder Park, verschlissene Attraktionen und Müll | Reparieren, wieder öffnen, 150 Gäste begrüßen, drei Fahrgeschäfte betreiben; Zustand 80 %, Sauberkeit 85 %, Zufriedenheit 75 % |
| Festival nach dem Sturm | 12.000 €, 42 × 42 Felder, 120 Gäste, acht Attraktionen und viel Müll | Reinigung organisieren, 350 Gäste begrüßen, Sauberkeit 90 %, Zufriedenheit 80 % und 400 € Betriebsgewinn pro Tag erreichen |
| Wildhain Tierpark | 22.000 €, 36 × 36 Felder, Zebras, Flamingos und ein Tierpfleger | Giraffen und Pinguine erforschen; vier verschiedene gesunde Arten zugänglich machen, 200 Gäste begrüßen, Tierwohl/Zufriedenheit 80 % und Sauberkeit 85 % erreichen |

Im Menü **Zoo & Tiere** stehen vier Gehegetypen und die **Tierpflegerstation**. Forschung schaltet zunächst Zebras, Flamingos und Pflegestationen, danach Savannentiere und die Pinguin-Küste frei. Gehege werden leer gebaut. Tiere einzeln aufnehmen, normale Parkwege an eine beliebige Zaunseite bauen und öffnen. Besucher verteilen sich entlang dieser Wege, schauen ins Gehege und bleiben unterschiedlich lange stehen. Es gibt keine Ein-/Ausgangspods, Warteschlangen oder zusätzlichen Gehegetickets; die Tierbeobachtung ist im Parkeintritt enthalten. Alte Spielstände werden automatisch umgestellt: Exklusive blaue/rote Zoo-Anschlüsse werden kostenlos zu Parkwegen, gemeinsam genutzte Anschlüsse anderer Betriebe bleiben erhalten. Leere Gehege zählen nicht als Attraktion oder Kampagnenfortschritt.

Tiere besitzen Namen, Futter-, Wasser-, Sauberkeits- und Gesundheitswerte. **Beschäftigung** kostet 350 €, ein **Rückzugsort** 500 €. Tierpfleger kosten 90 € pro Tag, laufen von einer erreichbaren Pflegestation über die Wege zum Gehege und versorgen dort die Tiere für 8 € je Tier. Ohne erreichbare Station oder ausreichendes Budget bleibt Pflege aus. Eine bezahlte Sofortversorgung ist am angeschlossenen Gehege möglich. Tierhaltungskosten fallen auch bei geschlossenem, bewohntem Gehege an. Schlechtes Tierwohl mindert die Besucherzufriedenheit und erscheint in der Parkanalyse. Tiere lassen sich ohne Erstattung an einen Partnerzoo abgeben; bewohnte Gehege sind vor Abriss und Bau-Undo geschützt.

**Tiere in 3D beobachten** öffnet eine frei drehbare, verschiebbare und zoombare Ansicht des tatsächlichen Geheges mit allen aufgenommenen Tieren und Verbesserungen. Die Tiere bewegen sich in 2D und 3D entlang derselben Wege innerhalb des Zauns. Über **Tier ansehen** springt die Kamera zur Nahansicht eines namentlich ausgewählten Tiers. Artspezifische, prozedural erzeugte Tierstimmen erklingen in Abständen, mit Entfernung und Stereoposition passend zur Kamera. **Sound einschalten** aktiviert den vorhandenen Ton; **Tierlaut anhören** spielt einen Ruf gezielt ab. Master- und Effektlautstärke gelten auch hier. Pause, Stummschaltung, verborgene Browserseiten und das Schließen der Ansicht stoppen die Stimmen. Es handelt sich um stilisierte Spielklänge, nicht um Naturaufnahmen. Die Beobachtung ist pausierbar; währenddessen pausiert der Park. Es gibt derzeit feste Gehegegrößen, keine Tierzucht oder frei gezeichneten Zäune.

Fahrgeschäfte besitzen jetzt einen **Zustand**: Nutzung verursacht Verschleiß, stark beschädigte Attraktionen schließen. **Reparieren** in der Attraktionsverwaltung bezahlt die Instandsetzung; anschließend wieder öffnen. Die Parkanalyse weist auf reparaturbedürftige Attraktionen und unzureichend versorgte Tiere hin.

## Neue Parkwerkzeuge

Das **Parkmenü** unten öffnet einen Halbkreis mit Icons und Tooltips für alle Werkzeuge, Besucher, Gelände, Forschung, Werkstatt, Verwaltung, Sound, Speichern und Hilfe. Nach der Auswahl klappt es ein. **Forschung** bleibt zusätzlich als beschrifteter Schnellzugriff sichtbar. Beim Überfahren einer Attraktion erscheinen Name, Art und Betriebsstatus; sichtbare Sprites und Gleise sind direkt auswählbar.

**3D-Mitfahren** funktioniert bei allen Fahrgeschäften und bei verbundenen Parkbahn-/Shuttlelinien. Jeder Sitz besitzt einen Anker am bewegten Fahrzeug; Sitzwechsel, Umsehen und freie Kamera sind möglich. Gesichter, Frisuren, Kleidung, Arme und Beine stammen aus einem gemeinsamen Figurenmodell. Nur tatsächlich belegte Sitze zeigen Gäste. Die unabhängige Probefahrt pausiert den Park; Transportproben behalten daher die Belegung vom Start der Vorschau bei.

Die **Werkstatt** wird durch Forschung freigeschaltet: fünf Fahrmechaniken, vier Motive, Farbe, Höhe, Tempo und 4–16 Plätze ergeben eigene Attraktionen mit abgeleiteten Baukosten und Fahrwerten. Eigene PNG-/WebP-Motive lassen sich importieren, Entwürfe lokal speichern und als JSON teilen. Die 3D-Vorschau zeigt die gewählte Mechanik. Motive dekorieren das Modell; sie verändern keine Fahrzeuggeometrie. Die Bibliothek bleibt beim Parkwechsel erhalten.

Für eine **Parkbahn oder einen Shuttle** zwei Haltestellen am verbundenen Parkweg bauen und in der Haltestellenverwaltung verbinden. Fahrzeuge halten vier Sekunden an beiden Enden. Gäste nutzen die Linie, wenn sie schneller als der Fußweg zum eigentlichen Ziel ist. Kapazitäten und Warteschlangen sind real; der Fahrpreis wird einmal beim Aussteigen fällig. Eine Parkbahn hat eine Lok mit drei vierplätzigen Wagen, ein Shuttle acht Plätze. Nach Wegänderungen lässt sich die Route neu verbinden. Derzeit ist jede Linie eine Verbindung zwischen zwei Halten.

## Wagen, Fahrspaß und Parkbetrieb

**Wagen & Farben** in der Achterbahnverwaltung bietet Klassik, Grubenlore und Sportrakete unabhängig vom Bahntyp. Karosserie, Akzente und Sitze lassen sich frei färben; auf Wunsch wechseln die Wagen ihre Lackierung ab. Vorschau, Parkansicht und 3D verwenden dasselbe Design. Die kostenlose Änderung ist rückgängig machbar und verändert keine Sitzkapazitäten oder Fahrwerte. Die Sportrakete hat zwei Sitze hintereinander.

**Fahrt spannender machen:** Markiere einen Bereich im Gleisplan oder auf der Strecke. Der Assistent sucht für Fahrspaß, G-Kraft, Airtime oder Komfort passende Änderungen und vergleicht ihre Wirkung auf die gesamte Fahrt. Neue Fertigprofile sind Airtime-Hügel, Bunny Hops, zwei Helices und Doppellooping; auch Beschleuniger und Bremsen lassen sich vorschlagen. Die kostenlose Vorschau zeigt Anschluss, Kosten, G-Werte und Komfort. Erst **Fahrprofil übernehmen** baut; ein Rückgängig stellt die Bahn wieder her. Die begrenzte Suche kann ohne geeigneten Vorschlag enden. Mehr G-Kraft wird nicht automatisch als mehr Spaß gewertet.

Die **3D-Achterbahnmitfahrt** misst vertikale, seitliche und längs wirkende Lasten in g, die Gesamtlast und den Spitzenwert der aktuellen Fahrt. Das Profil zeigt die vertikale Belastung über die Strecke. Berechnet wird aus der tatsächlich gebauten Geometrie und dem gemeinsamen Geschwindigkeitsmodell; im Stand werden 1 g angezeigt, bei Pause bleiben die Werte eingefroren. Es handelt sich um ein Spielmodell. Kurze prozedurale Jubel- und Schreireaktionen begleiten Abfahrten, Airtime und starke Belastungen. Sie folgen der Effektlautstärke und stoppen bei Pause, Stummschaltung oder verborgener Seite.

Unter **Versorgung / Natur → Mülleimer** stehen Behälter für 65 € bereit. Nach Essen und Trinken tragen Gäste Verpackungen zunächst weiter und werfen sie in erreichbare benachbarte Eimer. Ohne freien Eimer entsteht Müll auf dem Weg. **Reinigungskräfte** in der Parkverwaltung laufen zu erreichbaren Müllstellen und leeren volle Eimer; jede kostet 80 € je Spieltag. Dreck senkt örtlich die Laune und die Parkbewertung. Lange Wartezeiten und unpassende Fahrten wirken ebenfalls auf die Gästezufriedenheit, Aufenthaltsdauer und Einnahmen. Smileys zeigen gute, mittlere und schlechte Laune kurz und abwechselnd bei etwa jedem fünften Gast. Sie blenden sanft ein und aus; Pause und Spieltempo gelten auch für die Anzeige.

**Parkanalyse & Sauberkeit** ist direkt auf der Zielkarte und im Parkmenü erreichbar. Dort stehen Sauberkeit, Müllmenge, volle Eimer und Gäste mit schlechter Laune. Nummerierte Markierungen zeigen konkrete Problemstellen im Park: Dreck, lange Warteschlangen, niedriger Fahrspaß oder übermäßig intensive Bahnen. **Im Park zeigen** fokussiert die Stelle; passende Aktionen führen zu Personal, Mülleimern oder dem Fahrassistenten. Die Smileys lassen sich hier ausblenden.

**Werbung & Kampagnen** im Parkmenü beziehungsweise **Parkverwaltung → Werbung** bietet Flyer (90 €/Spieltag), Parkwerbung (180 €) und Attraktionswerbung (120 €). Laufzeiten betragen ein bis drei Spieltage; Kosten werden einmalig beim Start bezahlt. Höchstens zwei Kampagnen und eine je Werbeform laufen gleichzeitig. Die Spielpause hält auch ihre Laufzeit an. Parkwerbung steigert Nachfrage und Ankunftsrate; Attraktionswerbung erhöht bei zugeordneten Gästen das Interesse am ausgewählten Fahrgeschäft. Preise, Erreichbarkeit und Wartezeiten bleiben entscheidend. Laufende Kampagnen lassen sich ohne Erstattung beenden. Berichte zählen zugeordnete Besucher, deren tatsächlich gezahlten Eintritt, Fahrten und Einkäufe sowie Kosten pro Besucher. Der ausgewiesene Umsatz ist kein Nachweis zusätzlichen Gewinns.

## So baust du

**Mehrere Gleisteile entfernen:** Eine Bahn auswählen und **Gleise ersetzen / entfernen** öffnen. Im Gleisplan oder direkt auf der Schiene schaltet jeder Klick die Markierung um. Über die Bahn ziehen markiert mehrere Teile; **Umschalt + Klick** ergänzt einen Bereich. **Verbindungen vorschauen** zeigt neue Anschlüsse in Türkis und den Gesamtpreis. **Entfernen & Lücken verbinden** übernimmt alle ausgewählten Bereiche zusammen. Unmarkierte Gleise bleiben erhalten; bei Konflikten bleibt die ganze Bahn unverändert. **Rückgängig** stellt den gesamten Umbau wieder her. Einen zusammenhängenden Bereich kannst du stattdessen über **Auswahl durch Fertigteile ersetzen** mit Loopings und anderen Bauteilen umbauen.

**Beschleuniger und Bremsen bearbeiten:** In der Attraktionsverwaltung zeigt **Montierte Module** jedes zusammenhängende Modul mit Zieltempo, Stärke und Länge. **Bearbeiten** wählt das vollständige Modul; Tempo und Stärke lassen sich kostenlos anpassen. **Entfernen** nimmt nur dieses Modul ab und erstattet 40 % des Materialpreises. Zum Montieren neuer Module **Beschleuniger & Bremsen** öffnen und einen Bereich auswählen. Nach jeder Änderung die Bahn erneut testen.

Wähle unten ein Werkzeug. Die grüne/rote Vorschau zeigt, ob das Bauwerk passt, und nennt den Gesamtpreis. **Deko freiräumen** entfernt störende Bäume oder Blumen für 10 € pro Objekt. Bestehende Gebäude werden dabei nicht entfernt. Nach dem Platzieren öffnet sich direkt die Verwaltung; **Anschließen & öffnen** baut einen passenden Weg oder eine Warteschlange zum bestehenden Wegenetz. Ein mit dem Parkeingang verbundener Parkweg direkt vor dem Eingangspod genügt: Er bietet vier Warteplätze. Eine eigene Warteschlange wird bevorzugt und kann mehr Gäste aufnehmen. Der Anschlussplaner nutzt vorhandene Wege, füllt Lücken und sucht Verbindungen mit bis zu 30 neuen Feldern. Vorhandene Wege werden nicht umgefärbt.

Eine Achterbahn kannst du im **Schnellbau** vollständig platzieren und mit **R** drehen. Ihre Testfahrt startet automatisch; nach dem Anschluss eröffnet sie sich, sobald der Test abgeschlossen ist. Unter **Fertigteile** setzt du eine Station und wählst Geraden, Steigungen, Abfahrten, Kurven oder Loopings. Die grüne/rote Vorschau zeigt das nächste Teil, bevor du **Anfügen** drückst oder auf die Karte klickst. Jedes Teil passt seine Richtung und Höhe automatisch an den letzten Anschluss an. **Zur Station verbinden** sucht einen freien, geschlossenen Rückweg; **Letztes Bauteil entfernen** und Strg/⌘ Z entfernen jeweils einen vollständigen Bauschritt. Holzbahnen bleiben ohne Inversionen und sind auf 20 m begrenzt, Stahl-/Launch-Bahnen auf 40 m. **3D-Mitfahren** im Bahnfenster öffnet eine unabhängige Probefahrt.

**Einzelne Gleise ersetzen oder entfernen:** Bahn auswählen → **Gleise ersetzen / entfernen**, oder mit dem Abrisswerkzeug direkt auf die Schiene klicken. Der Gleisplan zeigt den markierten Bereich; die gesamte Bahn bleibt stehen. Schiene anklicken (Shift erweitert den Bereich) oder Von/Bis auswählen. Bei einem zusammenhängenden Bereich **Auswahl durch Fertigteile ersetzen** anklicken; danach neue Bauteile oder einen Looping anfügen und **Offene Enden verbinden**. Die Suche berücksichtigt erhaltene Gleise, Richtung, Höhe, Hindernisse und den verfügbaren Platz. Bei einem zu engen Schnitt unter **Lücke vergrößern** weitere angrenzende Gleise entfernen. **Platz für … schaffen** schlägt einen geprüften größeren Schnitt vor. Über **Anderen Gleisbereich auswählen** lässt sich die Auswahl neu beginnen. Der Katalog zeigt 14 bebilderte Fertigteile: kurze Gerade (1 Feld), Gerade (2 Felder), Steigung, Abfahrt, Links-/Rechtskurve, Looping, Hügel, S-Kurve, Airtime-Hügel, Bunny Hops, Links-/Rechtshelix und Doppellooping. Passgenau eingesetzte Teile docken sofort an die erhaltene Strecke an. Türkis markiert den erhaltenen Anschluss. Auch bei alten Bahnen bleiben die übrigen Rundungen erhalten. **Umbau übernehmen** berechnet nur Ersatzmaterial abzüglich Recycling; danach erneut testen und eröffnen. Unfertige Baustellen werden gespeichert und bleiben geschlossen. **Umbau abbrechen** stellt die ursprüngliche Strecke wieder her. Strg/⌘ Z nimmt zuerst neue Fertigteile zurück und anschließend den Schnitt; Bauteil-Undo speichert auch die Einstellungen an den Anschlussenden.

**Konflikte automatisch lösen:** Wähle beim Umbauen ein Fertigteil und **Konflikt automatisch lösen** beziehungsweise **… automatisch einpassen**. Das Spiel sucht eine vollständig verbundene Strecke, prüft größere Schnitte und kurze Zufahrten um Hindernisse. Bereits von dir ergänzte Teile bleiben erhalten. Die kostenlose Vorschau markiert ersetzte Gleise rot und den neuen Verlauf türkis, auch im 3D-Bauinspektor. Sie zeigt zusätzliche Abschnitte und den Gesamtpreis. Erst **Lösung übernehmen** baut den Vorschlag; ein **Rückgängig** stellt die ursprüngliche Bahn wieder her. Wasser, Wege und Gebäude werden nicht automatisch abgerissen. Wenn die begrenzte Suche keinen passenden Verlauf findet, bleibt dein Entwurf erhalten.

**Beschleuniger und Bremsen:** In der Bahnverwaltung **Beschleuniger & Bremsen** öffnen, einen oder mehrere Gleisabschnitte auswählen und Zieltempo (km/h) sowie Stärke (m/s²) einstellen. Montage und Entfernung betreffen nur diesen Bereich. Türkise Motorleisten beschleunigen, orange Bremsleisten verlangsamen; kurze Abschnitte können das Zieltempo unter Umständen nicht erreichen. Typgrenzen und die Stationsbremse bleiben wirksam. Änderungen derselben Modulart kosten nichts, beim Entfernen gibt es 40 % des Materialwerts zurück. Fahrprofil, Testzeit, Statistik, 2D und 3D verwenden dieselbe Berechnung. Nach Änderungen neu testen. Module bleiben beim Versetzen, Drehen und Speichern erhalten.

Im Baukasten folgt die Kamera dem nächsten Anschluss; **Anschluss folgen** lässt sich abschalten. **F** fokussiert ihn erneut. Der **3D-Bauinspektor** erlaubt freies Drehen, Verschieben und Zoomen, damit Höhenkonflikte erkennbar werden. Bei Kollisionen werden tatsächlich geprüfte Alternativen angeboten.

Zum Umbau eine bestehende Achterbahn auswählen: **Station versetzen** markiert geeignete gerade Abschnitte am Boden. Die Gleisform bleibt dabei unverändert. **Bahn verschieben / drehen** bewegt die gesamte Anlage; **R** dreht sie um die Station. Mausbewegung zeigt die Vorschau und mögliche Anschlusskosten. Klicke auf die Karte oder **Position übernehmen**, um den Umbau abzuschließen. **Abbrechen** und **Esc** verwerfen die Vorschau. Bei fehlendem Zugang kann das Spiel einen besseren Stationsplatz vorschlagen.

Versetzen ist kostenlos; nur geräumte Dekoration kostet 10 € pro Objekt. Bestehende Wege bleiben an ihrem bisherigen Ort. Beim Übernehmen wird die betroffene Attraktion geschlossen und entladen; anschließend den neuen Zugang prüfen und wieder öffnen. Eine laufende Testfahrt wird abgebrochen und kann neu gestartet werden. Bereits abgeschlossene Tests bleiben gültig. Bei Stationsversatz werden Tempo und Fahrwerte neu berechnet, da Anfahren und Bremsen an anderen Stellen stattfinden.

**Besucherströme:** Im Menü **Wege** gibt es beige Parkwege (12 €), blaue Eingangswege/Warteschlangen (18 €) und rote Ausgangswege (18 € pro Feld). Blau verbindet den Parkweg mit dem Eingang; Rot verbindet das Feld vor dem roten Ausgangspod mit dem beigen Parkweg. Die blauen und roten Pod-Häuschen sitzen am Rand der Attraktion beziehungsweise Station und sind unter **Ein- & Ausgangspods → Pod versetzen** separat platzierbar. Ein Klick auf das Häuschen öffnet ebenfalls die Platzierung. Nur das Feld direkt vor dem jeweiligen Pod zählt als Anschluss. Positionen bleiben beim Speichern erhalten und drehen sich beim Versetzen der gesamten Attraktion mit. Gäste nutzen Rot nur nach dem Aussteigen, niemals als Abkürzung hinein. Weiße Pfeile in 2D und 3D zeigen den kürzesten Ausgang zum Parkweg; Kreuzmarkierungen in 2D zeigen fehlende Anschlüsse. Die Attraktionsverwaltung meldet den Anschlussstatus. Unfertige oder fehlende Ausgänge verwenden weiterhin den bisherigen Zugang, sodass alte Parks spielbar bleiben. Auch aussteigende Parkbahn-/Shuttle-Fahrgäste nutzen fertige rote Wege; Fahrzeuge bleiben auf normalen Parkwegen.

Wege, Warteschlangen, Ausgangswege, Wasser und Abriss lassen sich ziehen. **Rückgängig** nimmt einen ganzen Bauzug zurück, während Besucher und Simulationszeit weiterlaufen. Die allgemeine Bauhistorie gilt für die aktuelle Sitzung und wird beim Laden oder Neubeginn geleert. Ein noch nicht gebauter Achterbahnentwurf einschließlich seiner Bauteil-Historie wird dagegen mitgespeichert; **Verwerfen** löscht ihn bewusst. Einzelne Attraktionen wechseln nach dem Bauen direkt in die Verwaltung; **Shift** hält das Werkzeug für mehrere Platzierungen aktiv.

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

React, TypeScript, Canvas 2D, Three.js und Web Audio mit Vite. Der 3D-Code wird erst beim Öffnen der Mitfahrt geladen. GitHub Pages liefert nur statische Dateien aus; kein Backend und keine Zugangsdaten werden für das Spiel benötigt. Spielstände liegen im Browser (`coaster-grove-v1`) und werden nicht zwischen Geräten synchronisiert.

## Veröffentlichung

Pushes auf `main` starten `.github/workflows/pages.yml`: Installation, Simulationstests, Assetprüfung, TypeScript-Prüfung, Vite-Build und Veröffentlichung auf GitHub Pages. Im Repository ist Pages auf **GitHub Actions** eingestellt. Der Vite-Basispfad ist `/rollercoaster/`.

## Grafik und Umfang

Die Spielsprites stammen ausschließlich aus dem OpenArt-Projekt des Nutzers. Die aktive Grafik wurde über den **OpenArt MCP** als einheitlicher Pixel-Art-Satz neu erzeugt, mit festen Größen, Ankerpunkten, Richtungsansichten und beweglichen Fahrgeschäftsteilen. Quellen, Prompts und Verarbeitung stehen in [ASSETS.md](ASSETS.md). Es werden keine Originalgrafiken oder Spieldateien von RollerCoaster Tycoon verwendet.

Dies ist eine kompakte Browser-Parksimulation. Fahrphysik und Wirtschaft sind vereinfachte Spielmodelle; sie enthalten beispielsweise keine Gelände-Höhenbearbeitung oder Mehrspielerfunktion.

## Audio-Prüfung im Browser

Im laufenden Vite-Entwicklungsserver `/rollercoaster/scripts/audio-check.html` öffnen und **Audio prüfen** anklicken. Der native OfflineAudioContext prüft hörbare, endliche Samples, Headroom und voneinander unabhängige Musik-/Effektkanäle sowie exakte Stille bei Master 0. Diese Prüfseite gehört nicht zum Produktionsbuild.

Für die Zoo-Tierstimmen prüft `/rollercoaster/scripts/zoo-audio-check.html` im lokalen Entwicklungsserver die vier Rufe im nativen OfflineAudioContext, Stereokanäle und Stille bei Pause, ausgeblendeter Seite, geschlossenem Fenster sowie deaktiviertem Ton.

## Besucher, Analyse und entspannter Parkbetrieb

- **Verwalten → Heatmap** zeigt aktuellen Andrang, wartende Gäste, Stimmung und Müll. Bereiche anklicken, um Gästezahlen und Ursachen zu sehen. Die Angebotsliste unterscheidet aktuelle Ziele, Besuche seit dem Bau und modellierte Anziehung.
- **Gehege auswählen → Beobachtungspunkt platzieren** bündelt Zuschauer auf bis zu drei normalen Wegfeldern außerhalb des Zauns. Das Gehege muss geöffnet und der Punkt mit dem Parkeingang verbunden sein. Ohne festen Punkt bleiben alle erreichbaren Zaunwege nutzbar.
- **Verwalten → Personal** zeigt Personen, Qualifikation, Lohn und Auftrag. Tierpfleger können passenden erreichbaren Gehegen direkt zugeteilt werden; „Automatisch“ hebt die Bindung wieder auf.
- Familien, Paare, Freundesgruppen und Einzelgäste reisen abhängig vom geöffneten Angebot an. Kinder haben eigene Proportionen, auch in 3D. Bestehende Gäste behalten ihre Identität; neue Gruppen entstehen bei neuen Anreisen. **Park → Besucher** zeigt Gruppen und ihre Interessen.
- **Verwalten → Parkverwaltung → Parkbetrieb** bietet Entspannt (45 % der bisherigen Löhne/Unterhaltskosten), Normal (65 %) und Anspruchsvoll (100 %). Normal ist auch für alte Spielstände ohne Einstellung der Standard. Der Satz gilt bei der nächsten Tagesabrechnung; Baukosten, Verkaufspreise und Pflegegebühren bleiben gleich.
- **Verwalten → Finanzen & Kredit** bietet bis zu 20.000 € Kredit, in 1.000-€-Schritten, mit freiwilliger Tilgung. 0,25 % der Restschuld werden je Spieltag als Zinsen berechnet: 10.000 € kosten 25 € pro Tag. Auszahlungen erhöhen weder Umsatz noch schuldenbereinigten Parkwert.

Elefanten besitzen einen OpenArt-Gehzyklus mit vier Bildern je Blickrichtung. Die Beinstellungen folgen ihrer zurückgelegten Strecke und bleiben bei Pause stehen. Quellen und reproduzierbare Atlasextraktion: `art/zoo-walk-v10/` und `scripts/extract-elephant-walk.py`.
