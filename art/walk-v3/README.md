Walk v3 candidate assets
========================

Exactly two OpenArt generations, using GPT Image 2.5 Sunburst image2image with the existing mobile atlas as reference. The root integration copied the validated frames into the game repository.

- `raw/`: two untouched 1360x1360 generated atlases.
- Runtime PNGs are in `../../public/assets/walk-v3/`: 32 frames, each 96x128, exact nearest-neighbor 4x copies.
- `manifest.json`: per-frame source bounds, pivots, common per-character scale, dimensions and validation.
- `provenance.json`: project, model, exact prompts, reference, generation IDs, resource URLs and visual review.
- `extract.py`: technical atlas processing. Running it with Pillow and NumPy recreates local `assets`, `logical`, `crops`, and `contact` inspection directories; these generated inspection files are not needed by the game.

Runtime names: `walk-red-{se,sw,nw,ne}-{0,1,2,3}.png` and `walk-teal-{se,sw,nw,ne}-{0,1,2,3}.png`.

Visual result and limitation
----------------------------

Both characters now alternate visibly between wide stride and narrow passing silhouettes, with bent knees, lifted feet, and arms that shift from spread to close to the body. The style matches the existing characters. All 32 PNGs are unique, have binary alpha, and preserve the requested frame/pivot convention.

The generated contact poses 0 and 2 are still very similar: they do not convincingly exchange the anatomical leading limb. Passing poses 1 and 3 are also similar. The phase labels in the manifest describe the requested poses, not verified anatomy. Treat these as two-pose-dominant cycles with small variations, not as a fully articulated four-phase walk. This is recorded explicitly in the manifest and provenance. The generation budget of two was respected.
