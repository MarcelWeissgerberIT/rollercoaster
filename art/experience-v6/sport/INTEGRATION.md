# Sport car delivery

OpenArt MCP job `jYMfh6RnojaWYXCOd2iN`, one generation.

- Original: `sport-atlas-openart.png` (1280×1024)
- Ready sprites: `assets/car-sport-{se,sw,nw,ne}.png` (192×160)
- Logical originals: `logical/` (48×40), common anchor (24,30), nearest-neighbor scale4.
- Exact prompt, reference URL, result URL: `provenance.json`
- Extraction, source crops, bounds and checksums: `manifest.json`, `extract.py`, `crops/`.

Accepted generation variation: two seats in tandem. Make3D Sport seats x=0, front z=-0.36 and rear z=+0.36 (forward=-Z); final model length can adjust these slightly. The front and rear anchors below are pelvis/cushion points, hand reviewed to nearest logical pixel. Subtract sprite anchor(24,30), then use the same scale/rotation as the car.

| Direction | Front driver | Rear passenger | Paint order |
|---|---|---|---|
| SE | (26,19) | (20,17) | rear, front |
| SW | (22,19) | (28,17) | rear, front |
| NW | (22,16) | (27,19) | front, rear |
| NE | (26,16) | (21,19) | front, rear |

Body pixels are magenta, accents cyan, seats warm ivory. Preserve neutral hardware and transparency while tinting. Seat anchors require final browser visual check with the actual rider sprite scale; their coordinates are not inferred from transparent image bounding boxes.

All derived files use technical cropping/keying/resampling only. No drawn features were added in code. Repository untouched.
