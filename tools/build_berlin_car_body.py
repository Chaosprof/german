"""Author the compact Kiez car's wheel wells and pierced cabin in Blender.

The exported meshes replace the two painted shells in the existing car.
Wheels, crowned decks, lights, collisions and shared instance pools remain
owned by the game. Run Blender -b -t 2 --python tools/build_berlin_car_body.py.
"""
import bpy, bmesh, math, os, json, struct, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def xyz(p): return (p[0], -p[2], p[1])

def mesh_object(name, vertices, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(p) for p in vertices], [], faces)
    mesh.update()
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    return ob

# Side openings are actual empty wheel wells. Their inner return is inset
# 19cm from the outside skin; the middle floor stays low and continuous.
wheel_r = .442
zs = [-2.02, -1.96, -1.84, -.86, -.60, -.3, 0, .3, .60, .86, 1.84, 1.96, 2.02]
for wheel in [-1.35, 1.35]:
    zs += [wheel + wheel_r * math.cos(math.pi * i / 16) for i in range(17)]
zs = sorted(set(round(z, 7) for z in zs))
verts, faces = [], []
for z in zs:
    end = max(0, (abs(z)-1.60)/.42)
    w = .93 - .16 * end * end
    top = 1.025 - .10 * end * end
    arch = .355
    for wheel in [-1.35, 1.35]:
        if abs(z-wheel) <= wheel_r:
            arch = max(arch, .4 + math.sqrt(max(0, wheel_r**2-(z-wheel)**2)))
    right = [(0,.355),(.68,.355),(.735,arch),(.98*w,arch),
             (w,max(arch+.036,top-.16)),(.98*w,top-.07),(.88*w,top-.018),(0,top)]
    ring = right + [(-x,y) for x,y in reversed(right[1:-1])]
    verts += [(x,y,z) for x,y in ring]
n = len(ring)
for j in range(len(zs)-1):
    for i in range(n):
        a=j*n+i; b=j*n+(i+1)%n; c=(j+1)*n+(i+1)%n; d=(j+1)*n+i
        faces.append((a,b,c,d))
faces += [tuple(reversed(range(n))), tuple((len(zs)-1)*n+i for i in range(n))]
body = mesh_object('Rounded body with open wheel wells', verts, faces)
for f in body.data.polygons: f.use_smooth = len(f.vertices)==4

# The old cabin silhouette is retained, with a smoother rolled shoulder and
# real apertures behind all six panes. Nothing is rendered as transparent.
bpy.ops.mesh.primitive_cube_add(size=1, location=xyz((0,1.29,-.20)))
cabin = bpy.context.object; cabin.name='Pierced tapered cabin'
cabin.dimensions=(1.66,2.04,.66)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bevel=cabin.modifiers.new('Rolled cabin shoulders','BEVEL');bevel.width=.14;bevel.segments=4
bpy.context.view_layer.objects.active=cabin;bpy.ops.object.modifier_apply(modifier=bevel.name)
for v in cabin.data.vertices:
    t=max(0,min(1,(v.co.z+.33)/.66))
    v.co.x*=1-t*.14; v.co.y*=1-t*.23

def aperture(points, axis):
    vertices=[]
    for direction in [-1,1]:
        vertices += [tuple(p[k]+direction*.24*axis[k] for k in range(3)) for p in points]
    cutter=mesh_object('Temporary glazing aperture',vertices,[(3,2,1,0),(4,5,6,7),
        (0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    bpy.context.view_layer.objects.active=cabin
    modifier=cabin.modifiers.new('Recessed glazing opening','BOOLEAN')
    modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

for end in [-1,1]:
    bottom=.757 if end>0 else -1.157; top=.632 if end>0 else -1.032
    aperture([(-.691,1.164,bottom),(.691,1.164,bottom),(.649,1.516,top),(-.649,1.516,top)],(0,0,1))
for side in [-1,1]:
    for z in [(-.10,.62,-.10,.43),(-1.02,-.25,-.84,-.25)]:
        aperture([(side*.816,1.144,z[0]+.004),(side*.816,1.144,z[1]-.004),
                  (side*.753,1.506,z[3]-.004),(side*.753,1.506,z[2]+.004)],(1,0,0))
for f in cabin.data.polygons: f.use_smooth=True
normal=cabin.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL')
normal.keep_sharp=True; normal.weight=30
bpy.ops.object.modifier_apply(modifier=normal.name)

paint=bpy.data.materials.new('Recolorable car paint');paint.diffuse_color=(.18,.43,.37,1)
paint.use_nodes=True
bsdf=paint.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=paint.diffuse_color
bsdf.inputs['Roughness'].default_value=.34;bsdf.inputs['Metallic'].default_value=.14
for ob in [body,cabin]: ob.data.materials.append(paint)

def packed(ob):
    mesh=ob.data; mesh.calc_loop_triangles()
    p,n,uv,indices,lookup=[],[],[],[],{}
    normal_matrix=ob.matrix_world.to_3x3().inverted().transposed()
    for tri in mesh.loop_triangles:
        for loop in tri.loops:
            v=ob.matrix_world @ mesh.vertices[mesh.loops[loop].vertex_index].co
            normal=(normal_matrix @ mesh.corner_normals[loop].vector).normalized()
            point=(round(v.x,6),round(v.z,6),round(-v.y,6))
            norm=(round(normal.x,7),round(normal.z,7),round(-normal.y,7))
            tex=(round(point[0]/2+.5,6),round(point[2]/4+.5,6))
            key=(*point,*norm,*tex)
            if key not in lookup:
                lookup[key]=len(p)//3;p.extend(point);n.extend(norm);uv.extend(tex)
            indices.append(lookup[key])
    def enc(fmt,values): return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
    assert len(p)//3<65536
    return dict(position=enc('f',p),normal=enc('f',n),uv=enc('f',uv),index=enc('H',indices),
                vertices=len(p)//3,triangles=len(indices)//3,
                min=[min(p[i::3]) for i in range(3)],max=[max(p[i::3]) for i in range(3)])

bpy.context.view_layer.update()
data={'version':1,'source':'Blender 5.2 / tools/build_berlin_car_body.py',
      'meshes':{'body':packed(body),'cabin':packed(cabin)}}
for ext in ['json','inline.js']:
    with open(os.path.join(OUT,'berlin-kiez-car-body-v1.'+ext),'w') as f:
        if ext=='inline.js':f.write('var BERLIN_KIEZ_CAR_BODY = ')
        json.dump(data,f,separators=(',',':'))
        if ext=='inline.js':f.write(';\n')
bpy.ops.object.select_all(action='DESELECT')
for ob in [body,cabin]:ob.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-kiez-car-body-v1.glb'),
    use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-kiez-car-body-v1.blend'))
print('KIEZ_CAR_BODY',json.dumps({k:{'triangles':v['triangles'],'min':v['min'],'max':v['max']} for k,v in data['meshes'].items()}))
