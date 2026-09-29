import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { HEADWEAR, HELD_PROPS, OUTFITS, type NpcLook } from "../src/contracts/world3d";
import { bodyKeyFor, CHAR_SLOTS, humanoidModel } from "../src/world3d/kit/characters/body";
import { bakeGeometry, boneMatrices, gaitCadence, newPose, samplePose, type HumanoidAnim, type PoseInput } from "../src/world3d/kit/characters/poses";
import { B, BONE_COUNT, JOINT, PARENT } from "../src/world3d/kit/characters/skeleton";
import { GeoBuilder } from "../src/world3d/kit/structures/geom";
import { statueFigure } from "../src/world3d/kit/characters/statue";

/*
 * The procedural humanoid (src/world3d/kit/characters): every outfit × headwear × held prop builds a skinned body with
 * valid weights, realistic proportions (1.75 m, 7.5 heads), a handful of material slots; every animation clip yields a
 * finite pose; the walk is speed-synced (the stance foot stays planted); and statues bake the rig into stone.
 */

const ANIMS: HumanoidAnim[] = ["idle", "walk", "run", "talk", "wave", "work", "sit", "study", "jump", "guard", "celebrate"];

describe("skeleton", () => {
  it("is a proper tree in bind order with joints at human proportions", () => {
    expect(PARENT.length).toBe(BONE_COUNT);
    expect(JOINT.length).toBe(BONE_COUNT);
    PARENT.forEach((p, i) => expect(p).toBeLessThan(i));
    const headUnit = 1.75 / 7.5;
    expect(JOINT[B.upperArmL][1]).toBeCloseTo(1.75 - headUnit * 1.4, 1);
    expect(JOINT[B.shinL][1]).toBeGreaterThan(0.45);
    expect(JOINT[B.shinL][1]).toBeLessThan(0.55);
    expect(JOINT[B.handL][1]).toBeCloseTo(0.87, 1);
  });
});

describe("humanoid bodies", () => {
  it(
    "builds every outfit × headwear × held combination with valid skinning",
    () => {
      let n = 0;
      for (const outfit of OUTFITS)
        for (const headwear of HEADWEAR)
          for (const held of HELD_PROPS) {
            const m = humanoidModel({ outfit, headwear, held, build: n % 3, hair: n % 4, egypt: n % 2 === 0 });
            n++;
            const where = `${outfit}/${headwear}/${held}`;
            expect(m.parts.length, where).toBeGreaterThanOrEqual(3);
            expect(m.parts.length, where).toBeLessThanOrEqual(CHAR_SLOTS.length);
            expect(m.tris, where).toBeLessThan(16_000);
            const box = new THREE.Box3();
            for (const p of m.parts) {
              const g = p.geometry;
              const si = g.attributes.skinIndex as THREE.BufferAttribute;
              const sw = g.attributes.skinWeight as THREE.BufferAttribute;
              expect(si.count, where).toBe(g.attributes.position.count);
              let bad = 0;
              for (let i = 0; i < si.count; i++) {
                if (si.getX(i) >= BONE_COUNT || si.getY(i) >= BONE_COUNT || Math.abs(sw.getX(i) + sw.getY(i) - 1) > 1e-5) bad++;
              }
              expect(bad, `${where} ${p.slot}`).toBe(0);
              g.computeBoundingBox();
              box.union(g.boundingBox!);
            }
            // a 1.75 m adult (headwear and raised props may add a little), feet on the ground, facing +z
            expect(box.min.y, where).toBeGreaterThan(-0.03);
            expect(box.min.y, where).toBeLessThan(0.03);
            const top = held === "staff" || held === "spear" || held === "torch" ? 2.2 : 1.95;
            expect(box.max.y, where).toBeLessThan(top + 0.2);
            expect(box.max.y, where).toBeGreaterThan(1.7);
          }
      expect(n).toBe(OUTFITS.length * HEADWEAR.length * HELD_PROPS.length);
    },
    60_000,
  );

  it("caches bodies and derives variety deterministically from the seed", () => {
    const look: NpcLook = { skin: "tone4", outfit: "kilt", color: "linen", accent: "gold", headwear: "none", held: "scroll", height: 1 };
    expect(bodyKeyFor(look, 42, true)).toEqual(bodyKeyFor(look, 42, true));
    const a = humanoidModel(bodyKeyFor(look, 42, true));
    expect(humanoidModel(bodyKeyFor(look, 42, true))).toBe(a);
    const dress = bodyKeyFor({ ...look, outfit: "dress" }, 3, false);
    expect(dress.build).toBe(2);
  });

  it("a kilted Egyptian shows skin on the torso and wears a linen kilt; a robe covers the arms", () => {
    const kilt = humanoidModel({ outfit: "kilt", headwear: "none", held: "none", build: 0, hair: 0, egypt: true });
    const slots = kilt.parts.map((p) => p.slot);
    expect(slots).toContain("linen");
    expect(slots).toContain("gold");
    expect(slots).toContain("hair");
    const robe = humanoidModel({ outfit: "robe", headwear: "hood", held: "lantern", build: 1, hair: 1, egypt: false });
    expect(robe.parts.map((p) => p.slot)).toContain("glow");
    expect(robe.flame?.lamp).toBe(true);
    const torch = humanoidModel({ outfit: "tunic", headwear: "none", held: "torch", build: 1, hair: 1, egypt: false });
    expect(torch.flame?.lamp).toBe(false);
  });
});

