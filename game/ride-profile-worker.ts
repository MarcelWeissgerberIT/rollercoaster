import { planRideProfile } from "./ride-profiles";
self.onmessage = (event: MessageEvent<Parameters<typeof planRideProfile>>) => {
  try {
    self.postMessage(planRideProfile(...event.data));
  } catch {
    self.postMessage({
      error: "Dieses Fahrprofil konnte nicht berechnet werden. Wähle einen kleineren Abschnitt.",
    });
  }
};
