"""Build the Kiez Kaffee roof sign in Blender; no textures or runtime dependencies."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
vertices, faces, face_colors, smooth = [], [], [], []

def linear(hex_color):
    rgb = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)

CREAM = linear('FFF0CC')
CORAL = linear('DC603E')
TEAL = linear('176B70')
TEAL_LIGHT = linear('287F80')
DARK = linear('163F44')

def face(indices, color, shade=True):
    faces.append(indices)
    face_colors.append(color)
    smooth.append(shade)

def lathe(profile, color, segments=24, cap=True):
    start = len(vertices)
    for z, radius in profile:
        vertices.extend((radius*math.cos(i*2*math.pi/segments), radius*math.sin(i*2*math.pi/segments), z) for i in range(segments))
    for j in range(len(profile)-1):
        for i in range(segments):
            n = (i+1)%segments
            face((start+j*segments+i, start+j*segments+n, start+(j+1)*segments+n, start+(j+1)*segments+i), color)
    if cap:
        face(tuple(start+i for i in reversed(range(segments))), color, False)
        face(tuple(start+(len(profile)-1)*segments+i for i in range(segments)), color, False)

def tube(points, radius, color, sides=6):
    start = len(vertices)
    for j, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(j+1,len(points)-1)]) - Vector(points[max(0,j-1)])
        tangent.normalize()
        side = tangent.cross(Vector((0,1,0))).normalized()
        other = tangent.cross(side).normalized()
        # Smaller end rings round the ends without a high-poly bevel.
        r = radius * (.55 if j in (0,len(points)-1) else 1)
        vertices.extend(tuple(p+r*(side*math.cos(i*2*math.pi/sides)+other*math.sin(i*2*math.pi/sides))) for i in range(sides))
    for j in range(len(points)-1):
        for i in range(sides):
            n=(i+1)%sides
            face((start+j*sides+i,start+j*sides+n,start+(j+1)*sides+n,start+(j+1)*sides+i),color)
    face(tuple(start+i for i in reversed(range(sides))),color,False)
    face(tuple(start+(len(points)-1)*sides+i for i in range(sides)),color,False)

def badge(side):
    # Both signs sit just outside the sleeve, so approaching from either end reads clearly.
    center_z=.77
    start=len(vertices)
    for radius, depth in ((.247,.523),(.260,.581),(.238,.593)):
        vertices.extend((radius*math.cos(i*2*math.pi/24), side*depth, center_z+radius*math.sin(i*2*math.pi/24)) for i in range(24))
    for j in range(2):
        for i in range(24):
            ids=(start+j*24+i,start+j*24+(i+1)%24,start+(j+1)*24+(i+1)%24,start+(j+1)*24+i)
            face(ids if side==-1 else tuple(reversed(ids)),CREAM)
    ids=tuple(start+48+i for i in range(24))
    face(ids if side==-1 else tuple(reversed(ids)),CREAM,False)
    # A single bold slanted coffee bean, with the cream seam cut visually into it.
    start=len(vertices)
    for i in range(20):
        t=2*math.pi*i/20
        x=.115*math.cos(t)
        z=.178*math.sin(t)
        a=-.40
        vertices.append((x*math.cos(a)-z*math.sin(a),side*.598,center_z+x*math.sin(a)+z*math.cos(a)))
    ids=tuple(start+i for i in range(20))
    face(ids if side==-1 else tuple(reversed(ids)),TEAL,False)
    points=[]
    for j in range(9):
        t=j/8
        z=(t-.5)*.279
        x=.028*math.sin((t-.5)*2*math.pi)
        a=-.40
        points.append((x*math.cos(a)-z*math.sin(a),side*.602,center_z+x*math.sin(a)+z*math.cos(a)))
    tube(points,.011,CREAM,4)

# Rounded base and gently tapered insulated cup.
lathe(((.015,.373),(.04,.416),(.10,.426),(1.23,.577),(1.30,.575)),CREAM)
# The raised sleeve remains broad enough to read in the runner camera.
lathe(((.405,.473),(.43,.492),(1.015,.569),(1.045,.553)),CORAL,cap=False)
# A sculpted, overhanging takeaway lid with a rolled lip and recessed crown.
lathe(((1.275,.565),(1.285,.633),(1.34,.652),(1.39,.635),(1.40,.553),(1.515,.522),(1.54,.49)),TEAL)
lathe(((1.538,.491),(1.559,.478)),TEAL_LIGHT)
badge(-1)
badge(1)
# The steam has an S-shaped silhouette with distinct unequal terminal heights.
for x, height, phase in ((-.23,.73,.3),(.22,.64,.05)):
    points=[]
    for j in range(12):
        t=j/11
        points.append((x+.070*math.sin(t*2.25*math.pi+phase),.015,1.69+t*height))
    tube(points,.035,CREAM)

# Tilt as one sculptural sign, then ground its lowest vertex exactly at zero.
tilt=Matrix.Rotation(math.radians(-10),4,'Y')
vertices=[tilt@Vector(v) for v in vertices]
floor=min(v.z for v in vertices)
vertices=[(v.x,v.y,v.z-floor) for v in vertices]
mesh=bpy.data.meshes.new('Kiez Kaffee sign mesh')
mesh.from_pydata(vertices,[],faces)
mesh.update()
obj=bpy.data.objects.new('Berlin Coffee Sign',mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj
obj.select_set(True)
colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for poly,color,shade in zip(mesh.polygons,face_colors,smooth):
    poly.use_smooth=shade
    for loop in poly.loop_indices:
        colors.data[loop].color=(*color,1)
mat=bpy.data.materials.new('Kiez Kaffee painted colors')
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.77
attribute=mat.node_tree.nodes.new('ShaderNodeVertexColor')
attribute.layer_name='Color'
mat.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
obj.data.materials.append(mat)
mesh.calc_loop_triangles()

positions,normals,rgb,indices=[],[],[],[]
lookup={}
for triangle in mesh.loop_triangles:
    for li in triangle.loops:
        loop=mesh.loops[li]
        v=mesh.vertices[loop.vertex_index].co
        n=mesh.corner_normals[li].vector
        p=tuple(round(float(c),4) for c in (v.x,v.z,-v.y))
        normal=tuple(round(float(c),4) for c in (n.x,n.z,-n.y))
        color=tuple(round(max(0,min(1,c))*255) for c in colors.data[li].color[:3])
        key=(p,normal,color)
        if key not in lookup:
            lookup[key]=len(positions)//3
            positions.extend(p)
            normals.extend(normal)
            rgb.extend(color)
        indices.append(lookup[key])
assert len(positions)==len(normals)==len(rgb)
assert all(math.isfinite(v) for v in positions+normals)
assert all(0<=i<len(positions)//3 for i in indices)
assert all(.99<sum(v*v for v in normals[i:i+3])<1.01 for i in range(0,len(normals),3))
assert len(indices)//3<=2200
bounds=[(min(positions[axis::3]),max(positions[axis::3])) for axis in range(3)]
assert bounds[1][0]==0 and bounds[0][1]-bounds[0][0]<1.8 and bounds[2][1]-bounds[2][0]<1.8
data=dict(positions=positions,normals=normals,colors=rgb,indices=indices)
js=OUT/'berlin-coffee-sign-v1.mesh.js'
js.write_text('globalThis.BERLIN_COFFEE_SIGN='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
glb=OUT/'berlin-coffee-sign-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
print(json.dumps(dict(vertices=len(positions)//3,triangles=len(indices)//3,bounds=bounds,js_bytes=js.stat().st_size,glb_bytes=glb.stat().st_size)))
