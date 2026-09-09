from PIL import Image
from pathlib import Path
import json,hashlib
from collections import deque
p=Path(__file__).resolve().parent
src=Image.open(p/'sport-atlas-openart.png').convert('RGBA')
for folder in ['crops','logical','assets']:(p/folder).mkdir(exist_ok=True)
items=[]
for i,d in enumerate(['se','sw','nw','ne']):
 box=((i%2)*640,(i//2)*512,(i%2+1)*640,(i//2+1)*512)
 cell=src.crop(box)
 pixels=[]
 for r,g,b,a in cell.getdata():
  if g>r+28 and g>b+28:a=0
  pixels.append((r,g,b,a))
 cell.putdata(pixels);bbox=cell.getbbox();crop=cell.crop(bbox)
 crop.save(p/'crops'/f'car-sport-{d}.png')
 items.append({'name':f'car-sport-{d}','direction':d,'cellBounds':box,'trimBoundsInCell':bbox,'crop':crop})
scale=32/max(item['crop'].width for item in items)
assets=[]
for item in items:
 crop=item.pop('crop');size=(round(crop.width*scale),round(crop.height*scale));left=24-size[0]//2;top=30-size[1]
 out=Image.new('RGBA',(48,40),(0,0,0,0));out.alpha_composite(crop.resize(size,Image.Resampling.NEAREST),(left,top));out.save(p/'logical'/f'{item["name"]}.png');out.resize((192,160),Image.Resampling.NEAREST).save(p/'assets'/f'{item["name"]}.png')
 # Report bright ivory components from the full source crop for selecting actual seat bases.
 w,h=crop.size;px=crop.load();mask=set()
 for y in range(h):
  for x in range(w):
   r,g,b,a=px[x,y]
   if a and r>155 and g>125 and b>70 and r>=g and g-b>15 and r-g<85:mask.add((x,y))
 components=[]
 while mask:
  seed=mask.pop();q=deque([seed]);points=[seed]
  while q:
   x,y=q.popleft()
   for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if n in mask:mask.remove(n);points.append(n);q.append(n)
  if len(points)>40:
   xs=[x for x,y in points];ys=[y for x,y in points]
   components.append({'area':len(points),'sourceCropBounds':[min(xs),min(ys),max(xs)+1,max(ys)+1],'sourceCropCentroid':[sum(xs)/len(xs),sum(ys)/len(ys)]})
 components.sort(key=lambda v:-v['area'])
 item.update({'sourceCropSize':[w,h],'logicalCanvas':[48,40],'logicalPivot':[24,30],'logicalBounds':[left,top,left+size[0],top+size[1]],'commonSourceToLogicalScale':scale,'canvas':[192,160],'pivot':[96,120],'fileScale':4,'asset':f'assets/{item["name"]}.png','logical':f'logical/{item["name"]}.png','sha256':hashlib.sha256((p/'assets'/f'{item["name"]}.png').read_bytes()).hexdigest(),'ivoryComponents':components})
 assets.append(item)
 print(item['name'],'crop',[w,h],'logicalBounds',item['logicalBounds'],'ivory',components[:3])
manifest={'fileScale':4,'processing':'Technical extraction only: 2x2 atlas cell crops, pure-green chroma key, transparent trim, one isotropic scale shared by all four views, ground baseline y=30 and horizontal center x=24, nearest-neighbor resize, exact4x display copies. No visual features painted or synthesized in code.','assets':assets}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2))
prov=json.loads((p/'provenance.json').read_text());prov['processing']=manifest['processing'];prov['manifest']='manifest.json';prov['limitations']=['OpenArt placed the two seats in tandem, rather than side by side; accepted as the sport model\'s intentional seating arrangement for shared 2D/3D integration.'];(p/'provenance.json').write_text(json.dumps(prov,indent=2))
