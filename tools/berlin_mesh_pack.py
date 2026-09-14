"""Shared Blender-local mesh -> Three.js packed static geometry conversion.

The runtime consumes local coordinates; object transforms arrange the Blender
asset sheet and are intentionally not baked into module geometry. UVs and
color attributes travel with edited vertices and evaluated mesh modifiers.
"""
import base64,math,struct

def packed_geometry(obj, mesh=None):
    me=mesh if mesh is not None else obj.data
    me.calc_loop_triangles()
    if not me.uv_layers.active:
        raise ValueError(obj.name+' needs an active UV layer for the runtime atlas')
    if 'Color' not in me.color_attributes:
        raise ValueError(obj.name+' needs its painted Color attribute')
    uv=me.uv_layers.active.data;col=me.color_attributes['Color']
    if col.domain not in ('CORNER','POINT'):
        raise ValueError(obj.name+' Color must use CORNER or POINT domain')
    positions=[];normals=[];colors=[];texcoords=[];indices=[];lookup={}
    for tri in me.loop_triangles:
        for li in tri.loops:
            loop=me.loops[li];p=me.vertices[loop.vertex_index].co
            n=me.corner_normals[li].vector
            c=col.data[li if col.domain=='CORNER' else loop.vertex_index].color
            t=uv[li].uv
            if not all(math.isfinite(v) for v in (*p,*n,*c,*t)):
                raise ValueError(obj.name+' contains a non-finite vertex attribute')
            # Blender Z-up -> Three Y-up, with the original atlas convention.
            point=(round(p.x,5),round(p.z,5),round(-p.y,5))
            normal=tuple(max(-32767,min(32767,round(v*32767))) for v in (n.x,n.z,-n.y))
            color=tuple(max(0,min(255,round(v*255))) for v in c[:3])
            tex=tuple(round(v,6) for v in t)
            key=(*point,*normal,*color,*tex)
            if key not in lookup:
                lookup[key]=len(positions)//3
                positions.extend(point);normals.extend(normal);colors.extend(color);texcoords.extend(tex)
            indices.append(lookup[key])
    if not positions:
        raise ValueError(obj.name+' contains no triangle geometry')
    def enc(fmt,values):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
    vc=len(positions)//3
    return dict(position=enc('f',positions),normal=enc('h',normals),color=enc('B',colors),uv=enc('f',texcoords),index=enc('H' if vc<65536 else 'I',indices),vertices=vc,triangles=len(indices)//3,
        min=[min(positions[i::3]) for i in range(3)],max=[max(positions[i::3]) for i in range(3)])