describe("animation", () => {
  const base: PoseInput = { anim: "idle", t: 1, time: 3.3, speed: 1.4, phase: 0.3, seed: 7, talking: false, held: "none", sitOnBlock: true, calm: false };

  it("every clip (and every held prop) yields a finite, bounded pose", () => {
    const pose = newPose();
    for (const anim of ANIMS)
      for (const held of HELD_PROPS)
        for (const time of [0, 1.7, 13.2]) {
          samplePose({ ...base, anim, held, time, t: time, talking: anim === "idle" && time > 5 }, pose);
          for (let i = 0; i < pose.r.length; i++) {
            expect(Number.isFinite(pose.r[i]), `${anim}/${held}`).toBe(true);
            expect(Math.abs(pose.r[i]), `${anim}/${held} bone ${Math.floor(i / 3)}`).toBeLessThan(3.2);
          }
          expect(Math.abs(pose.y)).toBeLessThan(0.9);
        }
  });

  it("walk cadence rises with speed and the run takes longer strides", () => {
    expect(gaitCadence(1.4)).toBeGreaterThan(0.7);
    expect(gaitCadence(1.4)).toBeLessThan(1.1);
    expect(gaitCadence(5)).toBeGreaterThan(gaitCadence(1.4));
    expect(5 / gaitCadence(5)).toBeGreaterThan(1.4 / gaitCadence(1.4));
  });

  it("keeps the stance foot planted: it moves back as fast as the body moves forward", () => {
    for (const speed of [1.2, 1.6, 4.5]) {
      const pose = newPose();
      const cadence = gaitCadence(speed);
      const ankleZ = (phase: number) => {
        samplePose({ ...base, anim: speed > 3 ? "run" : "walk", speed, phase }, pose);
        const m = boneMatrices(pose);
        const p = new THREE.Vector3(0, 0, 0).applyMatrix4(m[B.footL]);
        return p.z;
      };
      // mid-stance of the left leg (heel strike at phase 0, toe off at 0.5)
      const p1 = speed > 3 ? 0.08 : 0.1;
      const p2 = speed > 3 ? 0.3 : 0.4;
      const moved = ankleZ(p2) - ankleZ(p1);
      const bodyMoved = (speed * (p2 - p1)) / cadence;
      expect(moved).toBeLessThan(0);
      expect(-moved / bodyMoved, `speed ${speed}`).toBeGreaterThan(0.6);
      expect(-moved / bodyMoved, `speed ${speed}`).toBeLessThan(1.45);
    }
  });

  it("sitting lowers the hips onto a block or the ground", () => {
    const pose = newPose();
    samplePose({ ...base, anim: "sit", sitOnBlock: true }, pose);
    const hipsBlock = new THREE.Vector3().applyMatrix4(boneMatrices(pose)[B.hips]).y;
    samplePose({ ...base, anim: "sit", sitOnBlock: false }, pose);
    const hipsGround = new THREE.Vector3().applyMatrix4(boneMatrices(pose)[B.hips]).y;
    expect(hipsBlock).toBeGreaterThan(0.45);
    expect(hipsBlock).toBeLessThan(0.65);
    expect(hipsGround).toBeLessThan(0.2);
  });
});

describe("statues and baking", () => {
  it("bakes a posed body and adds a stone figure of the requested height", () => {
    const m = humanoidModel({ outfit: "kilt", headwear: "headdress", held: "none", build: 1, hair: 0, egypt: true });
    const baked = bakeGeometry(m.parts[0].geometry, newPose());
    expect(baked.attributes.position.count).toBe(m.parts[0].geometry.attributes.position.count);
    const b = new GeoBuilder();
    statueFigure(b, "ancient_egypt", 5.4, "main");
    const parts = b.build();
    expect(parts).toHaveLength(1);
    parts[0].geometry.computeBoundingBox();
    const box = parts[0].geometry.boundingBox!;
    expect(box.max.y).toBeGreaterThan(5.0);
    expect(box.max.y).toBeLessThan(6.0);
  });
});
