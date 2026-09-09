# Zoo asset delivery

24 sprites from exactly three OpenArt MCP image2image generations, GPT Image2.5 Flare. All source atlases, prompts, job IDs, source URLs, hashes and technical extraction are retained here. Integrated into Coaster Grove.

Runtime PNGs: `../../public/assets/zoo-v7/`. Rebuilding with `python3 extract.py` writes local `assets/`, `logical/` and `crops/` directories. All are exact4× nearest-neighbor copies of `logical/`. `../../game/zoo-sprites.json` is the runtime sprite-spec mapping; `manifest.json` contains source crops and anchor details.

| Sprite keys | Logical canvas | Ground anchor | File size |
|---|---|---|---|
| zebra-se/sw/nw/ne |40×32|(20,28)|160×128|
| giraffe-se/sw/nw/ne |32×48|(16,44)|128×192|
| flamingo-se/sw/nw/ne |24×32|(12,28)|96×128|
| penguin-se/sw/nw/ne |24×24|(12,20)|96×96|
| zoo-keeper-hut |72×80|(36,72)|288×320|
| zoo-feeder |32×32|(16,28)|128×128|
| zoo-trough |32×24|(16,20)|128×96|
| zoo-shelter |64×56|(32,48)|256×224|
| keeper-se/sw/nw/ne |24×32|(12,28)|96×128|

Animal/staff ground anchors follow the foot region, independent of head, tail or bucket overhang. One common normalization scale per species preserves proportions between directions. All16 animal silhouettes remain connected at logical resolution. Some direction silhouettes differ in height due to the generated stance and foreshortening.

Directions name travel/head direction in screen space: SE lower-right, SW lower-left, NW upper-left, NE upper-right. Animals have one pose per direction; use runtime translation and modest bob/tilt. These are not separate walking/head-animation layers. No fences, terrain or cast shadows are baked into the sprites.

Keeper limitation: the generated NW cell also faced NE. `keeper-nw.png` therefore uses a pure horizontal mirror of generated `keeper-ne.png`; the original wrong-facing NW crop remains in `crops/keeper-nw-original-wrong-facing.png`. No new illustrated features were painted in code.

Source row cuts were placed in real empty gutters. The savanna cut at y529 preserves giraffe heads that crossed the nominal half-height row boundary.

The source atlases and extracted sprites were visually reviewed. Run `python3 extract.py` followed by `python3 validate.py` (Pillow) to recheck sizes, anchors, hashes, unique sprites, alpha,4×NN scaling and connected animal silhouettes.
