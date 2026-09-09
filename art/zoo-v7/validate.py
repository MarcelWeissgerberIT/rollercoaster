from pathlib import Path
from PIL import Image
import json,hashlib
from collections import deque
p=Path(__file__).resolve().parent;m=json.loads((p/'manifest.json').read_text());hashes=set();report=[]
assert len(m['assets'])==24
for a in m['assets']:
 image=Image.open(p/a['asset']).convert('RGBA');logical=Image.open(p/a['logical']).convert('RGBA')
 assert list(image.size)==a['canvas'];assert list(logical.size)==a['logicalCanvas'];assert image.tobytes()==logical.resize(image.size,Image.Resampling.NEAREST).tobytes();assert logical.getbbox()==tuple(a['opaqueBounds'])
 digest=hashlib.sha256((p/a['asset']).read_bytes()).hexdigest();assert digest==a['sha256'];assert digest not in hashes;hashes.add(digest)
 assert set(logical.getchannel('A').getdata())<={0,255}
 assert a['logicalBounds'][0]>=0 and a['logicalBounds'][1]>=0 and a['logicalBounds'][2]<=logical.width and a['logicalBounds'][3]<=logical.height
 assert a['opaqueBounds'][3]<=a['logicalPivot'][1]
 mask=set()
 for y in range(logical.height):
  for x in range(logical.width):
   r,g,b,alpha=logical.getpixel((x,y))
   if not alpha:continue
   assert not ((g>r+28 and g>b+28)if a['atlas']=='birds'else(r>g+50 and b>g+50 and r>120 and b>120)),a['name']+' key remnants'
   mask.add((x,y))
 sizes=[]
 while mask:
  q=deque([mask.pop()]);n=0
  while q:
   x,y=q.popleft();n+=1
   for dx,dy in[(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
    t=(x+dx,y+dy)
    if t in mask:mask.remove(t);q.append(t)
  sizes.append(n)
 if a['group']in['zebra','giraffe','flamingo','penguin']:assert len(sizes)==1,a['name']+' detached animal parts'
 report.append({'sprite':a['name'],'width':logical.width,'height':logical.height,'anchor':a['logicalPivot'],'connectedComponents':len(sizes)})
result={'sprites':len(report),'uniqueAssets':len(hashes),'animalComponents':'all16 animals have one connected opaque silhouette at logical size','alpha':'binary and free of keyed backgrounds','scaling':'all assets exact4x nearest-neighbor copies','entries':report}
(p/'validation.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k!='entries'},indent=2))
