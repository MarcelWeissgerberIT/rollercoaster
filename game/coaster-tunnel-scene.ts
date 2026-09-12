import * as THREE from "three";
import type { Park, Point } from "./simulation";
import {
  parkCoasterTunnels,
  tunnelRingPoint,
  TUNNEL_INNER_RADIUS,
  TUNNEL_PORTAL_RADIUS,
  type TunnelFrame,
} from "./coaster-tunnels";

const vector = (p: Point) => new THREE.Vector3(p.x * 5, (p.z ?? 0) * 5, p.y * 5);
const sides = 20;
function shellGeometry(frames: TunnelFrame[], inner: number, outer?: number) {
  const positions: number[] = [],
    indices: number[] = [];
  for (const frame of frames)
    for (let side = 0; side <= sides; side++) {
      const p = vector(tunnelRingPoint(frame, (side * Math.PI * 2) / sides, inner));
      positions.push(p.x, p.y, p.z);
    }
  for (let row = 1; row < frames.length; row++)
    for (let side = 0; side < sides; side++) {
      const a = (row - 1) * (sides + 1) + side,
        b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  if (outer !== undefined) {
    const start = positions.length / 3;
    for (const frame of [frames[0], frames.at(-1)!])
      for (const radius of [inner, outer])
        for (let side = 0; side <= sides; side++) {
          const p = vector(tunnelRingPoint(frame, (side * Math.PI * 2) / sides, radius));
          positions.push(p.x, p.y, p.z);
        }
    // Annular rim only. Never cap the central opening, including a closed track's seam.
    for (let end = 0; end < 2; end++)
      for (let side = 0; side < sides; side++) {
        const a = start + end * (sides + 1) * 2 + side,
          b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** Physical, open-ended rock linings belong to the world, including the coaster excluded
 * from populatePark for its on-ride camera. Terrain subtraction is handled by terrain-scene. */
export function addCoasterTunnelScene(scene: THREE.Scene, park: Park) {
  const layout = parkCoasterTunnels(park),
    root = new THREE.Group();
  root.name = "coaster-tunnels";
  if (!layout.spans.length) return root;
  const stone = new THREE.MeshStandardMaterial({
      color: "#777b71",
      roughness: 0.98,
      side: THREE.DoubleSide,
    }),
    rib = new THREE.MeshStandardMaterial({
      color: "#a49c84",
      roughness: 0.94,
      side: THREE.DoubleSide,
    }),
    portalStone = new THREE.MeshStandardMaterial({
      color: "#b6ad91",
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
    lamp = new THREE.MeshStandardMaterial({
      color: "#ffe7a6",
      emissive: "#ffbc56",
      emissiveIntensity: 1.7,
    }),
    lampShape = new THREE.BoxGeometry(0.15, 0.27, 0.12);
  for (const [index, span] of layout.spans.entries()) {
    const lining = new THREE.Mesh(shellGeometry(span.frames, TUNNEL_INNER_RADIUS), stone);
    lining.name = `coaster-tunnel-lining-${span.buildingId}-${index}`;
    lining.userData.openEnded = true;
    root.add(lining);
    // Stone ribs and warm marker lamps make progress through a long underground run visible.
    for (let i = 0; i < span.frames.length; i += 22) {
      const frame = span.frames[i],
        next = {
          ...frame,
          x: frame.x + frame.tangent.x * 0.035,
          y: frame.y + frame.tangent.y * 0.035,
          z: frame.z + frame.tangent.z * 0.035,
        },
        band = new THREE.Mesh(
          shellGeometry([frame, next], TUNNEL_INNER_RADIUS - 0.018, TUNNEL_INNER_RADIUS + 0.02),
          rib,
        );
      band.name = "tunnel-stone-rib";
      root.add(band);
      for (const angle of [Math.PI / 5, (Math.PI * 4) / 5]) {
        const marker = new THREE.Mesh(lampShape, lamp);
        marker.name = "tunnel-guide-lamp";
        marker.position.copy(vector(tunnelRingPoint(frame, angle, TUNNEL_INNER_RADIUS - 0.04)));
        root.add(marker);
      }
    }
    for (const portal of span.portals) {
      const f = portal.frame,
        front = {
          ...f,
          x: f.x + portal.outward.x * 0.12,
          y: f.y + portal.outward.y * 0.12,
          z: f.z + portal.outward.z * 0.12,
        },
        back = {
          ...f,
          x: f.x - portal.outward.x * 0.06,
          y: f.y - portal.outward.y * 0.06,
          z: f.z - portal.outward.z * 0.06,
        },
        group = new THREE.Group();
      group.name = `coaster-tunnel-portal-${portal.buildingId}-${portal.entry ? "entry" : "exit"}-${index}`;
      group.userData.frame = f;
      group.userData.outward = portal.outward;
      group.userData.openEnded = true;
      group.add(
        new THREE.Mesh(
          shellGeometry([front, back], TUNNEL_INNER_RADIUS, TUNNEL_PORTAL_RADIUS),
          portalStone,
        ),
      );
      group.add(new THREE.Mesh(shellGeometry([front, back], TUNNEL_PORTAL_RADIUS), portalStone));
      root.add(group);
    }
  }
  scene.add(root);
  return root;
}
