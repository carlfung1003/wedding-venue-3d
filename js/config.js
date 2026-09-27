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

  // --- the six moments ---
  // Real locations (see js/site.js MOMENT_PLACES + the reference briefs).
  // ORDER IS CHRONOLOGICAL and the chip bar is read as a timeline, so the
  // Welcome Brunch — 18 March, two days out — goes FIRST. Nothing indexes this
  // array by number: main.js resolves the intro backdrop and the landing moment
  // through momentIndex() below, and the 1…9 keys are bounds-checked by
  // setMoment. Insert in the right place; do not append to protect an index.
  /* date + time (KAN-218) are what the timeline and the moment captions print.
     They come from ~/projects/wedding-app's itinerary (copy.ts): welcome party
     Fri 19 Mar 21:30; ceremony 16:30, cocktails 17:30, dinner 19:00, after
     party 21:00 on Sat 20 Mar. The brunch (Thu 18 Mar) has no published time
     there, so it has none here — never invent one. `short` is the timeline label.
     `zh` (KAN-232) is the same copy in TRADITIONAL Chinese — read it through
     i18n.js's mt(m, field), never directly. Names reuse the wedding-app's
     itinerary (迎賓派對 / 婚禮儀式 / 雞尾酒會 / 晚宴 / 派對); see i18n.js. */
  MOMENTS: [
    { id: 'brunch', name: 'Welcome Brunch', short: 'Brunch', area: 'The Westin Rooftop',
      date: '2027-03-18', time: null,
      spawn: MOMENT_PLACES.BRUNCH, night: false,
      blurb: 'Two days out, twenty-six floors up — the wedding party, long tables in the sun, and nothing past the pool but the sea.',
      zh: { name: '迎賓早午餐', short: '早午餐', area: '威斯汀頂層露台',
        blurb: '婚禮前兩天，二十六層樓之上 — 親友圍坐在陽光下的長桌旁，泳池之外，只有大海。' } },
    { id: 'setup', name: 'Prewedding Setup', short: 'Prewedding', area: 'Presidential Suite',
      date: '2027-03-19', time: '21:30',
      spawn: MOMENT_PLACES.PREWEDDING, night: true,
      blurb: 'The night before — lanterns on the pool, the glass wall folded open, everyone spilling out of the living room.',
      zh: { name: '迎賓派對', short: '迎賓派對', area: '總統套房',
        blurb: '婚禮前夜 — 燈籠浮在泳池上，整面玻璃牆摺起敞開，大家從客廳一路走到池邊。' } },
    /* Ceremony, Cocktail Hour and Wedding Dinner all MOVED on 2026-08-02 —
       Carl has been to the venue and none of the three was where the model had
       it. Ceremony and cocktails share the private beachfront lawn past the
       palm belt; dinner is on the two lawns either side of the presidential
       pool, not inside the 酒廊. See site.js's GRAND_LAWN / BEACH_LAWN /
       DINNER_LAWNS block. The order of this table is untouched — it is the
       timeline the chip bar draws, and momentIndex(id) is how anything finds a
       moment in it. */
    { id: 'ceremony', name: 'Ceremony', short: 'Ceremony', area: 'The Beachfront Lawn',
      date: '2027-03-20', time: '16:30',
      spawn: MOMENT_PLACES.CEREMONY, night: false,
      blurb: 'Chairs on the grass, an aisle through the palms, and an arch with the sea behind it.',
      zh: { name: '婚禮儀式', short: '婚禮儀式', area: '海濱草坪',
        blurb: '草地上的座椅，穿過棕櫚林的通道，花拱之後便是大海。' } },
    { id: 'cocktail', name: 'Cocktail Hour', short: 'Cocktails', area: 'The Beachfront Lawn',
      date: '2027-03-20', time: '17:30',
      spawn: MOMENT_PLACES.COCKTAIL, night: false,
      blurb: 'Same lawn, other end. Teal parasols on the grass, something cold, and the tide coming in behind the bar.',
      zh: { name: '雞尾酒會', short: '雞尾酒會', area: '海濱草坪',
        blurb: '同一片草坪的另一端。草地上撐起青綠色的陽傘，手中一杯冰涼，吧台後潮水漸漲。' } },
    { id: 'dinner', name: 'Wedding Dinner', short: 'Dinner', area: 'The Pool Lawns',
      date: '2027-03-20', time: '19:00',
      spawn: MOMENT_PLACES.DINNER, night: true,
      blurb: 'Six rounds and two long tables on the two lawns outside the pool, festoon strung overhead and the water lit alongside.',
      zh: { name: '晚宴', short: '晚宴', area: '泳池畔草坪',
        blurb: '泳池旁的兩片草坪上，六張圓桌、兩張長桌；頭頂串燈交織，身旁池水映光。' } },
    { id: 'afterparty', name: 'After Party', short: 'After Party', area: 'Suite Pool Deck',
      date: '2027-03-20', time: '21:00',
      spawn: MOMENT_PLACES.AFTERPARTY, night: true,
      blurb: 'The DJ takes the deck. Lanterns still burning on the water at 1 a.m.',
      zh: { name: '派對', short: '派對', area: '套房泳池平台',
        blurb: 'DJ 接手泳池平台。凌晨一點，水面上的燈籠依然亮著。' } },
  ],
};

/** Index of a moment by id. Use this instead of a literal anywhere outside the
 *  MOMENTS table — inserting the Welcome Brunch at 0 shifted every other moment
 *  by one, and three call sites in main.js were holding raw indices. Returns −1
 *  for an unknown id, which setMoment treats as "no such moment". */
export const momentIndex = id => CFG.MOMENTS.findIndex(m => m.id === id);
