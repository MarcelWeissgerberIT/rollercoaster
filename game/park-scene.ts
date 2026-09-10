import { RESTROOM_SIZE } from "./restroom";
import { addPhotoHardware, isPhotoPoint } from "./coaster-photo";
import { operationsOf, OPERATOR_POSTS } from "./operations";
import { staffLocation, type StaffRef } from "./staff";
import { withAccessLayoutCache } from "./ride-access";
import { staffMotion } from "./staff-visual";
import { createStaffModel } from "./staff-model";
import { GATES, gateStyle } from "./entrance";
import { FOOD, isFood, restPose } from "./park-life";
import { isRotatableFurniture } from "./building-orientation";
import { createFurnitureModel } from "./furniture-model";
import { createHabitatModel } from "./zoo-model";
import { isHabitat, initZoo, tickZoo } from "./zoo";
import { access } from "./simulation";
import { tickCleanliness, initCleanliness } from "./cleanliness";
import { cleanerTransfer, staffBagLocal, staffLocalWorld } from "./staff-work";
import { createCoasterCar } from "./coaster-car";
import { vehicleFor, carSeat } from "./vehicles";
import { addDriveHardware } from "./track-hardware";
import { addExitArrows } from "./path-markings";
import { addAccessPods } from "./pod-model";
import { createTransportRig } from "./transport-rig";
import { createGuestModel, createCrowd, personParts } from "./guest-model";
import { dogCompanionOwners, dogCompanionPose, type DogVector } from "./guest-dogs";
import { createDogCompanionModel } from "./dog-model";
import { guestWalkPosition } from "./guest-walk";
import { partyWalkingSpeed } from "./visitors";
import { createAttractionRig } from "./attraction-rig";
import { isTransport, transportPose, transportClock } from "./transit";
import * as THREE from "three";
import {
  type Park,
  type Building,
  CATALOG,
  COASTER_TYPES,
  rideCapacity,
  rideDuration,
  isRide,
} from "./simulation";
import { makeRidePath } from "./ride-path";
type MeshFactory = (
  geometry: THREE.BufferGeometry,
  color: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  parent?: THREE.Object3D,
) => THREE.Mesh;
/** Models share the live park layout; animations run on the preview clock without changing the saved simulation. */
export function populatePark(
  scene: THREE.Scene,
  park: Park,
  exclude: number,
  mesh: MeshFactory,
  mat: (c: string) => THREE.Material,
  cube: THREE.BufferGeometry,
  cylinder: THREE.BufferGeometry,
  cone: THREE.BufferGeometry,
) {
  addExitArrows(scene, park);
  const updatePods = addAccessPods(scene, park);
  const animations: ((t: number) => void)[] = [],
    sphere = new THREE.IcosahedronGeometry(1, 1);
  const trees = park.buildings.filter((b) => b.kind === "tree" || b.kind === "pine");
  for (const kind of ["tree", "pine"]) {
    const items = trees.filter((b) => b.kind === kind);
    for (const [geometry, color, height, radius, offset] of (kind === "pine"
      ? [
          [cylinder, "#795831", 4, 0.35, 2],
          [cone, "#286b45", 6, 2.3, 5],
          [cone, "#348653", 4, 1.7, 7.5],
        ]
      : [
          [cylinder, "#795831", 4, 0.4, 2],
          [sphere, "#4c8b36", 2.8, 2.8, 5.4],
          [sphere, "#75a746", 2.1, 2.1, 7.2],
        ]) as [THREE.BufferGeometry, string, number, number, number][]) {
      const instances = new THREE.InstancedMesh(geometry, mat(color), items.length),
        matrix = new THREE.Matrix4();
      items.forEach((b, i) => {
        const variation = 0.85 + (b.id % 7) * 0.04;
        matrix.compose(
          new THREE.Vector3(b.x * 5, offset * variation, b.y * 5),
          new THREE.Quaternion(),
          new THREE.Vector3(radius * variation, height * variation, radius * variation),
        );
        instances.setMatrixAt(i, matrix);
      });
      scene.add(instances);
    }
  }
  const gate = GATES[gateStyle(park)],
    gx = 15 * 5,
    gz = 29 * 5;
  for (const side of [-1, 1]) {
    mesh(cube, gate.color, gx + side * 4.2, 2.4, gz, 1.2, 4.8, 1.5);
    mesh(cube, gate.accent, gx + side * 4.2, 4.9, gz, 1.7, 0.35, 1.9);
  }
  mesh(cube, gate.color, gx, 5.1, gz, 9.8, 0.8, 1.3);
  for (let i = -3; i <= 3; i++)
    mesh(sphere, gate.accent, gx + i, 5.8 - Math.abs(i) * 0.09, gz, 0.16, 0.16, 0.16);
  if (gateStyle(park) === "safari") mesh(cone, "#926737", gx, 6.3, gz, 6, 2, 2.4);
  const addEmployee = (ref: StaffRef) => {
    const motion = staffMotion(park, ref),
      location = staffLocation(park, ref);
    if (!motion || !location) return null;
    const rig = createStaffModel(motion);
    rig.root.position.set(location.x * 5, 0, location.y * 5);
    scene.add(rig.root);
    return { ref, rig };
  };
  const updateEmployee = (
    state: Park,
    employee: NonNullable<ReturnType<typeof addEmployee>>,
    time: number,
  ) => {
    const location = staffLocation(state, employee.ref),
      motion = staffMotion(state, employee.ref, time);
    employee.rig.root.visible = !!location && !!motion;
    if (!location || !motion) return;
    employee.rig.root.position.set(location.x * 5, 0, location.y * 5);
    employee.rig.update(motion);
  };
  // Preview only the remainder of an existing access phase. Do not
  // invent boarding, riders or a new dispatch while the live park is paused.
  const operatorPark: Park = {
    ...park,
    buildings: park.buildings.map((b) => ({ ...b, operations: { ...operationsOf(b) } })),
  };
  for (const building of operatorPark.buildings) {
    const employees = OPERATOR_POSTS.flatMap((post) => {
      const employee = addEmployee({ kind: "operator", id: building.id, post });
      return employee ? [employee] : [];
    });
    if (!employees.length) continue;
    const initial = operationsOf(building),
      phase = initial.phase,
      remaining = initial.phaseLeft;
    animations.push((t) => {
      operatorPark.time = park.time + t;
      if (phase === "boarding" || phase === "checking" || phase === "unloading") {
        building.operations!.phaseLeft = Math.max(0, remaining - Math.max(0, t));
      }
      for (const employee of employees) updateEmployee(operatorPark, employee, operatorPark.time);
    });
  }
  animations.push(() => updatePods(operatorPark));
  const groupAt = (x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  };
  const cleaningPark: Park = {
    ...park,
    tiles: park.tiles,
    buildings: park.buildings.map((b) => ({ ...b })),
    guests: [],
    staff: park.staff,
    time: park.time,
    speed: 1,
    cleanliness: structuredClone(park.cleanliness),
  };
  initCleanliness(cleaningPark);
  let cleaningTime = 0;
  const litterModels = new Map<number, THREE.Object3D>();
  for (const l of cleaningPark.cleanliness?.litter ?? []) {
    const m = mesh(
      l.kind === "cup" ? cylinder : cube,
      l.kind === "cup" ? "#bd794f" : "#efe2b8",
      l.x * 5,
      0.1,
      l.y * 5,
      0.23,
      l.kind === "cup" ? 0.27 : 0.05,
      0.23,
    );
    m.rotation.y = l.id;
    litterModels.set(l.id, m);
  }
  const binParts = new Map<number, { lid: THREE.Group; overflow: THREE.Mesh[]; bin: Building }>();
  const collectionCarts = new Map<string, THREE.Group>();
  const transferBags = new Map<number, THREE.Group>();
  const collectionCart = (x: number, y: number) => {
    const key = `${x},${y}`,
      existing = collectionCarts.get(key);
    if (existing) return existing;
    const cart = groupAt(x * 5, 0, y * 5);
    cart.name = `staff-waste-collection-${key}`;
    mesh(cube, "#426656", 0, 0.6, 0, 1.1, 0.9, 0.9, cart);
    mesh(cube, "#263d34", 0, 1.07, 0, 0.88, 0.07, 0.7, cart);
    mesh(cube, "#e1d7a9", 0, 0.65, -0.46, 0.25, 0.2, 0.02, cart);
    for (const side of [-1, 1]) {
      const wheel = mesh(cylinder, "#35433e", side * 0.59, 0.18, 0, 0.19, 0.09, 0.19, cart);
      wheel.rotation.z = Math.PI / 2;
      mesh(cylinder, "#82998a", side * 0.47, 1.16, 0.47, 0.035, 0.9, 0.035, cart);
    }
    mesh(cube, "#82998a", 0, 1.58, 0.47, 1, 0.075, 0.075, cart);
    collectionCarts.set(key, cart);
    return cart;
  };
  const transferBag = (id: number) => {
    const existing = transferBags.get(id);
    if (existing) return existing;
    const bag = groupAt(0, 0, 0);
    bag.name = `staff-waste-transfer-${id}`;
    mesh(sphere, "#46554a", 0, 0, 0, 0.17, 0.21, 0.17, bag);
    mesh(sphere, "#a3ac81", 0, 0.19, 0, 0.035, 0.05, 0.035, bag);
    transferBags.set(id, bag);
    return bag;
  };
  const staffModels = (park.cleanliness?.workers ?? []).flatMap((w) => {
    const employee = addEmployee({ kind: "cleaner", id: w.id });
    return employee ? [employee] : [];
  });
  animations.push((t) => {
    const dt = Math.max(0, Math.min(0.1, t - cleaningTime));
    cleaningTime = t;
    cleaningPark.time = park.time + t;
    tickCleanliness(cleaningPark, dt);
    for (const [id, m] of litterModels)
      m.visible = !!cleaningPark.cleanliness?.litter.some((l) => l.id === id);
    for (const employee of staffModels) updateEmployee(cleaningPark, employee, cleaningPark.time);
    for (const { lid, overflow, bin } of binParts.values()) {
      lid.rotation.x = 0;
      for (const piece of overflow) piece.visible = (bin.binFill ?? 0) >= 12;
    }
    for (const cart of collectionCarts.values()) cart.visible = false;
    for (const bag of transferBags.values()) bag.visible = false;
    for (const worker of cleaningPark.cleanliness?.workers ?? []) {
      const transfer = cleanerTransfer(cleaningPark, worker);
      if (!transfer) continue;
      if (transfer.collection) collectionCart(transfer.target.x, transfer.target.y).visible = true;
      else {
        const bin = binParts.get(worker.target!.id);
        if (bin) bin.lid.rotation.x = transfer.lidOpen * 1.25;
      }
      if (!transfer.showTransfer) continue;
      const ref = { kind: "cleaner", id: worker.id } as const,
        location = staffLocation(cleaningPark, ref),
        motion = staffMotion(cleaningPark, ref, cleaningPark.time);
      if (!location || !motion) continue;
      const local = staffLocalWorld(staffBagLocal(motion), motion),
        handX = location.x * 5 + local[0],
        handZ = location.y * 5 + local[2],
        amount = transfer.empty ? 1 - transfer.t : transfer.t,
        bag = transferBag(worker.id);
      bag.visible = true;
      bag.position.set(
        handX + (transfer.target.x * 5 - handX) * amount,
        local[1] + (1.4 - local[1]) * amount + Math.sin(transfer.t * Math.PI) * 0.3,
        handZ + (transfer.target.y * 5 - handZ) * amount,
      );
    }
  });
  for (const b of park.buildings) {
    if (
      ["tree", "pine"].includes(b.kind) ||
      (b.id === exclude && !isTransport(b.kind)) ||
      b.id === park.trackEdit?.buildingId
    )
      continue;
    const n = CATALOG[b.kind].size,
      x = (b.x + (n - 1) / 2) * 5,
      z = (b.y + (n - 1) / 2) * 5;
    const running = b.open && (b.riders.length > 0 || !!b.testing);
    const phase = (time: number) =>
      running
        ? ((rideDuration(b) - Math.max(0, b.cycle) + time) / Math.max(1, rideDuration(b))) % 1
        : 0;
    if (isHabitat(b.kind)) {
      const rig = createHabitatModel(b);
      scene.add(rig.root);
      animations.push((t) => rig.update(park.time + t));
      continue;
    }
    if (b.kind === "keeperhut") {
      const hut = groupAt(x, 0, z);
      mesh(cube, "#e4c99f", 0, 1.8, 0, 7, 3.6, 7, hut);
      mesh(cone, "#407a58", 0, 4.2, 0, 5.5, 2.1, 5.5, hut);
      mesh(cube, "#5d4935", 0, 1.15, 3.55, 1.6, 2.3, 0.12, hut);
      mesh(cube, "#90c8c8", 2, 2.1, 3.58, 1.3, 1, 0.1, hut);
      continue;
    }
    if (b.kind === "bin") {
      const g = groupAt(x, 0, z);
      g.name = `bin-${b.id}`;
      mesh(cube, "#285e46", 0, 0.6, 0, 0.72, 1.2, 0.72, g);
      const lid = new THREE.Group();
      lid.name = `bin-lid-${b.id}`;
      lid.position.set(0, 1.3, 0.4);
      g.add(lid);
      mesh(cube, "#3c805b", 0, 0, -0.4, 0.85, 0.22, 0.85, lid);
      mesh(cube, "#152e29", 0, 1.07, -0.37, 0.49, 0.22, 0.03, g);
      mesh(cube, "#eedbae", 0, 0.65, -0.371, 0.25, 0.19, 0.03, g);
      const overflow = [-1, 1].map((side) => {
        const piece = mesh(cube, "#eae0bf", side * 0.13, 1.07, -0.38, 0.17, 0.17, 0.1, g);
        piece.visible = (b.binFill ?? 0) >= 12;
        return piece;
      });
      binParts.set(b.id, {
        lid,
        overflow,
        bin: cleaningPark.buildings.find((bin) => bin.id === b.id)!,
      });
      continue;
    }
    if (isRide(b.kind) && b.kind !== "coaster") {
      const rig = createAttractionRig(b, park);
      scene.add(rig.root);
      animations.push((t) => rig.update(running ? Math.max(0, rideDuration(b) - b.cycle) + t : 0));
      continue;
    }
    if (b.kind === "coaster" && b.track) {
      const path = makeRidePath(b.track),
        color = COASTER_TYPES[b.track[0].style ?? "steel"].color;
      addDriveHardware(scene, path);
      if (isPhotoPoint(b.photoPoint)) addPhotoHardware(scene, path, b.photoPoint);
      for (const side of [-0.58, 0.58])
        scene.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(
                path.points
                  .slice(0, -1)
                  .map((p, i) => p.clone().addScaledVector(path.rights[i], side)),
                true,
                "centripetal",
              ),
              Math.min(1200, path.count),
              0.11,
              5,
              true,
            ),
            mat(color),
          ),
        );
      const ties = new THREE.InstancedMesh(cube, mat("#486466"), Math.ceil(path.length / 1.2)),
        matrix = new THREE.Matrix4();
      for (let i = 0; i < ties.count; i++) {
        const f = path.at(i / ties.count);
        matrix.compose(f.position, f.quaternion, new THREE.Vector3(1.5, 0.13, 0.22));
        ties.setMatrixAt(i, matrix);
      }
      scene.add(ties);
      for (let d = 0; d < path.length; d += 6) {
        const f = path.at(d / path.length);
        if (f.position.y > 1.6) {
          mesh(
            cylinder,
            b.track[0].style === "wood" ? "#8b673a" : "#468481",
            f.position.x,
            f.position.y / 2,
            f.position.z,
            0.19,
            f.position.y,
            0.19,
          );
          mesh(cube, "#c4bfac", f.position.x, 0.1, f.position.z, 0.8, 0.2, 0.8);
        }
      }
      const station = groupAt(b.x * 5, 0, b.y * 5);
      station.quaternion.copy(path.at(0).quaternion);
      mesh(cube, "#d5c596", 1.7, 0.5, 0, 2.1, 0.4, 6, station);
      mesh(cube, color, 1.7, 3.7, 0, 2.5, 0.3, 6, station);
      for (const dz of [-2.5, 2.5]) mesh(cylinder, "#267b7e", 2.6, 2, dz, 0.1, 3.5, 0.1, station);
      const carts = Array.from({ length: Math.ceil(rideCapacity(b) / 2) }, (_, i) => {
        const g = createCoasterCar(vehicleFor(b), i);
        scene.add(g);
        for (const side of [-0.4, 0.4]) {
          if (i * 2 + (side > 0 ? 1 : 0) < b.riders.length) {
            const person = createGuestModel(
              park.guests.find((g) => g.id === b.riders[i * 2 + (side > 0 ? 1 : 0)]),
            );
            const seat = carSeat(vehicleFor(b), side > 0 ? 1 : 0);
            person.position.set(seat.x, 0.75, seat.z);
            g.add(person);
          }
        }
        return g;
      });
      animations.push((t) => {
        const u = running
          ? path.progress((Math.max(0, path.duration - b.cycle) + t) % path.duration)
          : 0;
        carts.forEach((g, i) => {
          const p = path.at((((u - (i * 3.7) / path.length) % 1) + 1) % 1);
          g.position.copy(p.position);
          g.quaternion.copy(p.quaternion);
        });
      });
    } else if (isTransport(b.kind)) {
      const station = groupAt(x, 0, z),
        line = park.transitLines?.find((l) => l.a === b.id || l.b === b.id);
      if (line) {
        const a = line.route[0],
          c = line.route[1];
        station.rotation.y = Math.atan2(c.x - a.x, c.y - a.y);
      }
      const length = b.kind === "train" ? 14 : 5;
      mesh(cube, "#e3d4ad", 0, 0.2, 0, 3, 0.4, length, station);
      mesh(cube, "#277f80", 0, 3.6, 0, 3.8, 0.23, length, station);
      for (const side of [-1, 1])
        for (const end of [-1, 1])
          mesh(
            cylinder,
            "#f0d29c",
            side * 1.25,
            1.8,
            end * (length / 2 - 0.4),
            0.09,
            3.6,
            0.09,
            station,
          );
      mesh(cube, "#244e40", 0, 3.1, 1, 2.3, 0.55, 0.13, station);
      const clock = mesh(cylinder, "#faf0c9", 0, 4.25, 0, 0.5, 0.13, 0.5, station);
      clock.rotation.x = Math.PI / 2;
      mesh(cube, "#31564c", 0, 4.39, 0.08, 0.05, 0.25, 0.04, station);
      mesh(cube, "#31564c", 0.12, 4.25, 0.08, 0.25, 0.05, 0.04, station);
      if (b.kind === "shuttle") mesh(cube, "#417f9e", 1.6, 1.6, 1.5, 0.65, 1.2, 0.15, station);
    } else if (b.kind === "toilet") {
      const room = groupAt(x, 0, z),
        roofGeometry = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
      room.name = `restroom-${b.id}`;
      const { cubicleWidth, depth, wallHeight, doorHeight } = RESTROOM_SIZE;
      mesh(cube, "#d6c39c", 0, 0.08, 0, 4.65, 0.16, depth + 0.3, room);
      for (const side of [-1, 1]) {
        const cx = side * 1.1,
          front = depth / 2 + 0.025;
        mesh(cube, "#fff0c6", cx, wallHeight / 2 + 0.12, 0, cubicleWidth, wallHeight, depth, room);
        mesh(roofGeometry, "#287f82", cx, wallHeight + 0.66, 0, 1.65, 1.24, 2.76, room);
        mesh(sphere, "#f4da91", cx, wallHeight + 1.31, 0, 0.1, 0.16, 0.1, room);
        const doorColor = side < 0 ? "#257b7a" : "#be594b";
        mesh(
          cube,
          "#d4bd83",
          cx,
          doorHeight / 2 + 0.14,
          front,
          1.26,
          doorHeight + 0.12,
          0.13,
          room,
        );
        mesh(
          cube,
          doorColor,
          cx,
          doorHeight / 2 + 0.11,
          front + 0.08,
          1.08,
          doorHeight,
          0.07,
          room,
        );
        mesh(cube, "#eee1bd", cx + 0.32, 1.2, front + 0.14, 0.06, 0.18, 0.05, room);
        mesh(cube, "#faf9e9", cx, 2.66, front + 0.08, 0.72, 0.43, 0.09, room);
        mesh(sphere, "#355f61", cx, 2.75, front + 0.14, 0.045, 0.045, 0.025, room);
        mesh(cube, "#355f61", cx, 2.61, front + 0.14, 0.105, 0.18, 0.03, room);
        for (const leg of [-1, 1])
          mesh(cube, "#355f61", cx + leg * 0.04, 2.51, front + 0.14, 0.03, 0.1, 0.03, room);
        mesh(cube, "#7aafa9", cx, 1.12, -depth / 2 - 0.01, 0.9, 0.66, 0.05, room);
        for (const trim of [-1, 1])
          mesh(
            cube,
            "#e2d5aa",
            cx + trim * (cubicleWidth / 2 - 0.09),
            1.52,
            front,
            0.12,
            wallHeight,
            0.1,
            room,
          );
      }
    } else if (isFood(b.kind) || ["balloon", "plush"].includes(b.kind)) {
      const color = isFood(b.kind) ? FOOD[b.kind].color : "#43878a";
      mesh(cube, "#fff0c6", x, 1.7, z, 3.8, 3.4, 3.8);
      mesh(cone, color, x, 4.3, z, 3.5, 2, 3.5).rotation.y = Math.PI / 4;
      mesh(cube, "#3d655d", x, 1.8, z + 1.94, 2.8, 1.4, 0.1);
      mesh(cube, color, x, 2.9, z + 2.3, 4, 0.2, 1.4);
      mesh(cube, "#c99546", x, 1.05, z + 2.1, 3, 0.25, 0.7);
      if (b.kind === "burger") {
        mesh(sphere, "#e5b545", x, 5.3, z, 1.1, 0.5, 1.1);
        mesh(cylinder, "#815329", x, 5.1, z, 1.05, 0.15, 1.05);
      } else if (b.kind === "hotdog") {
        mesh(sphere, "#e4ba73", x, 5.3, z, 1.4, 0.45, 0.6);
        mesh(sphere, "#ad5338", x, 5.55, z, 1.25, 0.22, 0.3);
        mesh(cube, "#efd663", x, 5.73, z, 0.95, 0.04, 0.08);
      } else if (b.kind === "icecream") {
        mesh(cone, "#bf9960", x, 5.3, z, 0.5, 1.4, 0.5).rotation.z = Math.PI;
        mesh(sphere, "#efb5cf", x, 6.2, z, 0.8, 0.8, 0.8);
      } else if (b.kind === "popcorn") {
        mesh(cube, "#c66757", x, 5.3, z, 1.2, 1.4, 1.2);
        for (let i = 0; i < 7; i++)
          mesh(
            sphere,
            "#eee0a1",
            x + Math.sin(i) * 0.5,
            6 + Math.cos(i) * 0.13,
            z + Math.cos(i) * 0.4,
            0.26,
            0.26,
            0.26,
          );
      } else if (b.kind === "coffee") {
        mesh(cylinder, "#ede4ce", x, 5.4, z, 0.7, 1.3, 0.7);
        mesh(cylinder, "#68472f", x, 6.08, z, 0.61, 0.04, 0.61);
      } else if (b.kind === "balloon") {
        for (let i = 0; i < 5; i++) {
          const px = x + (i - 2) * 0.45,
            py = 5.3 + Math.sin(i) * 0.5;
          mesh(
            sphere,
            ["#ef765d", "#f2d65c", "#50aeae", "#bf7cbb", "#7baed4"][i],
            px,
            py,
            z,
            0.34,
            0.47,
            0.34,
          );
          mesh(cylinder, "#f8efcf", px, py - 1, z, 0.016, 1.8, 0.016);
        }
      } else if (b.kind === "plush") {
        mesh(sphere, "#ba8645", x, 5, z, 0.65, 0.8, 0.5);
        mesh(sphere, "#d7a357", x, 5.9, z, 0.6, 0.55, 0.46);
        for (const side of [-1, 1]) {
          mesh(sphere, "#b98340", x + side * 0.48, 6.2, z, 0.23, 0.24, 0.17);
          mesh(sphere, "#352d25", x + side * 0.2, 5.98, z + 0.43, 0.065, 0.065, 0.04);
        }
        mesh(sphere, "#e9c286", x, 5.72, z + 0.44, 0.27, 0.2, 0.13);
      } else if (b.kind === "drink") {
        mesh(cylinder, "#faf0cc", x, 5.4, z, 0.65, 1.4, 0.65);
        mesh(cylinder, "#e85f39", x + 0.2, 6.3, z, 0.045, 1, 0.045).rotation.z = -0.25;
      }
    } else if (b.kind === "flowers") {
      mesh(cylinder, "#e7d9a0", x, 0.22, z, 1.6, 0.44, 1.6);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        mesh(
          sphere,
          i % 2 ? "#f0ca49" : "#df7057",
          x + Math.cos(a) * (i % 3) * 0.5,
          0.6,
          z + Math.sin(a) * (i % 3) * 0.5,
          0.27,
          0.3,
          0.27,
        );
      }
    } else if (b.kind === "playground") {
      mesh(cube, "#d7bd82", x, 0.12, z, 13, 0.2, 13);
      for (const dx of [-2, 2])
        for (const dz of [-2, 2]) mesh(cylinder, "#8c7956", x + dx, 1.6, z + dz, 0.15, 3.2, 0.15);
      mesh(cube, "#82b8ad", x, 2.3, z, 4.5, 0.24, 4.5);
      mesh(cone, "#e6ae99", x, 4.1, z, 3.2, 2, 3.2);
      const slide = mesh(cube, "#dfba61", x + 2.4, 1.25, z + 2.7, 1.5, 0.2, 6);
      slide.rotation.x = 0.4;
      for (let i = 0; i < 6; i++)
        mesh(cube, "#accbcc", x - 2.5, 0.35 + i * 0.35, z - 2.2, 0.25, 0.15, 2);
    } else if (isRotatableFurniture(b.kind)) {
      scene.add(createFurnitureModel(b, cube, mat));
    }
  }
  for (const line of park.transitLines ?? []) {
    if (line.kind === "train") {
      for (let i = 1; i < line.route.length; i++) {
        const a = line.route[i - 1],
          b = line.route[i],
          dx = b.x - a.x,
          dz = b.y - a.y;
        for (const side of [-0.48, 0.48]) {
          const rail = mesh(
            cube,
            "#758080",
            (a.x + b.x) * 2.5 + dz * side,
            0.18,
            (a.y + b.y) * 2.5 - dx * side,
            0.065,
            0.1,
            5,
          );
          rail.rotation.y = Math.atan2(dx, dz);
        }
        for (let t = 0; t < 1; t += 0.2) {
          const tie = mesh(
            cube,
            "#867153",
            (a.x + dx * t) * 5,
            0.09,
            (a.y + dz * t) * 5,
            1.3,
            0.14,
            0.18,
          );
          tie.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
    if (line.a === exclude || line.b === exclude) continue;
    const rig = createTransportRig(line, park);
    scene.add(rig.root);
    animations.push((t) => rig.update(line.enabled && !line.fault ? t : 0));
  }
  const zooPark = structuredClone(park);
  initZoo(zooPark);
  let zooTime = 0;
  const keeperModels = (park.zoo?.workers ?? []).flatMap((w) => {
    const employee = addEmployee({ kind: "keeper", id: w.id });
    return employee ? [employee] : [];
  });
  animations.push((t) => {
    const dt = Math.max(0, Math.min(0.1, t - zooTime));
    zooTime = t;
    zooPark.time = park.time + t;
    tickZoo(zooPark, dt, (s, b) => access(s, b));
    for (const employee of keeperModels) updateEmployee(zooPark, employee, zooPark.time);
  });
  // Animated visitors follow their existing path segments, with no mutations to the paused park.
  const guests = park.guests.filter(
      (g) =>
        g.state !== "ride" ||
        park.buildings.some((b) => isHabitat(b.kind) && b.riders.includes(g.id)),
    ),
    crowd = createCrowd(guests);
  scene.add(crowd.mesh);
  const dogOwners = dogCompanionOwners(park),
    dogs = new Map(
      guests
        .filter((g) => dogOwners.has(g.id))
        .map((g) => {
          const model = createDogCompanionModel(g.id);
          model.root.visible = false;
          scene.add(model.root);
          return [g.id, model] as const;
        }),
    );
  const routes = guests.map((g) => {
    const points = [{ x: g.x, y: g.y }, ...g.route],
      dist = [0];
    for (let i = 1; i < points.length; i++)
      dist.push(
        dist[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
      );
    return { points, dist, length: dist.at(-1) ?? 0 };
  });
  animations.push((time) => {
    guests.forEach((g, i) => {
      const route = routes[i];
      let x = g.x,
        z = g.y,
        walking = false,
        yaw = 0,
        direction: { x: number; y: number } | undefined;
      if (route.length > 0 && (g.state === "walk" || g.state === "leave") && g.timer <= time) {
        const d = Math.min(
          route.length,
          Math.max(0, time - Math.max(0, g.timer)) * partyWalkingSpeed(g),
        );
        let j = 1;
        while (
          j < route.dist.length - 1 &&
          (route.dist[j] <= d || route.dist[j] - route.dist[j - 1] < 0.00001)
        )
          j++;
        const a = route.points[j - 1],
          b = route.points[j],
          f = (d - route.dist[j - 1]) / Math.max(0.001, route.dist[j] - route.dist[j - 1]);
        x = a.x + (b.x - a.x) * f;
        z = a.y + (b.y - a.y) * f;
        walking = d < route.length;
        yaw = Math.atan2(-(b.x - a.x), -(b.y - a.y));
        direction = { x: x + b.x - a.x, y: z + b.y - a.y };
      }
      if (g.state === "observe") {
        const b = park.buildings.find((b) => b.id === g.target);
        if (b && isHabitat(b.kind)) {
          const center = (CATALOG[b.kind].size - 1) / 2;
          yaw = Math.atan2(-(b.x + center - x), -(b.y + center - z));
        }
      }
      const restBuilding =
        g.state === "rest" ? park.buildings.find((b) => b.id === g.target) : undefined;
      const resting = restBuilding ? restPose(restBuilding, g, park.time + time) : undefined;
      if (resting) {
        x = resting.x;
        z = resting.y;
        yaw = resting.yaw;
        walking = false;
      } else {
        const formation = guestWalkPosition(park, g, { x, y: z }, direction);
        x = formation.x;
        z = formation.y;
      }
      crowd.pose(
        i,
        x * 5,
        z * 5,
        yaw,
        time * 7 + g.id,
        walking,
        resting?.seated,
        resting?.height,
        park.time + time,
      );
      const dog = dogs.get(g.id);
      if (dog) {
        const pose = dogCompanionPose(park, g, {
            time: park.time + time,
            position: { x, y: z },
            direction: { x: x - Math.sin(yaw), y: z - Math.cos(yaw) },
            moving: walking,
          }),
          hand = personParts(g, false, time * 7 + g.id, walking).find((part) => part.leashGrip)
            ?.p as DogVector | undefined;
        dog.update(pose, hand);
      }
    });
    crowd.finish();
  });

  return (time: number) =>
    withAccessLayoutCache(operatorPark, () => animations.forEach((fn) => fn(time)));
}
