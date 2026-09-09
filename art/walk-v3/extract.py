from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
for name in ('raw', 'crops', 'logical', 'assets', 'contact'):
    (ROOT / name).mkdir(exist_ok=True)

DIRECTIONS = ('se', 'sw', 'nw', 'ne')
PHASES = ('left-contact', 'left-passing', 'right-contact', 'right-passing')
PROCESSING = 'Technical processing only: equal atlas cell cropping; magenta color key to binary alpha; transparent trim; common isotropic nearest-neighbor scale within each character; centered ground pivot normalization to 24x32 logical pixels with pivot (12,28); exact 4x nearest-neighbor PNG copies. No sprite features were painted, filled, synthesized, or otherwise altered in code.'

def key_magenta(im):
    arr = np.array(im.convert('RGBA'))
    rgb = arr[:,:,:3].astype(np.int16)
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
    magenta = (r > g + 32) & (b > g + 32) & (r > 70) & (b > 65)
    arr[:,:,3] = np.where(magenta, 0, 255).astype(np.uint8)
    arr[magenta, :3] = 0
    return Image.fromarray(arr)

entries = []
crops = {}
for character in ('red', 'teal'):
    atlas = Image.open(ROOT / 'raw' / f'walk-{character}.png').convert('RGBA')
    for row, direction in enumerate(DIRECTIONS):
        for phase in range(4):
            name = f'walk-{character}-{direction}-{phase}'
            bounds = [round(phase*atlas.width/4), round(row*atlas.height/4), round((phase+1)*atlas.width/4), round((row+1)*atlas.height/4)]
            keyed = key_magenta(atlas.crop(bounds))
            trim = keyed.getbbox()
            if not trim:
                raise ValueError('Empty cell: '+name)
            crop = keyed.crop(trim)
            crop.save(ROOT / 'crops' / (name+'.png'))
            crops[name] = crop
            entries.append(dict(name=name, character=character, atlas=f'raw/walk-{character}.png', atlasDimensions=list(atlas.size), row=row, column=phase, direction=direction, phase=phase, phaseName=PHASES[phase], cellBounds=bounds, trimBoundsInCell=list(trim), cropDimensions=list(crop.size), crop=f'crops/{name}.png'))

for character in ('red', 'teal'):
    group = [e for e in entries if e['character'] == character]
    scale = min(min(19 / crops[e['name']].width, 24 / crops[e['name']].height) for e in group)
    for entry in group:
        name = entry['name']
        crop = crops[name]
        size = (max(1, round(crop.width*scale)), max(1, round(crop.height*scale)))
        small = crop.resize(size, Image.Resampling.NEAREST)
        frame = Image.new('RGBA', (24,32))
        position = (round(12-size[0]/2), 28-size[1])
        frame.alpha_composite(small, position)
        frame.save(ROOT / 'logical' / (name+'.png'))
        enlarged = frame.resize((96,128), Image.Resampling.NEAREST)
        enlarged.save(ROOT / 'assets' / (name+'.png'))
        entry.update(logicalCanvas=[24,32], logicalPivot=[12,28], logicalBounds=list(frame.getbbox()), sourceToLogicalScale=scale, logicalVisibleDimensions=list(size), scaleGroup=character, fileScale=4, canvas=[96,128], pivot=[48,112], asset=f'assets/{name}.png', logical=f'logical/{name}.png', sha256=hashlib.sha256(frame.tobytes()).hexdigest())

def sheet(character, scale):
    # At scale1 each sprite is displayed at its actual 24x32 game size.
    cw, ch = 48*scale, 40*scale
    canvas = Image.new('RGB', (cw*4, ch*4), '#82966b')
    draw = ImageDraw.Draw(canvas)
    for e in (e for e in entries if e['character']==character):
        sprite = Image.open(ROOT / e['logical']).resize((24*scale,32*scale), Image.Resampling.NEAREST)
        x, y = e['column']*cw+12*scale, e['row']*ch+4*scale
        canvas.paste(sprite,(x,y),sprite)
    canvas.save(ROOT / 'contact' / f'{character}-{scale}x.png')

for character in ('red','teal'):
    sheet(character,1)
    sheet(character,4)

# Pixel difference of lower-body rectangles catches an unchanged gait frame.
differences=[]
for character in ('red','teal'):
    for direction in DIRECTIONS:
        frames=[np.array(Image.open(ROOT/'logical'/f'walk-{character}-{direction}-{p}.png'))[17:28] for p in range(4)]
        row={'character':character,'direction':direction,'adjacentLowerBodyPixelDifferences':[int(np.any(frames[p]!=frames[(p+1)%4],axis=2).sum()) for p in range(4)],'oppositeContactPixelDifference':int(np.any(frames[0]!=frames[2],axis=2).sum())}
        differences.append(row)
        if any(x==0 for x in row['adjacentLowerBodyPixelDifferences']):
            raise ValueError('Duplicate lower-body gait frame: '+str(row))

manifest=dict(projectId='ZUPnQYt5rmIl9G729LjL',model='gpt-image-2-5-sunburst',mode='image2image',processing=PROCESSING,logicalCanvas=[24,32],logicalPivot=[12,28],fileScale=4,animation={'rowDirections':list(DIRECTIONS),'columns':list(PHASES),'frameCount':4},assets=entries,validation={'frameCount':len(entries),'uniqueLogicalImages':len(set(e['sha256'] for e in entries)),'lowerBodyDifferences':differences})
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'count':len(entries),'sizes':[{e['name']:e['logicalVisibleDimensions']} for e in entries],'validation':manifest['validation']},indent=2))
