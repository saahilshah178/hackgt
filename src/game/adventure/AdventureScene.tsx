'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { AdventureKind } from './campaigns';
import './scene.css';
import { RoomDressing, ROOM_NAMES } from './RoomDressing';

export interface AdventureSceneProps {
  kind: AdventureKind;
  chapterIndex: number;
  platformer: boolean;
  restored: boolean;
  disabled: boolean;
  collected: boolean;
  relayActive: boolean;
  liveValue: number;
  worldAction?: { target: 'relay' | 'mission'; label: string };
  locationLabel?: string;
  apparatusLabel?: string;
  onMission?(): void;
  onCollect(): void;
  onRelay(): void;
  onInteract(target: 'apparatus' | 'companion' | 'exit'): void;
}

type Target = 'apparatus' | 'companion' | 'exit' | 'note' | 'relay' | 'mission';
type Position = { x: number; y: number; vy: number; facing: number; moving: boolean };
const PALETTE = {
  observatory: { light: '#83f5eb', metal: '#dcb269', name: 'Astral alignment engine' },
  cell: { light: '#abf4ab', metal: '#ecc89d', name: 'Membrane transport chamber' },
  archive: { light: '#ffd99a', metal: '#d3b796', name: 'Evidence reconstruction desk' },
  station: { light: '#d1baff', metal: '#db9e83', name: 'Research resonance array' },
};
const LEDGES = [{ x: 20, end: 36, y: 70 }, { x: 44, end: 63, y: 59 }, { x: 69, end: 84, y: 70 }];
function ledges(chapterIndex: number) {
  return LEDGES.map((ledge, i) => ({ x: ledge.x + [0, -2, 3, -3, 2, -1][chapterIndex % 6], end: ledge.end + [0, -2, 3, -3, 2, -1][chapterIndex % 6], y: ledge.y + [[0, 0, 0], [3, 4, -17], [-1, -5, -4], [3, 1, -1], [-3, -4, -8], [1, -2, -22]][chapterIndex % 6][i] }));
}
function destinations(platformer: boolean, chapterIndex: number): Record<Target, { x: number; y: number }> {
  const phase = chapterIndex % 5;
  const platforms = ledges(chapterIndex);
  const mission = { x: platformer ? (platforms[2].x + platforms[2].end) / 2 : [76, 80, 73, 69, 78][phase], y: platformer ? platforms[2].y : [78, 80, 74, 65, 82][phase] };
  return { companion: { x: 15 + phase * 2, y: 84 }, note: { x: platformer ? (platforms[0].x + platforms[0].end) / 2 : [29, 34, 39, 24, 42][phase], y: platformer ? platforms[0].y : [76, 70, 80, 62, 75][phase] }, apparatus: { x: platformer ? (platforms[1].x + platforms[1].end) / 2 : [49, 55, 61, 54, 47][phase], y: platformer ? platforms[1].y : [69, 72, 75, 78, 66][phase] }, relay: mission, mission, exit: { x: 92, y: 84 } };
}

