import { addDriveHardware } from "./track-hardware";
import { addExitArrows } from "./path-markings";
import { addAccessPods } from "./pod-model";
import { createTransportRig } from "./transport-rig";
import { createGuestModel, createCrowd } from "./guest-model";
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
  addAccessPods(scene, park);
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
  const groupAt = (x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  };
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
        const g = groupAt(0, 0, 0);
        mesh(cube, color, 0, 0.4, -0.3, 1.55, 0.65, 2.25, g);
        for (const side of [-0.4, 0.4]) {
          mesh(cube, "#f1dba6", side, 1, 0.35, 0.6, 0.9, 0.2, g);
          if (i * 2 + (side > 0 ? 1 : 0) < b.riders.length) {
            const person = createGuestModel(
              park.guests.find((g) => g.id === b.riders[i * 2 + (side > 0 ? 1 : 0)]),
            );
            person.position.set(side, 0.75, 0.15);
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
    } else if (["burger", "drink", "toilet", "balloon", "plush"].includes(b.kind)) {
      const color = b.kind === "burger" ? "#dc5c37" : b.kind === "drink" ? "#e7b62c" : "#43878a";
      mesh(cube, "#fff0c6", x, 1.7, z, 3.8, 3.4, 3.8);
      mesh(cone, color, x, 4.3, z, 3.5, 2, 3.5).rotation.y = Math.PI / 4;
      mesh(cube, "#3d655d", x, 1.8, z + 1.94, 2.8, 1.4, 0.1);
      mesh(cube, color, x, 2.9, z + 2.3, 4, 0.2, 1.4);
      mesh(cube, "#c99546", x, 1.05, z + 2.1, 3, 0.25, 0.7);
      if (b.kind === "burger") {
        mesh(sphere, "#e5b545", x, 5.3, z, 1.1, 0.5, 1.1);
        mesh(cylinder, "#815329", x, 5.1, z, 1.05, 0.15, 1.05);
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
    } else if (b.kind === "bench") {
      mesh(cube, "#b38038", x, 0.8, z, 2.5, 0.18, 0.8);
      mesh(cube, "#b38038", x, 1.35, z - 0.35, 2.5, 0.9, 0.13);
      for (const side of [-0.9, 0.9]) mesh(cube, "#275e53", x + side, 0.4, z, 0.15, 0.8, 0.7);
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
  // Animated visitors follow their existing path segments, with no mutations to the paused park.
  const guests = park.guests.filter((g) => g.state !== "ride"),
    crowd = createCrowd(guests);
  scene.add(crowd.mesh);
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
        yaw = 0;
      if (route.length > 0 && (g.state === "walk" || g.state === "leave")) {
        let d = (time * 0.28 * (1 + (g.id % 7) * 0.065)) % (route.length * 2);
        const reverse = d > route.length;
        d = d <= route.length ? d : route.length * 2 - d;
        let j = 1;
        while (j < route.dist.length - 1 && route.dist[j] < d) j++;
        const a = route.points[j - 1],
          b = route.points[j],
          f = (d - route.dist[j - 1]) / Math.max(0.001, route.dist[j] - route.dist[j - 1]);
        x = a.x + (b.x - a.x) * f;
        z = a.y + (b.y - a.y) * f;
        walking = true;
        yaw = Math.atan2(-(b.x - a.x), -(b.y - a.y)) + (reverse ? Math.PI : 0);
      }
      crowd.pose(i, x * 5, z * 5, yaw, time * 7 + g.id, walking);
    });
    crowd.finish();
  });

  return (time: number) => animations.forEach((fn) => fn(time));
}
