/** Metres around the ride centre, shared by the park sprites and the 3D seats. */
export function bumperPose(index: number, phase: number) {
  const a = phase * Math.PI * 4 + (index * Math.PI) / 2;
  const radius = index % 2 ? 3.7 : 4.8;
  const x = Math.cos(a) * radius,
    z = Math.sin(a) * radius * 0.76;
  return { x, y: 0.5, z, yaw: Math.atan2(Math.sin(a), -Math.cos(a) * 0.76) };
}
export function balloonPose(index: number, phase: number) {
  const a = phase * Math.PI * 2 + (index * Math.PI) / 2;
  return {
    x: Math.cos(a) * 4.5,
    z: Math.sin(a) * 4.5,
    y: 1.5 + (1 - Math.cos(phase * Math.PI * 2)) * 3.5,
    yaw: -a,
  };
}
