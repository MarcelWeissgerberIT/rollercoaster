from pathlib import Path
from PIL import Image
import json,hashlib,math
p=Path(__file__).resolve().parent
for name in ['crops','logical','assets']:(p/name).mkdir(exist_ok=True)
# Width,height,pivotX,pivotY,maxVisibleWidth,maxVisibleHeight.
SPECS={
 'zebra':(40,32,20,28,32,24),'giraffe':(32,48,16,44,28,40),
 'flamingo':(24,32,12,28,18,25),'penguin':(24,24,12,20,16,18),
 'keeper':(24,32,12,28,18,25),
 'zoo-keeper-hut':(72,80,36,72,64,68),'zoo-feeder':(32,32,16,28,28,20),
 'zoo-trough':(32,24,16,20,28,15),'zoo-shelter':(64,56,32,48,58,44),
}
ATLASES={
 'savanna':{'cut':529,'key':'magenta','names':[f'{animal}-{d}'for animal in ['zebra','giraffe']for d in ['se','sw','nw','ne']]},
 'birds':{'cut':742,'key':'green','names':[f'{animal}-{d}'for animal in ['flamingo','penguin']for d in ['se','sw','nw','ne']]},
 'zoo-props':{'cut':688,'key':'magenta','names':['zoo-keeper-hut','zoo-feeder','zoo-trough','zoo-shelter','keeper-se','keeper-sw','keeper-nw','keeper-ne']},
}
items=[]
for atlas,desc in ATLASES.items():
 src=Image.open(p/'raw'/f'{atlas}.png').convert('RGBA');w,h=src.size;cw=w//4
 for i,name in enumerate(desc['names']):
  bounds=(i%4*cw,0 if i<4 else desc['cut'],(i%4+1)*cw,desc['cut']if i<4 else h)
  image=src.crop(bounds);pixels=[]
  for r,g,b,a in image.getdata():
   key=(g>r+28 and g>b+28)if desc['key']=='green'else(r>g+50 and b>g+50 and r>120 and b>120)
   pixels.append((0,0,0,0)if key else(r,g,b,a))
  image.putdata(pixels);trim=image.getbbox();assert trim,name+' empty source';crop=image.crop(trim)
  crop.save(p/'crops'/f'{name}.png')
  group=name if name.startswith('zoo-')else name.rsplit('-',1)[0]
  items.append({'name':name,'atlas':atlas,'sourceAtlasDimensions':[w,h],'cellIndex':i,'cellBounds':bounds,'trimBoundsInCell':trim,'group':group,'crop':crop,'sourceTransform':'identity'})
# The generated NW keeper incorrectly faces NE. Preserve that original crop and
# derive NW by mirroring only the genuine NE sprite (a standard sprite transform).
nw=next(v for v in items if v['name']=='keeper-nw');ne=next(v for v in items if v['name']=='keeper-ne')
nw['crop'].save(p/'crops'/'keeper-nw-original-wrong-facing.png')
nw['crop']=ne['crop'].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
nw['crop'].save(p/'crops'/'keeper-nw.png');nw['sourceTransform']='horizontal mirror of keeper-ne';nw['derivedFrom']='keeper-ne';nw['preservedOriginalCrop']='crops/keeper-nw-original-wrong-facing.png'
# A shared source scale per species avoids independent-frame size breathing.
scales={}
for group,spec in SPECS.items():
 groupItems=[item for item in items if item['group']==group]
 scales[group]=min(spec[4]/max(v['crop'].width for v in groupItems),spec[5]/max(v['crop'].height for v in groupItems))
assets=[]
for item in items:
 crop=item.pop('crop');w,h=crop.size;spec=SPECS[item['group']];cw,ch,ax,ay=spec[:4];scale=scales[item['group']]
 # Foot-band center is independent of head/tail/bucket overhang.
 if item['group']in['zebra','giraffe','flamingo','penguin','keeper']:
  band=math.floor(h*.78);points=[];fallback=[]
  for y in range(band,h):
   for x in range(w):
    r,g,b,a=crop.getpixel((x,y))
    if a:
     fallback.append(x)
     if item['group']!='keeper'or(r>g*1.08 and r>b*1.15):points.append(x)
  points=points or fallback;sourceX=sum(points)/len(points)+.5
  anchorMethod='mean foreground x in bottom22% foot band; keeper uses warm brown boot pixels'
 else:sourceX=w/2;anchorMethod='horizontal center of complete object, lowest base contact'
 size=(round(w*scale),round(h*scale));left=round(ax-sourceX*scale);top=ay-size[1]
 assert left>=0 and top>=0 and left+size[0]<=cw and top+size[1]<=ch,(item['name'],left,top,size,spec)
 small=crop.resize(size,Image.Resampling.NEAREST);canvas=Image.new('RGBA',(cw,ch),(0,0,0,0));canvas.alpha_composite(small,(left,top))
 canvas.save(p/'logical'/f'{item["name"]}.png');canvas.resize((cw*4,ch*4),Image.Resampling.NEAREST).save(p/'assets'/f'{item["name"]}.png')
 item.update({'sourceCropDimensions':[w,h],'sourceAnchorInCrop':[sourceX,h],'anchorMethod':anchorMethod,'logicalCanvas':[cw,ch],'logicalPivot':[ax,ay],'logicalBounds':[left,top,left+size[0],top+size[1]],'opaqueBounds':canvas.getbbox(),'sourceToLogicalScale':scale,'fileScale':4,'canvas':[cw*4,ch*4],'pivot':[ax*4,ay*4],'asset':f'assets/{item["name"]}.png','logical':f'logical/{item["name"]}.png','sha256':hashlib.sha256((p/'assets'/f'{item["name"]}.png').read_bytes()).hexdigest()})
 assets.append(item);print(item['name'],item['logicalCanvas'],item['logicalPivot'],item['opaqueBounds'],item['sourceTransform'])
processing='Technical extraction only: chroma key, atlas-cell crops with row cuts moved into actual empty gutters(savanna529,birds742,zoo-props688), transparent trim, one isotropic source scale per species or object group, foot-band ground anchors for animals/staff, nearest-neighbor normalization, exact4x copies. KeeperNW is a horizontal mirror of generated KeeperNE because the raw NW faces the wrong way; wrong-facing original retained. No features painted, filled or synthesized in code.'
manifest={'provider':'OpenArt MCP','fileScale':4,'processing':processing,'assets':assets,'limits':['One pose per direction, not a complete walking or head-motion frame cycle. Runtime movement may add translation/rotation/bob.','KeeperNW uses technical horizontal mirroring of KeeperNE; it is not an independently generated NW pose.']}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2))
spriteSpecs={a['name']:{'width':a['logicalCanvas'][0],'height':a['logicalCanvas'][1],'anchorX':a['logicalPivot'][0],'anchorY':a['logicalPivot'][1]}for a in assets}
(p/'zoo-sprites.json').write_text(json.dumps(spriteSpecs,indent=2))
prov=json.loads((p/'provenance.json').read_text());prov.update({'processing':processing,'manifest':'manifest.json','spriteSpecs':'zoo-sprites.json','limits':manifest['limits']});(p/'provenance.json').write_text(json.dumps(prov,indent=2))