function Explorer({ companion = false, kind }: { companion?: boolean; kind: AdventureKind }) {
  if (kind === 'archive') return <svg viewBox="0 0 60 100" aria-hidden="true" className="adventure-explorer-art"><ellipse cx="30" cy="95" rx="23" ry="4" fill="#16191c" opacity=".4" /><g className="adventure-sprite-body"><path d="m21 56-5 33h13l4-27 6 27h12l-9-35" fill={companion ? '#5f5751' : '#35494e'} stroke="#242f34" strokeWidth="2" /><path d="m16 86-3 7h17v-6m9 0 1 6h14l-4-8" fill="#24262d" stroke="#ad9174" strokeWidth="1.5" /><path d="M21 32 10 42l-3 24 9 2 6-20-1 18h22l-3-19 9 16 7-4-9-20-10-7Z" fill={companion ? '#ac8863' : '#6b8b86'} stroke="#3c4745" strokeWidth="2" /><path d="m23 32 8 5 7-6-3 25h-9Z" fill="#e5d9bb" /><path d="m20 34 8 9-6 7m17-17-6 11 7 6" stroke="#d4c7a3" strokeWidth="2" fill="none" /><path d="M24 24v11h12V24" fill="#b97859" /><ellipse cx="30" cy="19" rx="11" ry="14" fill={companion ? '#b57859' : '#d59a75'} /><path d="M19 22Q12 2 29 3q17-1 15 20l-5-11-17 2-3 15" fill={companion ? '#d9d4c2' : '#3b302a'} /><path d="M24 20h2m8 0h2" stroke="#392e29" strokeWidth="2" /><path d="M28 28h6" stroke="#875947" strokeWidth="1.5" /><path d="M19 19h10v6H19zm13 0h9v6h-9zm-3 3h3" stroke="#b4986f" strokeWidth="1.5" fill="none" /><path d="m39 52 13-3 5 21-13 3Z" fill="#c69e63" stroke="#f0d3a2" strokeWidth="2" /><path d="m43 56 8-2m-7 7 8-2" stroke="#80664d" strokeWidth="1.5" /><path d="M10 66v6m39-9 5 4" stroke="#c78f6c" strokeWidth="6" strokeLinecap="round" /><path d="M24 59h16" stroke="#c0ae88" strokeWidth="2" /></g></svg>;
  const suit = kind === 'cell' ? (companion ? '#8cba9a' : '#d0dfb8') : kind === 'station' ? (companion ? '#b5a4d0' : '#d6d3cf') : companion ? '#b49a73' : '#d2aa68';
  return <svg viewBox="0 0 60 100" aria-hidden="true" className="adventure-explorer-art">
    <ellipse cx="30" cy="95" rx="22" ry="4" fill="#071a27" opacity=".45" />
    <g className="adventure-sprite-body">
      <path d="M18 49 13 86 27 90 31 61 36 89 49 85 43 47Z" fill={companion ? '#5b5658' : '#203e50'} stroke="#142a38" strokeWidth="2" />
      <path d="M14 84 13 93 28 93 28 86M36 86 36 93 51 93 49 84" fill="#142b3c" stroke="#9f8a68" strokeWidth="2" />
      <path d="m19 32-10 9-6 25 9 3 8-22 3 14 23-2-5-24Z" fill={suit} stroke="#453d37" strokeWidth="2" />
      <path d="m43 35 9 14 4 17-8 3-9-21" fill={suit} stroke="#453d37" strokeWidth="2" />
      <path d="M21 34 30 43 39 33 37 59 23 59Z" fill={companion ? '#537874' : '#3d6979'} />
      <path d="M19 52h24v5H19z" fill="#403c38" /><rect x="28" y="51" width="7" height="7" rx="1" fill="#e6cf88" />
      <path d="M14 38 13 59 20 58 20 34" fill="#655e4c" /><rect x="11" y="40" width="8" height="17" rx="3" fill="#486d6e" />
      <path d="m23 24 1 12 13 1 1-13" fill="#c69070" /><ellipse cx="30" cy="20" rx="12" ry="15" fill={companion ? '#a9694f' : '#dfaa7f'} stroke="#775244" strokeWidth="1.5" />
      <path d="M18 20Q13 1 29 3q18-1 14 18l-5-9-16 1-3 12" fill={companion ? '#d9d4bc' : '#263541'} />
      <path d="M17 17h27v7H17z" fill="#253846" /><path d="M20 18h10v5H20zM33 18h8v5h-8z" fill={companion ? '#e9c77e' : '#89e6e7'} />
      {(kind === 'cell' || kind === 'station') && <><path d="M15 24V14Q15-3 31-2q16 0 16 17v11L39 36H23Z" fill={kind === 'cell' ? '#9cd4c72e' : '#d1d1ce'} stroke={kind === 'cell' ? '#a0e5cf' : '#8a9ba9'} strokeWidth="3" /><path d="M19 14q12-8 24 0v13q-12 8-24 0Z" fill="#123947" stroke="#b8e8df" strokeWidth="1.5" /><path d="m21 16 7-3m-7 7 12-5" stroke="#d4fcf1" strokeWidth="2" opacity=".5" /><path d="M25 31h13v5H25" fill="#869b9b" /><path d="M14 37 9 45v11" stroke="#a0cbb9" strokeWidth="4" fill="none" /><rect x="25" y="43" width="14" height="9" rx="2" fill="#203f4b" /><circle cx="29" cy="47" r="2" fill={kind === 'cell' ? '#b4ffad' : '#d0b1ff'} />{kind === 'station' && <path d="M48 12V1m-3 1h6" stroke="#c3b0de" strokeWidth="2" />}</>}
      <path d="m22 31 9 5 9-5-5 11-11-2" fill={companion ? '#cebea4' : '#db7057'} /><path d="m25 39-7 12 7-2 6-9" fill={companion ? '#cebea4' : '#db7057'} />
      <circle cx="44" cy="46" r="3" fill="#a4fff0" /><path d="M6 65v6M52 66v6" stroke="#dfaa7f" strokeWidth="6" strokeLinecap="round" />
    </g>
  </svg>;
}

