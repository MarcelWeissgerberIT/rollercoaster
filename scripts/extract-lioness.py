"""Technical chroma-key extraction of the four original OpenArt lioness views."""
from PIL import Image
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent.parent
source=root/'art/zoo-v9/raw/lioness.png'
im=Image.open(source).convert('RGBA'); dims=im.size
entries=[];specs={}
for index,direction in enumerate(['se','sw','ne','nw']):
 x=(index%2)*680;y=(index//2)*680
 cell=im.crop((x,y,x+680,y+680))
 pixels=list(cell.getdata())
 cell.putdata([(r,g,b,0 if r>g+24 and b>g+24 and r+b>90 else a) for r,g,b,a in pixels])
 bounds=cell.getbbox();crop=cell.crop(bounds)
 # Common atlas scale preserves anatomical size across bearings.
 scale=0.052
 size=(round(crop.width*scale),round(crop.height*scale))
 small=crop.resize(size,Image.Resampling.NEAREST)
 # Foot contact anchor excludes the long sideways tail.
 pts=[px for py in range(int(crop.height*.8),crop.height) for px in range(crop.width) if crop.getpixel((px,py))[3]>0]
 anchor=sum(pts)/len(pts) if pts else crop.width/2
 logical=Image.new('RGBA',(40,32))
 position=(20-round(anchor*scale),28-size[1])
 logical.alpha_composite(small,position)
 dest=root/f'public/assets/zoo-v9/lioness-{direction}.png'
 logical.resize((160,128),Image.Resampling.NEAREST).save(dest)
 specs[f'lioness-{direction}']={'width':40,'height':32,'anchorX':20,'anchorY':28}
 entries.append({'name':f'lioness-{direction}','bounds':bounds,'sourceCell':[x,y,x+680,y+680],'logicalPivot':[20,28],'logicalCanvas':[40,32],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(root/'game/zoo-v9-sprites.json').write_text(json.dumps(specs,indent=2)+'\n')
manifest={'provider':'OpenArt MCP','historyId':'9qiv9qr2yLz4uaXmLRvX','model':'gpt-image-2','sourceDimensions':dims,'fileScale':4,'processing':'Pure chroma-key, four atlas crops, shared species scale and nearest-neighbor normalization. No pixels repainted.','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'assets':entries}
(root/'art/zoo-v9/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
