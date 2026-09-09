import type { Species } from "./zoo";

export type CareGroup = "savanna" | "carnivore" | "birds" | "specialist";
export type SpecialistRole = CareGroup | "technical";
export type HabitatFeatureId =
  | "foraging"
  | "rubbing"
  | "pool"
  | "rocks"
  | "shelter"
  | "climbing"
  | "nesting"
  | "planting";
export type HabitatFeature = {
  id: HabitatFeatureId;
  label: string;
  description: string;
  cost: number;
  category: "enrichment" | "shelter" | "terrain";
};
export const SPECIALIST_ROLES: Record<SpecialistRole, { label: string; description: string }> = {
  savanna: {
    label: "Savannenpflege",
    description: "Futter in passender Höhe, Hufkontrolle und Pflege für Zebras und Giraffen.",
  },
  carnivore: {
    label: "Raubtierpflege",
    description: "Löwen und Löwinnen über gesicherte Schleusen versorgen. Kein direkter Kontakt.",
  },
  birds: {
    label: "Vogelpflege",
    description: "Wasserqualität, Nistplätze und Pflege für Flamingos und Pinguine.",
  },
  specialist: {
    label: "Spezialtierpflege",
    description: "Elefanten im geschützten Kontakt betreuen und Pandas mit Bambus versorgen.",
  },
  technical: {
    label: "Zaun- & Anlagentechnik",
    description: "Barrieren, Schleusen und Elektro-Zusatzsicherung vor Ort prüfen und warten.",
  },
};
const feature = (
  id: HabitatFeatureId,
  label: string,
  description: string,
  cost: number,
  category: HabitatFeature["category"],
): HabitatFeature => ({ id, label, description, cost, category });
export const HABITAT_PROFILES: Record<
  Species,
  {
    biome: string;
    careGroup: CareGroup;
    careLabel: string;
    specialistRequired: boolean;
    barrier: "wood" | "reinforced" | "glass";
    barrierLabel: string;
    electric: boolean;
    social: string;
    features: HabitatFeature[];
  }
