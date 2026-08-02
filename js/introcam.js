// introcam.js — the opening. A slow drone orbit high above the resort plays
// behind the title card (the aerial Carl photographed), and "STEP INSIDE"
// flies the camera down over the pool and in through the folded-open glass
// wall — outside to inside in one unbroken move, the wizard.carlfung.dev
// entrance. House pattern: this owns the camera until the game starts, then
// hands it back to player.js and never touches it again.
import * as THREE from 'three';
import { CFG } from './config.js';
import { SITE, INTRO_PATH, enclaveToWorld } from './site.js';

/* SITE.POOL.cx/cz are ENCLAVE-LOCAL — water.js builds the pool from them, so
   they must stay that way. The orbit runs in world space, so map them once. */
const ORBIT = enclaveToWorld(SITE.POOL.cx, SITE.POOL.cz);
import { setFacing } from './player.js';

const _look = new THREE.Vector3();
const _from = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _to = new THREE.Vector3();
const _p = new THREE.Vector3();
const _exitLook = new THREE.Vector3();

let angle = 0;
let dive = null;   // { t, onDone } while diving

export function initIntroCam(G) {
  angle = -0.6;
  G.introActive = true;
  place(G, 0);
}

/* camera on the orbit circle, aimed at the suite across its pool */
function place(G, dt) {
  angle += CFG.INTRO.SPEED * dt;
  const { RADIUS, HEIGHT } = CFG.INTRO;
  G.camera.position.set(
    ORBIT.x + Math.sin(angle) * RADIUS,
    HEIGHT + Math.sin(angle * 0.7) * 6,
    ORBIT.z + Math.cos(angle) * RADIUS,
  );
  _look.set(INTRO_PATH.lookAt.x, INTRO_PATH.lookAt.y, INTRO_PATH.lookAt.z);
  G.camera.lookAt(_look);
}

/* Begin the dive. onDone fires once the camera has landed in the great room;
   that's when player.js takes over. */
export function startDive(G, onDone) {
  _from.copy(G.camera.position);
  _mid.set(INTRO_PATH.waypoint.x, INTRO_PATH.waypoint.y, INTRO_PATH.waypoint.z);
  _to.set(INTRO_PATH.land.x, CFG.EYE_HEIGHT, INTRO_PATH.land.z);
  dive = { t: 0, onDone };
}

export function updateIntroCam(G, dt) {
  if (!G.introActive) return;

  if (!dive) { place(G, dt); return; }

  dive.t = Math.min(1, dive.t + dt / CFG.INTRO.DIVE_TIME);
  // smootherstep — no jerk at either end
  const e = dive.t * dive.t * dive.t * (dive.t * (dive.t * 6 - 15) + 10);

  // quadratic bezier: high orbit → low over the water → inside the room
  const inv = 1 - e;
  _p.set(0, 0, 0)
    .addScaledVector(_from, inv * inv)
    .addScaledVector(_mid, 2 * inv * e)
    .addScaledVector(_to, e * e);
  G.camera.position.copy(_p);

  /* Aim: for the first half keep the villa framed (we're flying at it); over
     the second half swing round to the gaze the player will hold on landing,
     so the handover to player.js is invisible. */
  const yawEnd = INTRO_PATH.land.yaw;
  _exitLook.set(
    _p.x - Math.sin(yawEnd) * 12,
    CFG.EYE_HEIGHT - 0.15,
    _p.z - Math.cos(yawEnd) * 12,
  );
  _look.set(INTRO_PATH.lookAt.x, INTRO_PATH.lookAt.y, INTRO_PATH.lookAt.z);
  const blend = THREE.MathUtils.smoothstep(e, 0.45, 1);
  _look.lerp(_exitLook, blend);
  G.camera.lookAt(_look);

  if (dive.t >= 1) {
    const done = dive.onDone;
    dive = null;
    G.introActive = false;
    // hand the look state to player.js so there's no snap on the first frame
    setFacing(yawEnd);
    done?.();
  }
}

export function isDiving() { return !!dive; }
