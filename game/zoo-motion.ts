import type { Building } from "./simulation";
import { SPECIES, isHabitat, type Species } from "./zoo";

export const ANIMAL_NAMES = {
  zebra: ["Zuri", "Milo", "Amara", "Kito"],
  giraffe: ["Nala", "Kaya", "Juma"],
  flamingo: ["Rosalie", "Pepe", "Coral", "Luna", "Fiete", "Ruby"],
  penguin: ["Pip", "Puck", "Lotte", "Kalle", "Nori", "Flocke"],
  elephant: ["Tara", "Tembo", "Mala"],
  lion: ["Kito", "Amira", "Leo", "Suri"],
  panda: ["Bao", "Mei", "Lin"],
} satisfies Record<Species, readonly string[]>;
/** Bounded, continuous movement shared by the sprite view and the 3D animals. */
export function animalPose(b: Building, i: number, time: number) {
  const n = isHabitat(b.kind) ? SPECIES[b.kind].size : 4;
  const speed =
    b.kind === "elephant"
      ? 0.085
      : b.kind === "lion"
        ? 0.13
        : b.kind === "panda"
          ? 0.11
          : b.kind === "giraffe"
            ? 0.12
            : b.kind === "penguin"
              ? 0.2
              : 0.16;
  const walking = b.kind === "lion" ? 4.5 : b.kind === "panda" ? 5 : 6;
  const phase = time * speed + i * 2.399 + b.id * 0.17;
  const cycle = Math.floor(phase / 8),
    t = phase - cycle * 8;
  const walk = t < walking;
  // Smooth pauses without integrating render time, so seeking and save/resume agree.
  const f = Math.min(1, t / walking);
  // Each animal also has its own resting bearing, so pauses do not collect them at one point.
  const angle = (cycle + f * f * (3 - 2 * f)) * Math.PI * 2 + i * 2.399;
  const radius = n * (0.22 + (i % 3) * 0.024);
  const x = b.x + (n - 1) / 2 + Math.cos(angle) * radius;
  const y = b.y + (n - 1) / 2 + Math.sin(angle) * radius * 0.72;
  return {
    x,
    y,
    dx: -Math.sin(angle),
    dy: Math.cos(angle) * 0.72,
    walk,
    bob: walk
      ? Math.abs(
          Math.sin(
            time *
              (b.kind === "elephant"
                ? 2.3
                : b.kind === "lion"
                  ? 3.5
                  : b.kind === "panda"
                    ? 3.1
                    : 4) +
              i,
          ),
        ) * (b.kind === "elephant" ? 0.018 : b.kind === "panda" ? 0.045 : 0.035)
      : 0,
    name: isHabitat(b.kind) ? ANIMAL_NAMES[b.kind][i % ANIMAL_NAMES[b.kind].length] : "",
  };
}
