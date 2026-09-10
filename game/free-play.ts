import { newPark, RESEARCH, type Park, type ResearchId } from "./simulation";
import { PARK_ENTRANCE } from "./grid";

/** A new, independent empty park. Existing sandbox saves keep their finite budget. */
export function createFreePark(): Park {
  const s = newPark("sandbox");
  s.unlimitedBudget = true;
  s.open = false;
  s.tiles = s.tiles.map((row) => row.map(() => "grass"));
  for (let y = PARK_ENTRANCE.y; y >= PARK_ENTRANCE.y - 3; y--) s.tiles[y][PARK_ENTRANCE.x] = "path";
  s.buildings = [];
  s.guests = [];
  s.crewPool = { version: 1, nextId: 1, crews: [] };
  s.staff = 0;
  delete s.zoo;
  delete s.cleanliness;
  delete s.marketing;
  delete s.loan;
  delete s.entrance;
  delete s.pathStyles;
  delete s.trackEdit;
  delete s.draft;
  s.transitLines = [];
  s.landValue = 0;
  s.time = 0;
  s.nextId = 1;
  s.arrivals = 0;
  s.spawnClock = 0;
  s.cash = 0;
  s.income = 0;
  s.expenses = 0;
  s.dayIncome = 0;
  s.dayExpenses = 0;
  s.lastProfit = 0;
  s.operatingIncomeToday = 0;
  s.operatingExpensesToday = 0;
  s.operatingProfit = 0;
  s.rating = 80;
  s.won = false;
  s.research = {
    completed: Object.keys(RESEARCH) as ResearchId[],
    active: null,
    remaining: 0,
    ledger: { coins: 0, year: 0, ratingTotal: 0, elapsed: 0, profit: 0, lastReward: 0 },
  };
  return s;
}
