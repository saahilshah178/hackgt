export type RelayPort = 0 | 1 | 2 | 3; // up, right, down, left
export interface RelayTile { ports: RelayPort[]; rotation: number }
export interface RelayEvaluation { connected: number[]; complete: boolean }
const STEPS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const SOLUTIONS: RelayPort[][][] = [
  [[1, 2], [1, 3], [2, 3], [0, 3], [0, 2], [0, 1], [0, 1], [1, 3], [0, 3]],
  [[1, 2], [1, 3], [2, 3], [2, 3], [0, 2], [1, 2], [0, 1], [1, 3], [0, 3]],
  [[1, 2], [2, 3], [2, 3], [0, 3], [0, 1], [1, 3], [0, 1], [1, 3], [0, 3]],
];

export function relayPorts(tile: RelayTile): RelayPort[] {
  return tile.ports.map(port => ((port + tile.rotation) % 4 + 4) % 4 as RelayPort);
}

/** Flood only reciprocal connections. The left inlet and right outlet face outside the board. */
export function evaluateRelay(board: readonly RelayTile[]): RelayEvaluation {
  if (board.length !== 9 || !relayPorts(board[3]).includes(3)) return { connected: [], complete: false };
  const visited = new Set<number>([3]);
  const queue = [3];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const row = Math.floor(index / 3), column = index % 3;
    for (const port of relayPorts(board[index])) {
      const [dr, dc] = STEPS[port];
      const nextRow = row + dr, nextColumn = column + dc;
      if (nextRow < 0 || nextRow > 2 || nextColumn < 0 || nextColumn > 2) continue;
      const next = nextRow * 3 + nextColumn;
      if (!visited.has(next) && relayPorts(board[next]).includes((port + 2) % 4 as RelayPort)) { visited.add(next); queue.push(next); }
    }
  }
  return { connected: [...visited], complete: visited.has(5) && relayPorts(board[5]).includes(1) };
}

/** Every tile is a rotation of a known route, so every seeded board is solvable. */
export function createRelayBoard(seed: number): RelayTile[] {
  let state = ((Math.trunc(seed) || 0) + 0x9e3779b9) >>> 0;
  const topology = ((Math.trunc(seed) || 0) % 3 + 3) % 3;
  const board = SOLUTIONS[topology].map(ports => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return { ports: [...ports], rotation: (state >>> 0) % 4 };
  });
  if (evaluateRelay(board).complete) board[3].rotation = 1;
  return board;
}
