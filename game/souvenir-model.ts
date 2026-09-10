import * as THREE from "three";
import { souvenirStyle, souvenirPose, type SouvenirGuest } from "./souvenirs";

/** Small actual meshes, including foil seams and a flexible tether. The root
 * is positioned at the person's articulated grip by guest-model.ts. */
export function createSouvenirModel(g: SouvenirGuest) {
  const style = souvenirStyle(g),
    root = new THREE.Group();
  root.name = `souvenir-${style?.kind ?? "none"}-${g.id}`;
  root.userData.guestId = g.id;
  root.userData.souvenirStyle = style;
  if (!style) return { root, update: (_time: number) => {} };
  const object = new THREE.Group();
  root.add(object);
  const material = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: style.foil ? 0.24 : 0.65,
      metalness: style.foil ? 0.65 : 0.03,
    }),
    accent = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.6 }),
    cream = new THREE.MeshStandardMaterial({ color: "#f9e4c7", roughness: 0.83 }),
    dark = new THREE.MeshStandardMaterial({ color: "#43393b", roughness: 0.8 }),
    shine = new THREE.MeshStandardMaterial({ color: "#fff8e7", metalness: 0.25, roughness: 0.22 });
  const sphere = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  let tether: THREE.Line | undefined;
  if (style.kind === "balloon") {
    if (style.shape === "star" || style.shape === "heart") {
      const shape = new THREE.Shape();
      if (style.shape === "star") {
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (i * Math.PI) / 5,
            r = i % 2 ? 0.14 : 0.31;
          if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        shape.closePath();
      } else {
        shape.moveTo(0, -0.27);
        shape.bezierCurveTo(-0.51, 0.04, -0.27, 0.46, 0, 0.21);
        shape.bezierCurveTo(0.27, 0.46, 0.51, 0.04, 0, -0.27);
      }
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.025,
        bevelSegments: 2,
        steps: 1,
        curveSegments: 10,
      });
      geometry.translate(0, 0, -0.035);
      object.add(new THREE.Mesh(geometry, material));
      // Heat-sealed foil seam follows the actual silhouette in 3D.
      const contour = shape
        .getPoints(44)
        .map((p) => new THREE.Vector3(p.x * 0.93, p.y * 0.93, -0.084));
      const seam = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(contour),
        new THREE.LineBasicMaterial({ color: "#fff2dc" }),
      );
      object.add(seam);
    } else {
      sphere(object, 0, 0, 0, 0.245, 0.31, 0.14, material);
      if (style.shape === "bear")
        for (const side of [-1, 1]) sphere(object, side * 0.2, 0.24, 0, 0.11, 0.11, 0.08, material);
      for (const side of [-1, 1])
        sphere(object, side * 0.085, 0.025, -0.133, 0.027, 0.033, 0.013, dark);
      if (style.shape === "bear") {
        sphere(object, 0, -0.105, -0.128, 0.093, 0.065, 0.028, cream);
        sphere(object, 0, -0.075, -0.159, 0.027, 0.019, 0.01, dark);
      } else {
        const smile = new THREE.EllipseCurve(0, -0.035, 0.083, 0.08, Math.PI, Math.PI * 2, false, 0)
          .getPoints(12)
          .map((p) => new THREE.Vector3(p.x, p.y, -0.143));
        object.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(smile),
            new THREE.LineBasicMaterial({ color: "#43393b" }),
          ),
        );
      }
    }
    sphere(object, -0.105, 0.12, -0.145, 0.035, 0.074, 0.009, shine);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.06, 6), material);
    knot.position.y = -0.32;
    object.add(knot);
    tether = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 13 }, () => new THREE.Vector3()),
      ),
      new THREE.LineBasicMaterial({ color: "#f0e8d6" }),
    );
    tether.name = "held-balloon-string";
    root.add(tether);
  } else {
    object.name = `teddy-${style.trim}`;
    sphere(object, 0, -0.13, 0, 0.15, 0.19, 0.1, material);
    sphere(object, 0, 0.075, 0, 0.17, 0.15, 0.11, material);
    sphere(object, 0, -0.15, -0.083, 0.094, 0.13, 0.027, cream);
    sphere(object, 0, 0.02, -0.09, 0.075, 0.052, 0.03, cream);
    for (const side of [-1, 1]) {
      sphere(object, side * 0.135, 0.195, 0, 0.072, 0.072, 0.052, material);
      sphere(object, side * 0.135, 0.195, -0.038, 0.035, 0.036, 0.012, cream);
      sphere(object, side * 0.055, 0.09, -0.105, 0.019, 0.022, 0.009, dark);
      sphere(object, side * 0.17, -0.115, 0, 0.061, 0.13, 0.059, material).rotation.z = side * 0.35;
      sphere(object, side * 0.094, -0.29, -0.005, 0.078, 0.073, 0.069, material);
    }
    sphere(object, 0, 0.039, -0.121, 0.023, 0.017, 0.012, dark);
    if (style.trim === "bow") {
      for (const side of [-1, 1])
        sphere(object, side * 0.048, -0.055, -0.096, 0.048, 0.028, 0.02, accent);
      sphere(object, 0, -0.055, -0.108, 0.025, 0.022, 0.016, accent);
    } else {
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.103, 0.022, 6, 12), accent);
      neck.rotation.x = Math.PI / 2;
      neck.position.y = -0.04;
      object.add(neck);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.041, 0.16, 0.022), accent);
      tail.position.set(0.047, -0.125, -0.103);
      object.add(tail);
    }
  }
  function update(time: number) {
    const pose = souvenirPose(g, time);
    if (style!.kind === "balloon") {
      object.position.set(pose.x, pose.lift, pose.z);
      object.rotation.z = pose.roll;
      if (tether) {
        const positions = tether.geometry.attributes.position;
        for (let i = 0; i < 13; i++) {
          const t = i / 12;
          positions.setXYZ(
            i,
            (pose.x + Math.sin(pose.roll) * 0.35) * t + Math.sin(t * Math.PI) * 0.025,
            (pose.lift - Math.cos(pose.roll) * 0.35) * t,
            pose.z * t,
          );
        }
        positions.needsUpdate = true;
        tether.geometry.computeBoundingSphere();
      }
    }
  }
  const usedMaterials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh)
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((value) =>
        usedMaterials.add(value),
      );
  });
  for (const value of [material, accent, cream, dark, shine])
    if (!usedMaterials.has(value)) value.dispose();
  update(0);
  return { root, update };
}
