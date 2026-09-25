"""Author shared tree-base containers, using the existing garden material/atlas.

The runtime consumes local mesh coordinates. Native objects are arranged as an
asset sheet; their sheet transforms are not part of the runtime geometry.
"""
import bpy, math, json, struct, base64, hashlib, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
STAGE=ROOT/'audit/berlin-parity-v146'; OUT=STAGE/'models'
OUT.mkdir(parents=True,exist_ok=True)
PREFIX='berlin-street-containers-v146'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
atlas=bpy.data.images.load(str(ROOT/'assets/models/berlin-kiez-garden-v1-atlas.jpg'))
atlas.pack()
material=bpy.data.materials.new('Existing garden stone and soil');material.use_nodes=True
nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.9
color_node=nodes.new('ShaderNodeVertexColor');color_node.layer_name='Color'
links.new(color_node.outputs['Color'],bsdf.inputs['Base Color'])
def linear(rgb):
 return tuple(v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4 for v in rgb)+(1,)

# Each row is radius, height, surface paint. Fine profile rings form the lip
# and two barrel bands; colour is only restrained cavity/contact shading.
STONE=(192,180,154); LIGHT=(213,201,176); SHADE=(163,151,128); SOIL=(66,51,33)
urn_profile=[
 (0,.005,SHADE),(.59,.005,SHADE),(.65,.025,SHADE),(.669,.065,STONE),
 (.680,.265,STONE),(.70,.294,STONE),(.718,.313,LIGHT),(.720,.345,LIGHT),(.700,.372,SHADE),
 (.735,.662,STONE),(.758,.682,LIGHT),(.763,.714,LIGHT),(.741,.746,SHADE),
 (.765,.871,STONE),(.786,.880,LIGHT),(.814,.904,LIGHT),(.819,.942,LIGHT),
 (.806,.977,LIGHT),(.767,.995,LIGHT),(.728,.981,STONE),(.708,.947,SHADE),
 (.682,.891,SHADE),(.664,.827,SHADE),(.664,.785,SOIL),(0,.785,SOIL)
]
urn_profile=[(r,y*1.20,c) for r,y,c in urn_profile]
pit_profile=[(0,0,SOIL),(.88,0,SHADE),(.92,.035,STONE),(.92,.176,STONE),
 (.89,.220,LIGHT),(.756,.220,LIGHT),(.711,.165,SHADE),(.711,.100,SOIL),(0,.100,SOIL)]
def profile_object(name,profile,outline,sheet_x):
 count=len(outline);vertices=[];colors=[];rings=[];source=[]
 for row,(radius,height,paint) in enumerate(profile):
  ids=[]
  for j in range(1 if radius==0 else count):
   x,z=outline[j];ids.append(len(vertices));source.append((row,j))
   # Author in Blender Z-up, matching the packed helper's inverse mapping.
   vertices.append((radius*x,-radius*z,height));colors.append(linear(paint))
  rings.append(ids)
 faces=[];normals=[]
 def point_normal(row,j,edge):
  if profile[row][0]==0:return Vector((0,0,-1 if row==0 else 1))
  # A circular outline uses continuous radial normals. On the square pit,
  # keep broad walls flat and smooth only the cross-section bevels.
  if name=='treeUrn':h=Vector((outline[j][0],outline[j][1]))
  else:
   a,b=outline[edge],outline[(edge+1)%count];h=Vector((b[1]-a[1],a[0]-b[0])).normalized()
  reach=h.dot(Vector(outline[j]));parts=[]
  for a,b in [(max(0,row-1),row),(row,min(len(profile)-1,row+1))]:
   dr=profile[b][0]-profile[a][0];dy=profile[b][1]-profile[a][1]
   q=Vector((dy*h.x,-dy*h.y,-dr*reach))
   if q.length>1e-10:parts.append(q.normalized())
  return sum(parts,Vector()).normalized()
 def add(ids,edge):
  faces.append(ids);normals.extend([point_normal(*source[i],edge) for i in ids])
 for row in range(len(rings)-1):
  a,b=rings[row],rings[row+1]
  for j in range(count):
   k=(j+1)%count
   if len(a)==1:add([a[0],b[j],b[k]],j)
   elif len(b)==1:add([a[j],b[0],a[k]],j)
   else:add([a[j],b[j],b[k],a[k]],j)
 # Bottom and soil meet on the axis; there is no uncapped opening.
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 uv=mesh.uv_layers.new(name='UVMap')
 for item in uv.data:item.uv=(.015625,.015625)
 paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for i,value in enumerate(colors):paint.data[i].color=value
 for face in mesh.polygons:face.use_smooth=True
 mesh.normals_split_custom_set(normals)
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.location.x=sheet_x
 mesh.materials.append(material);obj['source']='tools/stage_berlin_containers_v146.py'
 return obj
