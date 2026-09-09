from pathlib import Path
import json, hashlib, math
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
JOBS=json.loads((ROOT/'jobs.json').read_text())
for dirname in ('raw','crops','logical','assets','contact'):
    (ROOT/dirname).mkdir(exist_ok=True)
PROCESSING='Technical processing only: atlas-cell crops (structures row split moved into empty gutter y600, parts first split y628 to retain complete tower finials), magenta color key to binary alpha, transparent trim, isotropic nearest-neighbor normalization, fixed logical canvases and pivots, exact4x nearest-neighbor PNG copies. Pirate ship translated2logicalpixels to align hub. No visual features painted, filled, or synthesized in code. Deep violet launch accents are preserved by a narrow bright-magenta key.'

def key_magenta(im):
    a=np.array(im.convert('RGBA'))
    rgb=a[:,:,:3].astype(np.int16)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    key=(r>g+60)&(b>g+60)&(r>180)&(b>180)&(np.abs(r-b)<80)
    a[:,:,3]=np.where(key,0,255).astype(np.uint8)
    a[key,:3]=0
    return Image.fromarray(a)

def spec(name):
    if name.startswith('car-'):
        return (48,40),(24,30),(36,26),'cars','ground'
    if name.startswith('station-'):
        return (72,96),(36,80),(64,68),'stations','ground'
    if name in ('ride-swing','swing-canopy'):
        return (128,160),(64,144),(116,132),name,'ground'
    if name in ('ride-drop','drop-tower'):
        return (96,224),(48,208),(82,196),name,'ground'
    if name in ('ride-pirate','pirate-frame'):
        return (160,176),(80,160),(148,148),name,'ground'
    if name=='swing-seat':
        return (28,56),(14,4),(20,48),name,'top'
    if name=='drop-gondola':
        return (80,64),(40,32),(72,56),name,'hole'
    if name=='pirate-ship':
        return (144,144),(72,16),(132,128),name,'hub'
    raise ValueError(name)

entries=[]
crops={}
for job in JOBS:
    source=ROOT/'raw'/(job['key']+'.png')
    atlas=Image.open(source).convert('RGBA')
    cols,rows=job['columns'],job['rows']
    for i,name in enumerate(job['names']):
        col,row=i%cols,i//cols
        cell=[round(col*atlas.width/cols),round(row*atlas.height/rows),round((col+1)*atlas.width/cols),round((row+1)*atlas.height/rows)]
        nominal=list(cell)
        if job['key']=='structures':
            row_edges=[0,600,atlas.height]
            cell[1],cell[3]=row_edges[row:row+2]
        if job['key']=='parts':
            row_edges=[0,628,1344,atlas.height]
            cell[1],cell[3]=row_edges[row:row+2]
        keyed=key_magenta(atlas.crop(cell))
        trim=keyed.getbbox()
        if not trim:
            raise ValueError('Empty cell: '+name)
        crop=keyed.crop(trim)
        crop.save(ROOT/'crops'/(name+'.png'))
        crops[name]=crop
        entries.append(dict(name=name,atlas=job['key'],atlasDimensions=list(atlas.size),cellIndex=i,nominalCellBounds=nominal,cellBounds=cell,trimBoundsInCell=list(trim),cropDimensions=list(crop.size),crop='crops/'+name+'.png'))

scales={}
for e in entries:
    frame,pivot,visible,group,alignment=spec(e['name'])
    crop=crops[e['name']]
    scale=min(visible[0]/crop.width,visible[1]/crop.height)
    scales[group]=min(scales.get(group,scale),scale)

for e in entries:
    name=e['name']
    frame,pivot,visible,group,alignment=spec(name)
    crop=crops[name]
    scale=scales[group]
    size=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
    small=crop.resize(size,Image.Resampling.NEAREST)
    x=round(pivot[0]-size[0]/2)
    y=pivot[1]-size[1] if alignment=='ground' else pivot[1] if alignment=='top' else pivot[1]-8 if alignment=='hub' else pivot[1]-round(size[1]*.52) if alignment=='hole' else round(pivot[1]-size[1]/2)
    if name=='pirate-ship':
        x+=2  # Align the generated central hub, rather than the flag-weighted bounds.
    logical=Image.new('RGBA',frame)
    logical.alpha_composite(small,(x,y))
    logical.save(ROOT/'logical'/(name+'.png'))
    enlarged=logical.resize((frame[0]*4,frame[1]*4),Image.Resampling.NEAREST)
    enlarged.save(ROOT/'assets'/(name+'.png'))
    e.update(logicalCanvas=list(frame),logicalPivot=list(pivot),logicalBounds=list(logical.getbbox()),logicalVisibleDimensions=list(size),sourceToLogicalScale=scale,scaleGroup=group,alignment=alignment,fileScale=4,canvas=[frame[0]*4,frame[1]*4],pivot=[pivot[0]*4,pivot[1]*4],asset='assets/'+name+'.png',logical='logical/'+name+'.png',sha256=hashlib.sha256(logical.tobytes()).hexdigest())

