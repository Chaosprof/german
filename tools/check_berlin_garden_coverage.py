"""Measure opaque geometry coverage in a projected crown hull, without rendering.

This is a silhouette occupancy diagnostic, not an FPS test or aesthetic score.
Run: python tools/check_berlin_garden_coverage.py <garden.json> [output.json]
"""
import base64, json, math, pathlib, struct, sys

data=json.loads(pathlib.Path(sys.argv[1]).read_text())
SIZE=256

def unpack(record,key,fmt):
    raw=base64.b64decode(record[key])
    return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)

def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def hull(points):
    points=sorted(set(points));lower=[];upper=[]
    for p in points:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]

def raster(polygon,mask):
    for y in range(max(0,math.floor(min(p[1] for p in polygon))),min(SIZE,math.ceil(max(p[1] for p in polygon)))):
        scan=y+.5;hits=[]
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            if (a[1]<=scan<b[1]) or (b[1]<=scan<a[1]):hits.append(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]))
        if len(hits)<2:continue
        lo=max(0,math.ceil(min(hits)-.5));hi=min(SIZE,math.floor(max(hits)-.5)+1)
        if hi>lo:mask[y*SIZE+lo:y*SIZE+hi]=bytes([1])*(hi-lo)

result={}
for name in ('treeNear','treeStreetFar','planter'):
    if name not in data['meshes']:continue
    record=data['meshes'][name];raw=unpack(record,'position','f')
    p=[raw[i:i+3] for i in range(0,len(raw),3)]
    ids=unpack(record,'index','H');skip=552*3 if name.startswith('tree') else 180*3
    ids=ids[skip:];used=set(ids);views=[]
    for elevation in (-5,10):
        e=math.radians(elevation)
        for yaw in range(0,360,45):
            a=math.radians(yaw)
            xy={i:(p[i][0]*math.cos(a)-p[i][2]*math.sin(a),p[i][1]*math.cos(e)-(p[i][0]*math.sin(a)+p[i][2]*math.cos(a))*math.sin(e)) for i in used}
            low=[min(q[j] for q in xy.values()) for j in range(2)]
            high=[max(q[j] for q in xy.values()) for j in range(2)]
            scale=(SIZE-4)/max(high[j]-low[j] for j in range(2))
            xy={i:tuple(2+(q[j]-low[j])*scale for j in range(2)) for i,q in xy.items()}
            outline=hull(list(xy.values()));boundary=bytearray(SIZE*SIZE);covered=bytearray(SIZE*SIZE)
            raster(outline,boundary)
            for i in range(0,len(ids),3):raster([xy[ids[i]],xy[ids[i+1]],xy[ids[i+2]]],covered)
            views.append({'yaw':yaw,'elevation':elevation,'coverage':round(sum(covered)/sum(boundary),4)})
    result[name]={'minimum':min(v['coverage'] for v in views),'maximum':max(v['coverage'] for v in views),'mean':round(sum(v['coverage'] for v in views)/len(views),4),'views':views}
if len(sys.argv)>2:pathlib.Path(sys.argv[2]).write_text(json.dumps(result,indent=2))
print(json.dumps({name:{key:value for key,value in item.items() if key!='views'} for name,item in result.items()},indent=2))
