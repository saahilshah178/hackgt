"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameSpec } from "../../contracts/gamespec";
import type { World3D, WorldLine } from "../../contracts/world3d";
import { composeWorld, type ComposedWorld, type Quality } from "../../world3d/core/compose";
import { distanceToPolyline } from "../../world3d/core/heightfield";
import { CLOTH_HEX } from "../../world3d/kit/materials";
import { describeAnswer } from "../describe-answer";
import { installGameDebug, type GameDebugHandle } from "../debug";
import { ChallengePanel, type ChallengeResult, type ChallengeTeach } from "../genre/ChallengePanel";
import { FieldGuide } from "../genre/teach/FieldGuide";
import { conceptsToTeach, lessonMap } from "../genre/teach/lessons";
import { TEACH_CSS } from "../genre/teach/teach.styles";
import { EncounterRunner, type Current } from "../runner/encounter-runner";
import { EndScreen } from "../systems/EndScreen";
import { WorldAudio } from "./audio";
import { KeyboardInput, isTyping } from "./input";
import { buildMoments, currentAct, leads as rankLeads, momentForNpc, nearestTarget, targetCandidates, withArticle, type MomentInfo } from "./model";
import { buildPhysics } from "./physics";
import { createDirector, dialogueShot, flyoverPath, landmarkShot, orbitGoal } from "./scene/camera";
import { GameCanvas } from "./scene/GameCanvas";
import type { SceneRefs } from "./scene/refs";
import { createLive, useStore, type Pose, type Target } from "./store";
import { ChallengeSheet } from "./ui/ChallengeSheet";
import { Dialogue, type Choice, type SpokenLine } from "./ui/Dialogue";
import { Compass, ControlsHint, InteractPrompt, QuestTracker, Toasts, type CompassMark, type Toast } from "./ui/hud";
import { MapOverlay, Minimap } from "./ui/map";
import { NpcLabels } from "./ui/NpcLabels";
import { TouchControls } from "./ui/TouchControls";
import { DEFAULT_SETTINGS, IntroCard, Journal, PauseMenu, playerLooks, provenanceLines, type Settings } from "./ui/overlays";
import { W3_CSS } from "./ui/styles";
import { themeFor } from "./ui/themes";

/*
 * World3DClient: plays a world3d GameSpec. Like GenreClient it owns the free-order EncounterRunner (grading, hints,
 * telemetry, mastery), the lessons before a concept's first challenge, the Field Guide and the end screen; what it adds
 * is the frame: a 3D world to roam (./scene), characters to talk to, the quest and its leads, the HUD, and a story
 * state machine:
 *
 *   loading → intro (flyover + title card) → explore ⇄ dialogue → challenge → dialogue (success) → … → finale → ended
 *
 * The world is composed once (src/world3d/core/compose.ts); per-frame state lives in `SceneRefs` and the live store,
 * so React renders only when the story changes.
 */

type Phase = "loading" | "intro" | "explore" | "dialogue" | "challenge" | "finale" | "ended";

interface DialogueState {
  lines: SpokenLine[];
  choices: Choice[];
  handlers: Record<string, () => void>;
  /** free chat with this npc (null: none) */
  chatNpc: string | null;
}

const SETTINGS_KEY = "w3:settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function autoQuality(): Quality {
  if (typeof navigator === "undefined") return "medium";
  if (navigator.webdriver) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores >= 8 && mem >= 8) return "high";
  return cores >= 4 ? "medium" : "low";
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The mechanic that framed each reward, for the toast icon. */
const REWARD_ICON: Record<string, string> = { key: "🗝", relic: "✦", map_fragment: "🗺", tool: "⚒", insight: "✧", blessing: "☀" };