> = {
  lion: {
    biome: "Savanne · Felsen & Rückzug",
    careGroup: "carnivore",
    careLabel: "Raubtierpflege",
    specialistRequired: true,
    barrier: "glass",
    barrierLabel: "Hohe Sicherheitsverglasung, Rückwand & Schleuse",
    electric: false,
    social: "Ein Löwe und bis zu drei Löwinnen. Ruhebereiche geben jedem Tier Abstand.",
    features: [
      feature(
        "foraging",
        "Duftspur & Futterball",
        "Wechselnde Gerüche und verstecktes Futter regen Suchen und Erkunden an.",
        350,
        "enrichment",
      ),
      feature(
        "rocks",
        "Aussichts- & Sonnenfelsen",
        "Erhöhte Felsen bieten Überblick und warme Liegeplätze.",
        650,
        "terrain",
      ),
      feature(
        "shelter",
        "Geschützte Felshöhle",
        "Schattiger, sichtgeschützter Rückzug mit getrennten Ruheboxen.",
        500,
        "shelter",
      ),
      feature(
        "rubbing",
        "Kratz- & Reibestämme",
        "Robuste Baumstämme zum Kratzen, Reiben und Markieren.",
        280,
        "enrichment",
      ),
      feature(
        "planting",
        "Sichtschutzinseln",
        "Dichte Büsche schaffen Abstand zum Publikum und weitere Ruheplätze.",
        320,
        "shelter",
      ),
    ],
  },
  elephant: {
    biome: "Savanne · Wasser & weicher Boden",
    careGroup: "specialist",
    careLabel: "Spezialtierpflege",
    specialistRequired: true,
    barrier: "reinforced",
    barrierLabel: "Massive Barriere & geschützter Pflegerkontakt",
    electric: true,
    social: "Sozial lebende Tiere mit Platz zum Ausweichen und mehreren Futterstellen.",
    features: [
      feature(
        "foraging",
        "Hängende Futterkörbe",
        "Verteiltes Futter beschäftigt Rüssel und Kopf statt einer einzigen Futterstelle.",
        350,
        "enrichment",
      ),
      feature(
        "pool",
        "Bade- & Schlammbecken",
        "Wasser und Schlamm für Baden, Hautpflege und Abkühlung.",
        800,
        "terrain",
      ),
      feature(
        "rubbing",
        "Scheuerbäume & Sandbad",
        "Stabile Reibestämme und weicher Sand zur Körperpflege.",
        480,
        "enrichment",
      ),
      feature(
        "shelter",
        "Großes Schattenhaus",
        "Geräumiger, geschützter Rückzug auf weichem Boden.",
        500,
        "shelter",
      ),
    ],
  },
  panda: {
    biome: "Bambuswald · Klettern & kühle Ruhe",
    careGroup: "specialist",
    careLabel: "Spezialtierpflege",
    specialistRequired: true,
    barrier: "glass",
    barrierLabel: "Klettersichere Begrenzung & getrennte Ruhebereiche",
    electric: false,
    social: "Große Pandas brauchen Abstand: getrennte Ruheplätze statt eines Gruppenbonus.",
    features: [
      feature(
        "foraging",
        "Bambus- & Suchfütterung",
        "Mehrere Bambusangebote und Futterrätsel fördern natürliches Suchen.",
        350,
        "enrichment",
      ),
      feature(
        "climbing",
        "Kletterstämme & Plattform",
        "Stabile Stämme mit erhöhten Sitz- und Ruheflächen.",
        620,
        "enrichment",
      ),
      feature(
        "shelter",
        "Kühle Rückzugsboxen",
        "Beschattete, getrennte Ruhebereiche für jedes Tier.",
        500,
        "shelter",
      ),
      feature(
        "planting",
        "Dichter Bambussichtschutz",
        "Bambusinseln schaffen Abstand und schattige Bereiche.",
        340,
        "terrain",
      ),
    ],
  },
  zebra: {
    biome: "Savanne · Grasen & Schatten",
    careGroup: "savanna",
    careLabel: "Savannenpflege",
    specialistRequired: false,
    barrier: "wood",
    barrierLabel: "Stabile Weidebegrenzung & Servicetor",
    electric: true,
    social: "Zebras leben in Gruppen. Freie Laufwege und Ausweichraum bleiben erhalten.",
    features: [
      feature(
        "foraging",
        "Verteilte Heufütterung",
        "Heu und Gras an mehreren Plätzen verlängern die Futtersuche.",
        350,
        "enrichment",
      ),
      feature(
        "rubbing",
        "Scheuerpfosten & Sandplatz",
        "Reibepfosten und Sand zum Wälzen und zur Fellpflege.",
        300,
        "enrichment",
      ),
      feature(
        "shelter",
        "Offener Weideunterstand",
        "Trockener Schattenplatz mit freiem Zugang für die Gruppe.",
        500,
        "shelter",
      ),
      feature(
        "planting",
        "Schattenbäume",
        "Mehrere geschützte Ruheplätze abseits des Besucherwegs.",
        320,
        "terrain",
      ),
    ],
  },
  giraffe: {
    biome: "Savanne · Hohe Futterstellen",
    careGroup: "savanna",
    careLabel: "Savannenpflege",
    specialistRequired: false,
    barrier: "reinforced",
    barrierLabel: "Hohe verstärkte Begrenzung & Servicetor",
    electric: true,
    social: "Mehrere Futterhöhen und ausreichend hohe Durchgänge für die Gruppe.",
    features: [
      feature(
        "foraging",
        "Hohe Laubkörbe",
        "Laubfütterung in mehreren Höhen für natürliche Zungen- und Halsbewegungen.",
        350,
        "enrichment",
      ),
      feature(
        "rubbing",
        "Hoher Scheuerbaum",
        "Ein stabiler Stamm für Hals- und Fellpflege.",
        400,
        "enrichment",
      ),
      feature(
        "shelter",
        "Hoher Savannenstall",
        "Hoher, geschützter Stall mit trockenen Ruheplätzen und breitem Zugang.",
        500,
        "shelter",
      ),
      feature(
        "planting",
        "Schattige Baumgruppe",
        "Zusätzlicher Sonnenschutz und Abstand zu den Besucherwegen.",
        420,
        "terrain",
      ),
    ],
  },
  flamingo: {
    biome: "Lagune · Flachwasser & Brutinseln",
    careGroup: "birds",
    careLabel: "Vogelpflege",
    specialistRequired: false,
    barrier: "wood",
    barrierLabel: "Lagunenbegrenzung & geschützter Zugang",
    electric: false,
    social: "Kolonievögel: gemeinsam ruhen, im Flachwasser suchen und auf Inseln nisten.",
    features: [
      feature(
        "foraging",
        "Flachwasser-Futtersuche",
        "Feines Futter in flachem Wasser ermöglicht das typische Filtern.",
        350,
        "enrichment",
      ),
      feature(
        "pool",
        "Erweiterte Flachwasserzone",
        "Breite flache Ufer für gemeinsames Waten und Gefiederpflege.",
        450,
        "terrain",
      ),
      feature(
        "nesting",
        "Schlamm- & Sandnistinsel",
        "Eine ungestörte Insel mit Nistmaterial abseits der Besucher.",
        380,
        "shelter",
      ),
      feature(
        "shelter",
        "Schilfgeschützter Rückzug",
        "Ein wind- und sichtgeschützter Ruhebereich für die Kolonie.",
        500,
        "shelter",
      ),
    ],
  },
  penguin: {
    biome: "Küste · Schwimmen & trockene Ruhe",
    careGroup: "birds",
    careLabel: "Vogelpflege",
    specialistRequired: false,
    barrier: "glass",
    barrierLabel: "Beckenverglasung & gesicherter Landbereich",
    electric: false,
    social:
      "Ein Küstengehege mit sauberem Schwimmwasser und trockenen Ruheplätzen, ohne pauschale Eislandschaft.",
    features: [
      feature(
        "foraging",
        "Fisch-Suchfütterung",
        "Verteilte Fischfütterung regt Suchen und Schwimmen an.",
        350,
        "enrichment",
      ),
      feature(
        "pool",
        "Gefiltertes Schwimmbecken",
        "Mehr Schwimmraum und Wasseraufbereitung; Vogelpflege kontrolliert die Qualität.",
        680,
        "terrain",
      ),
      feature(
        "nesting",
        "Felsnischen & Brutplätze",
        "Geschützte, trockene Nischen für Rückzug und Nestmaterial.",
        400,
        "shelter",
      ),
      feature(
        "shelter",
        "Beschattete Küstenhöhle",
        "Trockene Ruheplätze im Schatten mit leichtem Zugang zum Wasser.",
        500,
        "shelter",
      ),
    ],
  },
};
