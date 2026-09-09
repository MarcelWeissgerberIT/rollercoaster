import * as THREE from "three";
import {
  type Park,
  type Building,
  CATALOG,
  COASTER_TYPES,
  rideCapacity,
  rideDuration,
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
    if (["tree", "pine"].includes(b.kind) || b.id === exclude) continue;
    const n = CATALOG[b.kind].size,
      x = (b.x + (n - 1) / 2) * 5,
      z = (b.y + (n - 1) / 2) * 5;
    const running = b.open && (b.riders.length > 0 || !!b.testing);
    const phase = (time: number) =>
      running
        ? ((rideDuration(b) - Math.max(0, b.cycle) + time) / Math.max(1, rideDuration(b))) % 1
        : 0;
    if (b.kind === "coaster" && b.track) {
      const path = makeRidePath(b.track),
        color = COASTER_TYPES[b.track[0].style ?? "steel"].color;
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
          if (running) {
            mesh(sphere, "#e8b77c", side, 1.65, 0.3, 0.2, 0.24, 0.2, g);
            mesh(cube, i % 2 ? "#eb6046" : "#2498aa", side, 1.25, 0.3, 0.4, 0.45, 0.3, g);
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
    } else if (["burger", "drink", "toilet"].includes(b.kind)) {
      const color = b.kind === "burger" ? "#dc5c37" : b.kind === "drink" ? "#e7b62c" : "#43878a";
      mesh(cube, "#fff0c6", x, 1.7, z, 3.8, 3.4, 3.8);
      mesh(cone, color, x, 4.3, z, 3.5, 2, 3.5).rotation.y = Math.PI / 4;
      mesh(cube, "#3d655d", x, 1.8, z + 1.94, 2.8, 1.4, 0.1);
      mesh(cube, color, x, 2.9, z + 2.3, 4, 0.2, 1.4);
      mesh(cube, "#c99546", x, 1.05, z + 2.1, 3, 0.25, 0.7);
      if (b.kind === "burger") {
        mesh(sphere, "#e5b545", x, 5.3, z, 1.1, 0.5, 1.1);
        mesh(cylinder, "#815329", x, 5.1, z, 1.05, 0.15, 1.05);
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
    } else if (b.kind === "wheel") {
      const rotor = groupAt(x, 10, z),
        rim = new THREE.Mesh(new THREE.TorusGeometry(8, 0.2, 6, 48), mat("#da5938"));
      rotor.add(rim);
      const cabins: THREE.Group[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        mesh(
          cube,
          "#f2d886",
          Math.sin(a) * 4,
          Math.cos(a) * 4,
          0,
          0.12,
          8,
          0.12,
          rotor,
        ).rotation.z = -a;
        const cabin = new THREE.Group();
        cabin.position.set(Math.sin(a) * 8, Math.cos(a) * 8, 0);
        rotor.add(cabin);
        cabins.push(cabin);
        mesh(cube, "#d95b39", 0, 0, 0, 1.4, 1.5, 1.4, cabin);
        mesh(cone, "#f2d886", 0, 1, 0, 1, 1, 1, cabin);
      }
      for (const side of [-1, 1])
        mesh(cube, "#177779", x + side * 3, 4.5, z + 1.3, 1, 11, 1).rotation.z = side * 0.25;
      animations.push((t) => {
        rotor.rotation.z = phase(t) * Math.PI * 2;
        cabins.forEach((c) => (c.rotation.z = -rotor.rotation.z));
      });
    } else if (b.kind === "drop") {
      mesh(cube, "#248b93", x, 11, z, 1.4, 22, 1.4);
      mesh(cone, "#f2c34c", x, 23, z, 1.3, 2, 1.3);
      const gondola = groupAt(x, 2, z);
      mesh(cylinder, "#df6444", 0, 0, 0, 3, 1, 3, gondola);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        mesh(cube, "#f5d386", Math.sin(a) * 2.6, 0.6, Math.cos(a) * 2.6, 0.8, 1, 0.8, gondola);
      }
      animations.push((t) => {
        const p = phase(t);
        gondola.position.y =
          2 + (p < 0.55 ? p / 0.55 : p < 0.68 ? 1 : Math.max(0, 1 - ((p - 0.68) / 0.17) ** 2)) * 18;
      });
    } else if (b.kind === "pirate") {
      for (const dz of [-2.5, 2.5])
        for (const side of [-1, 1])
          mesh(cylinder, "#248483", x + side * 3.5, 5, z + dz, 0.22, 11, 0.22).rotation.z =
            side * 0.6;
      const pivot = groupAt(x, 9, z),
        hull = mesh(cube, "#b87836", 0, -6, 0, 8, 1.4, 3, pivot);
      for (const side of [-1, 1])
        mesh(cone, "#dfb060", side * 4, -5.6, 0, 1.5, 2, 1.5, pivot).rotation.z =
          (side * Math.PI) / 2;
      for (const side of [-1, 1])
        mesh(cylinder, "#e1c888", side * 2, -3, 0, 0.09, 6, 0.09, pivot).rotation.z = side * 0.3;
      for (let i = -2; i <= 2; i++) mesh(cube, "#f0d39d", i * 1.3, -5, 0, 0.7, 0.5, 2.5, pivot);
      animations.push(
        (t) => (pivot.rotation.z = running ? Math.sin(phase(t) * Math.PI * 4) * 0.9 : 0),
      );
    } else if (b.kind === "carousel" || b.kind === "swing") {
      const swing = b.kind === "swing",
        radius = swing ? 5 : 3.2,
        height = swing ? 8 : 5;
      mesh(cylinder, "#e1ad43", x, 0.45, z, radius, 0.8, radius);
      mesh(cylinder, "#247c7a", x, height / 2, z, 0.28, height, 0.28);
      const rotor = groupAt(x, height, z);
      mesh(cone, "#df6243", 0, 0, 0, radius + 1, 2, radius + 1, rotor);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rib = mesh(
          cube,
          "#fff0ba",
          Math.sin(a) * radius * 0.5,
          0.15,
          Math.cos(a) * radius * 0.5,
          0.16,
          0.13,
          radius,
          rotor,
        );
        rib.rotation.y = a;
        const seat = new THREE.Group();
        seat.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
        rotor.add(seat);
        mesh(cylinder, "#e7d69a", 0, -height * 0.4, 0, 0.045, height * 0.8, 0.045, seat);
        mesh(
          cube,
          swing ? "#e6b551" : "#f7e4b5",
          0,
          -height * 0.75,
          0,
          swing ? 0.8 : 1.3,
          swing ? 0.35 : 0.7,
          0.6,
          seat,
        );
        if (!swing) {
          mesh(cube, "#f7e4b5", 0.65, -height * 0.69, 0, 0.4, 0.7, 0.5, seat);
          mesh(cube, "#d75d3b", 0, -height * 0.68, 0, 0.6, 0.2, 0.65, seat);
        }
        animations.push((t) => {
          if (swing) seat.rotation.z = running ? Math.sin(a) * 0.3 : 0;
          else seat.position.y = Math.sin(phase(t) * Math.PI * 4 + a) * 0.25;
        });
      }
      animations.push((t) => (rotor.rotation.y = phase(t) * Math.PI * (swing ? 8 : 4)));
    }
  }
  // Animated visitors follow their existing path segments, with no mutations to the paused park.
  const guests = park.guests.filter((g) => g.state !== "ride"),
    heads = new THREE.InstancedMesh(sphere, mat("#e2b584"), guests.length),
    bodies = new THREE.InstancedMesh(cube, mat("#ffffff"), guests.length),
    legs = new THREE.InstancedMesh(cube, mat("#354e67"), guests.length * 2),
    matrix = new THREE.Matrix4(),
    q = new THREE.Quaternion();
  guests.forEach((g, i) =>
    bodies.setColorAt(
      i,
      new THREE.Color(
        g.profile === "family" ? "#e76849" : g.profile === "thrill" ? "#269baa" : "#e9bb45",
      ),
    ),
  );
  heads.frustumCulled = bodies.frustumCulled = legs.frustumCulled = false;
  scene.add(heads, bodies, legs);
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
        walking = false;
      if (route.length > 0 && (g.state === "walk" || g.state === "leave")) {
        let d = (time * (1 + (g.id % 7) * 0.065)) % (route.length * 2);
        d = d <= route.length ? d : route.length * 2 - d;
        let j = 1;
        while (j < route.dist.length - 1 && route.dist[j] < d) j++;
        const a = route.points[j - 1],
          b = route.points[j],
          f = (d - route.dist[j - 1]) / Math.max(0.001, route.dist[j] - route.dist[j - 1]);
        x = a.x + (b.x - a.x) * f;
        z = a.y + (b.y - a.y) * f;
        walking = true;
      }
      const bob = walking ? Math.sin(time * 12 + g.id) * 0.045 : 0;
      matrix.compose(
        new THREE.Vector3(x * 5, 1.65 + bob, z * 5),
        q,
        new THREE.Vector3(0.22, 0.25, 0.22),
      );
      heads.setMatrixAt(i, matrix);
      matrix.compose(
        new THREE.Vector3(x * 5, 1.02 + bob, z * 5),
        q,
        new THREE.Vector3(0.55, 0.7, 0.35),
      );
      bodies.setMatrixAt(i, matrix);
      for (let side = 0; side < 2; side++) {
        matrix.compose(
          new THREE.Vector3(
            x * 5 + (side ? 1 : -1) * 0.15,
            0.37,
            z * 5 + (walking ? Math.sin(time * 12 + g.id + side * Math.PI) * 0.15 : 0),
          ),
          q,
          new THREE.Vector3(0.19, 0.72, 0.2),
        );
        legs.setMatrixAt(i * 2 + side, matrix);
      }
    });
    heads.instanceMatrix.needsUpdate =
      bodies.instanceMatrix.needsUpdate =
      legs.instanceMatrix.needsUpdate =
        true;
  });
  return (time: number) => animations.forEach((fn) => fn(time));
}
