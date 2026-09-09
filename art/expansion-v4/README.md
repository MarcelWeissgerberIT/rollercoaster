Coaster Grove expansion assets
==============================

24 game sprites from exactly3 OpenArt generations in project ZUPnQYt5rmIl9G729LjL. GPT Image2.5 Sunburst image2image used the existing pixel-v2 atlases as style references. No repository files were changed.

Files
-----

- `assets/`:24 runtime PNGs, each an exact4x nearest-neighbor copy of its logical sprite.
- `logical/`:24 sprites at game pixel size.
- `raw/`:3 untouched generated atlases.
- `crops/`:24 full-resolution keyed and trimmed source cells.
- `contact/`:actual1x and exact2x contact sheets for each atlas.
- `manifest.json`:names, source crop bounds, dimensions, logical canvases/pivots, assembly attachment hints and validation.
- `provenance.json`:project, model, full prompts and settings, original reference URLs, generation IDs and output URLs.
- `extract.py`:reproducible technical processing. Two row boundaries were moved into empty gutters to retain complete tower finials.

Naming
------

- Cars: `car-{steel,wood,launch}-{se,sw,nw,ne}`.
- Stations: `station-{steel,wood,launch}`.
- Complete catalogue icons: `ride-{swing,drop,pirate}`.
- Separate animated parts: `swing-canopy`, `swing-seat`, `drop-tower`, `drop-gondola`, `pirate-frame`, `pirate-ship`.

Runtime geometry
----------------

| Group | Logical canvas | Logical pivot |
|---|---|---|
| All cars |48x40|24,30 ground|
| All stations |72x96|36,80 ground|
| Swing icon/canopy |128x160|64,144 ground|
| Swing seat with chains |28x56|14,4 suspension|
| Drop icon/tower |96x224|48,208 ground|
| Drop gondola |80x64|40,32 central hole|
| Pirate icon/frame |160x176|80,160 ground|
| Pirate ship with arms |144x144|72,16 axle|

All actual PNG files are4times those dimensions. `assemblyHints` in the manifest includes canopy orbit center/radii, gondola travel limits and pirate-frame axle. These are logical coordinates relative to each frame's top left.

Quality and limits
------------------

Cars visibly distinguish red steel, brown/gold wood, and teal/violet launch, with four orientations each and two cream bench rows. Individual passenger positions within each bench are not separated. All six modular ride parts are isolated as requested. Transparent holes survive extraction, including the32pixelwide gondola center hole.

The modular pirate ship/frame are broadside, whereas the complete pirate icon uses an angled view. A single swing chair view is supplied; rotation/orbit depth sorting belongs to the renderer. Projection follows the reference pixel style, with no machine verification of exact2:1 geometry. Fixed sprite scale and pivots are verified, but assembly hints may need a few pixels of renderer tuning.

Validation:24 distinct assets, binary alpha, nonempty frames, all source crops clear of cell boundaries, exact4x nearest-neighbor copies. No sprite details were painted or synthesized in code.
