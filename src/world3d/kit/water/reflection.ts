"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/*
 * Planar reflections for a horizontal water plane (High tier): each frame the scene is rendered from the camera
 * mirrored in the plane y = level, at a fraction of the drawing-buffer size, into a half-float target with an oblique
 * near plane that clips everything below the water (after three.js's examples/jsm/objects/Reflector.js, MIT). The water
 * shader projects its world position with `matrix` and samples `texture`, distorted by its normal.
 *
 * The reflection pass skips the shadow-map update (the main pass refreshes it) and hides the objects passed in
 * `hide()` (the water itself).
 */

export interface PlanarReflection {
  texture: THREE.Texture;
  matrix: THREE.IUniform<THREE.Matrix4>;
  on: THREE.IUniform<number>;
}

export class PlanarReflector implements PlanarReflection {
  readonly target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  readonly matrix = new THREE.Uniform(new THREE.Matrix4());
  readonly on = new THREE.Uniform(0);
  private readonly cam = new THREE.PerspectiveCamera();
  private readonly view = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly rot = new THREE.Matrix4();
  private readonly normal = new THREE.Vector3(0, 1, 0);
  private readonly point = new THREE.Vector3();
  private readonly plane = new THREE.Plane();
  private readonly clip = new THREE.Vector4();
  private readonly q = new THREE.Vector4();
  private readonly size = new THREE.Vector2();

  constructor(private readonly scale = 0.5) {
    this.target.texture.name = "world3d:water-reflection";
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  update(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, level: number | null, enabled: boolean, hide: () => THREE.Object3D[]) {
    const pc = camera as THREE.PerspectiveCamera;
    if (!enabled || level === null || !pc.isPerspectiveCamera) {
      this.on.value = 0;
      return;
    }
    this.point.set(0, level, 0);
    this.camPos.setFromMatrixPosition(camera.matrixWorld);
    // camera below the surface: no reflection
    if (this.camPos.y <= level) {
      this.on.value = 0;
      return;
    }
    const cam = this.cam;
    // mirror the camera through the plane
    this.view.copy(this.camPos).setY(2 * level - this.camPos.y);
    this.rot.extractRotation(camera.matrixWorld);
    this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.camPos);
    this.aim.copy(this.lookAt).setY(2 * level - this.lookAt.y);
    cam.position.copy(this.view);
    cam.up.set(0, 1, 0).applyMatrix4(this.rot);
    cam.up.setY(-cam.up.y);
    cam.lookAt(this.aim);
    cam.far = pc.far;
    cam.near = pc.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(pc.projectionMatrix);
    this.matrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique near plane = the water plane (Lengyel), so nothing below the surface shows in the reflection
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.point).applyMatrix4(cam.matrixWorldInverse);
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const e = cam.projectionMatrix.elements;
    this.q.set((Math.sign(this.clip.x) + e[8]) / e[0], (Math.sign(this.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    e[2] = this.clip.x;
    e[6] = this.clip.y;
    e[10] = this.clip.z + 1 - 0.003;
    e[14] = this.clip.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    gl.getDrawingBufferSize(this.size);
    const w = Math.max(64, Math.round(this.size.x * this.scale));
    const h = Math.max(64, Math.round(this.size.y * this.scale));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    const hidden = hide().filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const prevTarget = gl.getRenderTarget();
    const prevAutoShadow = gl.shadowMap.autoUpdate;
    const prevXr = gl.xr.enabled;
    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(prevTarget);
    gl.shadowMap.autoUpdate = prevAutoShadow;
    gl.xr.enabled = prevXr;
    for (const o of hidden) o.visible = true;
    this.on.value = 1;
  }

  dispose() {
    this.target.dispose();
  }
}

export function usePlanarReflection(level: number | null, enabled: boolean, hide: () => THREE.Object3D[], scale = 0.5): PlanarReflection {
  const reflector = useMemo(() => new PlanarReflector(scale), [scale]);
  useEffect(() => () => reflector.dispose(), [reflector]);
  useFrame(({ gl, scene, camera }) => reflector.update(gl, scene, camera, level, enabled, hide), -5);
  return reflector;
}
