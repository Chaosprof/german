"""Blender image conversion only; generated source pixels are not repainted."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
image=bpy.data.images.load(str(root/'assets/img/berlin-fernsehturm-surface-v1.png'))
image.scale(256,512)
image.file_format='JPEG'
image.filepath_raw=str(root/'assets/img/berlin-fernsehturm-surface-v1-256.jpg')
image.save()
print('Saved 256x512 generated appearance map with Blender; no pixel painting.')
