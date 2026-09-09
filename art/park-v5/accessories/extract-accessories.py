from pathlib import Path
import json, hashlib, math
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent
for folder in ('raw','logical','assets','contact'):(ROOT/folder).mkdir(exist_ok=True)
entries=[]

def save(name,source,selection,anchor,canvas,pivot,limit,description):
    image=Image.open(SOURCE/'crops'/source).convert('RGBA')
    a=np.array(image);alpha=np.array(selection).astype(np.uint8)
    a[:,:,3]=np.minimum(a[:,:,3],alpha);a[a[:,:,3]==0,:3]=0
    extracted=Image.fromarray(a);bounds=extracted.getbbox();cropped=extracted.crop(bounds)
    cropped.save(ROOT/'raw'/(name+'.png'))
    scale=min(limit[0]/cropped.width,limit[1]/cropped.height)
    size=(round(cropped.width*scale),round(cropped.height*scale))
    small=cropped.resize(size,Image.Resampling.NEAREST)
    if name=='hand-balloon':
        # Conservative sampling of the existing subpixel-thin string prevents
        # nearest-neighbor phase from dropping it. Copy existing source colours.
        src=np.array(cropped);dst=np.array(small)
        start=max(0,int((211-bounds[1])*size[1]/cropped.height))
        for yy in range(start,size[1]):
            for xx in range(size[0]):
                if dst[yy,xx,3]:continue
                left=int(xx*cropped.width/size[0]);right=math.ceil((xx+1)*cropped.width/size[0])
                top=int(yy*cropped.height/size[1]);bottom=math.ceil((yy+1)*cropped.height/size[1])
                tile=src[top:bottom,left:right];ys,xs=np.where(tile[:,:,3]>0)
                if len(xs):
                    centerx=(xx+.5)*cropped.width/size[0]-left;centery=(yy+.5)*cropped.height/size[1]-top
                    i=np.argmin((xs-centerx)**2+(ys-centery)**2)
                    dst[yy,xx]=tile[ys[i],xs[i]]
        small=Image.fromarray(dst)
    localanchor=(anchor[0]-bounds[0],anchor[1]-bounds[1])
    offset=(pivot[0]-round(localanchor[0]*scale),pivot[1]-round(localanchor[1]*scale))
    logical=Image.new('RGBA',canvas);logical.alpha_composite(small,offset)
    logical.save(ROOT/'logical'/(name+'.png'))
    logical.resize((canvas[0]*4,canvas[1]*4),Image.Resampling.NEAREST).save(ROOT/'assets'/(name+'.png'))
    entries.append({'name':name,'sourceCrop':'../crops/'+source,'sourceBounds':list(bounds),'sourceAnchor':list(anchor),'logicalCanvas':list(canvas),'logicalPivot':list(pivot),'logicalBounds':list(logical.getbbox()),'visible':list(size),'scale':scale,'fileScale':4,'canvas':[canvas[0]*4,canvas[1]*4],'pivot':[pivot[0]*4,pivot[1]*4],'asset':'assets/'+name+'.png','logical':'logical/'+name+'.png','processing':description,'sha256':hashlib.sha256(logical.tobytes()).hexdigest()})

source=Image.open(SOURCE/'crops/balloon-shop.png')
balloon=Image.new('L',source.size)
d=ImageDraw.Draw(balloon)
d.polygon([(268,139),(284,141),(299,151),(306,165),(306,183),(298,197),(286,209),(268,215),(254,214),(252,219),(245,220),(244,211),(238,201),(235,185),(238,170),(242,157),(252,145)],fill=255)
stringmask=Image.new('L',source.size);ImageDraw.Draw(stringmask).polygon([(245,214),(253,216),(231,250),(224,250)],fill=255)
a=np.array(source.convert('RGBA'));dark=(a[:,:,:3].astype(int).sum(axis=2)<260)&(a[:,:,3]>0)
combined=np.maximum(np.array(balloon),np.where((np.array(stringmask)>0)&dark,255,0).astype(np.uint8))
save('hand-balloon','balloon-shop.png',Image.fromarray(combined),(228,248),(16,24),(4,20),(10,17),'Mask the existing lower red balloon and its existing dark string. Nearest-neighbor body plus source-colour coverage-preserving sampling for the subpixel-thin string; no newly drawn string or invented colours. Anchored at lower string tip.')

source=Image.open(SOURCE/'crops/plush-shop.png')
teddy=Image.new('L',source.size)
ImageDraw.Draw(teddy).polygon([(134,3),(146,0),(157,3),(167,16),(193,16),(202,5),(215,3),(228,13),(232,32),(226,49),(224,68),(214,80),(225,87),(232,103),(230,120),(220,138),(205,141),(192,136),(185,127),(166,128),(145,120),(125,123),(112,117),(108,107),(110,96),(121,87),(137,84),(137,77),(147,70),(138,58),(136,39),(129,32),(129,17)],fill=255)
a=np.array(source.convert('RGBA'));r,g,b=[a[:,:,i].astype(int) for i in range(3)]
roof=(g>r+5)&(b>r+5)
selection=np.array(teddy);selection[roof]=0
save('hand-teddy','plush-shop.png',Image.fromarray(selection),(177,102),(12,16),(6,11),(8,10),'Polygon extraction of existing gold roof teddy, excluding teal roof pixels. No new colours or painted body features; anchored at lower torso for a guest hand.')

sheet=Image.new('RGB',(160,68),'#81916c');draw=ImageDraw.Draw(sheet)
for i,e in enumerate(entries):
    im=Image.open(ROOT/e['logical']);sheet.paste(im,(20+i*80,6),im);draw.text((4+i*80,48),e['name'],fill='#142718')
sheet.save(ROOT/'contact/accessories-1x.png')
sheet.resize((640,272),Image.Resampling.NEAREST).save(ROOT/'contact/accessories-4x.png')
manifest={'derivedFromProject':'ZUPnQYt5rmIl9G729LjL','sourceHistoryId':'2Xw3htNvbaIKH1PJ4Q5G','newGenerationJobs':0,'processing':'Technical selection masks, transparent trimming and nearest-neighbor scaling only. Existing colour pixels reused; no drawn new visual content.','assets':entries}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