export function World3DClient({ spec }: { spec: GameSpec & { world3d: World3D } }) {
  const world = spec.world3d;
  const router = useRouter();
  const theme = useMemo(() => themeFor(world.ui.hudTheme, world.ui.accent), [world.ui.hudTheme, world.ui.accent]);
  // client-only (the play page loads the game with ssr: false), so storage and media queries are readable here
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    return prefersReducedMotion() ? { ...s, reducedMotion: true } : s;
  });
  const quality: Quality = settings.quality === "auto" ? autoQuality() : settings.quality;
  const reducedMotion = settings.reducedMotion;
  const reducedMotionRef = useRef(reducedMotion);
  const flewRef = useRef(false);
  // procedural ambience + cues; the AudioContext only starts on a user gesture (Begin)
  const audioRef = useRef<WorldAudio | null>(null);
  if (!audioRef.current) audioRef.current = new WorldAudio(world, spec.theme.musicMood);
  const audio = audioRef.current;

  // ---- composition (≈0.2–1 s): after the loading screen has painted
  const [composed, setComposed] = useState<ComposedWorld | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setComposed(composeWorld(world, { quality }));
      // the first composition opens the title card (a quality change later recomposes without replaying it)
      setPhase((p) => {
        if (p !== "loading") return p;
        setFlying(!reducedMotionRef.current && world.opening.flyover.length > 0);
        return "intro";
      });
    }, 30);
    return () => clearTimeout(t);
  }, [world, quality]);

  const runnerRef = useRef<EncounterRunner | null>(null);
  if (!runnerRef.current) runnerRef.current = new EncounterRunner(spec, { order: "free" });
  const runner = runnerRef.current;
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [active, setActive] = useState<Current | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [collected, setCollected] = useState<ReadonlySet<string>>(new Set());
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [met, setMet] = useState<ReadonlySet<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panel, setPanel] = useState<null | "guide" | "journal" | "map" | "pause">(null);
  const [guideFocus, setGuideFocus] = useState<string | null>(null);
  const [lookIndex, setLookIndex] = useState(0);
  // photo mode (P): the HUD hides, movement stops, the camera still orbits; a button saves the frame
  const [photo, setPhoto] = useState(false);
  const toastId = useRef(0);
  const pets = useRef(0);

  const lessons = useMemo(() => lessonMap(spec), [spec]);
  const taughtRef = useRef<Set<string>>(new Set());
  const planRef = useRef<string[]>([]);

  // ---- scene refs: one object per composition (physics and camera follow the composed world). A recomposition (the
  // quality setting changed) keeps the player where they stood instead of sending them back to the spawn.
  const prevRefs = useRef<SceneRefs | null>(null);
  const refs = useMemo<SceneRefs | null>(() => {
    if (!composed) return null;
    const was = prevRefs.current?.player;
    const s = was ? { ...composed.spawn, x: was.x, y: composed.hf.height(was.x, was.z), z: was.z, facing: was.yaw } : composed.spawn;
    const input = new KeyboardInput();
    const director = createDirector(s.facing);
    // the opening flyover, only on the first composition and when motion is welcome
    if (!was && !flewRef.current && !reducedMotionRef.current && composed.world.opening.flyover.length > 0) {
      flewRef.current = true;
      const path = flyoverPath(composed, composed.world.opening.flyover, s);
      path.onDone = () => setFlying(false);
      director.mode = path;
    }
    const live = createLive({ x: s.x, y: s.y, z: s.z, yaw: s.facing });
    return {
      world: composed.world,
      composed,
      physics: buildPhysics(composed),
      input,
      director,
      live,
      player: { x: s.x, y: s.y, z: s.z, vy: 0, grounded: true, yaw: s.facing, speed: 0 },
      control: { enabled: false },
      talkingTo: { id: null },
      labels: new Map(),
    };
  }, [composed]);

  useEffect(() => {
    prevRefs.current = refs;
  }, [refs]);
  const moments = useMemo(() => (composed ? buildMoments(spec, composed) : new Map<string, MomentInfo>()), [spec, composed]);
  const solved = runner.solved();
  const available = runner.available();
  const bossId = runner.progression.bossId;
  const act = currentAct(world, solved);
  // spawn-relative order here; the tracker re-sorts by the live distance
  const leadList = useMemo(() => rankLeads(moments, available, composed?.spawn ?? { x: 0, z: 0 }, act), [moments, available, composed, act]);
  const leadsByNpc = useMemo(() => {
    const m = new Map<string, "lead" | "done">();
    for (const l of leadList) if (l.anchor.kind === "npc") m.set(l.anchor.id, "lead");
    return m;
  }, [leadList]);
  const goalReady = !!bossId && available.includes(bossId);

  // ---- speakers
  const npcById = useMemo(() => new Map(world.npcs.map((n) => [n.id, n])), [world.npcs]);
  const looks = useMemo(() => playerLooks(world.setting.style), [world.setting.style]);
  const speak = useCallback(
    (line: WorldLine | { speakerId: string; text: string }): SpokenLine => {
      const id = "speaker" in line ? line.speaker : line.speakerId;
      if (id === "narrator") return { name: null, text: line.text };
      if (id === "you") return { name: "You", color: CLOTH_HEX[looks[lookIndex].color], mono: "Y", text: line.text };
      const npc = npcById.get(id) ?? world.npcs.find((n) => n.characterId === id);
      if (npc) return { name: npc.name, role: npc.role, color: CLOTH_HEX[npc.look.color], mono: npc.name[0], text: line.text };
      const ch = spec.characters.find((c) => c.id === id);
      return { name: ch?.name ?? null, role: ch?.role, color: "#6b5a45", mono: ch?.name[0], text: line.text };
    },
    [npcById, world.npcs, spec.characters, looks, lookIndex],
  );

  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => audio.setEnabled(settings.sound), [audio, settings.sound]);

  const toast = useCallback((icon: string, title: string, text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, icon, title, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500);
  }, []);

  // ---- camera helpers
  const follow = useCallback(() => {
    if (!refs) return;
    refs.director.mode = { kind: "follow" };
    refs.talkingTo.id = null;
  }, [refs]);
  const frameTarget = useCallback(
    (kind: "npc" | "landmark", id: string, shiftLeft: number) => {
      if (!refs) return;
      const p = refs.player;
      if (kind === "npc") {
        const pose = refs.live.get().npcs[id] ?? refs.composed.npcs.find((n) => n.id === id);
        if (!pose) return;
        const shot = dialogueShot(p, pose, npcById.get(id)?.look.height ?? 1);
        // a side sheet (challenge) covers the right: shift left; the dialogue box covers the bottom: shift up
        refs.director.mode = { ...shot, shiftLeft, shiftUp: shiftLeft > 0 ? 0 : shot.shiftUp };
        refs.talkingTo.id = id;
      } else {
        const l = refs.composed.landmarks.find((x) => x.id === id);
        if (l) refs.director.mode = { ...landmarkShot(p, l, shiftLeft), shiftUp: shiftLeft > 0 ? 0 : 0.12 };
      }
    },
    [refs, npcById],
  );

  // ---- dialogue plumbing
  const endDialogue = useCallback(() => {
    setDialogue(null);
    setPhase("explore");
    follow();
  }, [follow]);
  const say = useCallback(
    (lines: SpokenLine[], choices: (Choice & { run: () => void })[], chatNpc: string | null = null) => {
      setDialogue({ lines, choices: choices.map((c) => ({ id: c.id, label: c.label, primary: c.primary })), handlers: Object.fromEntries(choices.map((c) => [c.id, c.run])), chatNpc });
      setPhase("dialogue");
    },
    [],
  );

  const requirementHint = useCallback(
    (encounterId: string): string => {
      const node = runner.progression.byId.get(encounterId);
      const missing = node?.requires.filter((r) => !solved.has(r)) ?? [];
      const next = missing.map((r) => moments.get(r)).find((m) => !!m);
      return next ? `First: ${next.moment.objective.replace(/\.$/, "")}.` : "Come back a little later in the story.";
    },
    [runner, solved, moments],
  );

  // ---- challenges
  const openChallenge = useCallback(
    (m: MomentInfo) => {
      if (!runner.available().includes(m.encounterId)) return;
      runner.focus(m.encounterId);
      const cur = runner.peek(m.encounterId);
      planRef.current = cur ? conceptsToTeach(cur.encounter, taughtRef.current, spec) : [];
      setActive(cur);
      setResult(null);
      setLastHint(null);
      setDialogue(null);
      setPhase("challenge");
      frameTarget(m.anchor.kind, m.anchor.id, 0.22);
      audio.cue("open");
      bump();
    },
    [runner, spec, frameTarget, audio],
  );

  const finale = useCallback(() => {
    if (refs?.composed.goal && !reducedMotion) refs.director.mode = orbitGoal(refs.composed.goal);
    audio.cue("finale");
    const outro = spec.narrative.outro.map((l) => speak(l));
    setDialogue({
      lines: outro.length ? outro : [{ name: null, text: "The journey is complete." }],
      choices: [{ id: "results", label: "See how you did", primary: true }],
      handlers: { results: () => setPhase("ended") },
      chatNpc: null,
    });
    setPhase("finale");
  }, [refs, reducedMotion, spec.narrative.outro, speak, audio]);

  const closeChallenge = useCallback(
    (success: boolean) => {
      const cur = active;
      runner.unfocus();
      setActive(null);
      setResult(null);
      setLastHint(null);
      bump();
      if (!cur || !success) {
        endDialogue();
        return;
      }
      const m = moments.get(cur.encounter.id);
      if (!m) {
        endDialogue();
        return;
      }
      toast(REWARD_ICON[m.moment.reward.kind] ?? "✦", m.moment.reward.name, m.moment.reward.description);
      audio.cue("reward");
      if (m.moment.opens) {
        setOpened((o) => new Set([...o, m.moment.opens!]));
        audio.cue("gate");
      }
      const isBoss = cur.encounter.id === bossId || runner.finished;
      const after = isBoss ? finale : endDialogue;
      say(
        m.moment.success.map((l) => speak(l)),
        [{ id: "continue", label: isBoss ? "Finish the journey" : "Continue", primary: true, run: after }],
        m.anchor.kind === "npc" ? m.anchor.id : null,
      );
    },
    [active, runner, moments, toast, bossId, finale, endDialogue, say, speak, audio],
  );

  // ---- interaction (E)
  const interact = useCallback(
    (target: Target | null) => {
      if (!target || !refs) return;
      if (target.kind === "collectible") {
        const item = world.collectibles.items.find((i) => i.id === target.id);
        setCollected((c) => new Set([...c, target.id]));
        audio.cue("relic");
        if (item) toast("✦", item.title, item.fact);
        return;
      }
      if (target.kind === "animal") {
        pets.current++;
        audio.cue("pet");
        const kind = target.id.split("_")[0];
        const lines: Record<string, string> = {
          cat: "The cat purrs and winds around your ankles.",
          dog: "The dog wags its whole body.",
          goat: "The goat nibbles your sleeve, hopefully.",
          camel: "The camel gives you a long, unimpressed look.",
          horse: "The horse nuzzles your shoulder.",
        };
        toast("♥", pets.current === 1 ? "A new friend" : `Friends made: ${pets.current}`, lines[kind] ?? "It seems pleased to see you.");
        return;
      }
      if (target.kind === "npc") {
        const npc = npcById.get(target.id);
        if (!npc) return;
        setMet((s) => new Set([...s, npc.id]));
        frameTarget("npc", npc.id, 0);
        const m = momentForNpc(moments, npc.id, solved);
        const bye = { id: "leave", label: "Goodbye", run: endDialogue };
        if (m && available.includes(m.encounterId)) {
          say(
            [speak({ speaker: npc.id, text: npc.greeting }), ...m.moment.approach.map((l) => speak(l))],
            [{ id: "take", label: m.encounterId === bossId ? "Face the final challenge" : "Take on the challenge", primary: true, run: () => openChallenge(m) }, { id: "later", label: "Not yet", run: endDialogue }],
            npc.id,
          );
        } else if (m && !solved.has(m.encounterId)) {
          say([speak({ speaker: npc.id, text: npc.greeting }), { name: null, text: requirementHint(m.encounterId) }], [bye], npc.id);
        } else {
          const extra = npc.barks[met.size % Math.max(1, npc.barks.length)];
          say([speak({ speaker: npc.id, text: m ? (extra ?? npc.greeting) : npc.greeting })], [bye], npc.id);
        }
        return;
      }
      if (target.kind === "moment") {
        const m = moments.get(target.id);
        if (!m) return;
        // a character who speaks for this place and stands by it gets the shot; otherwise frame the place itself
        const voice = m.moment.approach.map((l) => l.speaker).find((sp) => sp !== "narrator" && sp !== "you");
        const voicePose = voice ? (refs.live.get().npcs[voice] ?? refs.composed.npcs.find((n) => n.id === voice)) : undefined;
        if (voice && voicePose && Math.hypot(voicePose.x - m.x, voicePose.z - m.z) < m.radius + 18) {
          frameTarget("npc", voice, 0);
          setMet((s) => new Set([...s, voice]));
        } else frameTarget("landmark", m.anchor.id, 0);
        const ok = { id: "ok", label: "OK", run: endDialogue };
        if (available.includes(m.encounterId)) {
          say(
            m.moment.approach.map((l) => speak(l)),
            [{ id: "take", label: m.encounterId === bossId ? "Face the final challenge" : "Take on the challenge", primary: true, run: () => openChallenge(m) }, { id: "later", label: "Not yet", run: endDialogue }],
          );
        } else if (solved.has(m.encounterId)) {
          say([speak(m.moment.success[m.moment.success.length - 1])], [ok]);
        } else {
          const l = refs.composed.landmarks.find((p) => p.id === m.anchor.id);
          const desc = world.landmarks.find((x) => x.id === m.anchor.id)?.description;
          say([{ name: null, text: `${l?.name ?? m.place}. ${desc ?? ""}`.trim() }, { name: null, text: requirementHint(m.encounterId) }], [ok]);
        }
        return;
      }
      if (target.kind === "goal") {
        const g = refs.composed.goal;
        const remaining = spec.encounters.length - solved.size;
        say([{ name: null, text: `${g?.name ?? "The goal"}. ${world.quest.goal.description}` }, { name: null, text: remaining > 0 ? `${remaining} challenge${remaining === 1 ? "" : "s"} still stand between you and the goal.` : "Everything is ready." }], [{ id: "ok", label: "OK", run: endDialogue }]);
      }
    },
    [refs, world, toast, npcById, frameTarget, moments, solved, available, say, speak, bossId, openChallenge, endDialogue, requirementHint, met, spec.encounters.length, audio],
  );

  // ---- the target finder the player calls ~12×/s
  const findTarget = useCallback(
    (pose: Pose): Target | null => {
      if (!refs) return null;
      const live = refs.live.get();
      return nearestTarget(pose, targetCandidates({ world: refs.world, composed: refs.composed, moments, npcPoses: live.npcs, collected, animals: live.animals }));
    },
    [refs, moments, collected],
  );

  /** the first moment of play: how the world marks where to go */
  const orient = useCallback(() => {
    const g = composed?.goal?.name ?? "the goal";
    setTimeout(() => toast("◆", "Follow the light", `Gold beams mark your leads. The tallest, over ${withArticle(g)}, marks your goal.`), 600);
  }, [composed, toast]);

  /** end the flyover early: land behind the player and show the full title card */
  const skipFlight = useCallback(() => {
    audio.start();
    if (refs && refs.director.mode.kind === "path") {
      const done = refs.director.mode.onDone;
      refs.director.mode = { kind: "follow" };
      done?.();
    }
    setFlying(false);
  }, [refs, audio]);

  const begin = useCallback(() => {
    audio.start();
    setFlying(false);
    follow();
    const intro = spec.narrative.intro.map((l) => speak(l));
    if (intro.length) {
      const speakerNpc = world.npcs.find((n) => n.characterId === spec.narrative.intro[0].speakerId);
      say(intro, [{ id: "go", label: "Let's begin", primary: true, run: () => (endDialogue(), orient()) }], speakerNpc?.id ?? null);
    } else {
      setPhase("explore");
      orient();
    }
  }, [follow, spec.narrative.intro, speak, world.npcs, say, endDialogue, audio, orient]);

  // input and control gating
  useEffect(() => {
    if (!refs) return;
    const enabled = phase === "explore" && panel === null;
    refs.control.enabled = enabled;
    refs.input.setEnabled(enabled && !photo);
    refs.input.arrowsTurn = settings.arrowsTurn;
    refs.director.sensitivity = settings.sensitivity;
    refs.director.invertY = settings.invertY;
  }, [refs, phase, panel, settings, photo]);

  // the river swells as the player walks toward the water
  useEffect(() => {
    if (!refs) return;
    const hf = refs.composed.hf;
    const t = setInterval(() => {
      const p = refs.player;
      let d = Infinity;
      if (hf.river.length > 1) d = Math.max(0, distanceToPolyline(p.x, p.z, hf.river).d - hf.riverWidth / 2);
      else if (hf.waterLevel !== null)
        for (let r = 0; r <= 80 && d === Infinity; r += 10)
          for (let k = 0; k < 8; k++) if (hf.waterDepth(p.x + Math.cos(k * 0.785) * r, p.z + Math.sin(k * 0.785) * r) > 0) d = r;
      audio.setWaterDistance(d);
    }, 500);
    return () => clearInterval(t);
  }, [refs, audio]);

  // persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // storage unavailable: settings last for this session
    }
  }, [settings]);

  // global keys: E interact, G guide, J journal, M map, Esc menu/close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (photo) {
        if (k === "p" || e.key === "Escape") {
          e.preventDefault();
          setPhoto(false);
        }
        return;
      }
      if (phase === "explore" && panel === null) {
        if (k === "p") {
          e.preventDefault();
          setPhoto(true);
        } else if (k === "e") {
          e.preventDefault();
          interact(refs?.live.get().target ?? null);
        } else if (k === "g") {
          e.preventDefault();
          setGuideFocus(null);
          setPanel("guide");
        } else if (k === "j") {
          e.preventDefault();
          setPanel("journal");
        } else if (k === "m") {
          e.preventDefault();
          setPanel("map");
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPanel("pause");
        }
      } else if (phase === "dialogue" && e.key === "Escape" && dialogue) {
        e.preventDefault();
        const leave = dialogue.choices.find((c) => ["leave", "later", "ok"].includes(c.id));
        if (leave) dialogue.handlers[leave.id]();
      } else if (phase === "challenge" && e.key === "Escape" && panel === null) {
        e.preventDefault();
        if (result && !result.correct) setResult(null);
        else if (!result) closeChallenge(false);
      } else if (phase === "challenge" && k === "g" && panel === null) {
        e.preventDefault();
        setGuideFocus(active?.encounter.conceptIds[0] ?? null);
        setPanel("guide");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, panel, refs, interact, dialogue, result, active, closeChallenge, photo]);

  // ---- grading
  const submit = (input: unknown) => {
    const cur = runner.current();
    if (!cur || !active || cur.encounter.id !== active.encounter.id) return;
    const g = runner.submit(input);
    audio.cue(g.correct ? "correct" : "wrong");
    setResult({ correct: g.correct, feedback: g.feedback, yourAnswer: describeAnswer(cur.encounter.mode, cur.view, input) });
    bump();
  };
  const hint = () => {
    const h = runner.hint();
    if (h) setLastHint(h);
    bump();
  };

  // ---- free chat
  const ask = useCallback(
    async (npcId: string, question: string, history: { role: "user" | "assistant"; content: string }[]) => {
      // the play route's id (fixtures play as /play/fixture-<name>, whose spec.id differs)
      const path = window.location.pathname.split("/").filter(Boolean);
      const routeId = path[0] === "play" && path[1] ? decodeURIComponent(path[1]) : spec.id;
      const res = await fetch(`/api/games/${encodeURIComponent(routeId)}/npc/${encodeURIComponent(npcId)}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.length ? history : [{ role: "user", content: question }], solved: [...runner.solved()] }),
      });
      if (res.status === 429) throw new Error("They need a moment. Too many questions at once; try again shortly.");
      if (res.status === 503) throw new Error("Free conversation is switched off for this game.");
      if (!res.ok) throw new Error("They didn't catch that. Try again in a moment.");
      const text = (await res.text()).trim();
      return text || "Hmm. Ask me that another way?";
    },
    [spec.id, runner],
  );

  // ---- debug handle (dev, or ?debug=1): the board shape plus world3d controls for e2e and screenshots
  const debugRef = useRef({ interact, openChallenge, begin, closeChallenge, moments, refs, phase, dialogue, finale });
  useEffect(() => {
    debugRef.current = { interact, openChallenge, begin, closeChallenge, moments, refs, phase, dialogue, finale };
  });
  useEffect(() => {
    const d = () => debugRef.current;
    const handle: GameDebugHandle & { world3d: Record<string, unknown> } = {
      state: () => {
        const cur = runner.finished ? null : runner.current();
        return { finished: runner.finished, index: cur ? cur.index : spec.encounters.length, encounterId: cur?.encounter.id ?? null, mastery: runner.mastery() };
      },
      skipTo: (id) => {
        runner.skipTo(id);
        bump();
      },
      autoSolve: () => {
        if (runner.finished) {
          setPhase("ended");
          return;
        }
        const cur = runner.current();
        if (!cur) return;
        if (runner.focused !== cur.encounter.id) runner.focus(cur.encounter.id);
        runner.autoSolve();
        for (const c of cur.encounter.conceptIds) taughtRef.current.add(c);
        setActive(null);
        setResult(null);
        setDialogue(null);
        setPhase(runner.finished ? "ended" : "explore");
        bump();
      },
      events: () => runner.telemetry(),
      mastery: () => runner.mastery(),
      board: {
        available: () => runner.available(),
        solved: () => [...runner.solved()],
        active: () => runner.focused,
        open: (id) => {
          const m = d().moments.get(id);
          if (m) d().openChallenge(m);
        },
        lesson: () => planRef.current.filter((c) => !taughtRef.current.has(c)),
        dismissLesson: () => {
          for (const c of planRef.current) taughtRef.current.add(c);
          bump();
        },
        taught: () => [...taughtRef.current],
      },
      world3d: {
        phase: () => d().phase,
        player: () => (d().refs ? { ...d().refs!.player } : null),
        target: () => d().refs?.live.get().target ?? null,
        /** teleport the player next to an encounter's anchor (npc or landmark), facing it */
        warpTo: (id: string) => {
          const r = d().refs;
          const m = d().moments.get(id);
          if (!r || !m) return false;
          const back = m.anchor.kind === "npc" ? 2.2 : m.radius + 2.5;
          const ang = Math.atan2(r.composed.spawn.x - m.x, r.composed.spawn.z - m.z);
          const x = m.x + Math.sin(ang) * back;
          const z = m.z + Math.cos(ang) * back;
          Object.assign(r.player, { x, z, y: r.physics.ground(x, z), vy: 0, yaw: ang + Math.PI });
          return true;
        },
        interact: () => d().interact(d().refs?.live.get().target ?? null),
        begin: () => d().begin(),
        dialogue: () => d().dialogue && { lines: d().dialogue!.lines.map((l) => l.text), choices: d().dialogue!.choices.map((c) => c.id) },
        choose: (id: string) => d().dialogue?.handlers[id]?.(),
        leads: () => [...d().moments.values()].filter((m) => runner.available().includes(m.encounterId)).map((m) => m.encounterId),
        composeFixes: () => d().refs?.composed.fixes ?? [],
        /** play the finale cinematic (goal orbit + outro) without solving everything, for screenshots */
        finale: () => d().finale(),
      },
    };
    return installGameDebug(handle) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ render
  const rootStyle = { ...theme.vars };
  if (phase === "ended") {
    const { mastery, lines } = runner.debrief();
    return (
      <div className="w3-root" style={rootStyle} data-testid="world3d-client" data-phase="ended">
        <style>{W3_CSS}</style>
        <div className="w3-overlay" style={{ overflow: "auto", placeItems: "start center", padding: "4vh 16px" }}>
          <div style={{ width: "min(960px, 100%)", background: "#fbfaf7", color: "#1d1a16", borderRadius: 20, padding: 8 }}>
            <EndScreen gameId={spec.id} title={spec.title} outro={spec.narrative.outro} mastery={mastery} lines={lines} telemetry={runner.telemetry()} />
          </div>
        </div>
      </div>
    );
  }

  const teach: ChallengeTeach = {
    lessons,
    plan: planRef.current,
    pending: planRef.current.filter((c) => !taughtRef.current.has(c)),
    onLearned: (id) => {
      taughtRef.current.add(id);
      audio.cue("page");
      bump();
    },
    onReview: (id) => {
      setGuideFocus(id);
      setPanel("guide");
    },
  };
  const activeMoment = active ? moments.get(active.encounter.id) : undefined;
  const marks: CompassMark[] = [
    ...(composed?.goal ? [{ id: "goal", label: composed.goal.name ?? "Goal", x: composed.goal.x, z: composed.goal.z, goal: true }] : []),
    ...leadList.map((m) => ({ id: m.encounterId, label: m.place, x: m.x, z: m.z })),
  ];
  const actInfo = world.quest.acts[act] ?? world.quest.acts[0];
  const cinematic = phase === "dialogue" || phase === "finale";
  const chatNpc = dialogue?.chatNpc ? npcById.get(dialogue.chatNpc) : undefined;

  return (
    <div className={`w3-root${reducedMotion ? " w3-reduced" : ""}`} style={rootStyle} data-testid="world3d-client" data-phase={phase} data-genre="world3d">
      <style>{W3_CSS + TEACH_CSS}</style>
      {refs && composed && (
        <GameCanvas
          key={quality}
          refs={refs}
          quality={quality}
          reducedMotion={reducedMotion}
          opened={opened}
          playerLook={looks[lookIndex]}
          leads={leadList}
          goalReady={goalReady}
          collected={collected}
          accent={theme.accent}
          findTarget={findTarget}
        />
      )}
      {refs && composed && <NpcLabels refs={refs} npcs={world.npcs} leads={leadsByNpc} hidden={photo || phase !== "explore"} />}
      {phase === "loading" && (
        <div className="w3-loading" role="status">
          <div style={{ textAlign: "center" }}>
            <div className="w3-bar">
              <span />
            </div>
            <p>Building {world.setting.place}…</p>
          </div>
        </div>
      )}

      {photo && (
        <div className="w3-layer">
          <div className="w3-photobar w3-chip w3-fade-in" data-testid="w3-photo">
            <span>Photo mode · drag to frame your shot</span>
            <button
              type="button"
              className="w3-iconbtn w3-chip"
              onClick={() => {
                const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="world3d-canvas"] canvas, canvas');
                if (!canvas) return;
                const a = document.createElement("a");
                a.href = canvas.toDataURL("image/png");
                a.download = `${spec.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
                a.click();
              }}
            >
              Save photo
            </button>
            <button type="button" className="w3-iconbtn w3-chip" onClick={() => setPhoto(false)}>
              Done <kbd aria-hidden>P</kbd>
            </button>
          </div>
        </div>
      )}
      {refs && composed && !photo && (phase === "explore" || phase === "challenge") && (
        <div className="w3-layer">
          <div className="w3-topleft">
            <div className="w3-title w3-chip">
              <h1>{spec.title}</h1>
              <p>{world.setting.place}</p>
            </div>
          </div>
          {phase === "explore" && <Compass live={refs.live} marks={marks} />}
          <div className="w3-topright">
            <button type="button" className="w3-iconbtn w3-chip" onClick={() => setPanel("guide")} data-testid="field-guide-button" aria-keyshortcuts="G">
              Field guide <kbd aria-hidden>G</kbd>
            </button>
            <button type="button" className="w3-iconbtn w3-chip" onClick={() => setPanel("journal")} aria-keyshortcuts="J">
              Journal <kbd aria-hidden>J</kbd>
            </button>
            <button type="button" className="w3-iconbtn w3-chip" onClick={() => setPanel("map")} aria-keyshortcuts="M">
              Map <kbd aria-hidden>M</kbd>
            </button>
            <button type="button" className="w3-iconbtn w3-chip" onClick={() => setPanel("pause")} aria-label="Menu (Escape)">
              ☰
            </button>
          </div>
          {phase === "explore" && (
            <>
              <QuestTracker
                live={refs.live}
                goal={{ title: world.quest.goal.title, ready: goalReady }}
                act={{ index: act, title: actInfo?.title ?? "", count: world.quest.acts.length }}
                leads={leadList.filter((m) => m.encounterId !== bossId || !goalReady)}
                solved={solved.size}
                total={spec.encounters.length}
                relics={{ found: collected.size, total: world.collectibles.items.length, label: world.collectibles.label }}
                goalAt={composed.goal ? { x: composed.goal.x, z: composed.goal.z } : null}
              />
              <Minimap live={refs.live} composed={composed} leads={leadList} accent={theme.accent} goalReady={goalReady} />
              <InteractPrompt live={refs.live} />
              <TouchAction refs={refs} onAction={() => interact(refs.live.get().target)} />
              <ControlsHint live={refs.live} />
            </>
          )}
          <Toasts toasts={toasts} />
        </div>
      )}

      {phase === "challenge" && active && activeMoment && (
        <div className="w3-layer">
          <ChallengeSheet socket={activeMoment.socket} place={activeMoment.place} objective={activeMoment.moment.objective} onClose={() => closeChallenge(false)}>
            <ChallengePanel
              key={active.encounter.id}
              spec={spec}
              palette={theme.palette}
              current={active}
              heading={activeMoment.anchor.kind === "npc" ? activeMoment.place : withArticle(activeMoment.place).replace(/^the /, "The ")}
              hintsUsed={runner.hintsUsedOn(active.encounter.id)}
              lastHint={lastHint}
              result={result}
              onHint={hint}
              onSubmit={submit}
              onContinue={() => closeChallenge(true)}
              onRetry={() => setResult(null)}
              onClose={() => closeChallenge(false)}
              teach={teach}
            />
          </ChallengeSheet>
        </div>
      )}

      {cinematic && dialogue && (
        <div className="w3-layer w3-letterbox">
          <Dialogue
            key={dialogue.lines.map((l) => l.text).join("|").slice(0, 200)}
            lines={dialogue.lines}
            choices={dialogue.choices}
            onChoose={(id) => dialogue.handlers[id]?.()}
            chat={
              chatNpc
                ? {
                    name: chatNpc.name,
                    suggestions: [
                      ...chatNpc.topics.slice(0, 2).map((t) => `What should I know about ${spec.concepts.find((c) => c.id === t)?.name.toLowerCase() ?? t}?`),
                      `What is your work here, ${chatNpc.name}?`,
                    ],
                    ask: (q, h) => ask(chatNpc.id, q, h),
                  }
                : null
            }
            reducedMotion={reducedMotion}
            textScale={settings.textScale}
          />
          <Toasts toasts={toasts} />
        </div>
      )}

      {phase === "intro" && <IntroCard spec={spec} world={world} looks={looks} look={lookIndex} onLook={setLookIndex} onBegin={begin} flying={flying} onSkipFlight={skipFlight} />}

      {panel === "journal" && (
        <Journal
          onClose={() => setPanel(null)}
          data={{
            acts: world.quest.acts,
            moments,
            solved,
            available: new Set(available),
            debrief: new Map(spec.encounters.map((e) => [e.id, e.debriefLine])),
            relics: world.collectibles.items.map((i) => ({ id: i.id, title: i.title, fact: i.fact, found: collected.has(i.id) })),
            relicLabel: world.collectibles.label,
            people: world.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, met: met.has(n.id), color: CLOTH_HEX[n.look.color] })),
          }}
        />
      )}
      {panel === "map" && refs && composed && <MapOverlay live={refs.live} composed={composed} leads={leadList} accent={theme.accent} goalReady={goalReady} onClose={() => setPanel(null)} />}
      {panel === "pause" && (
        <PauseMenu
          settings={settings}
          onChange={setSettings}
          onResume={() => setPanel(null)}
          onQuit={() => router.push("/")}
          fps={refs?.live.get().fps ?? 0}
          about={provenanceLines(world.provenance)}
        />
      )}
      <FieldGuide
        spec={spec}
        open={panel === "guide"}
        focusConceptId={guideFocus}
        current={active?.encounter.conceptIds ?? []}
        taught={taughtRef.current}
        onClose={() => setPanel(null)}
      />
    </div>
  );
}

/** The touch controls, labelled with what the action button would do right now. */
function TouchAction({ refs, onAction }: { refs: SceneRefs; onAction(): void }) {
  const label = useStore(refs.live, (s) => s.target?.label ?? null);
  return <TouchControls input={refs.input} onAction={onAction} actionLabel={label ? label.split(" ")[0] : null} />;
}
