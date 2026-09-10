/** Camera-only quarter turns. World coordinates and saved parks never change. */
export const cameraTurn = (turn = 0) =>
  ((Math.round(Number.isFinite(turn) ? turn : 0) % 4) + 4) % 4;
export function rotateMapPoint(x: number, y: number, turn = 0) {
  switch (cameraTurn(turn)) {
    case 1:
      return { x: -y, y: x };
    case 2:
      return { x: -x, y: -y };
    case 3:
      return { x: y, y: -x };
    default:
      return { x, y };
  }
}
export type IsoProject = ((x: number, y: number, z?: number) => { x: number; y: number }) & {
  turn?: number;
};
export function viewDepth(project: IsoProject, x: number, y: number) {
  const p = rotateMapPoint(x, y, project.turn);
  return p.x + p.y;
}
export function viewFacing(project: IsoProject, dx: number, dy: number) {
  return rotateMapPoint(dx, dy, project.turn);
}
