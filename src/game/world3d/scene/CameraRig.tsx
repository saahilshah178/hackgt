"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { easeInOut } from "./camera";
import { useSceneRefs } from "./refs";

/*
 * Drives the THREE camera from the director (./camera.ts): the third-person follow orbit (mouse drag or keys to
 * orbit, wheel to zoom, gentle auto-follow behind a running player), framed shots, the flyover path and the finale
 * orbit. Keeps the camera above the terrain and pulls it in when a hill would block the view of the player.
 */

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const refs = useSceneRefs();
  const { camera, gl, size } = useThree();

  // mouse orbit: drag anywhere on the canvas (no pointer lock needed), wheel to zoom
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const locked = document.pointerLockElement === el;
      if (!dragging && !locked) return;
      if (!refs.control.enabled || refs.director.mode.kind !== "follow") return;
      const dx = locked ? e.movementX : e.clientX - lastX;
      const dy = locked ? e.movementY : e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const o = refs.director.orbit;
      const s = 0.0055 * refs.director.sensitivity;
      o.yaw -= dx * s;
      o.pitch = THREE.MathUtils.clamp(o.pitch + dy * s * (refs.director.invertY ? -1 : 1), -0.15, 1.25);
      o.touched = performance.now();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (!refs.control.enabled) return;
      e.preventDefault();
      const o = refs.director.orbit;
      o.distance = THREE.MathUtils.clamp(o.distance * Math.exp(e.deltaY * 0.0012), 2.6, 16);
    };
    const menu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", menu);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", menu);
    };
  }, [gl, refs]);

  useFrame((state, dt) => {
    const d = refs.director;
    const p = refs.player;
    const cam = camera as THREE.PerspectiveCamera;
    const mode = d.mode;
    let lambda = 3.2;
    let shiftLeft = 0;
    if (mode.kind === "follow") {
      const o = d.orbit;
      const input = refs.control.enabled ? refs.input.read() : null;
      if (input?.turn) {
        o.yaw -= input.turn * dt * 1.9;
        o.touched = performance.now();
      }
      // auto-follow: while running and the mouse hasn't moved the camera recently, drift behind the player
      if (!reducedMotion && p.speed > 1 && performance.now() - o.touched > 1600) {
        const behind = p.yaw + Math.PI;
        const diff = Math.atan2(Math.sin(behind - o.yaw), Math.cos(behind - o.yaw));
        o.yaw += diff * Math.min(1, dt * 0.9);
      }
      const head = new THREE.Vector3(p.x, p.y + 1.55, p.z);
      let dist = o.distance;
      const dir = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch));
      // pull in when terrain sits between the head and the camera
      for (let i = 1; i <= 6; i++) {
        const t = (i / 6) * dist;
        const x = head.x + dir.x * t;
        const z = head.z + dir.z * t;
        const y = head.y + dir.y * t;
        if (refs.physics.ground(x, z) + 0.45 > y) {
          dist = Math.max(1.6, t - 0.6);
          break;
        }
      }
      tmpPos.copy(head).addScaledVector(dir, dist);
      tmpPos.y = Math.max(tmpPos.y, refs.physics.ground(tmpPos.x, tmpPos.z) + 0.5);
      tmpLook.copy(head);
      lambda = 12;
    } else if (mode.kind === "frame") {
      tmpPos.copy(mode.position);
      tmpLook.copy(mode.look);
      shiftLeft = mode.shiftLeft ?? 0;
      lambda = reducedMotion ? 30 : 3.5;
    } else if (mode.kind === "path") {
      if (mode.started < 0) mode.started = state.clock.elapsedTime;
      const raw = (state.clock.elapsedTime - mode.started) / mode.duration;
      const t = easeInOut(Math.min(1, raw));
      mode.curve.getPointAt(t, tmpPos);
      mode.looks.getPointAt(t, tmpLook);
      lambda = 40;
      if (raw >= 1 && mode.onDone) {
        const done = mode.onDone;
        mode.onDone = undefined;
        done();
      }
    } else {
      const a = state.clock.elapsedTime * mode.speed;
      tmpPos.set(mode.center.x + Math.sin(a) * mode.radius, mode.center.y + mode.height, mode.center.z + Math.cos(a) * mode.radius);
      tmpLook.copy(mode.center);
      lambda = 1.6;
    }
    const k = 1 - Math.exp(-lambda * dt);
    if (d.position.lengthSq() === 0) {
      d.position.copy(tmpPos);
      d.look.copy(tmpLook);
    } else {
      d.position.lerp(tmpPos, k);
      d.look.lerp(tmpLook, k);
    }
    cam.position.copy(d.position);
    cam.lookAt(d.look);
    // a side panel covers the right of the screen: shift the principal point so the subject sits in the open left part
    const w = size.width;
    const h = size.height;
    const offset = Math.round(shiftLeft * w);
    if (offset > 0) cam.setViewOffset(w, h, offset, 0, w, h);
    else if (cam.view?.enabled) cam.clearViewOffset();
  });
  return null;
}
