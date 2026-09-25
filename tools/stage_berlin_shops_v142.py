"""Shorten actual shop reveals and move existing displays toward the street.

Preserve topology, UVs, paint, upper storeys, facade profiles and all other art.
Only current V141 audit baselines are read; shipping assets are never written.
"""
import base64,bpy,copy,json,pathlib,shutil,struct,sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1];STAGE=ROOT/'audit/berlin-parity-v142';BASE=STAGE/'baseline';OUT=STAGE/'models'
NAME='berlin-reference-architecture-v1';KEYS=['13.5:0:1','13.5:1:1']
sys.path.insert(0,str(ROOT/'tools'));import stage_berlin_facade_planting_v86 as helpers
source=json.loads((BASE/(NAME+'.json')).read_text());updated=copy.deepcopy(source);report={}
bpy.ops.wm.open_mainfile(filepath=str(BASE/(NAME+'.blend')));bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and o.get('runtime_key')}
for key in KEYS:
    old=source['meshes'][key];raw=helpers.unpack(old);new={k:list(v) for k,v in raw.items()};groups=helpers.components(raw)
    chosen={'returns':set(),'backdrops':set(),'counters':set(),'shelves':set(),'bread':set()};counts={k:0 for k in chosen}
    for g in groups:
        lo,hi=g['min'],g['max'];kind=None
        if abs(lo[1]-.42)<1e-4 and abs(lo[2]+.63)<1e-4 and abs(hi[2]-.41)<1e-4 and g['tiles']==[1]:kind='returns'
        elif g['tiles']==[4 if key==KEYS[1] else 5] and abs(lo[2]+.625)<1e-5 and abs(hi[2]+.625)<1e-5:kind='backdrops'
        elif abs(lo[2]+.51)<1e-4 and abs(hi[2]-.07)<1e-4 and abs(lo[1]-.55)<1e-4:kind='counters'
        elif abs(lo[2]+.52)<1e-4 and abs(hi[2]-.12)<1e-4 and abs(lo[1]-.9775)<1e-4:kind='counters'
        elif abs(lo[2]+.57)<1e-4 and abs(hi[2]+.33)<1e-4 and any(abs(lo[1]-y)<1e-4 for y in [1.5775,2.2875]):kind='shelves'
        elif key==KEYS[0] and len(g['faces'])==48 and g['tiles']==[0] and 1.02<lo[1]<1.03 and 1.17<hi[1]<1.18 and -.23<lo[2]<-.22 and -.08<hi[2]<-.07:kind='bread'
        if kind:chosen[kind].update(g['vertices']);counts[kind]+=1
    expected={'returns':2,'backdrops':2,'counters':4,'shelves':4,'bread':11} if key==KEYS[0] else {'returns':3,'backdrops':3,'counters':6,'shelves':6,'bread':0}
    assert counts==expected,(key,counts)
    assert sum(map(len,chosen.values()))==len(set.union(*chosen.values())),'No component may receive two transforms'
    for kind,vertices in chosen.items():
        for i in vertices:
            z=raw['position'][i*3+2]
            if kind=='returns':
                new['position'][i*3+2]=.41+(z-.41)*(.24/1.04)
                n=Vector(raw['normal'][i*3:i*3+3]);n.z/=(.24/1.04);n.normalize()
                new['normal'][i*3:i*3+3]=[round(v*32767) for v in n]
            else:new['position'][i*3+2]=z+{'backdrops':.8,'counters':.4,'shelves':.6,'bread':.4}[kind]
    after=copy.deepcopy(old)
    for attr,fmt in [('position','f'),('normal','h')]:after[attr]=base64.b64encode(struct.pack('<'+fmt*len(new[attr]),*new[attr])).decode()
    after['shopDepthRevision']='visible-recessed-displays-v142';updated['meshes'][key]=after
    target=objects[key];material=target.data.materials[0]
    # Re-read packed float32 positions so native export agrees with runtime.
    actual=helpers.unpack(after);p=actual['position'];idx=actual['index'];norm=actual['normal'];col=actual['color'];tex=actual['uv']
    mesh=bpy.data.meshes.new('Visible recessed shop displays v142 / '+key)
    mesh.from_pydata([(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
    mesh.update();uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,c in enumerate(paint.data):c.color=(*[v/255 for v in col[i*3:i*3+3]],1)
    custom=[]
    for loop in mesh.loops:
        i=loop.vertex_index;uv.data[loop.index].uv=tex[i*2:i*2+2];n=Vector(norm[i*3:i*3+3]).normalized();custom.append((n.x,-n.z,n.y))
    for face in mesh.polygons:face.use_smooth=True
    mesh.normals_split_custom_set(custom);mesh.materials.append(material);target.data=mesh;target['shop_depth_revision']='visible-recessed-displays-v142'
    report[key]={'components':counts,'vertices':{kind:sorted(vertices) for kind,vertices in chosen.items()},'triangles':old['triangles'],'vertexCount':old['vertices']}
updated['source']='Blender 5.2 / tools/stage_berlin_shops_v142.py'
(OUT/(NAME+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(NAME+'.inline.js')).write_text('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(NAME+'-atlas.png'),OUT/(NAME+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True);obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color');obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=objects[KEYS[0]]
bpy.ops.export_scene.gltf(filepath=str(OUT/(NAME+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))
(STAGE/'shop-transforms.json').write_text(json.dumps(report,indent=2))
print('SHOPS_V142_COMPLETE',json.dumps({key:value['components'] for key,value in report.items()}),flush=True)
