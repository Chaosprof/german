"""Blender image pipeline: retain the generated PNG, ship an opaque JPEG atlas source."""
import bpy, os, sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
stem=args[0] if args else 'berlin-reference-interiors-v1'
image=bpy.data.images.load(os.path.join(root,'assets/img',stem+'.png'))
size=int(args[1]) if len(args)>1 else 0
if size and max(image.size)>size:
    width,height=image.size
    image.scale(round(width*size/max(width,height)),round(height*size/max(width,height)))
scene=bpy.context.scene
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.quality=91 if size else 93
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
image.save_render(os.path.join(root,'assets/img',stem+'.jpg'),scene=scene)
print('Saved JPEG atlas source at',tuple(image.size),'pixels; original generated PNG retained.')
