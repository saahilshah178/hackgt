"use client";
import { useState } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import { canVisit, MAP_LOCATIONS, MAP_SIZE, MAP_START, moveOnMap } from "./map";
import styles from "./activity.module.css";

export function TopDownMap({ spec, completed, available, onOpen }: {
  spec: GameSpec; completed: ReadonlySet<string>; available: ReadonlySet<string>; onOpen: (id: string) => void;
}) {
  const [position, setPosition] = useState(MAP_START);
  const at = MAP_LOCATIONS.findIndex(p => p.x === position.x && p.y === position.y);
  const encounter = spec.encounters[at];
  const move = (dx: number, dy: number) => setPosition(p => moveOnMap(p, dx, dy));
  const directions: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  return <section className={styles.map} aria-label="Bird's-eye exploration map">
    <p>Move the survey marker with arrow keys, WASD, or the direction buttons. Paths connect locations in every direction.</p>
    <svg viewBox="0 0 450 450" role="group" tabIndex={0} aria-label={`Exploration map. Marker at column ${position.x + 1}, row ${position.y + 1}. Use arrow keys to move.`}
      onKeyDown={event => { const direction = directions[event.key]; if (direction) { event.preventDefault(); move(...direction); } }}>
      <rect width="450" height="450" rx="16" fill="#1c302c" />
      {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, cell) => {
        const x = cell % MAP_SIZE; const y = Math.floor(cell / MAP_SIZE);
        return <rect key={cell} x={x * 50 + 3} y={y * 50 + 3} width="44" height="44" rx="6" fill={canVisit({ x, y }) ? "#34534a" : "#101f1b"} />;
      })}
      {spec.encounters.map((e, i) => {
        const point = MAP_LOCATIONS[i];
        const title = e.conceptIds.map(id => spec.concepts.find(c => c.id === id)?.name).join(" + ");
        return <g key={e.id}><title>{title}: {completed.has(e.id) ? "complete" : available.has(e.id) ? "open" : "locked"}</title>
          <rect x={point.x * 50 + 10} y={point.y * 50 + 10} width="30" height="30" rx="4" fill={completed.has(e.id) ? "#74b989" : available.has(e.id) ? "#edce8e" : "#7a817d"} />
          <text x={point.x * 50 + 25} y={point.y * 50 + 30} textAnchor="middle" fill="#132820" fontSize="14">{completed.has(e.id) ? "✓" : i + 1}</text>
        </g>;
      })}
      <circle cx={position.x * 50 + 25} cy={position.y * 50 + 25} r="20" fill="none" stroke="#fff" strokeWidth="4" />
    </svg>
    <div className={styles.help} aria-label="Map movement">
      <button aria-label="Move north" onClick={() => move(0, -1)}>↑</button><button aria-label="Move west" onClick={() => move(-1, 0)}>←</button>
      <button aria-label="Move south" onClick={() => move(0, 1)}>↓</button><button aria-label="Move east" onClick={() => move(1, 0)}>→</button>
    </div>
    <div aria-live="polite"><p>{encounter ? encounter.conceptIds.map(id => spec.concepts.find(c => c.id === id)?.name).join(" + ") : "Follow a path to a numbered discovery."}</p>
      {encounter && <button disabled={!available.has(encounter.id)} onClick={() => onOpen(encounter.id)}>
        {completed.has(encounter.id) ? "Discovered" : available.has(encounter.id) ? "Explore this location" : "Complete its earlier discoveries first"}
      </button>}
    </div>
    <details><summary>Map legend</summary><ol>{spec.encounters.map(e => <li key={e.id}>{e.conceptIds.map(id => spec.concepts.find(c => c.id === id)?.name).join(" + ")} · {completed.has(e.id) ? "complete" : available.has(e.id) ? "open" : "locked"}</li>)}</ol></details>
  </section>;
}
