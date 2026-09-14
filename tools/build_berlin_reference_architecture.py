"""Polish the authored bakery/bookstore kit in Blender and export the game meshes.

Run export_kiez_architecture_source.cjs first. All work is non-destructive to the
editable JS forms: weld coincident corners, bevel selected structural edges,
shade by angle, and bake short-range contact occlusion into linear vertex color.
The game consumes the exported mesh records, not an offline render.
"""
import bpy,bmesh,json,os,math,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry as packed
OUT=os.path.join(ROOT,'assets/models')
with open(os.path.join(ROOT,'.tmp/kiez-architecture-source.json')) as f: source=json.load(f)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

# Reproduce the UV sheet for the editable Blender/GLB asset. Runtime Canvas2D
# retains lettering and other procedural tiles at their original coordinates.
image=bpy.data.images.load(os.path.join(ROOT,'assets/img/berlin-reference-surfaces-v2.png'))
sw,sh=image.size;src=np.empty(sw*sh*4,dtype=np.float32);image.pixels.foreach_get(src);src=src.reshape((sh,sw,4))
pixels=np.ones((1024,1024,4),dtype=np.float32)
for cell in [1,3]:
    for y in range(256):
        value=.69+.29*y/255
        pixels[(3-cell//4)*256+y,(cell%4)*256:(cell%4+1)*256,:3]=value
for cell,sx,sy in [(5,0,1),(4,1,1),(2,0,0),(1,1,0)]:
    xs=sx*(sw//2)+(np.arange(256)*(sw/2)/256).astype(int)
    ys=sy*(sh//2)+(np.arange(256)*(sh/2)/256).astype(int)
    pixels[(3-cell//4)*256:(4-cell//4)*256,(cell%4)*256:(cell%4+1)*256]=src[ys[:,None],xs[None,:]]
    if cell==1:
        pixels[768:1024,256:512,:3]=pixels[768:1024,256:512,:3]*.60+.40
for cell in [9,10]:pixels[(3-cell//4)*256:(4-cell//4)*256,(cell%4)*256:(cell%4+1)*256,:3]=(.019,.049,.054)
atlas=bpy.data.images.new('Reference storefront atlas',width=1024,height=1024,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png');atlas.file_format='PNG';atlas.save();atlas.pack()
mat=bpy.data.materials.new('Reference architecture / painted atlas + baked contact');mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.86
color=nodes.new('ShaderNodeVertexColor');color.layer_name='Color'
tex=nodes.new('ShaderNodeTexImage');tex.image=atlas
mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
links.new(color.outputs['Color'],mul.inputs[1]);links.new(tex.outputs['Color'],mul.inputs[2]);links.new(mul.outputs[0],bsdf.inputs['Base Color'])

def polish(item):
    p=item['position'];n=item['normal'];uv=item['uv'];c=item['color'];count=len(p)//3
    vertices=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
    faces=[(i,i+1,i+2) for i in range(0,count,3)]
    mesh=bpy.data.meshes.new('Kiez '+item['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
    uv_layer=mesh.uv_layers.new(name='UVMap');colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        i=loop.vertex_index;uv_layer.data[loop.index].uv=(uv[i*2],uv[i*2+1]);colors.data[loop.index].color=(*c[i*3:i*3+3],1)
    bm=bmesh.new();bm.from_mesh(mesh)
    fabric=bm.faces.layers.int.new('awning_fabric');bm.faces.ensure_lookup_table()
    for start,end in item.get('fabricRanges',[]):
        for face in list(bm.faces)[start:end]:face[fabric]=1
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008)
    bm.normal_update();weight=bm.edges.layers.float.new('bevel_weight_edge')
    selected=0
    for edge in bm.edges:
        if any(face[fabric] for face in edge.link_faces):continue
        if len(edge.link_faces)==2 and edge.calc_length()>.68 and edge.calc_face_angle(0)>.74:
            edge[weight]=1;selected+=1
    bm.to_mesh(mesh);bm.free();mesh.update()
    # Bevel-generated slivers can extrapolate a UV past its atlas cell.
    # Retain the original surface identity so those new 27mm edges stay on
    # the intended paint tile instead of sampling adjacent shop lettering.
    original_bvh=BVHTree.FromPolygons([v.co.copy() for v in mesh.vertices],[tuple(p.vertices) for p in mesh.polygons],all_triangles=True)
    source_uv=mesh.uv_layers.active.data
    source_cells=[]
    for polygon in mesh.polygons:
        center=sum((source_uv[li].uv for li in polygon.loop_indices),Vector((0,0)))/len(polygon.loop_indices)
        source_cells.append((min(3,max(0,int(center.x*4))),min(3,max(0,int((1-center.y)*4)))))
    obj=bpy.data.objects.new('Bakery' if item['variant']==0 else 'Bookstore',mesh);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    mesh.materials.append(mat)
    bevel=obj.modifiers.new('Soft structural edges','BEVEL');bevel.limit_method='WEIGHT';bevel.width=.027;bevel.segments=2;bevel.use_clamp_overlap=True
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32),keep_sharp_edges=True)
    obj.data.update();me=obj.data;me.calc_loop_triangles()
    painted_uv=me.uv_layers.active.data
    fixed_edges=0
    for polygon in me.polygons:
        values=[painted_uv[li].uv.copy() for li in polygon.loop_indices]
        cells={(math.floor(v.x*4),math.floor((1-v.y)*4)) for v in values}
        if len(cells)==1 and all(0<v.x<1 and 0<v.y<1 for v in values):continue
        nearest=original_bvh.find_nearest(polygon.center)
        if nearest[2] is None:raise ValueError('Missing source face for bevel atlas repair')
        cx,cy=source_cells[nearest[2]];pad=3/1024
        for li,value in zip(polygon.loop_indices,values):
            painted_uv[li].uv=(min((cx+1)/4-pad,max(cx/4+pad,value.x)),min(1-cy/4-pad,max(1-(cy+1)/4+pad,value.y)))
        fixed_edges+=1
    print('ATLAS_EDGE_REPAIR',item['name'],fixed_edges,flush=True)
    # A small bake complements broad live lighting without any extra render pass.
    bm=bmesh.new();bm.from_mesh(me);bvh=BVHTree.FromBMesh(bm,epsilon=.000001);bm.free()
    col=me.color_attributes['Color'];cache={}
    # Cache normals before changing color attributes: interleaved RNA color
    # writes otherwise invalidate Blender's lazy mesh evaluation per corner.
    normal_cache=[value.vector.copy() for value in me.corner_normals]
    point_cache=[vertex.co.copy() for vertex in me.vertices]
    baked_colors=[]
    golden=2.399963229728653
    for loop in me.loops:
        pt=point_cache[loop.vertex_index];normal=normal_cache[loop.index]
        key=(*[round(x,4) for x in pt],*[round(x,3) for x in normal])
        if key not in cache:
            axis=normal.cross(Vector((0,0,1)))
            if axis.length<.1:axis=normal.cross(Vector((0,1,0)))
            axis.normalize();other=normal.cross(axis).normalized();hits=0
            for s in range(6):
                z=.28+.68*(s+.5)/6;r=math.sqrt(1-z*z);angle=s*golden
                direction=normal*z+axis*(r*math.cos(angle))+other*(r*math.sin(angle))
                hit=bvh.ray_cast(pt+normal*.012,direction,.65)
                if hit[0] is not None:hits+=max(0,1-hit[3]/.65)
            cache[key]=1-.23*hits/6
        original=col.data[loop.index].color
        baked_colors.extend((*[v*cache[key] for v in original[:3]],1))
    col.data.foreach_set('color',baked_colors)
    print('POLISHED',item['name'],'selected edges',selected,'triangles',len(me.loop_triangles),flush=True)
    return obj

records={};objects=[]
for item in source['modules']:
    obj=polish(item);record=packed(obj)
    assert record['triangles']<23000,(item['name'],record['triangles'])
    records[item['name']]=record;obj['runtime_key']=item['name'];obj['reference']='audit/berlin-kiez-art-direction-v1.png'
    obj['contact_baked']=True;objects.append(obj)
data={'version':1,'source':'Blender 5.2 / tools/build_berlin_reference_architecture.py','meshes':records}
with open(os.path.join(OUT,'berlin-reference-architecture-v1.json'),'w') as f:json.dump(data,f,separators=(',',':'))
with open(os.path.join(OUT,'berlin-reference-architecture-v1.inline.js'),'w') as f:
    f.write('var BERLIN_REFERENCE_ARCHITECTURE = ');json.dump(data,f,separators=(',',':'));f.write(';\n')
for i,obj in enumerate(objects):obj.location=(i*22,0,0)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
# The Multiply node is not recognized as vertex-color use by Blender 5.2's
# MATERIAL export mode. Name the baked layer explicitly so it becomes COLOR_0
# (rather than an unused COLOR_1 behind a synthetic white COLOR_0).
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,
    export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.context.scene.world.color=(.3,.35,.42)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
print('REFERENCE_ARCHITECTURE_COMPLETE',len(records),'meshes',sum(x['triangles'] for x in records.values()),'triangles',flush=True)
