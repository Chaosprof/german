"""Inspect current native architecture components; never modify shipping assets."""
import json, pathlib, shutil, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-parity-v141'
BASE=STAGE/'baseline'
for folder in [BASE,STAGE/'models',STAGE/'frames']: folder.mkdir(parents=True,exist_ok=True)
NAME='berlin-reference-architecture-v1'
for suffix in ['.json','.inline.js','.blend','.glb','-atlas.png']:
    p=BASE/(NAME+suffix)
    if not p.exists(): shutil.copyfile(ROOT/'assets/models'/p.name,p)
if not (STAGE/'baseline.html').exists(): shutil.copyfile(ROOT/'berlin-runner.html',STAGE/'baseline.html')
sys.path.insert(0,str(ROOT/'tools'))
import stage_berlin_facade_planting_v86 as helpers
data=json.loads((BASE/(NAME+'.json')).read_text())
report={}
for key in ['13.5:0:1','13.5:1:1']:
    raw=helpers.unpack(data['meshes'][key])
    groups=helpers.components(raw)
    selected=[]
    for i,g in enumerate(groups):
        if g['max'][2]<.3 or max(b-a for a,b in zip(g['min'],g['max']))<.8: continue
        selected.append(dict(id=i,triangles=len(g['faces']),vertices=len(g['vertices']),
          **{k:g[k] for k in ['min','max','center','tiles','meanColor']}))
    report[key]=selected
(STAGE/'component-inspection.json').write_text(json.dumps(report,indent=2))
for key,groups in report.items():
    print(key)
    for g in groups:
        if key.endswith(':0:1') and g['min'][0]>1.5 and g['tiles']==[0]:
            print(g['id'],g['triangles'], 'min', [round(v,3) for v in g['min']], 'max',[round(v,3) for v in g['max']], 'rgb',[round(v) for v in g['meanColor']])
