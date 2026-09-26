import { describe, expect, it } from 'vitest';
import { createRelayBoard, evaluateRelay, relayPorts } from '../src/game/adventure/relay-board';

describe('relay conduit routing', () => {
  const solved = () => createRelayBoard(42).map(tile => ({ ...tile, rotation: 0 }));
  it('connects the left inlet to the right receiver through bends on row one', () => {
    const result = evaluateRelay(solved());
    expect(result.complete).toBe(true);
    expect(result.connected).toEqual([3, 0, 1, 2, 5]);
  });
  it('rejects a broken bend instead of crossing nonreciprocal ports', () => {
    const board = solved();
    board[2].rotation = 2;
    expect(evaluateRelay(board)).toEqual({ connected: [3, 0, 1], complete: false });
  });
  it('requires the source to face the left inlet', () => {
    const board = solved();
    board[3].rotation = 1;
    expect(evaluateRelay(board)).toEqual({ connected: [], complete: false });
  });
  it('requires the receiver to face the right outlet even when connected', () => {
    const board = solved();
    board[5].ports = [0, 2];
    expect(evaluateRelay(board).connected).toContain(5);
    expect(evaluateRelay(board).complete).toBe(false);
  });
  it('produces deterministic, varied, initially incomplete and solvable scrambles', () => {
    expect(createRelayBoard(3)).toEqual(createRelayBoard(3));
    expect(createRelayBoard(3)).not.toEqual(createRelayBoard(4));
    for (let seed = -10; seed < 120; seed++) {
      const board = createRelayBoard(seed);
      expect(evaluateRelay(board).complete).toBe(false);
      expect(board.every(tile => tile.rotation >= 0 && tile.rotation <= 3)).toBe(true);
      expect(evaluateRelay(board.map(tile => ({ ...tile, rotation: 0 }))).complete).toBe(true);
    }
  });
  it('varies the solved route between upper, lower, and central detours', () => {
    const solvedPath = (seed: number) => evaluateRelay(createRelayBoard(seed).map(tile => ({ ...tile, rotation: 0 })));
    expect(solvedPath(42).connected).toEqual([3, 0, 1, 2, 5]);
    expect(solvedPath(43).connected).toEqual([3, 6, 7, 8, 5]);
    expect(solvedPath(44).connected).toEqual([3, 0, 1, 4, 5]);
    expect([42, 43, 44].every(seed => solvedPath(seed).complete)).toBe(true);
  });
  it('rotates clockwise and wraps correctly after four turns', () => {
    expect(relayPorts({ ports: [0, 3], rotation: 1 })).toEqual([1, 0]);
    expect(relayPorts({ ports: [0, 3], rotation: 4 })).toEqual([0, 3]);
  });
  it('rejects incomplete board dimensions', () => { expect(evaluateRelay([]).complete).toBe(false); });
});
