# Artspezifische Zoo-Ausstattung: Primärquellen und Spielübersetzung

Stand: 9. September 2026. Die folgenden Bauteile und Spielregeln sind Designvorschläge, abgeleitet aus den angegebenen Primärquellen; keine realen Gehegedimensionen oder technischen Zaunspezifikationen werden simuliert.

| Art | Beobachtung aus Primärquelle | Konkrete Spielausstattung |
| --- | --- | --- |
| Zebra | San Diego Zoo beschreibt Gras-/Heufutter und soziale Familiengruppen bei Steppen-/Bergzebras; Grevy-Zebras haben andere Sozialstrukturen. | Heuraufe, freie Weidefläche, schattiger Stall. Als Spielart Steppenzebra festlegen, bevor ein Gruppenbedarf eingeführt wird. |
| Giraffe | AZA 2025 empfiehlt regelmäßiges Laubfutter auf unterschiedlichen Höhen, Schatten, geeigneten Stall und trockenen rutschfesten Boden. | Hohe Laubstation, hoher Wetterschutz, trockene Savannenfläche. |
| Flamingo | WWT beschreibt Kolonien, Teiche, feuchten Sand/Schlamm für Nesthügel und saisonale Wasserstandspflege. | Flachwasserteich, Nistinsel, geschützter Gruppen-Rückzug. |
| Pinguin | AZA beschreibt Wasseraufbereitung und Kolonien; Brutplätze und Temperaturbedarf hängen von der Pinguinart ab. | Gefiltertes Schwimmbecken, trockene Ruhe-/Brutplätze, artspezifischer Klimaschutz. Kein pauschales Eis-Upgrade. |
| Elefant | EAZA empfiehlt freie Wahl von Baden, Schlamm-/Staubbädern, Scheuermöglichkeiten und Rückzug; geschützter Pflegerkontakt und stabile Barrieren sind wichtig. | Bade-/Schlammbereich, Scheuerstamm/Futteraufgabe, Sandboden, großer Rückzug; geschützte Pflegeschleuse. |
| Löwe/Löwin | Smithsonian beschreibt Außenbereiche, Innenboxen, soziale Gruppen und Beschäftigung mit Bällen/Objekten. | Schattige Rückzugsboxen, Aussichts-/Ruheplatz, Futter- und Geruchsbeschäftigung; verstärkte Grundbegrenzung und Schleuse als Spiel-Sicherheitsmodell. |
| Großer Panda | Smithsonian beschreibt Bambusversorgung, Kletterstrukturen und Kühlung; Große Pandas sind grundsätzlich Einzelgänger. | Bambusstation, Kletterbaum, kühler Rückzug und voneinander trennbare Bereiche. Kein pauschaler Gruppenbonus. |

Quellen: [Zebra – San Diego Zoo](https://animals.sandiegozoo.org/animals/zebra); [AZA Giraffe Care Manual 2025](https://assets.speakcdn.com/assets/2332/aza_giraffe_care_manual.pdf), S. 12–20, 42–43; [WWT: feuchter Sand und Nistinsel](https://www.wwt.org.uk/wetland-centres/slimbridge/flamingo-diary/hot-enough-to-make-an-andean-flamingo); [WWT: Tierpfleger und Wasserpflege](https://www.wwt.org.uk/wetland-centres/slimbridge/flamingo-diary/a-day-in-the-life-of-a-wwt-flamingo-keeper); [AZA Penguin Care Manual 2014](https://www.aza.org/assets/2332/penguin_care_manual_aza_final_2014.pdf), S. 8 und 55–57; [EAZA Elephant Guidelines 2020](https://strapi.eaza.net/uploads/Elephant_TAG_BPG_2020_6956205c9a.pdf), S. 32–35, 73–74; [Löwen – Smithsonian](https://nationalzoo.si.edu/animals/lion); [Großer Panda – Smithsonian FAQ](https://www.nationalzoo.si.edu/animals/giant-panda-faqs); [Bambusversorgung – Smithsonian](https://www.nationalzoo.si.edu/animals/news/keep-national-zoos-pandas-satisfied-staff-prepare-endless-supply-bamboo).

## Absicherung

EAZA nennt dünne Elektrolitzen bei Elefanten ausdrücklich als sekundäre Barriere, nicht als alleinige Umzäunung. Die AZA-Giraffenrichtlinie führt elektrische Begrenzungen als eine von mehreren möglichen Konstruktionen auf. Die sichere Spielvereinfachung lautet daher: Elektro-Zusatz nur bei ausgewählten Säugern (Zebra/Giraffe/Elefant), zusätzlich zu einer artgeeigneten, intakten Grundbarriere. Keine pauschale Verbesserung für alle Arten und kein Ersatz für Rückzug, Fachpersonal oder Wartung. Diese Auswahl ist eine Designentscheidung, keine aus einer Quelle übernommene universelle Artenliste. [EAZA Elefant S. 32–33](https://strapi.eaza.net/uploads/Elephant_TAG_BPG_2020_6956205c9a.pdf), [AZA Giraffe S. 20](https://assets.speakcdn.com/assets/2332/aza_giraffe_care_manual.pdf).

## UI-Leitlinien

- Artspezifischen Bedarf und fehlenden nächsten Schritt unmittelbar unter der Tierwohl-Zahl zeigen.
- Versorgung (laufender Zustand), Ausstattung (gekauft), Fachpersonal (angestellt/qualifiziert) und Absicherung (Zustand) getrennt darstellen.
- Anschaffungspreis und laufende Löhne vor dem Klick sichtbar; fehlendes Budget als Text, nicht nur deaktivierter Button.
- Fachpersonal ergänzt Basispflege. Der gleiche Bedarf darf in Übersicht und Gehegedetail nicht widersprüchlich sein; beide lesen die Backend-Helper.
- Löwe/Löwin explizit benennen; Geschlecht nicht aus Tiernamen raten. Solange keine individuelle Geschlechtsinformation gespeichert wird, Gruppentext verwenden.
- Alte generische enrichment/shelter-Käufe durch habitatHasFeature lesen, damit Migration und UI denselben Bestand anzeigen.
