from PIL import Image
from pathlib import Path
import numpy as np
import sys
source=Path(sys.argv[1]); names=sys.argv[2].split(','); cols=int(sys.argv[3]) if len(sys.argv)>3 else 3; rows=(len(names)+cols-1)//cols
im=Image.open(source).convert('RGBA'); w,h=im.size
for i,name in enumerate(names):
 if name=='skip': continue
 cell=im.crop((round(i%cols*w/cols), round(i//cols*h/rows), round((i%cols+1)*w/cols), round((i//cols+1)*h/rows)))
 a=np.array(cell); rgb=a[:,:,:3].astype(float); r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
 mask=(r>g*1.3+20)&(b>g*1.3+20)&(r>100)&(b>95)
 a[:,:,3][mask]=0
 # Remove residual chroma on antialiased boundary pixels only.
 edge=(r-g>35)&(b-g>35)&(~mask)
 a[:,:,0][edge]=np.minimum(a[:,:,0][edge],a[:,:,1][edge]+25)
 a[:,:,2][edge]=np.minimum(a[:,:,2][edge],a[:,:,1][edge]+25)
 out=Image.fromarray(a); box=out.getbbox()
 if box: out=out.crop(box)
 out.save(Path('public/assets')/(name+'.png'),optimize=True)
 print(name,out.size)
