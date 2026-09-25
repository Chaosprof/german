"""Round four actual turret cornices, preserving every other painted corner.

The V140 baseline is immutable. Run inspect_berlin_stone_v141.py first, then
Blender -b -t 2 --python this file. Outputs remain under audit until accepted.
"""
import base64, copy, json, math, pathlib, shutil, sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-parity-v141'; BASE=STAGE/'baseline'; OUT=STAGE/'models'
NAME='berlin-reference-architecture-v1'; KEY='13.5:0:1'
sys.path.insert(0,str(ROOT/'tools'))
import stage_berlin_facade_planting_v86 as helpers
source=json.loads((BASE/(NAME+'.json')).read_text()); old=source['meshes'][KEY]
raw=helpers.unpack(old); groups=helpers.components(raw)
selected=[g for g in groups if len(g['faces'])==80 and g['tiles']==[1]
          and abs(g['center'][0]-4.65)<.001 and g['max'][2]>2
          and g['min'][1]>5.8 and g['max'][1]-g['min'][1]<.4]
assert len(selected)==4, 'Four existing solid 20-sided cornices required'
extra={key:[] for key in helpers.FORMATS}; report=[]; removed=set()
SEGMENTS=32; SX=1.14

def barycentric(point,a,b,c):
    v0,v1,v2=b-a,c-a,point-a
    d00,d01,d11,d20,d21=v0.dot(v0),v0.dot(v1),v1.dot(v1),v2.dot(v0),v2.dot(v1)
    den=d00*d11-d01*d01
    assert abs(den)>1e-14
    v=(d11*d20-d01*d21)/den; w=(d00*d21-d01*d20)/den
    values=[max(0,min(1,x)) for x in [1-v-w,v,w]]
    return [x/sum(values) for x in values]

for g in selected:
    removed.update(g['faces'])
    points=[Vector(raw['position'][i:i+3]) for i in range(0,len(raw['position']),3)]
    faces=[raw['index'][i*3:i*3+3] for i in g['faces']]
    bvh=BVHTree.FromPolygons(points,faces,all_triangles=True)
    lo,hi=g['min'][1],g['max'][1]; cx,cz=g['center'][0],g['center'][2]
    bottom=max(abs(points[i].z-cz) for i in g['vertices'] if abs(points[i].y-lo)<1e-5)
    top=max(abs(points[i].z-cz) for i in g['vertices'] if abs(points[i].y-hi)<1e-5)
    bevel=min(.038,(hi-lo)*.24); slope=(top-bottom)/(hi-lo)
    profile=[(bottom-bevel,lo),(bottom+slope*bevel,lo+bevel),
             (top-slope*bevel,hi-bevel),(top-bevel,hi)]
    start=len(extra['position'])//3
    local_p=[];local_n=[];local_faces=[]
    # Shared edge normals ease the stone arris. Flat cap normals are retained
    # at its inner boundary; broad vertical faces keep cylindrical normals.
    for row,(radius,y) in enumerate(profile):
        for i in range(SEGMENTS):
            a=i*math.tau/SEGMENTS; s,c=math.sin(a),math.cos(a)
            local_p.append(Vector((cx+radius*SX*s,y,cz+radius*c)))
            local_n.append(Vector((0,-1,0)) if row==0 else Vector((0,1,0)) if row==3
                           else Vector((s/SX,-slope,c)).normalized())
    local_p.extend([Vector((cx,lo,cz)),Vector((cx,hi,cz))])
    local_n.extend([Vector((0,-1,0)),Vector((0,1,0))])
    for row in range(3):
        for i in range(SEGMENTS):
            j=(i+1)%SEGMENTS; a=row*SEGMENTS+i; b=row*SEGMENTS+j
            c=(row+1)*SEGMENTS+j; d=(row+1)*SEGMENTS+i
            local_faces.extend([(a,b,c),(a,c,d)])
    for i in range(SEGMENTS):
        j=(i+1)%SEGMENTS
        local_faces.extend([(4*SEGMENTS,j,i),(4*SEGMENTS+1,3*SEGMENTS+i,3*SEGMENTS+j)])
    for p,n in zip(local_p,local_n):
        hit=bvh.find_nearest(p); ids=faces[hit[2]]
        weights=barycentric(hit[0],*[points[i] for i in ids])
        extra['position'].extend(p)
        extra['normal'].extend(round(v*32767) for v in n)
        extra['uv'].extend(sum(weights[j]*raw['uv'][ids[j]*2+k] for j in range(3)) for k in range(2))
        extra['color'].extend(round(sum(weights[j]*raw['color'][ids[j]*3+k] for j in range(3))) for k in range(3))
    for face in local_faces:
        a,b,c=(local_p[i] for i in face)
        if (b-a).cross(c-a).dot(sum((local_n[i] for i in face),Vector()))<0: face=tuple(reversed(face))
        extra['index'].extend(start+i for i in face)
    report.append(dict(min=g['min'],max=g['max'],bottomRadius=bottom,topRadius=top,
                       bevel=bevel,oldTriangles=len(faces),newTriangles=len(local_faces),radialSegments=SEGMENTS))

