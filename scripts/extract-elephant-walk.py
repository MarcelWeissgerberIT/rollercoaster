"""Technical atlas extraction only: chroma key, fixed cells, shared scale, nearest sampling.

Artwork and four walking poses are authored by OpenArt, see art/zoo-walk-v10.
No limbs or replacement art are drawn by this script.
"""
from pathlib import Path
from PIL import Image
import json
import hashlib

root = Path(__file__).resolve().parent.parent
source = root / "art/zoo-walk-v10/raw/elephant-walk.png"
im = Image.open(source).convert("RGBA")
assert im.width == im.height and im.width % 4 == 0
cell = im.width // 4
frames = []
# The generated atlas has slightly uneven row gutters. Crop through their empty
# centers so the tips of the north-facing ears aren't assigned to the row above.
row_edges = [0, 323, 647, 971, im.height]
for row, direction in enumerate(["se", "sw", "ne", "nw"]):
    poses = []
    for col in range(4):
        crop = im.crop((col*cell, row_edges[row], (col+1)*cell, row_edges[row+1]))
        crop.putdata([(r,g,b,0 if r>g*1.5 and b>g*1.5 and r>85 and b>85 else a) for r,g,b,a in crop.getdata()])
        poses.append(crop)
    baseline = max(p.getbbox()[3] for p in poses)
    frames.extend((direction, index, p, baseline) for index,p in enumerate(poses))
out = root / "public/assets/zoo-walk-v10"
out.mkdir(parents=True, exist_ok=True)
specs = {}
assets = []
for direction, index, pose, baseline in frames:
    # One scale and horizontal cell origin across every pose; only row baseline differs.
    ratio = .145
    resized = pose.resize((round(cell*ratio),round(pose.height*ratio)),Image.Resampling.NEAREST)
    canvas = Image.new("RGBA",(48,40))
    canvas.alpha_composite(resized,(round(24-cell*ratio/2),round(36-baseline*ratio)))
    name = f"elephant-walk-{direction}-{index}"
    canvas.resize((192,160),Image.Resampling.NEAREST).save(out/f"{name}.png")
    specs[name] = dict(width=48,height=40,anchorX=24,anchorY=36)
    assets.append({"name":name,"canvas":[192,160],"logicalPivot":[24,36],"sha256":hashlib.sha256((out/f"{name}.png").read_bytes()).hexdigest()})
(root / "game/zoo-walk-sprites.json").write_text(json.dumps(specs,indent=2)+"\n")
(root / "art/zoo-walk-v10/manifest.json").write_text(json.dumps({"provider":"OpenArt","historyId":"0pdMRgeNwlHiiHZDpXhu","sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"assets":assets},indent=2)+"\n")
print(json.dumps({"frames":len(frames),"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest()}))
