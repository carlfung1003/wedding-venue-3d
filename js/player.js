// First-person walking controls, ported from lassen-camp: pointer lock,
// WASD + touch stick, {x,z,r} cylinder colliders, interactables registry,
// Tab cursor mode. Module-level yaw/pitch is the one look state.
import * as THREE from 'three';
import { CFG } from './config.js';
import { floorY } from './world.js';
import { touchInput } from './touch.js';

const keys = {};
let yaw = 0, pitch = 0;

export function applyLook(dx, dy, sens = CFG.TOUCH_LOOK_SENS) {
  yaw -= dx * sens;
  pitch -= dy * sens;
  pitch = Math.max(-CFG.PITCH_MAX, Math.min(CFG.PITCH_MAX, pitch));
}

/* teleports (moment switches) reset the look flat toward a heading */
export function setFacing(a) {
  yaw = a;
  pitch = 0;
}

/* apply pos + look to the camera outside the update loop (title backdrop,
   the frame a moment switch lands on) */
export function syncCamera(G) {
  G.camera.position.copy(G.player.pos);
  G.camera.rotation.set(0, 0, 0);
  G.camera.rotateY(yaw);
  G.camera.rotateX(pitch);
}

export function initPlayer(G) {
  G.player = {
    pos: new THREE.Vector3(0, floorY(0, 0) + CFG.EYE_HEIGHT, 0),
    locked: false,
    moving: false,
    nearest: null,
  };
  G.scene.add(G.camera);
  syncCamera(G);

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (!G.started || G.overlayOpen) return;
    // Tab: cursor mode — freeze the view, free the mouse to click the chips
    if (e.code === 'Tab') { e.preventDefault(); G.toggleCursorMode(); return; }
    if (e.code === 'KeyF') G.toggleMode();   // walk ↔ fly
    if (e.code === 'KeyE' && G.player.nearest) G.player.nearest.use();
    if (/^Digit[1-5]$/.test(e.code)) G.setMoment(+e.code.slice(5) - 1);
  });
  document.addEventListener('keyup', e => keys[e.code] = false);

  document.addEventListener('mousemove', e => {
    if (!G.player.locked || G.overlayOpen) return;
    applyLook(e.movementX, e.movementY, CFG.LOOK_SENS);
  });

  document.addEventListener('mousedown', e => {
    if (!G.started || G.overlayOpen || G.player.locked) return;
    // only clicking the game view re-locks — clicks on the HUD/chips stay free
    if (!G.cursorMode && e.target === G.canvas) lock(G);
  });

  document.addEventListener('pointerlockchange', () => {
    if (G.touchMode) return;   // touch mode never uses pointer lock
    G.player.locked = document.pointerLockElement === G.canvas;
    if (G.player.locked) G.cursorMode = false;
  });
}

