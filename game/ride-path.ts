import * as THREE from "three";
import type { Point } from "./simulation";
export function makeRidePath(track: Point[]) {
  const raw = track
    .slice(0, -1)
    .map((p) => new THREE.Vector3(p.x * 5, (p.z ?? 0) * 5 + 1.1, p.y * 5));
  if (raw.length < 3) throw Error("Die Strecke ist zu kurz.");
  const curve = new THREE.CatmullRomCurve3(raw, true, "centripetal");
  curve.arcLengthDivisions = Math.max(2048, raw.length * 16);
  curve.updateArcLengths();
  const count = Math.min(4096, Math.max(512, Math.ceil(curve.getLength() * 6)));
  const tangents: THREE.Vector3[] = [],
    rights: THREE.Vector3[] = [],
    ups: THREE.Vector3[] = [],
    points: THREE.Vector3[] = [],
    costs = [0];
  const inversion: boolean[] = [];
  const transport = new THREE.Quaternion(),
    worldUp = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= count; i++) {
    const tangent = i === count ? tangents[0].clone() : curve.getTangentAt(i / count).normalize();
    tangents.push(tangent);
    const point = i === count ? points[0].clone() : curve.getPointAt(i / count);
    point.y = Math.max(1.1, point.y);
    points.push(point);
    const segment = Math.min(
      raw.length - 1,
      Math.floor(curve.getUtoTmapping(i / count, 0) * raw.length),
    );
    inversion.push(!!(track[segment]?.inversion || track[(segment + 1) % raw.length]?.inversion));
    const right =
      i && inversion[i] && inversion[i - 1]
        ? rights[i - 1]
            .clone()
            .applyQuaternion(transport.setFromUnitVectors(tangents[i - 1], tangent))
        : new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    right.addScaledVector(tangent, -right.dot(tangent)).normalize();
    rights.push(right);
  }
  // Keep ordinary track upright. Spread each inversion's residual twist inside that element only.
  for (let start = 0; start <= count; start++) {
    if (!inversion[start]) continue;
    let end = start;
    while (end < count && inversion[end + 1]) end++;
    const desired = new THREE.Vector3().crossVectors(tangents[end], worldUp).normalize();
    const twist = Math.atan2(
      new THREE.Vector3().crossVectors(rights[end], desired).dot(tangents[end]),
      rights[end].dot(desired),
    );
    for (let j = start; j <= end; j++)
      rights[j].applyAxisAngle(tangents[j], (twist * (j - start)) / Math.max(1, end - start));
    start = end;
  }
  for (let i = 0; i <= count; i++) {
    ups.push(new THREE.Vector3().crossVectors(rights[i], tangents[i]).normalize());
    if (i) {
      const distance = points[i].distanceTo(points[i - 1]);
      const speed =
        track[0].style === "launch"
          ? Math.max(6, 19 - tangents[i].y * 8)
          : Math.max(3, 11 - tangents[i].y * 9 + (points[i - 1].y - points[i].y) * 3);
      costs.push(costs[i - 1] + distance / speed);
    }
  }
  const matrix = new THREE.Matrix4();
  function at(u: number) {
    const p = Math.max(0, Math.min(1, u)) * count,
      index = Math.min(count - 1, Math.floor(p)),
      f = p - index;
    const position = points[index].clone().lerp(points[index + 1], f);
    const tangent = tangents[index]
      .clone()
      .lerp(tangents[index + 1], f)
      .normalize();
    const right = rights[index].clone().lerp(rights[index + 1], f);
    right.addScaledVector(tangent, -right.dot(tangent)).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();
    const quaternion = new THREE.Quaternion()
      .setFromRotationMatrix(matrix.makeBasis(right, up, tangent.clone().negate()))
      .normalize();
    return { position, tangent, right, up, quaternion };
  }
  function progress(time: number) {
    const cost = Math.min(costs[count], Math.max(0, time));
    let lo = 0,
      hi = count;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (costs[mid] < cost) lo = mid;
      else hi = mid;
    }
    return (lo + (cost - costs[lo]) / Math.max(1e-9, costs[hi] - costs[lo])) / count;
  }
  return {
    curve,
    points,
    rights,
    ups,
    count,
    length: curve.getLength(),
    duration: costs[count],
    at,
    progress,
  };
}
