import type { Park } from "./simulation";
import { staffLocation, type StaffRef } from "./staff";
import type { StaffAction, StaffMotion } from "./staff-animation";
import { cleanerTransfer } from "./staff-work";

/** A single adapter ties work poses to the live actor used by cards and the camera. */
export function staffMotion(park: Park, ref: StaffRef, time = park.time): StaffMotion | null {
  const location = staffLocation(park, ref);
  if (!location) return null;
  const activity = location.activity as string;
  let action: StaffAction = "idle";
  if (location.walking) action = location.carried > 0 ? "carry" : "walk";
  else if (activity === "sweep" || activity === "clean") action = "sweep";
  else if (
    activity === "empty" ||
    activity === "deposit" ||
    activity === "feed" ||
    activity === "water"
  )
    action = activity;
  else if (activity === "repair" || activity === "inspect" || activity === "checking")
    action = "inspect";
  else if (activity === "greet" || activity === "boarding" || activity === "unloading")
    action = "greet";
  else if (activity === "console" || activity === "control" || activity === "running")
    action = "console";
  const cleaner =
    ref.kind === "cleaner" ? park.cleanliness?.workers.find((w) => w.id === ref.id) : undefined;
  return {
    id: ref.id,
    role: ref.kind,
    action,
    time,
    heading: Math.atan2(location.dy, location.dx),
    distance: location.distanceWalked,
    progress: location.progress,
    carried: location.carried,
    hideBag: cleaner ? cleanerTransfer(park, cleaner)?.hideHandBag : false,
  };
}