def contact(key,zoom):
    selected=[e for e in entries if e['atlas']==key]
    cols=4 if key=='cars' else 3 if key=='structures' else 2
    cw=max(e['logicalCanvas'][0] for e in selected)+24
    ch=max(e['logicalCanvas'][1] for e in selected)+28
    sheet=Image.new('RGB',(cols*cw,math.ceil(len(selected)/cols)*ch),'#81916c')
    draw=ImageDraw.Draw(sheet)
    for i,e in enumerate(selected):
        im=Image.open(ROOT/e['logical']).convert('RGBA')
        x,y=(i%cols)*cw,(i//cols)*ch
        sheet.paste(im,(x+(cw-im.width)//2,y+8),im)
        draw.text((x+5,y+ch-16),e['name'],fill='#162718')
    sheet=sheet.resize((sheet.width*zoom,sheet.height*zoom),Image.Resampling.NEAREST)
    sheet.save(ROOT/'contact'/f'{key}-{zoom}x.png')

for job in JOBS:
    contact(job['key'],1)
    contact(job['key'],2)

manifest=dict(projectId='ZUPnQYt5rmIl9G729LjL',model='gpt-image-2-5-sunburst',mode='image2image',processing=PROCESSING,fileScale=4,assets=entries,validation={'assetCount':len(entries),'uniqueLogicalImages':len(set(e['sha256'] for e in entries))})
manifest['assemblyHints']={
    'units':'logical pixels; approximate attachment points measured from normalized sprite geometry',
    'swing':{'static':'swing-canopy','moving':'swing-seat','canopySuspensionEllipse':{'center':[64,67],'radius':[53,16]},'seatAttachment':[14,4],'recommendedSeatCount':6,'notes':'Canopy includes stationary central mast and base. Each chair includes full chain; position its top pivot around the canopy ellipse, and depth-sort rear chairs behind canopy.'},
    'drop':{'static':'drop-tower','moving':'drop-gondola','towerTravelTop':[48,55],'towerTravelBottom':[48,170],'gondolaCenterHole':[40,32],'notes':'Gondola transparent center hole is32logicalpixelswide. Tower is a separate sprite. Front seats may need foreground compositing for correct mast occlusion.'},
    'pirate':{'static':'pirate-frame','moving':'pirate-ship','frameAxle':[80,46],'shipAxle':[72,16],'notes':'Ship includes suspension arms and a top axle hub. Rotate the entire ship around its pivot. The moving component is drawn broadside, while the complete catalogue icon uses an angled view.'}
}
manifest['validation']['visualReview']={'reviewed':['raw/cars.png','raw/structures.png','raw/parts.png','contact/cars-1x.png','contact/structures-1x.png','contact/parts-1x.png','contact/structures-2x.png','contact/parts-2x.png'],'result':'24 isolated, readable game sprites with style and palette consistent with pixel-v2. All four car orientations and three types are distinct. Two transverse cream bench rows are visible. All six modular components are isolated without the other moving or static half. Tower finials retained after gutter correction.','limitations':['Individual passenger slots within each bench are not separated; two bench rows are the readable seating unit.','Modular pirate frame/ship are broadside and do not reproduce the complete static icon exact angled geometry.','A single swing-chair view is supplied; orbit and depth ordering remain renderer work.','These are fixed pixel projection assets; exact analytical 2:1 geometry and intercomponent perspective were not machine-verified.']}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'count':len(entries),'sprites':[{e['name']:{'visible':e['logicalVisibleDimensions'],'canvas':e['logicalCanvas'],'pivot':e['logicalPivot']}} for e in entries]},indent=2))
