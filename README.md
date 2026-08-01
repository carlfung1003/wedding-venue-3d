# The Big Day

*Walk through our wedding day — before anyone else does.*

A first-person 3D walkthrough of Carl & Rachel's wedding venue, playable in
the browser. Wander the hotel as it moves through the five moments of the
day — the same grand ballroom is dressed for the ceremony, then flipped for
dinner, exactly the way the hotel will do it on the day.

## Run

```bash
python3 serve.py
# → http://localhost:8799
```

No build, no install — Three.js loads from a CDN.

## How it plays

WASD (or the touch stick) to walk, mouse (or drag) to look, **E** to
interact. Press **F** (or the FLY button) to lift off into free flight —
W/S fly along wherever you're looking, **Space**/**C** (or ▲▼) climb and
dive, Shift goes fast; press F again to land. Keys **1–5** or the chips at
the bottom jump between moments:

1. **Prewedding Setup** — the bridal suite: garment rack, good light, one
   very important dress
2. **Ceremony** — rows of white chairs, a long aisle, an arch at the end
3. **Cocktail Hour** — high-tops and champagne in the foyer while the
   ballroom flips
4. **Wedding Dinner** — the same ballroom re-dressed: rounds of ten, a head
   table, a dance floor
5. **After Party** — string lights and a DJ booth on the terrace

## Tech

- Three.js r180 via CDN importmap — pure static HTML/CSS/JS, zero build
- Procedural everything: CanvasTexture carpets, marble, parquet and night
  sky; seeded PRNG so the venue is identical every load
- First-person walking controls ported from
  [Lassen Nights](https://camp.carlfung.dev), renderer setup from
  [Alice Lunch Party](https://alice.carlfung.dev), free-flight spectator
  mode in the spirit of [Broomflight](https://wizard.carlfung.dev)
- The venue itself is a placeholder — it gets rebuilt from the real hotel's
  walkthrough video

## Credits

Placeholder venue, real wedding. For R. — see you on the big day. 💍
