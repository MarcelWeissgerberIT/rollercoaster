Coaster Grove: next expansion assets
===================================

32 isolated pixel sprites from exactly three OpenArt jobs in project `ZUPnQYt5rmIl9G729LjL`. GPT Image 2.5 Sunburst image2image used the existing expansion-v4 assets as references. The seated riders additionally reference the original red/teal visitors. No repository files or existing assets were changed.

Files
-----

- `assets/`: 32 runtime transparent PNGs, exact 4× nearest-neighbor copies.
- `logical/`: 32 sprites at their intended game pixel size.
- `raw/`: three untouched OpenArt atlases.
- `crops/`: full-resolution keyed and trimmed source cells.
- `contact/`: actual 1× and exact 2× contact sheets.
- `manifest.json`: source crops, dimensions, logical canvases/pivots, assembly hints and visual/technical QA.
- `provenance.json`: all three prompts, settings, reference URLs, history IDs and output URLs.
- `extract.py`: reproducible technical processing. `jobs.json` holds the original two jobs; `seated-job.json` holds the subsequently authorized rider job.

Sprite names
------------

- `train-loco-{se,sw,nw,ne}`, `shuttle-{se,sw,nw,ne}`.
- `train-station`, `shuttle-stop`, `balloon-shop`, `plush-shop`.
- `teacup-base`, `teacup-cup`, `spinner-base`, `spinner-arm`, `spinner-gondola`.
- `theme-moon`, `theme-dragon`, `theme-mushroom`, `theme-star`, `workshop`.
- `ride-teacups`, `ride-spinner`: complete catalogue icons.
- `rider-{red,teal}-{se,sw,nw,ne}`: seated passenger overlays, no car or seat.

Logical geometry
----------------

| Group | Canvas | Pivot |
|---|---|---|
| Locomotive / shuttle | 64×48 | 32,36 ground |
| Train station | 88×104 | 44,88 ground |
| Shuttle stop | 72×80 | 36,64 ground |
| Shops | 72×104 | 36,88 ground |
| Teacup base | 128×96 | 64,76 ground |
| Teacup | 40×40 | 20,32 ground |
| Spinner base | 96×144 | 48,128 ground |
| Spinner arm | 96×64 | 12,16 root bearing |
| Spinner gondola | 40×48 | 20,6 suspension |
| Theme decorations | 64×80 | 32,68 ground |
| Workshop | 96×112 | 48,96 ground |
| Teacup icon | 144×112 | 72,96 ground |
| Spinner icon | 160×192 | 80,176 ground |
| Seated riders | 20×24 | 10,16 pelvis |

The PNG dimensions and pivots are four times these logical values. Riders have visible bodies approximately 9×15–16 pixels, with head, torso, bent arms and short bent legs. Draw lower bodies behind the vehicle shell; local y17 is a suggested upper-body clipping boundary. Seat locations and view-dependent depth order belong to the renderer.

`assemblyHints` in the manifest describes the teacup orbit, spinner hub/root/tip connections, and rider occupancy pivot.

QA and limits
-------------

All 32 assets are distinct, nonempty, binary-alpha PNGs with verified exact 4× copies. All source crops have clear margins. Two atlas row boundaries and two row-specific column boundaries were moved into empty magenta gutters to keep balloon tops, station, platform, workshop and spinner complete.

The generated NW locomotive pointed NE. A horizontal reflection corrects its direction; baked lighting is correspondingly mirrored. The complete spinner icon has two visible arms and gondolas rather than three, while the individual pieces permit any runtime arm count. Each moving ride component has one fixed view. No additional hand-held balloon or teddy was produced: those were suggested after the two main jobs had already completed. Projection and style are visually coherent with the reference; exact analytical 2:1 geometry is not guaranteed by image generation.

OpenArt history IDs: transport/shops `2Xw3htNvbaIKH1PJ4Q5G`; rides/themes `qgkSU8eoQFC8xtdgW7fD`; seated riders `AJv9Y8VBiDQMaxYOG3pW`.