circle=[(math.cos(j*math.tau/32),math.sin(j*math.tau/32)) for j in range(32)]
# Counter-clockwise chamfered square, within the original 1.84m base footprint.
square=[(1,.87),(.87,1),(-.87,1),(-1,.87),(-1,-.87),(-.87,-1),(.87,-1),(1,-.87)]
objects=[profile_object('treeUrn',urn_profile,circle,0),profile_object('treePit',pit_profile,square,2.7)]
records={o.name:packed_geometry(o) for o in objects}
data={'version':146,'source':'Blender 5.2 / tools/stage_berlin_containers_v146.py','material':'existing berlinGardenKit.material','neutralAtlasUV':[.015625,.015625],'meshes':records}
(OUT/(PREFIX+'.json')).write_text(json.dumps(data,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('// Native tree containers; existing shared garden material and white atlas cell.\nvar BERLIN_STREET_CONTAINERS_V146 = '+json.dumps(data,separators=(',',':'))+';\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
# Export the exact packed local buffers to GLB; Blender's saved corner data is
# checked below independently. This avoids a second exporter normal rebuild.
binary=bytearray();views=[];accessors=[]
def buffer(raw,target=None):
 while len(binary)%4:binary.append(0)
 v={'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)}
 if target:v['target']=target
 views.append(v);binary.extend(raw);return len(views)-1
def accessor(raw,ctype,kind,count,target,normalized=False,bounds=None):
 a={'bufferView':buffer(raw,target),'componentType':ctype,'count':count,'type':kind}
 if normalized:a['normalized']=True
 if bounds:a['min'],a['max']=bounds
 accessors.append(a);return len(accessors)-1
meshes=[];gltf_nodes=[]
for obj in objects:
 record=records[obj.name];attributes={};vc=record['vertices']
 for key,kind in [('position','POSITION'),('normal','NORMAL'),('uv','TEXCOORD_0'),('color','COLOR_0')]:
  raw=base64.b64decode(record[key]);typ='VEC2' if key=='uv' else 'VEC3';ctype=5126;normalized=False
  if key=='normal':raw=struct.pack('<'+'f'*(vc*3),*(x[0]/32767 for x in struct.iter_unpack('<h',raw)))
  if key=='color':raw=b''.join(raw[i:i+3]+b'\xff' for i in range(0,len(raw),3));typ='VEC4';ctype=5121;normalized=True
  attributes[kind]=accessor(raw,ctype,typ,vc,34962,normalized,[record['min'],record['max']] if key=='position' else None)
 index=accessor(base64.b64decode(record['index']),5123,'SCALAR',record['triangles']*3,34963)
 meshes.append({'name':obj.name,'primitives':[{'attributes':attributes,'indices':index,'material':0}]})
 gltf_nodes.append({'name':obj.name,'mesh':len(meshes)-1,'translation':[obj.location.x,0,0]})
image=buffer((ROOT/'assets/models/berlin-kiez-garden-v1-atlas.jpg').read_bytes())
doc={'asset':{'version':'2.0','generator':data['source']},'scene':0,'scenes':[{'nodes':list(range(len(objects)))}],
 'nodes':gltf_nodes,'meshes':meshes,'materials':[{'name':material.name,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'roughnessFactor':.9,'metallicFactor':0,'baseColorTexture':{'index':0}}}],
 'images':[{'bufferView':image,'mimeType':'image/jpeg'}],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
 'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);binary+=b'\0'*((-len(binary))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
(OUT/(PREFIX+'.glb')).write_bytes(glb)
# Reopen the saved native artifact and verify its complete exported surface.
bpy.ops.wm.open_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
max_normal_delta=0
for name,record in records.items():
 check=packed_geometry(bpy.data.objects[name])
 for key in ['position','color','uv','index','vertices','triangles','min','max']:assert check[key]==record[key],(name,key)
 before=struct.unpack('<'+'h'*(record['vertices']*3),base64.b64decode(record['normal']))
 after=struct.unpack('<'+'h'*(record['vertices']*3),base64.b64decode(check['normal']))
 max_normal_delta=max(max_normal_delta,max(abs(a-b) for a,b in zip(before,after)))
assert max_normal_delta<=2,max_normal_delta
report={'passed':True,'roles':{k:{x:v[x] for x in ['vertices','triangles','min','max']} for k,v in records.items()},'nativeNormalQuantizationDelta':max_normal_delta,'sharedOriginalAtlas':True,'glbSha256':hashlib.sha256(glb).hexdigest()}
(STAGE/'native-check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
