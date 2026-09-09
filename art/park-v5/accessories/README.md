Optional guest accessories and seat anchors
==========================================

No new OpenArt jobs. Existing shop-source pixels were extracted into two transparent accessories outside the repository.

| Asset | Logical canvas | Logical hand pivot | Runtime PNG |
|---|---|---|---|
| `hand-balloon` | 16×24 | 4,20 at string end | 64×96 |
| `hand-teddy` | 12×16 | 6,11 at lower torso | 48×64 |

The balloon is the shop's lower red balloon with its existing short string. Conservative source-colour sampling preserves the thin string when reducing to game pixels. The teddy is the gold roof ornament with the teal roof excluded. All pixels come from the existing sprites, with no invented string, body features or colours. Both finished assets have binary alpha and exact 4× nearest-neighbor runtime copies.

`manifest.json` records crop bounds, source history ID and processing; `raw/` preserves the extracted source-size objects. `contact/accessories-1x.png` and `contact/accessories-4x.png` show actual game size and enlargement.

`seat-anchors.json` contains visually measured local pelvis points for the existing drop gondola and pirate ship. `contact/*-pelvis.png` marks those locations on the unchanged 4× source sprites. `contact/*-occupancy-example.png` demonstrates the existing seated riders clipped at local y17 and placed at those coordinates. These contact images are inspection composites, not replacement ride assets.

All anchor positions are logical pixels relative to the entire frame's top left. Drop gondola frame/pivot: 80×64 / (40,32). Pirate ship frame/pivot: 144×144 / (72,16). The existing rider's pelvis pivot is (10,16) in a 20×24 frame. Suggested rider scale: 1.4 for both rides, keeping torsos and heads visible against the larger seat backs. Fine adjustment and proper foreground occlusion remain renderer concerns. Pirate rider anchors and clip masks must follow the same rotating transform as the ship.