export function lock(G) {
  if (G.touchMode) return;
  if (document.pointerLockElement !== G.canvas) {
    try {
      const p = G.canvas.requestPointerLock?.();
      p?.catch?.(() => {});   // non-gesture / headless refusals are fine
    } catch (e) { /* pointer lock unavailable */ }
  }
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
const camDir = new THREE.Vector3(), toIt = new THREE.Vector3();

export function updatePlayer(G, dt) {
  const { player } = G;
  const stickMag = Math.hypot(touchInput.x, touchInput.y);

  /* ══ FLY MODE: spectator flight — W/S ride the full look direction (yaw AND
     pitch), A/D strafe level, Space/C (or ▲▼) climb and dive. No collisions;
     altitude clamped between floorY + FLY_MIN_CLEAR and FLY_MAX_ALT. ══ */
  if (G.mode === 'fly') {
    fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    move.set(0, 0, 0);
    if (keys['KeyW']) move.add(fwd);
    if (keys['KeyS']) move.sub(fwd);
    if (keys['KeyD']) move.add(right);
    if (keys['KeyA']) move.sub(right);
    if (G.touchMode && stickMag > 0.15) {
      move.addScaledVector(fwd, -touchInput.y);   // stick forward = along the gaze
      move.addScaledVector(right, touchInput.x);
    }
    if (keys['Space'] || G.flyUp) move.y += 1;
    if (keys['KeyC'] || G.flyDown) move.y -= 1;
    const fast = keys['ShiftLeft'] || keys['ShiftRight'] || (G.touchMode && stickMag > 0.92);
    player.moving = move.lengthSq() > 0;
    player.yaw = yaw;
    if (player.moving) {
      move.normalize().multiplyScalar((fast ? CFG.FLY_FAST : CFG.FLY_SPEED) * dt);
      player.pos.add(move);
    }
    player.pos.x = Math.max(-CFG.WORLD_BOUND, Math.min(CFG.WORLD_BOUND, player.pos.x));
    player.pos.z = Math.max(-CFG.WORLD_BOUND, Math.min(CFG.WORLD_BOUND, player.pos.z));
    player.pos.y = Math.max(floorY(player.pos.x, player.pos.z) + CFG.FLY_MIN_CLEAR,
      Math.min(CFG.FLY_MAX_ALT, player.pos.y));
    syncCamera(G);
    // no interacting mid-air — the {x,z,r} distance test ignores altitude
    player.nearest = null;
    G.ui.prompt(null);
    if (G.btnInteract) G.btnInteract.classList.remove('pulse');
    return;
  }

  /* ── movement: WASD + touch stick, Shift (or full stick) to run ── */
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  move.set(0, 0, 0);
  if (keys['KeyW']) move.add(fwd);
  if (keys['KeyS']) move.sub(fwd);
  if (keys['KeyD']) move.add(right);
  if (keys['KeyA']) move.sub(right);
  if (G.touchMode && stickMag > 0.15) {
    move.addScaledVector(fwd, -touchInput.y);
    move.addScaledVector(right, touchInput.x);
  }
  const wantRun = keys['ShiftLeft'] || keys['ShiftRight'] || (G.touchMode && stickMag > 0.92);
  const moving = move.lengthSq() > 0;
  player.moving = moving;
  player.running = moving && wantRun;
  player.yaw = yaw;
  if (moving) move.normalize().multiplyScalar((wantRun ? CFG.RUN_SPEED : CFG.WALK_SPEED) * dt);
  player.pos.add(move);

  /* ── safety clamp, then cylinder colliders (r + player radius) ── */
  player.pos.x = Math.max(-CFG.WORLD_BOUND, Math.min(CFG.WORLD_BOUND, player.pos.x));
  player.pos.z = Math.max(-CFG.WORLD_BOUND, Math.min(CFG.WORLD_BOUND, player.pos.z));
  for (const c of G.colliders) {
    const dx = player.pos.x - c.x, dz = player.pos.z - c.z;
    const r = c.r + CFG.PLAYER_R;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 0.001) {
      player.pos.x = c.x + dx / d * r;
      player.pos.z = c.z + dz / d * r;
    }
  }

  /* ── eye height rides floorY, which is now a real HEIGHT FIELD ───────────
     Pass the current FEET height in: floorY resolves to the highest walkable
     surface at or below feet + STEP_UP, which is what lets you climb the
     suite's stair and the pool plinth while stopping you teleporting onto the
     2F floor from the great room below it.
     Up is a snap (a step you can take, you take instantly). Down is gravity,
     so walking off the deck edge drops you instead of leaving you hovering. */
  const feet = player.pos.y - CFG.EYE_HEIGHT;
  const target = floorY(player.pos.x, player.pos.z, feet);

  if (target >= feet - 1e-3) {
    player.fallV = 0;
    player.pos.y = target + CFG.EYE_HEIGHT;
  } else {
    player.fallV = Math.min(CFG.FALL_MAX, (player.fallV || 0) + CFG.FALL_G * dt);
    const nextFeet = Math.max(target, feet - player.fallV * dt);
    if (nextFeet <= target + 1e-3) player.fallV = 0;
    player.pos.y = nextFeet + CFG.EYE_HEIGHT;
  }
  syncCamera(G);

  /* ── nearest interactable in reach and roughly faced ── */
  let best = null, bestD = CFG.INTERACT_DIST;
  G.camera.getWorldDirection(camDir);
  camDir.y = 0; camDir.normalize();
  for (const it of G.interactables) {
    if (it.enabled && !it.enabled()) continue;
    const dx = it.x - player.pos.x, dz = it.z - player.pos.z;
    const d = Math.hypot(dx, dz) - (it.r || 0);
    if (d > bestD) continue;
    toIt.set(dx, 0, dz).normalize();
    if (toIt.dot(camDir) < 0.25 && d > 1.2) continue;
    best = it; bestD = d;
  }
  player.nearest = best;
  G.ui.prompt(best ? (G.touchMode ? `👆 ${best.label()}` : `<b>E</b> ${best.label()}`) : null);
  if (G.btnInteract) G.btnInteract.classList.toggle('pulse', !!best);
}

/* helper for other modules: is the player looking at a world position */
export function playerFacing(G, targetPos, minDot = 0.5) {
  G.camera.getWorldDirection(camDir);
  toIt.copy(targetPos).sub(G.player.pos).normalize();
  return camDir.dot(toIt) >= minDot;
}
