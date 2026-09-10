import type { Building, Guest, Park } from "./simulation";
import type { WeatherSnapshot } from "./weather";

type Conditions = Pick<WeatherSnapshot, "rain" | "heat">;

export function seeksWeatherSeat(b: Building, g: Guest, weather: Conditions) {
  if (g.visited?.includes(b.id)) return false;
  return b.kind === "shelter"
    ? weather.rain > 0.3 || weather.heat > 0.55
    : b.kind === "parasol" && (weather.heat > 0.2 || weather.rain > 0.2);
}

export function weatherSeatScore(b: Building, g: Guest, weather: Conditions) {
  const benefit =
    b.kind === "shelter"
      ? weather.rain * 12 + weather.heat * 5
      : b.kind === "parasol"
        ? weather.heat * 10 + weather.rain * 4
        : 0;
  return benefit - Math.hypot(b.x - g.x, b.y - g.y);
}

/** Benefits require the guest to occupy the actual protected seat. A distant
 * pavilion does not shelter a queue, and trees only shade their nearby ground. */
export function guestWeatherComfort(park: Park, guest: Guest, weather: Conditions) {
  const seat =
    guest.state === "rest" && guest.rest
      ? park.buildings.find((b) => b.id === guest.target && b.open)
      : undefined;
  const roof = seat?.kind === "shelter" ? 1 : seat?.kind === "parasol" ? 0.6 : 0;
  const treeShade = park.buildings.some(
    (b) => ["tree", "pine"].includes(b.kind) && Math.hypot(b.x - guest.x, b.y - guest.y) < 1.25,
  );
  const shade = roof ? 1 : treeShade ? 0.65 : 0;
  // Keep weather gentle: a fully exposed rainy minute costs only 1.2 mood.
  const outside = guest.state !== "ride" && guest.state !== "leave";
  return {
    rainProtection: roof,
    shade,
    extraThirst: outside ? weather.heat * 0.07 * (1 - shade) : 0,
    moodPerSecond: outside
      ? -weather.rain * 0.02 * (1 - roof) - weather.heat * 0.008 * (1 - shade)
      : 0,
  };
}
