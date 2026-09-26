'use client';

import { useState } from 'react';
import type { AdventureKind } from './campaigns';
import './relay.css';

import { createRelayBoard, evaluateRelay, relayPorts } from './relay-board';
export { createRelayBoard, evaluateRelay, relayPorts } from './relay-board';
export type { RelayPort, RelayTile, RelayEvaluation } from './relay-board';
const DIRECTIONS = ['up', 'right', 'down', 'left'];

const THEMES = {
  observatory: { title: 'Route the starlight', source: 'Light source', receiver: 'Telescope', instruction: 'Turn the brass mirrors to carry a continuous beam from the left inlet to the telescope on the right.', signal: 'Send light', unit: 'beam', color: '#89eee0' },
  cell: { title: 'Reconnect the nutrient channel', source: 'Nutrients', receiver: 'Cell chamber', instruction: 'Rotate the channels to make a continuous nutrient route from the left inlet to the cell chamber on the right.', signal: 'Release nutrients', unit: 'channel', color: '#a1e6a6' },
  archive: { title: 'Repair the reading-lamp circuit', source: 'Supply', receiver: 'Desk lamp', instruction: 'Turn the connectors to route current from the left supply to the reading lamp on the right.', signal: 'Switch on lamp', unit: 'circuit', color: '#f1c882' },
  station: { title: 'Reroute auxiliary power', source: 'Generator', receiver: 'Research array', instruction: 'Rotate the conduits to build an unbroken connection from the left generator to the research array on the right.', signal: 'Send power', unit: 'circuit', color: '#c5b1ff' },
};
const PORT_POINTS = [[50, 0], [100, 50], [50, 100], [0, 50]];

export function RelayPuzzle({ kind, seed, onComplete }: { kind: AdventureKind; seed: number; onComplete(): void }) {
  const theme = THEMES[kind];
  const [board, setBoard] = useState(() => createRelayBoard(seed));
  const [status, setStatus] = useState('The receiver is dark. Rotate a conduit to begin tracing the route.');
  const [completed, setCompleted] = useState(false);
  const evaluation = evaluateRelay(board);
  function rotate(index: number) {
    setBoard(previous => previous.map((tile, tileIndex) => tileIndex === index ? { ...tile, rotation: (tile.rotation + 1) % 4 } : tile));
    setStatus('Conduit rotated. Follow the glowing route from the left inlet.');
  }
  function send() {
    if (completed) return;
    if (!evaluation.complete) { setStatus(`The ${theme.unit} stops before the receiver. Match both ends of each connection, including the left inlet and right outlet. You can keep adjusting.`); return; }
    setCompleted(true);
    setStatus(`${theme.receiver} connected. The relay is ready.`);
    onComplete();
  }
  return <section className={`relay-puzzle relay-puzzle--${kind}`} style={{ '--relay-glow': theme.color } as React.CSSProperties} aria-label="Relay routing challenge">
    <div className="relay-heading"><span>AUXILIARY RELAY / ROTATE & CONNECT</span><h3>{theme.title}</h3><p>{theme.instruction}</p></div>
    <div className="relay-board-frame">
      <div className="relay-terminal relay-terminal-source"><span className="relay-terminal-orb">◉</span><span>{theme.source}</span></div>
      <div className="relay-board" aria-label="Nine rotatable conduits, arranged in three rows">
        {board.map((tile, index) => {
          const ports = relayPorts(tile);
          const lit = evaluation.connected.includes(index);
          return <button type="button" key={index} className={`relay-tile ${lit ? 'is-lit' : ''}`} disabled={completed} onClick={() => rotate(index)} aria-label={`Rotate conduit row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}; connects ${ports.map(port => DIRECTIONS[port]).join(' and ')}`}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id={`relay-plate-${index}`}><stop stopColor="#425359" /><stop offset="1" stopColor="#1b3039" /></radialGradient></defs><rect x="4" y="4" width="92" height="92" rx="10" fill={`url(#relay-plate-${index})`} stroke="#c8b789" strokeOpacity=".25" />{[0, 1, 2, 3].map(n => <circle key={n} cx={n % 2 ? 88 : 12} cy={n < 2 ? 12 : 88} r="2" fill="#8b967e" />)}{ports.map(port => {
              const [x, y] = PORT_POINTS[port];
              return <g key={port}><path d={`M50 50L${x} ${y}`} stroke="#121e27" strokeWidth="18" /><path d={`M50 50L${x} ${y}`} stroke="#a19f82" strokeWidth="12" /><path className="relay-flow" d={`M50 50L${x} ${y}`} stroke={lit ? theme.color : '#4a5b5e'} strokeWidth="5" /><circle cx={x === 0 ? 3 : x === 100 ? 97 : x} cy={y === 0 ? 3 : y === 100 ? 97 : y} r="4" fill={lit ? theme.color : '#7b8c84'} /></g>;
            })}<circle cx="50" cy="50" r="12" fill="#20333c" stroke={lit ? theme.color : '#b2a881'} strokeWidth="3" /><circle cx="50" cy="50" r="4" fill={lit ? theme.color : '#617577'} /><path d="m76 71 8 7-9 5m9-5q-5-13-17-7" stroke="#dae2c7" fill="none" strokeWidth="2" /></svg>
            <span className="relay-tile-coordinate">{Math.floor(index / 3) + 1}.{index % 3 + 1}</span>
          </button>;
        })}
      </div>
      <div className={`relay-terminal relay-terminal-receiver ${evaluation.complete ? 'is-lit' : ''}`}><span className="relay-terminal-orb">◉</span><span>{theme.receiver}</span></div>
    </div>
    <p className="relay-route-status">{evaluation.complete ? 'Receiver reached · ready to send' : `${evaluation.connected.length} of 9 conduits receiving signal`}</p>
    <p className="relay-controls-note">Click or tap a tile to turn it clockwise. Keyboard: Tab to a tile, then Enter or Space.</p>
    <div className="relay-puzzle-actions"><button type="button" className="relay-send" onClick={send} disabled={completed}>{completed ? 'Relay connected ✓' : theme.signal} <span>→</span></button><button type="button" className="relay-reset" disabled={completed} onClick={() => { setBoard(createRelayBoard(seed)); setStatus('Original scramble restored. Try a different route.'); }}>Reset rotations</button></div>
    <p className="relay-feedback" role="status" aria-live="polite">{status}</p>
  </section>;
}