export function AdventureScene(props: AdventureSceneProps) {
  const { kind, chapterIndex, platformer, restored, disabled, collected, relayActive } = props;
  const palette = { ...PALETTE[kind], name: props.apparatusLabel || PALETTE[kind].name };
  const worldAction = props.worldAction || { target: 'relay' as const, label: 'Activate relay' };
  const location = props.locationLabel || ROOM_NAMES[kind][chapterIndex % ROOM_NAMES[kind].length];
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const keys = useRef(new Set<string>());
  const actor = useRef<Position>({ x: 9, y: 84, vy: 0, facing: 1, moving: false });
  const destination = useRef<{ x: number; y: number; target?: Target } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 9, y: 84, vy: 0, facing: 1, moving: false });
  const [message, setMessage] = useState('Explore the room. Approach an object and press E, or choose an object below.');
  const [hazardX, setHazardX] = useState(43);
  const [recovering, setRecovering] = useState(false);
  const perform = useRef<(target: Target) => void>(() => {});

  useEffect(() => { latest.current = props; });
  useEffect(() => {
    perform.current = (target) => {
      const p = latest.current;
      if (p.disabled) return;
      if (target === 'exit' && !p.restored) { setMessage('The exit needs the restored apparatus. Bring this room back to life first.'); return; }
      if (target === 'note') { if (!p.collected) p.onCollect(); setMessage('Field note recovered. Open your journal to read the discovery.'); }
      else if (target === 'relay') { if (!p.relayActive) p.onRelay(); setMessage('Inspect the relay controls to connect this chamber.'); }
      else if (target === 'mission') { p.onMission?.(); setMessage('Your field task is open. Investigate this room’s evidence.'); }
      else p.onInteract(target);
    };
  });
  useEffect(() => {
    actor.current = { x: 9, y: 84, vy: 0, facing: 1, moving: false };
    destination.current = null;
    keys.current.clear();
    // Rendering catches the reset on the next animation frame.
  }, [chapterIndex, kind]);
  useEffect(() => {
    let frame = 0;
    let previous = 0;
    let cooldown = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tick = (time: number) => {
      const dt = Math.min((time - previous) / 1000 || 0, .04);
      previous = time;
      const p = latest.current;
      const a = actor.current;
      const hazard = 43 + (reducedMotion.matches ? 0 : Math.sin(time / 1100) * 7);
      setHazardX(hazard);
      if (!p.disabled) {
        const target = destination.current;
        const horizontal = (keys.current.has('arrowright') || keys.current.has('d') ? 1 : 0) - (keys.current.has('arrowleft') || keys.current.has('a') ? 1 : 0);
        const vertical = (keys.current.has('arrowdown') || keys.current.has('s') ? 1 : 0) - (keys.current.has('arrowup') || keys.current.has('w') ? 1 : 0);
        a.moving = false;
        if (target) {
          // Assisted travel gives touch and non-spatial users access to every ledge.
          const dx = target.x - a.x, dy = target.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 1) { a.x = target.x; a.y = target.y; a.vy = 0; destination.current = null; if (target.target) perform.current(target.target); }
          else { const step = Math.min(distance, dt * 29); a.x += dx / distance * step; a.y += dy / distance * step; a.facing = dx < 0 ? -1 : 1; a.moving = true; a.vy = 0; }
        } else {
          a.x = Math.max(4, Math.min(96, a.x + horizontal * dt * 22));
          if (horizontal) { a.facing = horizontal; a.moving = true; }
          if (p.platformer) {
            const oldY = a.y;
            a.vy += dt * 105;
            a.y += a.vy * dt;
            for (const ledge of ledges(p.chapterIndex)) if (a.x >= ledge.x - 1 && a.x <= ledge.end + 1 && oldY <= ledge.y + .2 && a.y >= ledge.y && a.vy >= 0) { a.y = ledge.y; a.vy = 0; }
            if (a.y >= 84) { a.y = 84; a.vy = 0; }
            if (Math.abs(a.x - hazard) < 3.5 && a.y > 79 && time > cooldown) {
              a.x = 9; a.y = 84; a.vy = 0; cooldown = time + 1800; setRecovering(true); setMessage('The energy current returned you to the safe landing. Your discoveries are kept.');
            }
          } else { a.y = Math.max(42, Math.min(87, a.y + vertical * dt * 22)); if (vertical) a.moving = true; }
        }
      } else { a.moving = false; keys.current.clear(); }
      if (cooldown && time > cooldown) { cooldown = 0; setRecovering(false); }
      setPosition({ ...a });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const spots = destinations(platformer, chapterIndex);
  const nearby = (Object.entries(spots) as [Target, { x: number; y: number }][]).filter(([target]) => target !== (worldAction.target === 'relay' ? 'mission' : 'relay') && !(target === 'note' && collected)).sort((a, b) => Math.hypot(position.x - a[1].x, position.y - a[1].y) - Math.hypot(position.x - b[1].x, position.y - b[1].y))[0];
  const inReach = Math.hypot(position.x - nearby[1].x, position.y - nearby[1].y) < 12;
  function travel(target: Target) {
    if (disabled) return;
    keys.current.clear();
    destination.current = { ...spots[target], target };
    setMessage(`Travelling to ${target === 'note' ? 'the field note' : target === 'apparatus' ? palette.name : target === worldAction.target ? worldAction.label : `the ${target}`}.`);
    viewport.current?.focus({ preventScroll: true });
  }
  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e'].includes(key)) event.preventDefault();
    if (disabled) return;
    if (key === 'e' && !event.repeat) { if (inReach) perform.current(nearby[0]); else setMessage('Move closer to a lit object, or select it below for assisted travel.'); }
    else if ((key === ' ' || key === 'arrowup' || key === 'w') && platformer && !event.repeat && actor.current.vy === 0) { destination.current = null; actor.current.vy = -64; }
    else { keys.current.add(key); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) destination.current = null; }
  }
  return <section className={`adventure-scene adventure-scene--${kind} adventure-composition-${chapterIndex % 3} ${restored ? 'is-restored' : ''}`} style={{ '--scene-light': palette.light, '--scene-metal': palette.metal } as React.CSSProperties} aria-label={`${location} playable exploration scene`}>
    <div className="adventure-scene-viewport" ref={viewport} tabIndex={0} role="group" aria-label={`${palette.name} exploration. ${platformer ? 'Left and right to walk; Space or Up to jump.' : 'Arrow keys or WASD to walk.'} E to interact.`} aria-describedby={`${id}-controls`} onKeyDown={keyboard} onKeyUp={e => keys.current.delete(e.key.toLowerCase())} onBlur={() => keys.current.clear()} onPointerDown={event => {
      if (disabled || (event.target as HTMLElement).closest('button')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      destination.current = { x: Math.max(4, Math.min(96, (event.clientX - rect.left) / rect.width * 100)), y: platformer ? 84 : Math.max(42, Math.min(87, (event.clientY - rect.top) / rect.height * 100)) };
      event.currentTarget.focus({ preventScroll: true });
    }}>
      <div className="adventure-painted-world" style={{ backgroundImage: `url(/assets/adventure/${kind}.png)`, backgroundPosition: `${[15, 34, 57, 78, 92, 45][chapterIndex % 6]}% ${[40, 58, 25, 70][chapterIndex % 4]}%` }} />
      <div className="adventure-world-shade" /><div className="adventure-light-shaft" /><div className="adventure-light-shaft second" />
      <div className="adventure-restoration-aura" aria-hidden="true" />
      {restored && <div className="adventure-restoration-motes" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${12 + i * 7}%`, top: `${34 + (i % 4) * 12}%`, animationDelay: `${i * -.43}s` }} />)}</div>}
      <div className="adventure-ground" /><RoomDressing kind={kind} chapterIndex={chapterIndex} platformer={platformer} restored={restored} />
      <svg className="adventure-world-lines" viewBox="0 0 1000 580" preserveAspectRatio="none" aria-hidden="true"><path d="M80 498H940M305 450v35h455v-38M550 340v145" fill="none" stroke={relayActive || restored ? palette.light : '#887d62'} strokeWidth="3" strokeDasharray={relayActive ? 'none' : '5 12'} opacity=".5" /><path d="M80 510h860M90 530h820M150 560h680" stroke="#bdac8c" opacity=".13" />{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${170 + i * 155} 580 500 360`} stroke="#bdac8c" opacity=".13" />)}</svg>

      {platformer && ledges(chapterIndex).map((ledge, i) => <div key={i} className="adventure-ledge" style={{ left: `${ledge.x}%`, top: `${ledge.y}%`, width: `${ledge.end - ledge.x}%` }}><span /></div>)}
      {platformer && <div className="adventure-hazard" style={{ left: `${hazardX}%` }} aria-hidden="true"><span>ϟ</span></div>}
      <button className="adventure-prop adventure-companion" style={{ left: `${spots.companion.x}%`, top: `${spots.companion.y}%` }} onClick={() => travel('companion')} disabled={disabled} aria-label="Travel to and speak with your guide"><span className="adventure-object-tag">Guide</span><Explorer companion kind={kind} /></button>
      <button className="adventure-prop adventure-apparatus" style={{ left: `${spots.apparatus.x}%`, top: `${spots.apparatus.y}%` }} onClick={() => travel('apparatus')} disabled={disabled} aria-label={`Travel to and inspect ${palette.name}`}><span className="adventure-object-tag">{restored ? 'Restored' : 'Apparatus'} <b>✦</b></span><svg className="adventure-inspection-panel" viewBox="0 0 90 58" aria-hidden="true"><path d="M5 6h80v43H5Z" fill="#203a43" stroke={palette.metal} strokeWidth="4" /><path d="M13 14h43v25H13Z" fill="#102a35" stroke="#719b98" strokeWidth="2" /><path d="M18 31 25 24 33 29 42 19 50 24" fill="none" stroke={palette.light} strokeWidth="2" /><circle cx="69" cy="22" r="7" fill={restored ? palette.light : palette.metal} /><path d="M62 38h14" stroke={palette.light} strokeWidth="3" /></svg></button>
      {!collected && <button className="adventure-prop adventure-note" style={{ left: `${spots.note.x}%`, top: `${spots.note.y}%` }} onClick={() => travel('note')} disabled={disabled} aria-label="Travel to and collect field note"><span className="adventure-object-tag">Field note</span><svg viewBox="0 0 70 70" aria-hidden="true"><path d="m15 16 37-6 6 43-37 7Z" fill="#f1d7a0" stroke="#c4a46b" strokeWidth="3" /><path d="m23 26 23-4M25 34l23-4M26 42l16-3" stroke="#8c6b4b" strokeWidth="3" /><path d="M10 65h50" stroke={palette.light} strokeWidth="2" /></svg></button>}
      <button className={`adventure-prop adventure-relay ${relayActive ? 'is-active' : ''}`} style={{ left: `${spots.relay.x}%`, top: `${spots.relay.y}%` }} onClick={() => travel(worldAction.target)} disabled={disabled} aria-label={`Travel to ${worldAction.label}`}><span className="adventure-object-tag">{worldAction.target === 'mission' ? worldAction.label : relayActive ? 'Linked' : 'Relay'}</span><svg viewBox="0 0 80 115" aria-hidden="true"><path d="M14 110h52l-7-19H21zM28 93V53h24v40" fill="#34454d" stroke="#b79b72" strokeWidth="4" /><circle cx="40" cy="39" r="26" fill="#193b43" stroke="#c1a879" strokeWidth="4" />{worldAction.target === 'relay' ? <path d="m40 17-12 24h13l-3 21 17-28H42l5-17" fill={relayActive ? palette.light : '#92896e'} /> : <><path d="M25 26h30v27H25Z" fill="#d9c69b" /><path d="M30 33h20m-20 7h17m-17 7h12" stroke="#6b6854" strokeWidth="2" /></>}</svg></button>
      <button className={`adventure-prop adventure-exit ${restored ? 'is-open' : ''}`} style={{ left: `${spots.exit.x}%`, top: `${spots.exit.y}%` }} onClick={() => travel('exit')} disabled={disabled} aria-label={restored ? 'Travel to open exit and continue' : 'Inspect locked exit'}><span className="adventure-object-tag">{restored ? 'Continue →' : 'Sealed exit'}</span><svg viewBox="0 0 110 160" aria-hidden="true"><path d="M10 155V51Q55-13 100 51v104" fill="#152635" stroke="#9c9479" strokeWidth="9" /><path d="M25 155V56q30-44 60 0v99" fill={restored ? palette.light : '#2c3b47'} opacity={restored ? '.6' : '1'} /><path d="M55 39v109M25 86h60" stroke={restored ? '#fff0b4' : '#877f68'} strokeWidth="3" /><circle cx="55" cy="86" r="10" fill={restored ? '#fff6c9' : '#a89871'} /></svg></button>
      <div className={`adventure-player ${position.moving ? 'is-walking' : ''} ${recovering ? 'is-recovering' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%`, '--facing': position.facing } as React.CSSProperties}><Explorer kind={kind} /><span className="adventure-player-marker">You</span></div>
      <div className="adventure-foreground"><span /><span /><span /></div>
      <div className="adventure-scene-status">{restored ? 'WORLD RESTORED' : relayActive ? 'SIGNAL CONNECTED' : 'EXPLORE & RESTORE'}<span>{location}</span></div>
      {inReach && !disabled && <button className="adventure-nearby" onClick={() => perform.current(nearby[0])}>E · {nearby[0] === 'apparatus' ? 'Inspect apparatus' : nearby[0] === 'companion' ? 'Speak to guide' : nearby[0] === 'note' ? 'Collect note' : nearby[0] === worldAction.target ? worldAction.label : 'Use exit'}</button>}
    </div>
    <div className="adventure-scene-access"><p id={`${id}-controls`}>{platformer ? '← → / A D move · Space / ↑ jump' : 'Arrows / WASD move'} · E interact · Click the floor to travel</p><div className="adventure-object-actions" aria-label="Assisted object travel"><button disabled={disabled} onClick={() => travel('companion')}>Talk to guide</button><button disabled={disabled || collected} onClick={() => travel('note')}>{collected ? 'Note collected ✓' : 'Collect field note'}</button><button disabled={disabled} onClick={() => travel(worldAction.target)}>{worldAction.target === 'mission' ? worldAction.label : relayActive ? 'Relay linked' : worldAction.label}</button><button disabled={disabled} onClick={() => travel('apparatus')}>Inspect apparatus</button><button disabled={disabled} onClick={() => travel('exit')}>{restored ? 'Continue →' : 'Inspect exit'}</button></div><p className="adventure-travel-message" role="status" aria-live="polite">{message}</p></div>
  </section>;
}
