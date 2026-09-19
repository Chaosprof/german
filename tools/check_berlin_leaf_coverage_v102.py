"""Compare actual projected opaque near-canopy coverage across 16 views."""
import ast,base64,json,math,pathlib,struct
ROOT=pathlib.Path(__file__).resolve().parents[1];STAGE=ROOT/'audit/berlin-leaf-contours-v102';SIZE=256
source=(ROOT/'tools/check_berlin_garden_coverage.py').read_text();tree=ast.parse(source)
helper='\n\n'.join(ast.get_source_segment(source,n) for n in tree.body if isinstance(n,ast.FunctionDef))
exec(compile(helper,'existing_coverage_helpers','exec'),globals())
before=json.loads((STAGE/'baseline/berlin-kiez-garden-v1.json').read_text())['meshes']['treeNear']
after=json.loads((STAGE/'models/berlin-kiez-garden-v1.json').read_text())['meshes']['treeNear']
def decoded(record):
    raw=unpack(record,'position','f');points=[raw[i:i+3] for i in range(0,len(raw),3)]
    ids=unpack(record,'index','H')[552*3:];return points,ids,set(ids)
old=decoded(before);new=decoded(after);views=[]
for elevation in (-12,8):
    e=math.radians(elevation)
    for yaw in range(0,360,45):
        a=math.radians(yaw)
        def project(decoded):
            p,ids,used=decoded
            return {i:(p[i][0]*math.cos(a)-p[i][2]*math.sin(a),p[i][1]*math.cos(e)-(p[i][0]*math.sin(a)+p[i][2]*math.cos(a))*math.sin(e)) for i in used}
        xy_old=project(old);xy_new=project(new)
        low=[min(q[k] for q in xy_old.values()) for k in range(2)];high=[max(q[k] for q in xy_old.values()) for k in range(2)]
        scale=(SIZE-4)/max(high[k]-low[k] for k in range(2))
        masks=[]
        for decoded,xy in [(old,xy_old),(new,xy_new)]:
            xy={i:tuple(2+(q[k]-low[k])*scale for k in range(2)) for i,q in xy.items()};mask=bytearray(SIZE*SIZE)
            ids=decoded[1]
            for j in range(0,len(ids),3):raster([xy[ids[j]],xy[ids[j+1]],xy[ids[j+2]]],mask)
            masks.append(mask)
        prior,current=masks;lost=sum(a and not b for a,b in zip(prior,current));gained=sum(b and not a for a,b in zip(prior,current))
        # A lost pixel more than four pixels inside the old opaque union is a
        # new visible hole, rather than the intended rounder exterior contour.
        interior_lost=0
        for y in range(4,SIZE-4):
            for x in range(4,SIZE-4):
                i=y*SIZE+x
                if prior[i] and not current[i] and all(prior[i+dy*SIZE+dx] for dx,dy in [(4,0),(-4,0),(0,4),(0,-4),(3,3),(-3,3),(3,-3),(-3,-3)]):interior_lost+=1
        views.append({'yaw':yaw,'elevation':elevation,'old_pixels':sum(prior),'new_pixels':sum(current),'lost_fraction':lost/sum(prior),'gained_fraction':gained/sum(prior),'new_interior_hole_fraction':interior_lost/sum(prior)})
report={'views':views,'max_lost_fraction':max(v['lost_fraction'] for v in views),'max_new_interior_hole_fraction':max(v['new_interior_hole_fraction'] for v in views),'mean_net_change':sum((v['new_pixels']-v['old_pixels'])/v['old_pixels'] for v in views)/len(views)}
(STAGE/'coverage.json').write_text(json.dumps(report,indent=2))
assert report['max_lost_fraction']<.035,'The candidate loses more than 3.5% of visible coverage'
assert report['max_new_interior_hole_fraction']<.01,'The candidate opens visible interior holes'
print(json.dumps({k:v for k,v in report.items() if k!='views'},indent=2))
