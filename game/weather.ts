import type { Park } from "./simulation";
import { calendarOf, calendarTime, YEAR_SECONDS } from "./calendar";

export const WEATHER_PHASE_SECONDS = 75;
export const WEATHER_TRANSITION_SECONDS = 8;
export type WeatherKind = "sun" | "cloud" | "rain" | "heat";
export type WeatherPark = Pick<Park, "time"> & Partial<Pick<Park, "mode" | "scenario" | "calendar">>;
export type WeatherSnapshot = {
  kind: WeatherKind;
  label: string;
  description: string;
  temperature: number;
  rain: number;
  cloud: number;
  heat: number;
  wetness: number;
  wind: number;
  light: number;
  skyColor: string;
  fogColor: string;
  season: "spring" | "summer" | "autumn" | "winter";
  phaseStart: number;
  nextChange: number;
};
const definitions = {
  sun: {
    label: "Sonnig",
    description: "Ein freundlicher Parktag. Gäste genießen die Angebote im Freien.",
    rain: 0,
    cloud: 0.1,
    heat: 0,
    wind: 0.14,
    temperature: 2,
    sky: "#b4d9e6",
    fog: "#d4e4d6",
  },
  cloud: {
    label: "Bewölkt",
    description: "Wolken ziehen auf. Es bleibt angenehm für einen Parkbesuch.",
    rain: 0,
    cloud: 0.7,
    heat: 0,
    wind: 0.34,
    temperature: -1,
    sky: "#b8cad1",
    fog: "#d0d9d2",
  },
  rain: {
    label: "Regen",
    description: "Regenschauer ziehen durch. Unterstände bieten eine trockene Pause.",
    rain: 0.8,
    cloud: 1,
    heat: 0,
    wind: 0.52,
    temperature: -3,
    sky: "#8fa9b7",
    fog: "#bdcdd1",
  },
  heat: {
    label: "Heiß",
    description: "Ein warmer Sommertag. Schatten und Trinkwasser tun den Gästen gut.",
    rain: 0,
    cloud: 0.04,
    heat: 1,
    wind: 0.08,
    temperature: 7,
    sky: "#bedfe5",
    fog: "#e5e8cb",
  },
} as const;
const seasonNames = ["spring", "summer", "autumn", "winter"] as const;
const patterns: Record<WeatherSnapshot["season"], WeatherKind[]> = {
  spring: ["sun", "cloud", "rain", "sun"],
  summer: ["sun", "heat", "cloud", "rain"],
  autumn: ["cloud", "rain", "sun", "rain"],
  winter: ["cloud", "sun", "rain", "cloud"],
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function seedOf(park: WeatherPark) {
  const text = park.scenario ?? park.mode ?? "scenario";
  let seed = 17;
  for (let i = 0; i < text.length; i++) seed = (Math.imul(seed, 31) + text.charCodeAt(i)) | 0;
  return seed >>> 0;
}
function colorMix(a: string, b: string, t: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((at) =>
        Math.round(mix(parseInt(a.slice(at, at + 2), 16), parseInt(b.slice(at, at + 2), 16), t))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function phaseConditions(park: WeatherPark, phase: number) {
  const start = Math.max(0, phase) * WEATHER_PHASE_SECONDS,
    year = Math.floor(start / YEAR_SECONDS),
    seasonIndex = Math.floor((start % YEAR_SECONDS) / (YEAR_SECONDS / 4)),
    season = seasonNames[seasonIndex],
    quarterPhase = Math.floor((start % (YEAR_SECONDS / 4)) / WEATHER_PHASE_SECONDS),
    // Start gently in every new park; following years vary without rerolling on load.
    shift = year ? (seedOf(park) + year * 3) % 4 : 0,
    kind = patterns[season][(quarterPhase + shift) % 4],
    definition = definitions[kind],
    variation = ((seedOf(park) + Math.max(0, phase) * 7) % 5) - 2,
    temperature =
      { spring: 17, summer: 26, autumn: 14, winter: 7 }[season] +
      definition.temperature +
      variation * 0.5;
  return { ...definition, kind, season, temperature };
}

/** Pure simulation-time weather. Calendar migration offsets preserve the old
 * park's season; no new random roll or transient state is stored in a save. */
export function parkWeather(park: WeatherPark, time = park.time): WeatherSnapshot {
  const at = Number.isFinite(time) ? Math.max(0, time) : 0,
    calendar = calendarOf(park, at),
    calendarSeconds = Math.max(0, calendarTime(park, at)),
    phase = Math.floor(calendarSeconds / WEATHER_PHASE_SECONDS),
    age = calendarSeconds - phase * WEATHER_PHASE_SECONDS,
    current = phaseConditions(park, phase),
    previous = phaseConditions(park, Math.max(0, phase - 1)),
    blend = smooth(age / WEATHER_TRANSITION_SECONDS),
    rain = mix(previous.rain, current.rain, blend),
    cloud = mix(previous.cloud, current.cloud, blend),
    heat = mix(previous.heat, current.heat, blend),
    phaseStart = at - age;
  return {
    kind: current.kind,
    label: current.label,
    description: current.description,
    temperature: Math.round(mix(previous.temperature, current.temperature, blend)),
    rain,
    cloud,
    heat,
    wetness: Math.max(rain, previous.rain * (1 - smooth(age / 34))),
    wind: mix(previous.wind, current.wind, blend),
    light: 1 - cloud * 0.26 - rain * 0.15,
    skyColor: colorMix(previous.sky, current.sky, blend),
    fogColor: colorMix(previous.fog, current.fog, blend),
    season: calendar.season,
    phaseStart,
    nextChange: phaseStart + WEATHER_PHASE_SECONDS,
  };
}

/** Forecast the next complete weather phases, not a fresh random prediction. */
export function forecastWeather(park: WeatherPark, count = 3): WeatherSnapshot[] {
  const current = parkWeather(park);
  return Array.from({ length: Math.max(0, Math.min(5, Math.floor(count))) }, (_, i) =>
    parkWeather(park, current.nextChange + i * WEATHER_PHASE_SECONDS + WEATHER_TRANSITION_SECONDS),
  );
}

/** Shared world-space precipitation in tile units, for both park projections.
 * A trail starts at the returned point and extends to tail; z is height. */
export function weatherDrop(
  index: number,
  time: number,
  width: number,
  height: number,
  wind: number,
) {
  const fract = (n: number) => n - Math.floor(n),
    fall = 1 - fract(time * (0.29 + (index % 5) * 0.013) + index * 0.61803398875),
    z = fall * 12,
    x = fract(index * 0.754877666 + 0.19) * width - 0.5 + (z / 12 - 0.5) * wind * 1.2,
    y = fract(index * 0.569840296 + 0.37) * height - 0.5;
  return { x, y, z, tail: { x: x + wind * 0.04, y: y + wind * 0.02, z: z + 0.26 } };
}
export function weatherDropCount(width: number, height: number) {
  return Math.max(240, Math.min(3200, Math.ceil(width * height * 0.3)));
}
