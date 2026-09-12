"""Inspect the exported gameplay mesh; this is not a browser/FPS capture.
node tools/check_berlin_skip.cjs --export
blender --background --python tools/render_berlin_skip.py
"""
import bpy, json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
parts = json.loads((root / '.tmp/berlin-skip-inspection.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1000, 800
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.world.color = (.20, .25, .32)
for i, part in enumerate(parts):
    p, n = part['position'], part['normal']
    points = [(p[j], -p[j+2], p[j+1]) for j in range(0, len(p), 3)]
    normals = [(n[j], -n[j+2], n[j+1]) for j in range(0, len(n), 3)]
    mesh = bpy.data.meshes.new(f'Skip surface {i}')
    mesh.from_pydata(points, [], [(j, j+1, j+2) for j in range(0, len(points), 3)])
    mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    mesh.normals_split_custom_set(normals)
    material = bpy.data.materials.new(f'Game material {i}')
    material.diffuse_color = (*part['color'], 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*part['color'], 1)
    shader.inputs['Roughness'].default_value = part['roughness']
    obj.data.materials.append(material)
bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
material = bpy.data.materials.new('Neutral inspection floor')
material.diffuse_color = (.18, .24, .28, 1)
floor.data.materials.append(material)
for position, energy, size in [((2,-5,8),1600,5),((-4,2,5),900,4)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy, lamp.data.shape, lamp.data.size = energy, 'DISK', size
    lamp.rotation_euler = (Vector((0,0,.8))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,7,5))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 5.4
scene.camera = camera
scene.render.filepath = str(root / 'audit/berlin-skip-inspection-2026-09-11.png')
bpy.ops.render.render(write_still=True)
