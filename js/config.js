// All tuning lives here — no magic numbers in game code (house rule).
// WHERE things are is NOT here: that's js/site.js, the master site plan.
import { MOMENT_PLACES } from './site.js';

export const CFG = {
  // --- player ---
  EYE_HEIGHT: 1.65,
  WALK_SPEED: 3.2,
  RUN_SPEED: 5.6,
  LOOK_SENS: 0.0023,        // mouse, rad per px
  TOUCH_LOOK_SENS: 0.0038,  // drag-to-look, rad per px
  PITCH_MAX: 1.35,
  PLAYER_R: 0.35,           // body cylinder radius — added to every collider's r at test time
  // --- the height field (walkable stairs, 2026-08-02) ---
  // floorY(x,z,feetY) resolves to the highest walkable surface AT OR BELOW
  // feetY + STEP_UP, which is what stops the player teleporting onto the 2F
  // floor from the great room. Raise STEP_UP and thresholds get easier — but
  // 0.40 is already the tallest single step on the campus (the lounge plinth
  // at 0.34 + its marble), and much more starts letting people climb walls.
  STEP_UP: 0.40,            // automatic step-up: kerbs, thresholds, single steps
  HEAD_CLEAR: 1.8,          // a surface must have this much room above it to be climbed onto
  FALL_G: 16,               // m/s² — walking off a deck edge drops you, never floats you
  FALL_MAX: 18,             // terminal speed of that drop
  INTERACT_DIST: 2.6,
  WORLD_BOUND: 300,         // absolute |x|,|z| safety clamp — the campus is ~500 m across

  // --- fly mode (spectator flight — W/S along the look direction, no collisions) ---
  FLY_SPEED: 18,
  FLY_FAST: 46,             // Shift, or a fully-pushed touch stick
  FLY_MAX_ALT: 220,         // must stay well inside SKY_R
  FLY_MIN_CLEAR: 0.5,       // lowest flight = floorY(x,z) + this

  // --- camera ---
  FOV: 58,
  NEAR: 0.08,
  FAR: 3000,                // the ocean and the hotel crescent are far away
  SKY_R: 900,               // sky-dome radius — must exceed FLY_MAX_ALT + world diagonal

  // --- the opening aerial ---
  // The title card plays over a slow drone orbit above the pool, then "STEP
  // INSIDE" flies you down into the suite — the wizard.carlfung.dev entrance.
  INTRO: {
    RADIUS: 92,             // orbit radius around the hero pool
    HEIGHT: 58,
    SPEED: 0.055,           // rad/sec
    DIVE_TIME: 5.2,         // seconds from the orbit down to the deck
  },

  SEED: 20270320,           // 2027.03.20 — the big day

  // --- lighting ---
  LIGHT: {
    HEMI_DAY: 0.75, HEMI_NIGHT: 0.22,
    SUN_DAY: 2.1,   SUN_NIGHT: 0.16,
    ENV_DAY: 0.95,  ENV_NIGHT: 0.30,   // scene.environmentIntensity
    EXPOSURE_DAY: 1.0, EXPOSURE_NIGHT: 1.12,
  },
  START_AT_NIGHT: false,    // open on the golden-hour aerial; N toggles

  // --- the five moments of the day ---
  // Real locations now (see js/site.js MOMENT_PLACES + the reference briefs).
  MOMENTS: [
    { id: 'setup', name: 'Prewedding Setup', area: 'Presidential Suite',
      spawn: MOMENT_PLACES.PREWEDDING, night: true,
      blurb: 'The night before — lanterns on the pool, the glass wall folded open, everyone spilling out of the living room.' },
    { id: 'ceremony', name: 'Ceremony', area: 'The Circular Lawn',
      spawn: MOMENT_PLACES.CEREMONY, night: false,
      blurb: 'Chairs on the grass, an aisle through the palms, and an arch with the sea behind it.' },
    { id: 'cocktail', name: 'Cocktail Hour', area: 'Clubhouse Terrace',
      spawn: MOMENT_PLACES.COCKTAIL, night: false,
      blurb: 'High-tops by the terrace pool, teal umbrellas, and something cold while the lounge is flipped.' },
    { id: 'dinner', name: 'Wedding Dinner', area: '隐逸居 Lounge',
      spawn: MOMENT_PLACES.DINNER, night: true,
      blurb: 'Two hundred and eighty square metres, sixty seats, and the glass walls folded back to the pool.' },
    { id: 'afterparty', name: 'After Party', area: 'Suite Pool Deck',
      spawn: MOMENT_PLACES.AFTERPARTY, night: true,
      blurb: 'The DJ takes the deck. Lanterns still burning on the water at 1 a.m.' },
  ],
};
