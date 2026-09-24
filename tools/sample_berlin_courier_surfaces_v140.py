"""Read the exact donor atlas at the actual exterior surface probes."""
import json, pathlib, math
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
stage=root/'audit/berlin-parity-v140'
atlas=Image.open(stage/'source-atlas.webp').convert('RGB')
samples=json.loads((stage/'surface-probes.json').read_text())
for sample in samples:
    x=sample['uv'][0]*atlas.width-.5;y=sample['uv'][1]*atlas.height-.5
    ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
    sample['pixels']=[{'rgb':list(atlas.getpixel((max(0,min(atlas.width-1,ix+dx)),max(0,min(atlas.height-1,iy+dy))))),'weight':wx*wy}
                      for dx,wx in [(0,1-fx),(1,fx)] for dy,wy in [(0,1-fy),(1,fy)]]
(stage/'surface-pixels.json').write_text(json.dumps(samples))
print('Sampled',len(samples),'exterior hits from',atlas.size,'atlas')
