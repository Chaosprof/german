"""Author the courier's soft canvas backpack shells in Blender.

Meshes use bag-radius units and face local -Z. The game retains its existing
bone attachment, straps, buckles and three material batches.
"""
import bpy,bmesh,json,math,os,sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets','models');os.makedirs(OUT,exist_ok=True)
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
material=bpy.data.materials.new('Muted teal canvas');material.use_nodes=True
shader=material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value=(.030,.275,.243,1)
shader.inputs['Roughness'].default_value=.86
def spow(x,n):return math.copysign(abs(x)**n,x)
def make_mesh(name,points,faces):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in points],[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    for face in mesh.polygons:face.use_smooth=True
    return obj
def pillow(name,width,height,depth,center=(0,0,0),segments=32,rings=16):
    points=[];faces=[]
    # Soft superellipsoid: fuller lower corners, gently gathered shoulders.
    for row in range(1,rings):
        latitude=-math.pi/2+math.pi*row/rings
        y=spow(math.sin(latitude),.48)*height/2
        radius=spow(math.cos(latitude),.48)
        taper=1-.055*max(0,y/(height/2))
        for col in range(segments):
            angle=math.tau*col/segments
            x=spow(math.cos(angle),.43)*width/2*radius*taper
            z=spow(math.sin(angle),.43)*depth/2*radius
            if z>0:z*=.82
            points.append((x+center[0],y+center[1],z+center[2]))
    for row in range(rings-2):
        for col in range(segments):
            a=row*segments+col;b=row*segments+(col+1)%segments
            faces.append((a,b,b+segments,a+segments))
    bottom=len(points);points.append((center[0],center[1]-height/2,center[2]))
    top=len(points);points.append((center[0],center[1]+height/2,center[2]))
    for col in range(segments):
        faces.append((bottom,(col+1)%segments,col))
        a=(rings-2)*segments+col;b=(rings-2)*segments+(col+1)%segments
        faces.append((top,a,b))
    return make_mesh(name,points,faces)
body=pillow('Soft backpack body',2.70,2.55,1.50,(0,-.05,0))
pocket=pillow('Low canvas pocket',2.08,.76,.34,(.025,-.73,-.72),24,10)

# A folded cloth flap follows the top shoulder and bows over the front.
profile=[(.97,.43,1.17),(1.20,.23,1.28),(1.35,-.08,1.33),
         (1.30,-.42,1.37),(1.14,-.71,1.36),(.91,-.85,1.34),
         (.66,-.90,1.31),(.43,-.91,1.27),(.29,-.88,1.16)]
points=[];faces=[];cols=16
for row,(y,z,half_width) in enumerate(profile):
    for col in range(cols+1):
        u=col/cols*2-1
        bottom_round=(.13*abs(u)**8) if row==len(profile)-1 else 0
        points.append((u*half_width+.035,y-.025*u*u+bottom_round,z+.045*u*u))
for row in range(len(profile)-1):
    for col in range(cols):
        a=row*(cols+1)+col;faces.append((a,a+1,a+cols+2,a+cols+1))
flap=make_mesh('Folded canvas flap',points,faces)
bpy.context.view_layer.objects.active=flap;flap.select_set(True)
solid=flap.modifiers.new('Real cloth thickness','SOLIDIFY');solid.thickness=.055;solid.offset=-1
bpy.ops.object.modifier_apply(modifier=solid.name)
bevel=flap.modifiers.new('Soft cloth hem','BEVEL');bevel.width=.018;bevel.segments=2
bevel.limit_method='ANGLE';bevel.angle_limit=.6
bpy.ops.object.modifier_apply(modifier=bevel.name)

meshes={'body':body,'pocket':pocket,'flap':flap};records={}
for name,obj in meshes.items():
    mesh=obj.data;mesh.update()
    uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        p=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(.5+p.x/3.2,.5+p.z/3.2)
        paint.data[loop.index].color=(1,1,1,1)
    mesh.color_attributes.active_color_index=mesh.color_attributes.find('Color')
    mesh.color_attributes.render_color_index=mesh.color_attributes.find('Color')
    obj['runtime_key']=name;records[name]=packed_geometry(obj)
print('BAG_TRIANGLES', {k:r['triangles'] for k,r in records.items()}, flush=True)
assert sum(r['triangles'] for r in records.values())<2800
data={'version':1,'source':'Blender 5.2 / tools/build_berlin_courier_bag.py','units':'bagRadius','meshes':records}
for suffix in ('json','inline.js'):
    with open(os.path.join(OUT,'berlin-courier-bag-v1.'+suffix),'w') as f:
        f.write(('var BERLIN_COURIER_BAG_DATA = ' if suffix=='inline.js' else '')+json.dumps(data,separators=(',',':'))+(';\n' if suffix=='inline.js' else ''))
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes.values():obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-courier-bag-v1.glb'),use_selection=True,export_format='GLB',
    export_normals=True,export_materials='EXPORT',export_yup=True,export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-courier-bag-v1.blend'))
print('COURIER_BAG_COMPLETE',json.dumps({k:{'triangles':r['triangles'],'min':r['min'],'max':r['max']} for k,r in records.items()}),flush=True)
