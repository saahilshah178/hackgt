export interface Point { x: number; y: number }
export const MAP_SIZE = 9;
export const MAP_START: Point = { x: 2, y: 2 };
export function canVisit({ x, y }: Point): boolean {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return false;
  return !(x === 4 && y !== 2 && y !== 6) && !(y === 4 && x !== 2 && x !== 6);
}
export function moveOnMap(position: Point, dx: number, dy: number): Point {
  if (Math.abs(dx) + Math.abs(dy) !== 1) return position;
  const next = { x: position.x + dx, y: position.y + dy };
  return canVisit(next) ? next : position;
}
/** Spread discoveries across all quadrants instead of a left-to-right corridor. */
export const MAP_LOCATIONS: readonly Point[] = [
  { x: 2, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }, { x: 6, y: 2 },
  { x: 0, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }, { x: 8, y: 0 },
  { x: 2, y: 0 }, { x: 6, y: 8 }, { x: 0, y: 6 }, { x: 8, y: 2 },
  { x: 0, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 8 }, { x: 6, y: 0 },
  { x: 1, y: 1 }, { x: 7, y: 7 }, { x: 1, y: 7 }, { x: 7, y: 1 },
];
