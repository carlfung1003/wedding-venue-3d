// beds.js — what each moment SOUNDS like (KAN-234): a level per layer, 0…1,
// multiplied by the layer's own calibrated gain (layers.js LAYERS[name].gain).
// Anything not listed is silent (and stopped — a silent layer costs nothing).
//
// Every moment has a DAY and a NIGHT bed, because N (and the status pill) can
// flip the light anywhere: the moment's own lighting is its authored bed, the
// other one swaps birds for crickets (or back) and settles the music. The
// crossfade between any two beds is the engine's (engine.js setScene).
//
// 'aerial' is the title card: the drone orbit over the enclave (the ceremony is
// dressed below it) — wind, the whole sea, the ceremony's strings, far off.
export const BEDS = {
  aerial: {
    day:   { wind: .65, sea: .75, birds: .15, strings: .6 },
    night: { wind: .6, sea: .75, crickets: .3, strings: .55 },
  },
  /* the rooftop, 26 floors up: wind, the sea far below, a café, a lounge */
  brunch: {
    day:   { wind: .7, sea: .6, murmur: .55, clink: .6, lounge: .85, birds: .12 },
    night: { wind: .7, sea: .6, murmur: .5, clink: .5, lounge: .75 },
  },
  /* the suite pool at night: water, crickets, a guitar from the house, voices */
  setup: {
    night: { lapping: .85, crickets: .8, acoustic: .85, murmur: .4, sea: .45, clink: .25 },
    day:   { lapping: .8, birds: .45, acoustic: .75, murmur: .35, sea: .5, palms: .35 },
  },
  /* the beachfront lawn at golden hour: surf, palms, birds, strings + piano */
  ceremony: {
    day:   { sea: 1, palms: .75, birds: .8, strings: .85, wind: .2 },
    night: { sea: 1, palms: .6, crickets: .6, strings: .75, wind: .2 },
  },
  /* the same lawn an hour later: the sea, a crowd, glasses, soft swing */
  cocktail: {
    day:   { sea: .85, palms: .4, birds: .35, murmur: .7, clink: .65, jazz: .85 },
    night: { sea: .85, palms: .3, crickets: .5, murmur: .65, clink: .6, jazz: .8 },
  },
  /* the pool lawns at night: crickets, a dinner party, cutlery, a warm ballad */
  dinner: {
    night: { crickets: .7, murmur: .75, cutlery: .7, clink: .35, warm: .85, sea: .4, lapping: .25 },
    day:   { birds: .4, murmur: .75, cutlery: .7, clink: .35, warm: .8, sea: .45, lapping: .25, palms: .3 },
  },
  /* the pool deck at 1 a.m.: the DJ (muffled with distance), a crowd */
  afterparty: {
    night: { beat: .75, crowd: .75, lapping: .3, crickets: .3, sea: .3 },
    day:   { beat: .7, crowd: .7, lapping: .3, birds: .25, sea: .35 },
  },
};

/** The levels for a moment id (or 'aerial') in the current light. */
export function bedLevels(key, night) {
  const b = BEDS[key] || BEDS.aerial;
  return (night ? b.night : b.day) || b.day || b.night;
}
