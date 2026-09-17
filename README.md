# The Big Day

*Walk our wedding day — before anyone else does.*

A first-person 3D walkthrough of Carl & Rachel's wedding venue — The Westin
Sanya Haitang Bay, the 隐逸居 (Yinyiju) clubhouse enclave — playable in the
browser. Six moments across three days, each dressed the way the planner's
renders dress them, on the real campus: the presidential suite and its lit
pool, the beachfront lawn, the two pool lawns, the hotel rooftop.

## Run

```bash
python3 serve.py
# → http://localhost:8799
```

No build, no install — Three.js loads from a CDN. The site is static.

## How it plays

WASD (or the touch stick) to walk, mouse (or drag) to look, **E** to
interact. Press **F** (or the FLY button) to lift off into free flight —
W/S fly along wherever you're looking, **Space**/**C** (or ▲▼) climb and
dive, Shift goes fast; press F again to land. **N** flips golden hour to
night. Keys **1–6** or the chips at the bottom jump between moments, in
order:

1. **Welcome Brunch** (18 March) — the Westin rooftop, an infinity pool to
   the sea, the buffet and the champagne service
2. **Prewedding Setup** (19 March) — the presidential suite at night, lanterns
   on the water, the champagne tower
3. **Ceremony** (20 March) — the beachfront lawn: sixty cross-back chairs,
   a petal aisle, two floral towers, the bead chandeliers, the dessert bar
4. **Cocktail Hour** — the same lawn, the round pine bar and the four real
   cocktails
5. **Wedding Dinner** — the pool lawns at dusk: rounds and longs under
   festoon and crystal candelabra
6. **After Party** — the DJ takes the pool deck

## Tech

- Three.js r180 via CDN importmap — pure static HTML/CSS/JS, zero build
- The campus is procedural (CanvasTexture surfaces, seeded PRNG so the venue
  is identical every load); the **props are Blender-authored** —
  `assets/blender/` scripts every chair, table, floral and fixture, bakes an
  albedo×AO atlas and exports one-mesh Draco GLBs to `assets/models/`, which
  `js/models.js` instances through the same buckets the procedural dressing
  used, so sixty chairs are still one draw call
- Textures and art come from Vertex AI image generation
  (`assets/blender/art_manifest.json`), colour-balanced to the planner's
  palette; every word on screen is the game's own copy
- First-person walking controls ported from
  [Lassen Nights](https://camp.carlfung.dev), renderer setup from
  [Alice Lunch Party](https://alice.carlfung.dev), free-flight spectator
  mode in the spirit of [Broomflight](https://wizard.carlfung.dev)
- Modelled from our own site photos, the suite walkthrough and the planner's
  renders — see `CLAUDE.md` for the whole record

## Credits

Real venue, real decor, real wedding. For R. — see you on the big day. 💍
