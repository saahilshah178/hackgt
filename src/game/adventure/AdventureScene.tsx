'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { AdventureKind } from './campaigns';
import './scene.css';

export interface AdventureSceneProps {
  kind: AdventureKind;
  chapterIndex: number;
  platformer: boolean;
  restored: boolean;
  disabled: boolean;
  collected: boolean;
  relayActive: boolean;
  liveValue: number;
  onCollect(): void;
  onRelay(): void;
  onInteract(target: 'apparatus' | 'companion' | 'exit'): void;
}

type Target = 'apparatus' | 'companion' | 'exit' | 'note' | 'relay';
type Position = { x: number; y: number; vy: number; facing: number; moving: boolean };
const PALETTE = {
  observatory: { light: '#83f5eb', metal: '#dcb269', name: 'Astral alignment engine' },
  cell: { light: '#abf4ab', metal: '#ecc89d', name: 'Membrane transport chamber' },
  archive: { light: '#ffd99a', metal: '#d3b796', name: 'Evidence reconstruction desk' },
  station: { light: '#d1baff', metal: '#db9e83', name: 'Research resonance array' },
};
const LEDGES = [{ x: 20, end: 36, y: 70 }, { x: 44, end: 63, y: 59 }, { x: 69, end: 84, y: 70 }];
function destinations(platformer: boolean, chapterIndex: number): Record<Target, { x: number; y: number }> {
  const phase = chapterIndex % 3;
  return { companion: { x: 15 + phase * 2, y: 84 }, note: { x: platformer ? 26 + phase * 3 : 29 + phase * 5, y: platformer ? 70 : [76, 70, 80][phase] }, apparatus: { x: platformer ? 51 + phase * 4 : 49 + phase * 6, y: platformer ? 59 : 69 + phase * 3 }, relay: { x: platformer ? 73 + phase * 3 : [76, 80, 73][phase], y: platformer ? 70 : [78, 80, 74][phase] }, exit: { x: 92, y: 84 } };
}

function Explorer({ companion = false }: { companion?: boolean }) {
  return <svg viewBox="0 0 60 100" aria-hidden="true" className="adventure-explorer-art">
    <ellipse cx="30" cy="95" rx="22" ry="4" fill="#071a27" opacity=".45" />
    <g className="adventure-sprite-body">
      <path d="M18 49 13 86 27 90 31 61 36 89 49 85 43 47Z" fill={companion ? '#5b5658' : '#203e50'} stroke="#142a38" strokeWidth="2" />
      <path d="M14 84 13 93 28 93 28 86M36 86 36 93 51 93 49 84" fill="#142b3c" stroke="#9f8a68" strokeWidth="2" />
      <path d="m19 32-10 9-6 25 9 3 8-22 3 14 23-2-5-24Z" fill={companion ? '#b49a73' : '#d2aa68'} stroke="#453d37" strokeWidth="2" />
      <path d="m43 35 9 14 4 17-8 3-9-21" fill={companion ? '#b49a73' : '#d2aa68'} stroke="#453d37" strokeWidth="2" />
      <path d="M21 34 30 43 39 33 37 59 23 59Z" fill={companion ? '#537874' : '#3d6979'} />
      <path d="M19 52h24v5H19z" fill="#403c38" /><rect x="28" y="51" width="7" height="7" rx="1" fill="#e6cf88" />
      <path d="M14 38 13 59 20 58 20 34" fill="#655e4c" /><rect x="11" y="40" width="8" height="17" rx="3" fill="#486d6e" />
      <path d="m23 24 1 12 13 1 1-13" fill="#c69070" /><ellipse cx="30" cy="20" rx="12" ry="15" fill={companion ? '#a9694f' : '#dfaa7f'} stroke="#775244" strokeWidth="1.5" />
      <path d="M18 20Q13 1 29 3q18-1 14 18l-5-9-16 1-3 12" fill={companion ? '#d9d4bc' : '#263541'} />
      <path d="M17 17h27v7H17z" fill="#253846" /><path d="M20 18h10v5H20zM33 18h8v5h-8z" fill={companion ? '#e9c77e' : '#89e6e7'} />
      <path d="m22 31 9 5 9-5-5 11-11-2" fill={companion ? '#cebea4' : '#db7057'} /><path d="m25 39-7 12 7-2 6-9" fill={companion ? '#cebea4' : '#db7057'} />
      <circle cx="44" cy="46" r="3" fill="#a4fff0" /><path d="M6 65v6M52 66v6" stroke="#dfaa7f" strokeWidth="6" strokeLinecap="round" />
    </g>
  </svg>;
}

