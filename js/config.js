// All tuning lives here — no magic numbers in game code (house rule).
export const CFG = {
  // --- player ---
  EYE_HEIGHT: 1.65,
  WALK_SPEED: 3.2,
  RUN_SPEED: 5.6,
  LOOK_SENS: 0.0023,        // mouse, rad per px
  TOUCH_LOOK_SENS: 0.0038,  // drag-to-look, rad per px
  PITCH_MAX: 1.35,
  PLAYER_R: 0.35,           // body cylinder radius — added to every collider's r at test time
  INTERACT_DIST: 2.6,
  WORLD_BOUND: 60,          // absolute |x|,|z| safety clamp if a collider is ever missed

  // --- venue dimensions (meters — the placeholder shell is sized from these) ---
  // Compass convention: the stage sits at -z ("north"), the foyer at +x ("east").
  BALLROOM: { W: 30, L: 50, H: 8 },      // x-width, z-length, ceiling height
  FOYER:    { W: 12, H: 5 },             // pre-function space along the ballroom's full east side
  CORRIDOR: { W: 4,  H: 3.4 },           // service corridor behind the ballroom (+z)
  SUITE:    { W: 8,  L: 10, H: 3.4 },    // bridal suite off the corridor's west end
  TERRACE:  { W: 18, L: 26, RAIL_H: 1.05 },  // outdoors, east of the foyer
  STAGE:    { W: 12, D: 5, H: 0.6 },
  COLUMN:   { R: 0.5, X: 10.5, Z0: -15, SPACING: 6, COUNT: 6 },  // two rows at ±X
  WALL_T: 0.3,
  DOOR_H: 2.6,              // lintels start here above every opening
  SKY_R: 140,
  SEED: 20260111,           // 01.11.2026 — the big day

  // --- lighting (warm hotel interior) ---
  LIGHT: {
    HEMI: 0.5,
    SUN: 0.7,
    CHANDELIER: 60,         // ballroom point lights (three, PointLight intensity)
    FOYER: 30,
    SUITE: 22,
    TERRACE: 26,
    ENV: 0.35,              // scene.environmentIntensity (PMREM RoomEnvironment)
  },

  // --- the five moments of the day (moments.js builds one prop group per id) ---
  MOMENTS: [
    { id: 'setup', name: 'Prewedding Setup', area: 'Bridal Suite',
      spawn: { x: -11, z: 31.5, yaw: Math.PI },
      blurb: 'Garment bags, good light and one very important dress — the quiet hours before it all begins.' },
    { id: 'ceremony', name: 'Ceremony', area: 'Grand Ballroom',
      spawn: { x: 0, z: 8, yaw: 0 },
      blurb: 'Rows of white chairs, a long aisle, and an arch waiting at the end of it.' },
    { id: 'cocktail', name: 'Cocktail Hour', area: 'Foyer',
      spawn: { x: 21, z: 14, yaw: 0 },
      blurb: 'High-tops and champagne in the foyer while the ballroom flips behind the doors.' },
    { id: 'dinner', name: 'Wedding Dinner', area: 'Grand Ballroom',
      spawn: { x: 0, z: 16, yaw: 0 },
      blurb: 'The same ballroom, re-dressed — round tables of ten, a head table, and a dance floor.' },
    { id: 'afterparty', name: 'After Party', area: 'Terrace',
      spawn: { x: 30, z: 0, yaw: -Math.PI / 2 },
      blurb: 'String lights over the terrace. The DJ has the rest of the night.' },
  ],
};
