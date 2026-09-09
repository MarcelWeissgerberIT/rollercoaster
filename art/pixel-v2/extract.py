from pathlib import Path
import json, math
from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parent
BRIEFS = json.loads((ROOT / 'briefs.json').read_text())
for sub in ('raw', 'crops', 'logical', 'assets', 'contact'):
    (ROOT / sub).mkdir(exist_ok=True)

def key_magenta(im):
    a = np.array(im.convert('RGBA'))
    rgb = a[:,:,:3].astype(np.int16)
    r,g,b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
    mask = (r > g + 32) & (b > g + 32) & (r > 70) & (b > 65)
    a[:,:,3][mask] = 0
    return Image.fromarray(a)

def record_bounds(im):
    return list(im.getbbox() or (0,0,0,0))

entries = []
crops = {}
for brief in BRIEFS['atlases']:
    source_path = ROOT / 'raw' / (brief['key'] + '.png')
    if not source_path.exists():
        continue
    atlas = Image.open(source_path).convert('RGBA')
    w,h = atlas.size
    for i,name in enumerate(brief['names']):
        col,row = i % brief['columns'], i // brief['columns']
        nominal_cell = [round(col*w/brief['columns']), round(row*h/brief['rows']), round((col+1)*w/brief['columns']), round((row+1)*h/brief['rows'])]
        cell = list(nominal_cell)
        if brief['key'] == 'environment':
            # Model placed the tall first row below nominal cell448 boundary.
            # Move extraction boundary into visibly empty gutter; keep whole sprites.
            row_edges = [0, 512, 896, 1344]
            cell[1], cell[3] = row_edges[row], row_edges[row+1]
        keyed = key_magenta(atlas.crop(cell))
        bbox = record_bounds(keyed)
        if bbox == [0,0,0,0]:
            raise ValueError('Empty sprite ' + name)
        crop = keyed.crop(bbox)
        crop.save(ROOT / 'crops' / (name+'.png'))
        crops[name] = crop
        entries.append(dict(name=name, atlas=brief['key'], atlasDimensions=[w,h], cellIndex=i, nominalCellBounds=nominal_cell, cellBounds=cell, trimBoundsInCell=bbox, cropDimensions=list(crop.size), crop='crops/'+name+'.png'))

def spec(name):
    if name.startswith('guest'):
        return (24,32), (12,28), (17,24), 'guest'
    if name.startswith('car-'):
        return (48,40), (24,30), (32,24), 'car'
    if name in ('burger','drink','toilet','entrance','station'):
        return (56,88), (28,72), (50,66), name
    if name in ('bench','flowers','shrub'):
        return (48,40), (24,26), (40,24), name
    if name in ('tree','pine'):
        return (64,96), (32,82), (58,78), name
    if name == 'env-carousel':
        return (104,152), (52,124), (98,116), name
    if name == 'env-wheel':
        return (152,216), (76,176), (140,168), name
    # Modular parts are also preserved at source resolution in crops/.
    if name == 'wheel-rim':
        return (152,152), (76,76), (144,144), name
    if name == 'wheel-support':
        return (128,176), (64,164), (116,158), name
    if name == 'wheel-cabin':
        return (32,40), (16,4), (26,32), name
    if name in ('carousel-roof','carousel-base'):
        return (112,80), (56,40), (104,68), name
    if name == 'carousel-horse':
        return (40,56), (20,48), (32,44), name
    raise ValueError(name)

# A common scale across guest frames avoids independent width distortions.
scales = {}
for entry in entries:
    name = entry['name']
    frame,pivot,max_visible,group = spec(name)
    w,h = crops[name].size
    scale = min(max_visible[0]/w, max_visible[1]/h)
    scales[group] = min(scales.get(group, scale), scale)

for entry in entries:
    name = entry['name']
    frame,pivot,max_visible,group = spec(name)
    crop = crops[name]
    scale = scales[group]
    size = (max(1,round(crop.width*scale)), max(1,round(crop.height*scale)))
    small = crop.resize(size, Image.Resampling.NEAREST)
    logical = Image.new('RGBA', frame)
    if name == 'wheel-rim' or name in ('carousel-roof','carousel-base'):
        pos = (round(pivot[0] - size[0]/2), round(pivot[1] - size[1]/2))
    elif name == 'wheel-cabin':
        pos = (round(pivot[0] - size[0]/2), pivot[1])
    else:
        pos = (round(pivot[0] - size[0]/2), pivot[1]-size[1])
    logical.alpha_composite(small, pos)
    logical.save(ROOT / 'logical' / (name+'.png'))
    logical.resize((frame[0]*4, frame[1]*4), Image.Resampling.NEAREST).save(ROOT / 'assets' / (name+'.png'))
    entry.update(logicalCanvas=list(frame), logicalPivot=list(pivot), sourceToLogicalScale=scale, logicalVisibleDimensions=list(size), logicalBounds=record_bounds(logical), scaleGroup=group, fileScale=4, canvas=[frame[0]*4,frame[1]*4], pivot=[pivot[0]*4,pivot[1]*4], asset='assets/'+name+'.png', logical='logical/'+name+'.png')

def contact_sheet(selected, filename, use_logical):
    cols = 4
    rows = math.ceil(len(selected)/cols)
    cw,ch = 300,260
    sheet = Image.new('RGB', (cols*cw, rows*ch), '#e8eee4')
    draw = ImageDraw.Draw(sheet)
    for i,e in enumerate(selected):
        x,y = (i%cols)*cw,(i//cols)*ch
        draw.rectangle((x+4,y+4,x+cw-4,y+ch-4), fill='#8ca879',outline='#c8d2c4')
        im = Image.open(ROOT / (e['logical'] if use_logical else e['crop'])).convert('RGBA')
        scale = min((cw-24)/im.width, (ch-44)/im.height)
        im = im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
        sheet.paste(im,(x+(cw-im.width)//2,y+8+(ch-40-im.height)//2), im)
        draw.rectangle((x+4,y+ch-31,x+cw-4,y+ch-4),fill='#eef2e9')
        draw.text((x+12,y+ch-24),e['name'],fill='#17281b')
    sheet.save(ROOT / 'contact' / filename)

for brief in BRIEFS['atlases']:
    selected = [e for e in entries if e['atlas']==brief['key']]
    if selected:
        contact_sheet(selected,brief['key']+'-crops.png',False)
        contact_sheet(selected,brief['key']+'-normalized.png',True)

manifest=dict(projectId=BRIEFS['projectId'], model=BRIEFS['model'], mode=BRIEFS['mode'], processing='Technical processing only: cell cropping with environment row boundary moved to empty gutter y512 to keep first-row sprites complete; magenta color key to binary alpha; transparent trim; nearest-neighbor isotropic downsample; frame/pivot normalization; exact4x nearest-neighbor copies. No generated object painted, altered, filled, or synthesized by code. Source atlases and full-resolution keyed crops are preserved.', assets=entries)
(ROOT / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'count':len(entries),'assets':[{e['name']:e['cropDimensions']} for e in entries]},indent=2))
