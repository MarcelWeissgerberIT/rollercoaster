# Cleaning staff and litter bins

OpenArt MCP job `NOLzDwIyYmi7rOyVftfF`, one generation, GPT Image2.5 Flare.

- Ready sprites: `assets/bin-empty.png`, `assets/bin-full.png`, `assets/cleaner-{se,sw,nw,ne}.png`.
- Every file96×128; logical24×32, pivot(12,28), nearest-neighbor scale4.
- Original: `cleaning-atlas-openart.png` (1536×1024).
- Exact prompts/URL/job: `provenance.json`; source crops, scales, reviewed foot anchors, checksums: `manifest.json`.

Workers have25pixel cap-to-foot height and a shared source scale. The anchor follows the feet rather than the broom-bounds center, preventing horizontal jumps when changing direction. Bin variants share scale and floor baseline, with15pixel visible height.

Four views are visually distinct: SE/SW show the face, NW/NE show the cap/shirt back. They contain one pose each, not a generated walk/sweep cycle. Use route movement plus modest stride bob for now; do not claim frame animation. The broom is already attached and points to the floor.

Bin-full adds only paper/cup inside the opening. No ground litter or ground shadow is baked in. Cleanup operations and ground litter remain independent gameplay elements.

No repository files changed; all extraction is technical crop/key/nearest-neighbor normalization, no illustrated drawing in code.
