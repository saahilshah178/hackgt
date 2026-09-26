/**
 * actors/companion.ts (H1) — the guide's puppet (docs/design/20 §2.2): follows over the shoulder with lag and bob,
 * plays `idle`, `talk` while its lines type, and on hints flies to `hintTargetsFor(station, rung)` anchors (circle,
 * land, hover, ride-along) playing `cue`. With `awakeFlag` set it stays perched and dormant until the flag is set.
 */
import type { Cast } from "../../../../contracts/world";
import { flightAt, flightPlan, type FlightPlan, type FlightTarget } from "./flight";
import type { PuppetLike } from "./puppet-shim";

export const COMPANION_DEPTH = 72;

export class Companion {
  readonly puppet: PuppetLike;
  x = 0;
  y = 0;
  private flight: { plan: FlightPlan; t: number; resolve: () => void } | null = null;
  private talking = false;
  private awake = true;
  private perch: { x: number; y: number } | null = null;
  private t = 0;

  constructor(puppet: PuppetLike, private readonly cfg: Cast["guide"]["companion"]) {
    this.puppet = puppet;
    this.puppet.container.setDepth(COMPANION_DEPTH);
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.puppet.container.setPosition(x, y);
  }
  /** Dormant companions perch at `at` until awake (cast.guide.companion.awakeFlag). */
  setAwake(awake: boolean, perchAt: { x: number; y: number }): void {
    if (!awake && !this.perch) {
      this.perch = perchAt;
      this.place(perchAt.x, perchAt.y);
    }
    if (awake) this.perch = null;
    if (awake !== this.awake) this.puppet.setDormant(!awake);
    this.awake = awake;
  }
  get isAwake(): boolean {
    return this.awake;
  }
  get flying(): boolean {
    return this.flight !== null;
  }
  setTalking(on: boolean): void {
    this.talking = on;
  }

  /** Flies the plan; resolves when the last hold ends. A new flight replaces the old one. */
  fly(targets: readonly FlightTarget[]): Promise<void> {
    this.flight?.resolve();
    if (targets.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.flight = { plan: flightPlan({ x: this.x, y: this.y }, targets), t: 0, resolve };
      this.puppet.play("cue");
    });
  }
  cancelFlight(): void {
    this.flight?.resolve();
    this.flight = null;
  }

  update(dtMs: number, player: { x: number; y: number; facing: 1 | -1 }, frozenFx = false): void {
    this.t += dtMs;
    if (this.flight) {
      this.flight.t += dtMs;
      const p = flightAt(this.flight.plan, this.flight.t);
      this.place(p.x, p.y);
      if (p.done) {
        const done = this.flight.resolve;
        this.flight = null;
        done();
      }
    } else if (this.awake) {
      const tx = player.x + this.cfg.offset[0] * player.facing;
      const ty = player.y + this.cfg.offset[1];
      const k = 1 - Math.exp(-dtMs / 1000 / this.cfg.lagSec);
      this.place(this.x + (tx - this.x) * k, this.y + (ty - this.y) * k);
      this.puppet.play(this.talking ? "talk" : "idle");
    }
    this.puppet.container.setScale(player.x < this.x ? -1 : 1, 1);
    if (!frozenFx) this.puppet.update(dtMs);
  }

  destroy(): void {
    this.cancelFlight();
    this.puppet.destroy();
  }
}
