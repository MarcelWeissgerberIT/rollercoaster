import * as THREE from "three";
import type { Building, Park } from "./simulation";
import type { makeRidePath } from "./ride-path";
import { coasterTrainVisuals, coasterBlockVisuals, CAR_SPACING } from "./coaster-trains";
import { createCoasterCar } from "./coaster-car";
import { vehicleFor, carSeat, vehicleHeightOffset } from "./vehicles";
import { createGuestModel } from "./guest-model";

/** One adapter for the park's 3D world and the selected-train camera. Seat IDs
 * are refreshed when the actual boarding simulation changes; no invented riders. */
export function createCoasterFleetScene(
  scene: THREE.Scene,
  park: Park,
  building: Building,
  path: ReturnType<typeof makeRidePath>,
) {
  const root = new THREE.Group();
  root.name = `coaster-fleet-${building.id}`;
  scene.add(root);
  const vehicle = vehicleFor(building),
    cars = new Map<string, { model: THREE.Group; seatIds: string; people: THREE.Object3D[] }>();
  const signals = coasterBlockVisuals(building).map((block) => {
    const group = new THREE.Group(),
      frame = path.at((block.distance * 5) / path.length);
    group.position.copy(frame.position).addScaledVector(frame.right, 1.4);
    group.quaternion.copy(frame.quaternion);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: "#506b63" }),
    );
    pole.position.y = 1.05;
    group.add(pole);
    const casing = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.2),
      new THREE.MeshStandardMaterial({ color: "#233d37" }),
    );
    casing.position.y = 2.4;
    group.add(casing);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({
        color: "#59da77",
        emissive: "#59da77",
        emissiveIntensity: 0.6,
      }),
    );
    lamp.position.set(0, 2.4, -0.15);
    group.add(lamp);
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.18, 2),
      new THREE.MeshStandardMaterial({ color: "#e4b665", metalness: 0.5, roughness: 0.4 }),
    );
    brake.position.copy(frame.position).addScaledVector(frame.up, 0.1);
    brake.quaternion.copy(frame.quaternion);
    root.add(brake);
    group.name = `block-signal-${block.index + 1}`;
    root.add(group);
    return lamp;
  });
  const update = () => {
    const keep = new Set<string>();
    for (const train of coasterTrainVisuals(building))
      for (let i = 0; i < train.cars; i++) {
        const key = `${train.id}:${i}`;
        keep.add(key);
        let car = cars.get(key);
        if (!car) {
          const model = createCoasterCar(vehicle, i);
          model.name = `train-${train.id}-car-${i + 1}`;
          root.add(model);
          car = { model, seatIds: "", people: [] };
          cars.set(key, car);
        }
        const frame = path.at(
          (((((train.distance - i * CAR_SPACING) * 5) / path.length) % 1) + 1) % 1,
        );
        car.model.position.copy(frame.position);
        // Suspended vehicle shells and passengers hang under the running rail.
        car.model.position.addScaledVector(frame.up, vehicleHeightOffset(vehicle));
        car.model.quaternion.copy(frame.quaternion);
        const ids = train.riders.slice(i * 2, i * 2 + 2),
          signature = ids.join(",");
        if (signature !== car.seatIds) {
          for (const person of car.people) {
            person.removeFromParent();
            person.traverse((o) => {
              if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
              }
            });
          }
          car.people = ids.map((id, side) => {
            const person = createGuestModel(park.guests.find((g) => g.id === id)),
              seat = carSeat(vehicle, side);
            person.position.set(seat.x, 0.75, seat.z);
            car!.model.add(person);
            return person;
          });
          car.seatIds = signature;
        }
      }
    for (const [key, car] of cars)
      if (!keep.has(key)) {
        car.model.removeFromParent();
        cars.delete(key);
      }
    coasterBlockVisuals(building).forEach((block, i) => {
      const lamp = signals[i];
      if (!lamp) return;
      const color = block.owner === null ? "#59da77" : "#ed664c";
      lamp.material.color.set(color);
      lamp.material.emissive.set(color);
    });
  };
  update();
  return { root, update };
}