function Machine({ kind, restored, liveValue, glow }: { kind: AdventureKind; restored: boolean; liveValue: number; glow: string }) {
  const rotation = Number.isFinite(liveValue) ? liveValue * 60 : 0;
  return <svg viewBox="0 0 240 220" className={`adventure-machine-art ${restored ? 'is-restored' : ''}`} aria-hidden="true">
    <defs><radialGradient id={`machine-light-${kind}`}><stop stopColor={glow} stopOpacity=".5" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="120" cy="116" rx="112" ry="100" fill={`url(#machine-light-${kind})`} />
    <path d="M40 181h160l18 20H22z" fill="#283d45" stroke="#b89865" strokeWidth="3" /><path d="M58 183v-48M182 183v-48" stroke="#9a8762" strokeWidth="12" />
    {kind === 'observatory' && <><circle cx="120" cy="100" r="70" fill="#142f3c" stroke="#ddba70" strokeWidth="7" /><circle cx="120" cy="100" r="56" fill="none" stroke={glow} strokeWidth="1" strokeDasharray="2 10" /><g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '120px 100px' }}><ellipse cx="120" cy="100" rx="67" ry="25" fill="none" stroke="#b78c54" strokeWidth="5" transform="rotate(-30 120 100)" /><path d="M120 100 168 63" stroke={glow} strokeWidth="4" /><circle cx="168" cy="63" r="7" fill={glow} /></g><circle cx="120" cy="100" r="17" fill={restored ? glow : '#6b777b'} /><path d="M120 100v58M92 158h56" stroke="#ddba70" strokeWidth="4" /></>}
    {kind === 'cell' && <><path d="M65 38h110v111q-55 36-110 0Z" fill="#173d43" stroke="#d6b385" strokeWidth="7" /><path d="M76 83q44-14 88 0v63q-44 25-88 0Z" fill={glow} opacity=".18" /><path d="M120 45v108" stroke="#a9eecc" strokeWidth="7" strokeDasharray="8 4" />{[0, 1, 2, 3, 4, 5].map(i => <circle className="adventure-molecule" key={i} cx={83 + (i % 3) * 32} cy={65 + Math.floor(i / 3) * 57} r={5 + i % 3} fill={i % 2 ? '#f2c48d' : glow} style={{ animationDelay: `${i * -.7}s` }} />)}<path d="M101 31v-12h38v12M174 104h31v51h-19" fill="none" stroke="#bb9968" strokeWidth="6" /></>}
    {kind === 'archive' && <><path d="m34 115 44-40h129l-35 77H40Z" fill="#674f42" stroke="#b99463" strokeWidth="5" /><path d="m79 85 102 5-28 47-103-9Z" fill="#f5dfb1" />{[0, 1, 2, 3].map(i => <path key={i} d={`M${81 - i * 6} ${96 + i * 8}h65`} stroke="#776451" strokeWidth="2" />)}<path d="M174 99v-51l-32-15" fill="none" stroke="#af9873" strokeWidth="8" /><path d="m126 31 22-7 20 19-29 13Z" fill="#d5b674" /><path d="m139 54-45 70h83l-21-78" fill={glow} opacity=".15" /><circle cx="181" cy="146" r="22" fill="#253c43" stroke="#b99463" strokeWidth="5" /><path d="m181 145 10-11" stroke={glow} strokeWidth="3" /></>}
    {kind === 'station' && <><path d="M55 151V57h130v94" fill="#293548" stroke="#ba947b" strokeWidth="7" /><path d="M73 74h94v48H73z" fill="#101d32" stroke="#8a8177" strokeWidth="3" /><path d={`M78 99q10 ${-18 * Math.sin(liveValue)} 20 0t20 0t20 0t20 0`} stroke={glow} strokeWidth="3" fill="none" /><circle cx="85" cy="142" r="10" fill="#ba947b" /><circle cx="119" cy="142" r="10" fill="#ba947b" /><circle cx="155" cy="142" r="6" fill={restored ? glow : '#cd716b'} /><path d="M120 54V27m-23 4 23-15 23 15" stroke="#c8a07b" strokeWidth="5" fill="none" /><circle cx="120" cy="16" r="7" fill={glow} /></>}
    <rect x="89" y="174" width="62" height="14" rx="4" fill="#112e39" /><circle cx="102" cy="181" r="3" fill={restored ? glow : '#e59b64'} /><path d="M113 181h28" stroke={glow} strokeWidth="2" />
  </svg>;
}

