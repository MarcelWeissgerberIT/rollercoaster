from PIL import Image
from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent;src=Image.open(p/'cleaning-atlas-openart.png').convert('RGBA')
for folder in ['crops','logical','assets']:(p/folder).mkdir(exist_ok=True)
names=['bin-empty','bin-full','cleaner-se','cleaner-sw','cleaner-nw','cleaner-ne']
# Manually reviewed foot contacts, independent of the broom's outer silhouette.
# Coordinates are in the corresponding512x512 atlas cell; all items remain unpainted.
foot={'cleaner-se':(205,434),'cleaner-sw':(281,366),'cleaner-nw':(249,370),'cleaner-ne':(214,370)}
items=[]
for i,name in enumerate(names):
 box=(i%3*512,i//3*512,(i%3+1)*512,(i//3+1)*512);cell=src.crop(box);data=[]
 for r,g,b,a in cell.getdata():
  if r>g+50 and b>g+50 and r>130 and b>130:a=0
  data.append((r,g,b,a))
 cell.putdata(data);bounds=cell.getbbox();crop=cell.crop(bounds);crop.save(p/'crops'/f'{name}.png')
 items.append({'name':name,'cellBounds':box,'trimBoundsInCell':bounds,'crop':crop,'sourceAnchorInCell':foot.get(name,((bounds[0]+bounds[2])/2,bounds[3]))})
workerScale=25/max(item['sourceAnchorInCell'][1]-item['trimBoundsInCell'][1] for item in items if item['name'].startswith('cleaner'))
binScale=15/max(item['crop'].height for item in items if item['name'].startswith('bin'))
assets=[]
for item in items:
 crop=item.pop('crop');scale=workerScale if item['name'].startswith('cleaner') else binScale
 w,h=crop.size;size=(round(w*scale),round(h*scale));anchor=item['sourceAnchorInCell'];bounds=item['trimBoundsInCell'];left=round(12-(anchor[0]-bounds[0])*scale);top=round(28-(anchor[1]-bounds[1])*scale)
 assert left>=0 and top>=0 and left+size[0]<=24 and top+size[1]<=32,(item['name'],left,top,size)
 logical=Image.new('RGBA',(24,32),(0,0,0,0));logical.alpha_composite(crop.resize(size,Image.Resampling.NEAREST),(left,top));logical.save(p/'logical'/f'{item["name"]}.png');logical.resize((96,128),Image.Resampling.NEAREST).save(p/'assets'/f'{item["name"]}.png')
 assert all(not(a and r>g+50 and b>g+50 and r>130 and b>130)for r,g,b,a in logical.getdata())
 item.update({'sourceCropSize':[w,h],'logicalCanvas':[24,32],'logicalPivot':[12,28],'logicalBounds':[left,top,left+size[0],top+size[1]],'opaqueBounds':logical.getbbox(),'commonGroupScale':scale,'scaleGroup':'worker'if item['name'].startswith('cleaner')else'bin','fileScale':4,'canvas':[96,128],'pivot':[48,112],'asset':f'assets/{item["name"]}.png','logical':f'logical/{item["name"]}.png','sha256':hashlib.sha256((p/'assets'/f'{item["name"]}.png').read_bytes()).hexdigest()})
 assets.append(item)
 print(item['name'],item['logicalBounds'],item['sourceAnchorInCell'])
processing='Technical extraction only: six atlas-cell crops, bright-magenta chroma key, transparent trim, one isotropic scale shared by four workers and one shared by both bins, manually reviewed human-foot anchors independent of broom extent, nearest-neighbor normalization and exact4x copies. No illustrated features painted, filled or synthesized in code.'
m={'fileScale':4,'processing':processing,'assets':assets,'limitations':['Four directional worker poses, one frame per direction. These are not a complete walk cycle or a separate sweeping action animation.','Broom is part of each character sprite. Worker anchor follows feet, so a forward broom may extend below logical y28.']}
(p/'manifest.json').write_text(json.dumps(m,indent=2));d=json.loads((p/'provenance.json').read_text());d.update({'processing':processing,'manifest':'manifest.json','limitations':m['limitations']});(p/'provenance.json').write_text(json.dumps(d,indent=2))
(p/'INTEGRATION.md').write_text('''# Cleaning staff and litter bins\n\nOpenArt MCP job `NOLzDwIyYmi7rOyVftfF`, one generation, GPT Image2.5 Flare.\n\n- Ready sprites: `assets/bin-empty.png`, `assets/bin-full.png`, `assets/cleaner-{se,sw,nw,ne}.png`.\n- Every file96×128; logical24×32, pivot(12,28), nearest-neighbor scale4.\n- Original: `cleaning-atlas-openart.png` (1536×1024).\n- Exact prompts/URL/job: `provenance.json`; source crops, scales, reviewed foot anchors, checksums: `manifest.json`.\n\nWorkers have25pixel cap-to-foot height and a shared source scale. The anchor follows the feet rather than the broom-bounds center, preventing horizontal jumps when changing direction. Bin variants share scale and floor baseline, with15pixel visible height.\n\nFour views are visually distinct: SE/SW show the face, NW/NE show the cap/shirt back. They contain one pose each, not a generated walk/sweep cycle. Use route movement plus modest stride bob for now; do not claim frame animation. The broom is already attached and points to the floor.\n\nBin-full adds only paper/cup inside the opening. No ground litter or ground shadow is baked in. Cleanup operations and ground litter remain independent gameplay elements.\n\nNo repository files changed; all extraction is technical crop/key/nearest-neighbor normalization, no illustrated drawing in code.\n''')
