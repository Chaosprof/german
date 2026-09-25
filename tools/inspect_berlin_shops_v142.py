"""Inventory visible shop surfaces from the current accepted native assets."""
import json,pathlib,shutil,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];STAGE=ROOT/'audit/berlin-parity-v142';BASE=STAGE/'baseline'
for d in [BASE,STAGE/'models',STAGE/'sources',STAGE/'frames']:d.mkdir(parents=True,exist_ok=True)
NAME='berlin-reference-architecture-v1'
for suffix in ['.json','.inline.js','.blend','.glb','-atlas.png']:
    to=BASE/(NAME+suffix)
    if not to.exists():shutil.copyfile(ROOT/'assets/models'/to.name,to)
for src,dst in [('berlin-runner.html','baseline.html'),('tools/berlin_kiez_kit.js','baseline/berlin_kiez_kit.js'),('tools/berlin_facade_finish_v119.js','baseline/berlin_facade_finish_v119.js')]:
    to=STAGE/dst
    if not to.exists():shutil.copyfile(ROOT/src,to)
sys.path.insert(0,str(ROOT/'tools'));import stage_berlin_facade_planting_v86 as helpers
data=json.loads((BASE/(NAME+'.json')).read_text());report={}
for key in ['13.5:0:1','13.5:1:1']:
    raw=helpers.unpack(data['meshes'][key]);groups=helpers.components(raw);selected=[]
    for i,g in enumerate(groups):
        if g['min'][1]<4.7 and g['min'][2]<.62 and g['max'][2]>-.7:
            selected.append(dict(id=i,triangles=len(g['faces']),vertices=len(g['vertices']),**{k:g[k] for k in ['min','max','center','tiles','meanColor']}))
    report[key]=selected
(STAGE/'shop-components.json').write_text(json.dumps(report,indent=2))
for key,groups in report.items():
    print(key)
    for g in groups:
        if g['max'][1]<4.7 and (g['max'][0]-g['min'][0]>.8 or len(g['tiles'])>1):
            print(g['id'],g['triangles'],'min',[round(v,4) for v in g['min']],'max',[round(v,4) for v in g['max']],'tiles',g['tiles'],'rgb',[round(v) for v in g['meanColor']])
