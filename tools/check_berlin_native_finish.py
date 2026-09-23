"""Compare packed world-space vertices/normals against the exported native GLB."""
import base64,itertools,json,struct,sys
from collections import defaultdict
from pathlib import Path
import numpy as np

prefix=Path(sys.argv[1]);raw=prefix.with_suffix('.glb').read_bytes();size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);binary=raw[28+size:];packed=json.loads(prefix.with_suffix('.json').read_text())
def matrix(record):
    if 'matrix' in record:return np.array(record['matrix']).reshape(4,4).T
    x,y,z,w=record.get('rotation',record.get('quaternion',[0,0,0,1]));m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(record.get('scale',[1,1,1]))
    m[:3,3]=record.get('translation',[0,0,0]);return m
def world(p,n,m):
    p=p@m[:3,:3].T+m[:3,3];n=n@np.linalg.inv(m[:3,:3]);n/=np.linalg.norm(n,axis=1)[:,None];return p,n
def acc(id):
    a=doc['accessors'][id];v=doc['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];s=np.dtype(dtype).itemsize
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',width*s),s)).astype(float)
source=[];source_triangles=0
def visit(id,parent):
    global source_triangles
    node=doc['nodes'][id];m=parent@matrix(node)
    if 'mesh' in node:
        for prim in doc['meshes'][node['mesh']]['primitives']:
            source.append(world(acc(prim['attributes']['POSITION']),acc(prim['attributes']['NORMAL']),m))
            source_triangles+=len(acc(prim['indices']))//3
    for child in node.get('children',[]):visit(child,m)
for node in doc['scenes'][doc.get('scene',0)]['nodes']:visit(node,np.eye(4))
grid=defaultdict(list);cell=.0002
for pp,nn in source:
    for p,n in zip(pp,nn):grid[tuple(np.floor(p/cell).astype(int))].append((p,n))
parts=packed.get('parts',[{'mesh':k} for k in packed['meshes']]);checked=0;max_position=0;max_normal=0;runtime_triangles=0
for part in parts:
    r=packed['meshes'][part['mesh']];p=np.frombuffer(base64.b64decode(r['position']),dtype='<f4').reshape(-1,3).astype(float)
    n=np.frombuffer(base64.b64decode(r['normal']),dtype='<i2').reshape(-1,3).astype(float)/32767
    p,n=world(p,n,matrix(part));runtime_triangles+=r['triangles']
    for pos,norm in zip(p,n):
        key=np.floor(pos/cell).astype(int);candidates=[]
        for offset in itertools.product((-1,0,1),repeat=3):candidates.extend(grid.get(tuple(key+offset),()))
        matches=[(np.linalg.norm(pos-v),np.linalg.norm(norm-vn)) for v,vn in candidates if np.linalg.norm(pos-v)<.0001]
        assert matches,('native position mismatch',part['mesh'],pos.tolist())
        delta=min(matches,key=lambda v:v[1]);assert delta[1]<.003,('native normal mismatch',part['mesh'],delta)
        max_position=max(max_position,delta[0]);max_normal=max(max_normal,delta[1]);checked+=1
assert runtime_triangles==source_triangles
result={'passed':True,'verticesChecked':checked,'triangles':runtime_triangles,'maxPositionDifference':max_position,'maxNormalDifference':max_normal}
prefix.parent.joinpath('native-runtime-check.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