export function AdventureScene(props: AdventureSceneProps) {
  const { kind, chapterIndex, platformer, restored, disabled, collected, relayActive, liveValue } = props;
  const palette = PALETTE[kind];
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
      else if (target === 'relay') { if (!p.relayActive) p.onRelay(); setMessage('Relay activated. Its signal now reaches the apparatus.'); }
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
            for (const ledge of LEDGES) if (a.x >= ledge.x - 1 && a.x <= ledge.end + 1 && oldY <= ledge.y + .2 && a.y >= ledge.y && a.vy >= 0) { a.y = ledge.y; a.vy = 0; }
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
  const nearby = (Object.entries(spots) as [Target, { x: number; y: number }][]).sort((a, b) => Math.hypot(position.x - a[1].x, position.y - a[1].y) - Math.hypot(position.x - b[1].x, position.y - b[1].y))[0];
  const inReach = Math.hypot(position.x - nearby[1].x, position.y - nearby[1].y) < 12;
  function travel(target: Target) {
    if (disabled) return;
    keys.current.clear();
    destination.current = { ...spots[target], target };
    setMessage(`Travelling to ${target === 'note' ? 'the field note' : target === 'apparatus' ? palette.name : `the ${target}`}.`);
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
  return <section className={`adventure-scene adventure-scene--${kind} adventure-composition-${chapterIndex % 3} ${restored ? 'is-restored' : ''}`} style={{ '--scene-light': palette.light, '--scene-metal': palette.metal } as React.CSSProperties} aria-label="Playable exploration scene">
    <div className="adventure-scene-viewport" ref={viewport} tabIndex={0} role="group" aria-label={`${palette.name} exploration. ${platformer ? 'Left and right to walk; Space or Up to jump.' : 'Arrow keys or WASD to walk.'} E to interact.`} aria-describedby={`${id}-controls`} onKeyDown={keyboard} onKeyUp={e => keys.current.delete(e.key.toLowerCase())} onBlur={() => keys.current.clear()} onPointerDown={event => {
      if (disabled || (event.target as HTMLElement).closest('button')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      destination.current = { x: Math.max(4, Math.min(96, (event.clientX - rect.left) / rect.width * 100)), y: platformer ? 84 : Math.max(42, Math.min(87, (event.clientY - rect.top) / rect.height * 100)) };
      event.currentTarget.focus({ preventScroll: true });
    }}>
      <div className="adventure-painted-world" style={{ backgroundImage: `url(/assets/adventure/${kind}.png)`, backgroundPosition: `${[35, 50, 65][chapterIndex % 3]}% center` }} />
      <div className="adventure-world-shade" /><div className="adventure-light-shaft" /><div className="adventure-light-shaft second" />
      <div className="adventure-restoration-aura" aria-hidden="true" />
      {restored && <div className="adventure-restoration-motes" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${12 + i * 7}%`, top: `${34 + (i % 4) * 12}%`, animationDelay: `${i * -.43}s` }} />)}</div>}
      <div className="adventure-room-arch" /><div className="adventure-ground" />
      <svg className="adventure-wall-study" viewBox="0 0 150 110" aria-hidden="true"><path d="M5 5h140v100H5z" fill="#102f3c" fillOpacity=".75" stroke={palette.metal} strokeWidth="2" />{kind === 'archive' ? <><path d="m23 24 40-3 4 62-40 3Zm56 11 46-6 4 52-47 5Z" fill="#d9c09a" /><path d="M31 34h23m-22 9h25m-24 10h21m36-11h25m-24 10h25m-24 10h20" stroke="#745b48" strokeWidth="2" /></> : kind === 'cell' ? <><path d="M71 17v75" stroke={palette.light} strokeWidth="6" strokeDasharray="6 3" />{[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={25 + (i % 3) * 45} cy={35 + Math.floor(i / 3) * 42} r={6 + i % 3} fill={palette.light} opacity=".6" />)}</> : <><circle cx="75" cy="54" r={30 + chapterIndex % 3 * 4} fill="none" stroke={palette.light} /><path d="M18 54h113M75 16v80m-42-15 76-52" stroke={palette.metal} strokeWidth="1" /><circle cx={95 + chapterIndex % 3 * 8} cy="34" r="4" fill={palette.light} /></>}<path d="M15 99h120" stroke={palette.metal} strokeWidth="2" /></svg>
      <svg className="adventure-world-lines" viewBox="0 0 1000 580" preserveAspectRatio="none" aria-hidden="true"><path d="M80 498H940M305 450v35h455v-38M550 340v145" fill="none" stroke={relayActive || restored ? palette.light : '#887d62'} strokeWidth="3" strokeDasharray={relayActive ? 'none' : '5 12'} opacity=".5" /><path d="M80 510h860M90 530h820M150 560h680" stroke="#bdac8c" opacity=".13" />{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${170 + i * 155} 580 500 360`} stroke="#bdac8c" opacity=".13" />)}</svg>
      <div className="adventure-scenery-column left"><i /><i /><i /></div><div className="adventure-scenery-column right"><i /><i /><i /></div>
      {platformer && LEDGES.map((ledge, i) => <div key={i} className="adventure-ledge" style={{ left: `${ledge.x}%`, top: `${ledge.y}%`, width: `${ledge.end - ledge.x}%` }}><span /></div>)}
      {platformer && <div className="adventure-hazard" style={{ left: `${hazardX}%` }} aria-hidden="true"><span>ϟ</span></div>}
      <button className="adventure-prop adventure-companion" style={{ left: `${spots.companion.x}%`, top: `${spots.companion.y}%` }} onClick={() => travel('companion')} disabled={disabled} aria-label="Travel to and speak with your guide"><span className="adventure-object-tag">Guide</span><Explorer companion /></button>
      <button className="adventure-prop adventure-apparatus" style={{ left: `${spots.apparatus.x}%`, top: `${spots.apparatus.y}%` }} onClick={() => travel('apparatus')} disabled={disabled} aria-label={`Travel to and inspect ${palette.name}`}><span className="adventure-object-tag">{restored ? 'Restored' : 'Apparatus'} <b>✦</b></span><Machine kind={kind} restored={restored} liveValue={liveValue} glow={palette.light} /></button>
      {!collected && <button className="adventure-prop adventure-note" style={{ left: `${spots.note.x}%`, top: `${spots.note.y}%` }} onClick={() => travel('note')} disabled={disabled} aria-label="Travel to and collect field note"><span className="adventure-object-tag">Field note</span><svg viewBox="0 0 70 70" aria-hidden="true"><path d="m15 16 37-6 6 43-37 7Z" fill="#f1d7a0" stroke="#c4a46b" strokeWidth="3" /><path d="m23 26 23-4M25 34l23-4M26 42l16-3" stroke="#8c6b4b" strokeWidth="3" /><path d="M10 65h50" stroke={palette.light} strokeWidth="2" /></svg></button>}
      <button className={`adventure-prop adventure-relay ${relayActive ? 'is-active' : ''}`} style={{ left: `${spots.relay.x}%`, top: `${spots.relay.y}%` }} onClick={() => travel('relay')} disabled={disabled} aria-label={relayActive ? 'Travel to active relay' : 'Travel to and activate relay'}><span className="adventure-object-tag">{relayActive ? 'Linked' : 'Relay'}</span><svg viewBox="0 0 80 115" aria-hidden="true"><path d="M14 110h52l-7-19H21zM28 93V53h24v40" fill="#34454d" stroke="#b79b72" strokeWidth="4" /><circle cx="40" cy="39" r="26" fill="#193b43" stroke="#c1a879" strokeWidth="4" /><path d="m40 17-12 24h13l-3 21 17-28H42l5-17" fill={relayActive ? palette.light : '#92896e'} /></svg></button>
      <button className={`adventure-prop adventure-exit ${restored ? 'is-open' : ''}`} style={{ left: `${spots.exit.x}%`, top: `${spots.exit.y}%` }} onClick={() => travel('exit')} disabled={disabled} aria-label={restored ? 'Travel to open exit and continue' : 'Inspect locked exit'}><span className="adventure-object-tag">{restored ? 'Continue →' : 'Sealed exit'}</span><svg viewBox="0 0 110 160" aria-hidden="true"><path d="M10 155V51Q55-13 100 51v104" fill="#152635" stroke="#9c9479" strokeWidth="9" /><path d="M25 155V56q30-44 60 0v99" fill={restored ? palette.light : '#2c3b47'} opacity={restored ? '.6' : '1'} /><path d="M55 39v109M25 86h60" stroke={restored ? '#fff0b4' : '#877f68'} strokeWidth="3" /><circle cx="55" cy="86" r="10" fill={restored ? '#fff6c9' : '#a89871'} /></svg></button>
      <div className={`adventure-player ${position.moving ? 'is-walking' : ''} ${recovering ? 'is-recovering' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%`, '--facing': position.facing } as React.CSSProperties}><Explorer /><span className="adventure-player-marker">You</span></div>
      <div className="adventure-foreground"><span /><span /><span /></div>
      <div className="adventure-scene-status">{restored ? 'WORLD RESTORED' : relayActive ? 'SIGNAL CONNECTED' : 'EXPLORE & RESTORE'}<span>{platformer ? 'Jump between the landing platforms' : 'Follow the lights to investigate'}</span></div>
      {inReach && !disabled && <button className="adventure-nearby" onClick={() => perform.current(nearby[0])}>E · {nearby[0] === 'apparatus' ? 'Inspect apparatus' : nearby[0] === 'companion' ? 'Speak to guide' : nearby[0] === 'note' ? 'Collect note' : nearby[0] === 'relay' ? 'Activate relay' : 'Use exit'}</button>}
    </div>
    <div className="adventure-scene-access"><p id={`${id}-controls`}>{platformer ? '← → / A D move · Space / ↑ jump' : 'Arrows / WASD move'} · E interact · Click the floor to travel</p><div className="adventure-object-actions" aria-label="Assisted object travel"><button disabled={disabled} onClick={() => travel('companion')}>Talk to guide</button><button disabled={disabled || collected} onClick={() => travel('note')}>{collected ? 'Note collected ✓' : 'Collect field note'}</button><button disabled={disabled} onClick={() => travel('relay')}>{relayActive ? 'Relay linked ✓' : 'Activate relay'}</button><button disabled={disabled} onClick={() => travel('apparatus')}>Inspect apparatus</button><button disabled={disabled} onClick={() => travel('exit')}>{restored ? 'Continue →' : 'Inspect exit'}</button></div><p className="adventure-travel-message" role="status" aria-live="polite">{message}</p></div>
  </section>;
}
