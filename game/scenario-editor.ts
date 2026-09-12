import { setCoasterTrainProgram } from "./coaster-trains";
import { newPark, validSave, migratePark, type Park } from "./simulation";
import { resetRideOperations } from "./operations";
import {
  DEFAULT_CUSTOM_SCENARIO,
  validCustomScenario,
  type CustomScenario,
} from "./custom-scenario";

export type ScenarioFile = {
  format: "coaster-grove-scenario";
  version: 1;
  settings: CustomScenario;
  park: Park;
};
export function scenarioTemplate(s?: Park): CustomScenario {
  return structuredClone(
    s?.customScenario ?? {
      ...DEFAULT_CUSTOM_SCENARIO,
      cash: Math.max(0, Math.round(s?.cash ?? DEFAULT_CUSTOM_SCENARIO.cash)),
    },
  );
}
/** Freeze a layout as a new challenge. No visitor, operating or deadline progress leaks into the new game. */
export function createScenarioFile(source: Park, settings: CustomScenario): ScenarioFile {
  if (!validCustomScenario(settings) || !settings)
    throw new Error("Bitte gültige Startbedingungen und Ziele eingeben.");
  if (!validSave(source)) throw new Error("Der Ausgangspark enthält ungültige Daten.");
  const park = structuredClone(source);
  delete park.customScenario;
  delete park.draft;
  delete park.trackEdit;
  park.guests = [];
  park.time = 0;
  park.calendar = { version: 1, offsetSeconds: 0 };
  park.won = false;
  park.arrivals = 0;
  park.income = 0;
  park.expenses = 0;
  park.dayIncome = 0;
  park.dayExpenses = 0;
  park.operatingIncomeToday = 0;
  park.operatingExpensesToday = 0;
  park.operatingProfit = 0;
  park.lastProfit = 0;
  delete park.financeLedger;
  delete park.marketing;
  delete park.loan;
  delete park.maintenance;
  if (park.research)
    park.research = { completed: [...park.research.completed], active: null, remaining: 0 };
  for (const b of park.buildings) {
    delete b.maintenance;
    delete b.retail;
  }
  park.spawnClock = 0;
  park.mode = "scenario";
  park.unlimitedBudget = false;
  park.cash = settings.cash;
  park.speed = 1;
  park.open = true;
  // A new challenge keeps the built layout, crews, research and physical condition.
  // Complete pending transfers instead of importing ghost guests or a half-completed circuit.
  for (const b of park.buildings) {
    b.queue = [];
    b.riders = [];
    b.cycle = 0;
    b.served = 0;
    b.revenue = 0;
    b.testing = undefined;
    b.testDuration = undefined;
    b.wheel = undefined;
    if (b.trainFleet) {
      const program = { ...b.trainFleet.program };
      delete b.trainFleet;
      setCoasterTrainProgram(b, program);
    }
    resetRideOperations(b);
  }
  for (const line of park.transitLines ?? []) {
    line.passengers = [];
  }
  park.customScenario = structuredClone(settings);
  migratePark(park);
  if (!validSave(park))
    throw new Error(
      "Dieser Park lässt sich noch nicht als Startkarte verwenden. Beende laufende Umbauten und probiere es erneut.",
    );
  return {
    format: "coaster-grove-scenario",
    version: 1,
    settings: structuredClone(settings),
    park,
  };
}
export function blankScenarioPark(): Park {
  const park = newPark("sandbox");
  park.buildings = [];
  park.guests = [];
  park.tiles = park.tiles.map((row) => row.map(() => "grass"));
  for (let y = 22; y < park.tiles.length; y++) park.tiles[y][15] = "path";
  park.transitLines = [];
  park.crewPool = undefined;
  park.cleanliness = undefined;
  park.zoo = undefined;
  park.scenery = [];
  park.arrivals = 0;
  park.time = 0;
  park.cash = 20000;
  park.unlimitedBudget = true;
  park.nextId = 1;
  park.research = undefined;
  return migratePark(park);
}
export function parseScenarioFile(raw: string): ScenarioFile {
  if (raw.length > 12_000_000) throw new Error("Die Szenariodatei ist zu groß (maximal 12 MB).");
  let value: ScenarioFile;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON-Szenario.");
  }
  if (
    !value ||
    value.format !== "coaster-grove-scenario" ||
    value.version !== 1 ||
    !value.settings ||
    !validCustomScenario(value.settings) ||
    !validSave(value.park)
  )
    throw new Error("Die Datei enthält kein gültiges Coaster-Grove-Szenario.");
  return createScenarioFile(value.park, value.settings);
}
export function startCustomScenario(file: ScenarioFile): Park {
  return createScenarioFile(file.park, file.settings).park;
}
export const exportScenarioFile = (file: ScenarioFile) => JSON.stringify(file, null, 2);
