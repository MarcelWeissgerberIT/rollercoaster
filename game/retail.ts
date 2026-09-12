import type { Building, Guest, Park } from "./simulation";
import { creditCash, spendCash } from "./budget";
import { recordFinance } from "./finance";
import { parkWeather } from "./weather";
import { recordMarketingRevenue } from "./marketing";

export const DEFAULT_PHOTO_PRICE = 5;
export const UMBRELLA_PRICE = 6;
export type RetailState = {
  photoPrice?: number;
  photoSales: number;
  photoRevenue: number;
  umbrellaSales: number;
  umbrellaRevenue: number;
};
export type GuestUmbrella = { color: number; opened: number };
export function retailOf(b: Building): RetailState {
  return (b.retail ??= { photoSales: 0, photoRevenue: 0, umbrellaSales: 0, umbrellaRevenue: 0 });
}
function sale(
  s: Park,
  b: Building,
  g: Guest,
  price: number,
  supplies: number,
  category: "photos" | "umbrellas",
) {
  g.wallet = Math.max(0, (g.wallet ?? 60) - price);
  creditCash(s, price);
  s.income += price;
  s.dayIncome += price;
  s.operatingIncomeToday = (s.operatingIncomeToday ?? 0) + price;
  spendCash(s, supplies, true);
  s.expenses += supplies;
  s.dayExpenses += supplies;
  s.operatingExpensesToday = (s.operatingExpensesToday ?? 0) + supplies;
  b.revenue += price;
  recordFinance(s, category, price);
  recordFinance(s, "supplies", supplies);
  recordMarketingRevenue(s, g, price, "shop");
}
/** A sale follows a completed visit, never merely passing the photo laser. */
export function buyRidePhoto(s: Park, b: Building, g: Guest): boolean {
  if (b.kind !== "coaster" || b.photoPoint === undefined) return false;
  const retail = retailOf(b),
    price = retail.photoPrice ?? DEFAULT_PHOTO_PRICE;
  if (
    price <= 0 ||
    price > (g.wallet ?? 60) ||
    g.happiness < 40 ||
    (g.id * 31 + g.rides * 17 + b.id) % 100 >= Math.max(10, Math.min(85, g.happiness - price * 3))
  )
    return false;
  sale(s, b, g, price, 0.7, "photos");
  retail.photoSales++;
  retail.photoRevenue += price;
  g.photoCount = (g.photoCount ?? 0) + 1;
  g.thought = "Mein Fahrtfoto ist eine tolle Erinnerung!";
  return true;
}
/** An umbrella is offered at an attended souvenir purchase, not sold remotely. */
export function buyUmbrella(s: Park, b: Building, g: Guest): boolean {
  if (
    !["balloon", "plush"].includes(b.kind) ||
    g.umbrella ||
    parkWeather(s).rain < 0.25 ||
    (g.wallet ?? 60) < UMBRELLA_PRICE
  )
    return false;
  const retail = retailOf(b);
  sale(s, b, g, UMBRELLA_PRICE, 1.8, "umbrellas");
  retail.umbrellaSales++;
  retail.umbrellaRevenue += UMBRELLA_PRICE;
  g.umbrella = { color: g.id % 6, opened: 0 };
  g.thought = "Zum Glück gibt es hier Regenschirme!";
  return true;
}
export function tickUmbrella(g: Guest, dt: number, rain: number) {
  if (!g.umbrella) return;
  const target =
    rain > 0.2 && g.state !== "ride" && g.state !== "observe" && g.state !== "rest" ? 1 : 0;
  g.umbrella.opened = Math.max(
    0,
    Math.min(1, g.umbrella.opened + (Math.sign(target - g.umbrella.opened) * dt) / 0.8),
  );
}
export function setPhotoPrice(b: Building, price: number): string | null {
  if (
    b.kind !== "coaster" ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 15 ||
    !Number.isInteger(price)
  )
    return "Wähle einen Fotopreis von 0 bis 15 €.";
  retailOf(b).photoPrice = price;
  return null;
}
export function validRetail(s: Park) {
  return (
    s.buildings.every(
      (b) =>
        b.retail === undefined ||
        (b.retail &&
          [
            b.retail.photoSales,
            b.retail.photoRevenue,
            b.retail.umbrellaSales,
            b.retail.umbrellaRevenue,
          ].every((n) => Number.isFinite(n) && n >= 0) &&
          (b.retail.photoPrice === undefined ||
            (Number.isInteger(b.retail.photoPrice) &&
              b.retail.photoPrice >= 0 &&
              b.retail.photoPrice <= 15))),
    ) &&
    s.guests.every(
      (g) =>
        (g.photoCount === undefined || (Number.isSafeInteger(g.photoCount) && g.photoCount >= 0)) &&
        (g.umbrella === undefined ||
          (!!g.umbrella &&
            Number.isInteger(g.umbrella.color) &&
            g.umbrella.color >= 0 &&
            g.umbrella.color < 6 &&
            Number.isFinite(g.umbrella.opened) &&
            g.umbrella.opened >= 0 &&
            g.umbrella.opened <= 1)),
    )
  );
}
