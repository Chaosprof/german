"""Stage rectangular upper windows on the existing native bookstore master.

Only the upper storeys change; all accepted ground-storey triangle corners
and the eleven other architecture records remain exactly as authored.
"""
import ast,base64,bpy,bmesh,copy,json,math,pathlib,shutil,struct,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-parity-v128';BASE=STAGE/'baseline';OUT=STAGE/'models'
NAME='berlin-reference-architecture-v1';KEY='13.5:1:1'
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
baseline=json.loads((BASE/(NAME+'.json')).read_text())
bpy.ops.wm.open_mainfile(filepath=str(BASE/(NAME+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and o.get('runtime_key')}
target=objects[KEY];mat=target.data.materials[0]
src=(ROOT/'tools/build_berlin_reference_architecture.py').read_text()
fn=next(n for n in ast.parse(src).body if isinstance(n,ast.FunctionDef) and n.name=='polish')
polish_source=ast.get_source_segment(src,fn)
polish_source=polish_source.replace('if len(edge.link_faces)==2 and edge.calc_length()>.68 and edge.calc_face_angle(0)>.74:',
  'if len(edge.link_faces)==2 and edge.calc_length()>.68 and edge.calc_face_angle(0)>.74 and min(face.calc_area()/edge.calc_length() for face in edge.link_faces)>.032:')
polish_source=polish_source.replace('bevel.use_clamp_overlap=True','bevel.use_clamp_overlap=False')
exec(compile(polish_source,'native_architecture_polish','exec'),globals())
upper=polish(json.loads((STAGE/'bookstore-upper-source.json').read_text()))
upper_record=packed_geometry(upper)
def unpack(record):
    return {name:list(struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw))
      for name,fmt in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H' if record['vertices']<65536 else 'I')]
      for raw in [base64.b64decode(record[name])]}
old=unpack(baseline['meshes'][KEY]);new=unpack(upper_record)
data={name:[] for name in old};lookup={};protected_faces=0;face_keys=set();dropped=0
for raw,ground in [(old,True),(new,False)]:
    for f in range(0,len(raw['index']),3):
        ids=raw['index'][f:f+3]
        if ground and max(raw['position'][i*3+1] for i in ids)>4.70001:continue
        points=[tuple(raw['position'][i*3:i*3+3]) for i in ids]
        face_key=tuple(sorted(points))
        if not ground and (face_key in face_keys or (Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0])).length_squared<1e-18):
            dropped+=1;continue
        face_keys.add(face_key)
        if ground:protected_faces+=1
        for i in ids:
            values=tuple(v for name,size in [('position',3),('normal',3),('uv',2),('color',3)] for v in raw[name][i*size:i*size+size])
            if values not in lookup:
                lookup[values]=len(data['position'])//3
                for name,size in [('position',3),('normal',3),('uv',2),('color',3)]:data[name].extend(raw[name][i*size:i*size+size])
            data['index'].append(lookup[values])
record=copy.deepcopy(baseline['meshes'][KEY])
record.update({name:base64.b64encode(struct.pack('<'+fmt*len(data[name]),*data[name])).decode()
  for name,fmt in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H')]})
record.update(vertices=len(data['position'])//3,triangles=len(data['index'])//3,
  min=[min(data['position'][k::3]) for k in range(3)],max=[max(data['position'][k::3]) for k in range(3)],
  upperWindowRevision='rectangular-street-windows-v128',upperTopArched=False)
assert record['triangles']<baseline['meshes'][KEY]['triangles']
# Reconstruct the native asset from the same staged runtime triangle corners.
p=data['position'];verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
faces=[tuple(data['index'][i:i+3]) for i in range(0,len(data['index']),3)]
mesh=bpy.data.meshes.new('Bookstore / rectangular upper windows v128');mesh.from_pydata(verts,[],faces);mesh.update()
uv=mesh.uv_layers.new(name='UVMap');color=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(color.data):c.color=(*[v/255 for v in data['color'][i*3:i*3+3]],1)
normals=[]
for loop in mesh.loops:
    i=loop.vertex_index;uv.data[loop.index].uv=data['uv'][i*2:i*2+2]
    x,y,z=[v/32767 for v in data['normal'][i*3:i*3+3]];normals.append((x,-z,y))
for face in mesh.polygons:face.use_smooth=True
mesh.normals_split_custom_set(normals);mesh.materials.append(mat);target.data=mesh
bpy.data.objects.remove(upper,do_unlink=True)
target['upper_window_revision']='rectangular street windows v128'
updated=copy.deepcopy(baseline);updated['meshes'][KEY]=record
updated['source']='Blender 5.2 / tools/stage_berlin_bookstore_v128.py'
for key in baseline['meshes']:
    if key!=KEY:assert updated['meshes'][key]==baseline['meshes'][key]
(OUT/(NAME+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(NAME+'.inline.js')).write_text('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(NAME+'-atlas.png'),OUT/(NAME+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True)
    obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color')
    obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=target
bpy.ops.export_scene.gltf(filepath=str(OUT/(NAME+'.glb')),use_selection=True,export_format='GLB',export_normals=True,
  export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,
  export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))
report={'beforeTriangles':baseline['meshes'][KEY]['triangles'],'afterTriangles':record['triangles'],'degenerateUpperFacesRemoved':dropped,
 'protectedGroundTriangles':protected_faces,'otherRecordsPreserved':11,'upperWindowRevision':record['upperWindowRevision']}
(STAGE/'bookstore-geometry.json').write_text(json.dumps(report,indent=2))
print('BOOKSTORE_V128_STAGED',json.dumps(report),flush=True)
