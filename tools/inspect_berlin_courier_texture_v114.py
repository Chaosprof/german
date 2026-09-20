import json,struct,io
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];STAGE=ROOT/'audit/berlin-model-forms-v114/courier/contour-trial';STAGE.mkdir(exist_ok=True,parents=True)
data=(ROOT/'assets/models/berlin-runner-hero-v14.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);blob=data[28+length:]
image_view=doc['bufferViews'][doc['images'][0]['bufferView']];atlas=Image.open(io.BytesIO(blob[image_view['byteOffset']:image_view['byteOffset']+image_view['byteLength']])).convert('RGB');atlas.save(STAGE/'source-atlas.png')
def accessor(name,components):
    a=doc['accessors'][doc['meshes'][0]['primitives'][0]['attributes'][name]];view=doc['bufferViews'][a['bufferView']];at=view.get('byteOffset',0)+a.get('byteOffset',0)
    return list(struct.iter_unpack('<'+'f'*components,blob[at:at+a['count']*components*4]))
uv=accessor('TEXCOORD_0',2);p=accessor('POSITION',3)
def linear(v):
    v/=255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
records=[];rows=[]
for i,coord in enumerate(uv):
    x=int(max(0,min(atlas.width-1,coord[0]*(atlas.width-1))));y=int(max(0,min(atlas.height-1,coord[1]*(atlas.height-1))))
    pixel=list(atlas.getpixel((x,y)));r,g,b=[v/255 for v in pixel];mx=max(r,g,b);mn=min(r,g,b);sat=(mx-mn)/mx if mx else 0
    if b>r*1.25 and b>g*1.12 and sat>.22 and mx<.86:
        value=r*.2126+g*.7152+b*.0722;pixel=[round(min(1,value*f)*255) for f in (.84,1.13,1.38)]
    elif sat<=.20 and .06<=mx<=.40:
        t=(mx-.06)/.34;value=.54+(.98-.54)*t;chroma=.84*(.72+.28*t)
        pixel=[int(value*255),int(value*(1-chroma*(1-.2))*255),int(value*(1-chroma)*255)]
    rgb=list(map(linear,pixel));cloth=smooth(.02,.10,rgb[0]-2.4*max(rgb[1],rgb[2]));records.append(dict(rgb=rgb,cloth=cloth))
    if .65<p[i][1]<.91 and cloth>.75:rows.append(dict(i=i,p=p[i],cloth=cloth))
(STAGE/'source-colors.json').write_text(json.dumps(records,separators=(',',':')))
(STAGE/'shirt-hem-vertices.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(dict(texture=atlas.size,shirtHemSamples=len(rows),min=min([r['p'][1] for r in rows],default=0),max=max([r['p'][1] for r in rows],default=0))))