extra={key:tuple(values) for key,values in extra.items()}
after=helpers.splice([(raw,removed),(extra,set())],old)
for field in ['min','max']:
    assert all((a>=b-1e-5 if field=='min' else a<=b+1e-5) for a,b in zip(after[field],old[field])), (field,after[field],old[field])
    after[field]=list(old[field])
after['stoneRevision']='eased-turret-cornices-v141'
newraw=helpers.unpack(after)
protected=helpers.payloads(raw,removed)
assert helpers.payloads(newraw,range(old['triangles']-len(removed),after['triangles']))==protected
assert after['triangles']==old['triangles']+704
updated=copy.deepcopy(source);updated['meshes'][KEY]=after
updated['source']='Blender 5.2 / tools/stage_berlin_stone_v141.py'

bpy.ops.wm.open_mainfile(filepath=str(BASE/(NAME+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and o.get('runtime_key')}
target=objects[KEY]; material=target.data.materials[0]
mesh=bpy.data.meshes.new('Eased turret cornices v141')
p=newraw['position'];idx=newraw['index'];norm=newraw['normal'];col=newraw['color'];tex=newraw['uv']
mesh.from_pydata([(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
mesh.update();uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(paint.data): c.color=(*[v/255 for v in col[i*3:i*3+3]],1)
custom=[]
for loop in mesh.loops:
    i=loop.vertex_index;uv.data[loop.index].uv=tex[i*2:i*2+2]
    n=Vector(norm[i*3:i*3+3]).normalized();custom.append((n.x,-n.z,n.y))
for face in mesh.polygons: face.use_smooth=True
mesh.normals_split_custom_set(custom);mesh.materials.append(material);target.data=mesh
target['stone_revision']='eased-turret-cornices-v141'
(OUT/(NAME+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(NAME+'.inline.js')).write_text('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(NAME+'-atlas.png'),OUT/(NAME+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True);obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color');obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=target
bpy.ops.export_scene.gltf(filepath=str(OUT/(NAME+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))
result=dict(beforeTriangles=old['triangles'],afterTriangles=after['triangles'],beforeVertices=old['vertices'],afterVertices=after['vertices'],
            removedFaces=sorted(removed),protectedTriangles=old['triangles']-len(removed),protectedCornerSha256=helpers.payload_hash(protected),
            cornices=report,otherElevenRecordsExact=True,addedDraws=0,addedTextures=0)
(STAGE/'stone.json').write_text(json.dumps(result,indent=2))
print('STONE_V141_COMPLETE',json.dumps({k:v for k,v in result.items() if k not in ['removedFaces','cornices']}),flush=True)
