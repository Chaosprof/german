"""Build the reference-inspired Berlin lime tree and storefront planter in Blender.

Run: blender.exe -b -t 2 --python tools/build_berlin_garden.py -- --render
All foliage is closed, opaque geometry with one shared surface atlas. No
alpha cards or per-copy material instances are required by the instance pools.
"""
import bpy, bmesh, math, random, json, os, sys, struct, base64
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'models')
AUDIT = os.path.join(ROOT, 'audit')
# Accepted v8 is canonical; explicit earlier stages remain reproducible.
SCULPTED_STREET_BRANCHES='--stage-structure' in sys.argv or not any(flag in sys.argv for flag in ('--stage-curved','--stage-lush','--stage-sprays','--stage-coreless','--stage-tetra','--stage-planter','--flowering-planter'))
CURVED_STREET_LEAVES='--stage-curved' in sys.argv or SCULPTED_STREET_BRANCHES
LUSH_PROTOTYPE='--stage-lush' in sys.argv or not any(flag in sys.argv for flag in ('--stage-sprays','--stage-coreless','--stage-tetra','--stage-planter','--flowering-planter'))
CORELESS_PROTOTYPE='--stage-coreless' in sys.argv
TETRA_PROTOTYPE='--stage-tetra' in sys.argv or not (CORELESS_PROTOTYPE or '--stage-sprays' in sys.argv)
# Historical v2/v3/v4 stages retain their original planter; v5 and v6 use their
# respective flowering recipes so previews and rollback assets are reproducible.
FLOWERING_PLANTER='--stage-planter' in sys.argv or not any(flag in sys.argv for flag in ('--stage-sprays','--stage-coreless','--stage-tetra'))
if '--stage-structure' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-branch-v8')
    OUT = os.path.join(AUDIT, 'models')
elif '--stage-curved' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-curved-v7')
    OUT = os.path.join(AUDIT, 'models')
elif '--stage-lush' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-lush-v6')
    OUT = os.path.join(AUDIT, 'models')
elif '--stage-planter' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-planter-v5')
    OUT = os.path.join(AUDIT, 'models')
elif '--stage-tetra' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-tetra-v4')
    OUT = os.path.join(AUDIT, 'models')
elif CORELESS_PROTOTYPE:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-coreless-v3')
    OUT = os.path.join(AUDIT, 'models')
elif '--stage-sprays' in sys.argv:
    AUDIT = os.path.join(AUDIT, 'berlin-garden-sprays-v2')
    OUT = os.path.join(AUDIT, 'models')
os.makedirs(OUT, exist_ok=True)
os.makedirs(AUDIT, exist_ok=True)
R = random.Random(86012)
ICO_TEMPLATES={}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0

def linear(c):
    return tuple(((v / 255 + .055) / 1.055) ** 2.4 if v > 10 else v / 3294.6 for v in c)

class MeshBuilder:
    def __init__(self): self.v, self.f, self.c, self.uv, self.n, self.corner_n = [], [], [], [], [], []
    def add(self, vertices, faces, colors, face_uv=None, normals=None, corner_normals=None):
        n = len(self.v); self.v.extend(vertices)
        self.f.extend(tuple(n + i for i in f) for f in faces)
        self.c.extend(colors)
        self.n.extend(normals if normals is not None else [None]*len(vertices))
        self.corner_n.extend(corner_normals if corner_normals is not None else [None]*len(faces))
        self.uv.extend(face_uv if face_uv is not None else [[(.015625,.015625)]*len(f) for f in faces])
    def tube(self, path, radii, sides=7, color=(115,87,53)):
        verts, cols = [], []
        for j, p in enumerate(path):
            p = Vector(p)
            direction = Vector(path[min(j+1,len(path)-1)]) - Vector(path[max(0,j-1)])
            direction.normalize()
            u = direction.cross(Vector((0,1,0))).normalized()
            if u.length < .5: u = direction.cross(Vector((1,0,0))).normalized()
            v = direction.cross(u).normalized()
            for k in range(sides):
                a = math.tau * k / sides
                verts.append(tuple(p + (u*math.cos(a)+v*math.sin(a))*radii[j]))
                tint = .86 + .16 * math.cos(a-.5) + .035*j
                cols.append(linear(tuple(min(255,int(tint*t)) for t in color)))
        faces = []
        for j in range(len(path)-1):
            for k in range(sides):
                a=j*sides+k; b=j*sides+(k+1)%sides; c=b+sides; d=a+sides
                faces.extend(((a,b,c),(a,c,d)))
        for k in range(1,sides-1):
            faces.extend(((0,k+1,k),((len(path)-1)*sides,(len(path)-1)*sides+k,(len(path)-1)*sides+k+1)))
        self.add(verts,faces,cols)
    def leaf(self, center, length, width, azimuth, tilt, color,soft=False):
        # Closed, bowed six-sided leaf: a broad oval contour and smooth normals
        # preserve the individual-leaf silhouette without a jagged paper crown.
        u=Vector((math.cos(azimuth)*math.cos(tilt),math.sin(azimuth)*math.cos(tilt),math.sin(tilt))).normalized()
        v=Vector((-math.sin(azimuth),math.cos(azimuth),.16*math.cos(tilt))).normalized()
        n=u.cross(v).normalized(); c=Vector(center)
        verts=[c+u*(math.cos(math.tau*i/6)*length)+v*(math.sin(math.tau*i/6)*width) for i in range(6)]
        verts.extend((c+n*width*.075,c-n*width*.035))
        faces=[]
        for i in range(6): faces.extend(((6,i,(i+1)%6),(7,(i+1)%6,i)))
        factors=[.98,.92,.94,.91,.90,.95,1.03,.86 if soft else .74]
        cols=[linear(tuple(min(255,int(t*f)) for t in color)) for f in factors]
        self.add([tuple(v) for v in verts],faces,cols)
    def lozenge_leaf(self,center,length,width,azimuth,tilt,color):
        # Four boundary points and two very shallow face centres form a
        # closed eight-triangle leaf, retaining a folded silhouette from both
        # sides while spending the whole near budget on actual foliage.
        u=Vector((math.cos(azimuth)*math.cos(tilt),math.sin(azimuth)*math.cos(tilt),math.sin(tilt))).normalized()
        v=Vector((-math.sin(azimuth),math.cos(azimuth),.12*math.cos(tilt))).normalized()
        n=u.cross(v).normalized();c=Vector(center)
        verts=[c+u*length,c+v*width,c-u*length*.92,c-v*width*.94,c+n*width*.08,c-n*width*.025]
        faces=[]
        for i in range(4):faces.extend(((4,i,(i+1)%4),(5,(i+1)%4,i)))
        factors=[.99,.95,.91,.96,1.03,.87]
        cols=[linear(tuple(min(255,int(t*f)) for t in color)) for f in factors]
        self.add([tuple(v) for v in verts],faces,cols)
    def tetra_leaf(self,center,length,width,azimuth,tilt,color,roll=0,emit=True):
        # A very shallow closed tetrahedron projects as a four-corner leaf:
        # two triangles on either side, no alpha and no hidden solid canopy.
        # The raised tip gives real thickness without an additional centre.
        u=Vector((math.cos(azimuth)*math.cos(tilt),math.sin(azimuth)*math.cos(tilt),math.sin(tilt))).normalized()
        v=Vector((-math.sin(azimuth),math.cos(azimuth),.12*math.cos(tilt))).normalized()
        n=u.cross(v).normalized();v=n.cross(u).normalized();c=Vector(center)
        u,v=u*math.cos(roll)+v*math.sin(roll),v*math.cos(roll)-u*math.sin(roll)
        verts=[c+u*length+n*width*.045,c+u*length*.12+v*width,c-u*length*.85,c+u*length*.12-v*width*.94]
        faces=[(0,3,1),(1,3,2),(0,1,2),(0,2,3)]
        factors=[1,.97,.93,.96]
        colors=[linear(tuple(min(255,int(value*factor)) for value in color)) for factor in factors]
        if emit:self.add([tuple(v) for v in verts],faces,colors)
        return verts
    def oval_leaf(self,center,length,width,azimuth,tilt,color,roll=0,emit=True,curved=False):
        # Six outline corners, eight closed faces. Alternating tiny thickness
        # makes a flattened triangular antiprism with a full oval silhouette;
        # it avoids spending the near-tree budget on invisible interior fans.
        u=Vector((math.cos(azimuth)*math.cos(tilt),math.sin(azimuth)*math.cos(tilt),math.sin(tilt))).normalized()
        v=Vector((-math.sin(azimuth),math.cos(azimuth),0)).normalized()
        n=u.cross(v).normalized();v=n.cross(u).normalized();c=Vector(center)
        u,v=u*math.cos(roll)+v*math.sin(roll),v*math.cos(roll)-u*math.sin(roll)
        outline=[(1,0),(.45,1),(-.48,.85),(-.94,0),(-.48,-.85),(.45,-1)]
        verts=[c+u*(x*length)+v*(y*width)+n*(width*((.10*x*x+.06*y*y if curved else 0)+(1 if i%2==0 else -1)*(.13 if curved else .026))) for i,(x,y) in enumerate(outline)]
        faces=[(0,2,4),(1,3,5)]+[(i,(i+1)%6,(i+2)%6) for i in range(6)]
        for i,f in enumerate(faces):
            normal=(verts[f[1]]-verts[f[0]]).cross(verts[f[2]]-verts[f[0]])
            if normal.dot(sum((verts[j]-c for j in f),Vector()))<0:faces[i]=(f[0],f[2],f[1])
        colors=[linear(tuple(min(255,int(value*factor)) for value in color)) for factor in (1,.97,.93,.89,.94,.99)]
        corner_normals=None
        if curved:
            # Each side has its own smooth lens normal. Sharing a normal
            # across the paper-thin perimeter collapses it to a sideways
            # vector; flat face normals instead make six hard sheets. These
            # curved normals retain native PBR/shadowing and the same 8 faces.
            corner_normals=[]
            for f in faces:
                face_n=(verts[f[1]]-verts[f[0]]).cross(verts[f[2]]-verts[f[0]])
                sign=1 if face_n.dot(n)>0 else -1
                normals=[]
                for idx in f:
                    x,y=outline[idx]
                    surface=n*sign+u*(x*.24-sign*.20*x*width/length)+v*(y*.48-sign*.12*y)
                    normals.append(tuple(surface.normalized()))
                corner_normals.append(normals)
        if emit:self.add([tuple(p) for p in verts],faces,colors,corner_normals=corner_normals)
        return verts
    def foliage_mass(self,center,radii,seed,detail=2,color=(77,122,64),textured=False,envelope=None):
        # Compact opaque core gives a dense crown without alpha overdraw. Its
        # irregular outline is recessed behind fine individual exterior leaves.
        if detail not in ICO_TEMPLATES:
            bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=detail,radius=1)
            bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
            ICO_TEMPLATES[detail]=([tuple(v.co) for v in bm.verts],[tuple(v.index for v in f.verts) for f in bm.faces]);bm.free()
        points,faces=ICO_TEMPLATES[detail];verts=[];cols=[];normals=[]
        for x,y,z in points:
            ripple=1+(.045 if envelope else .14)*math.sin(x*8.7+y*5.1+seed)*math.cos(z*7.2-x*4.2+seed*.7)
            verts.append((center.x+x*radii[0]*ripple,center.y+y*radii[1]*ripple,center.z+z*radii[2]*ripple))
            tint=(.93+.06*(z*.5+.5)) if envelope else .80+.18*(z*.5+.5)+.07*math.sin(x*11+y*8+seed)
            cols.append(linear(tuple(min(255,int(value*tint)) for value in color)))
            if envelope:
                origin,extent=envelope
                direction=Vector(tuple((verts[-1][j]-origin[j])/(extent[j]*extent[j]) for j in range(3)))
                direction.z+=.14
                normals.append(tuple(direction.normalized()))
            else:normals.append(None)
        face_uv=None
        if textured:
            face_uv=[]
            # Small core surfaces need the same leaf scale as the real sprays.
            # Sample a varied atlas patch instead of shrinking the full field
            # of hundreds of leaves onto every sub-metre branch cluster.
            uv_span=.43 if envelope else 1
            u0=(1-uv_span)*(.5+.45*math.sin(seed*2.1))
            v0=(1-uv_span)*(.5+.45*math.cos(seed*1.3))
            for f in faces:
                avg=[sum(points[i][j] for i in f)/len(f) for j in range(3)]
                axis=max(range(3),key=lambda j:abs(avg[j]));other=[j for j in range(3) if j!=axis]
                face_uv.append([((32+(u0+(points[i][other[0]]*.5+.5)*uv_span)*479)/512,
                    (32+(v0+(points[i][other[1]]*.5+.5)*uv_span)*479)/512) for i in f])
        self.add(verts,faces,cols,face_uv,normals)
    def object(self,name):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update()
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(self.c): attr.data[i].color=(*c,1)
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for j,li in enumerate(poly.loop_indices):uv.data[li].uv=self.uv[poly.index][j]
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        for p in mesh.polygons: p.use_smooth=True
        # A leaf is thin, not an inflated lens. Split only its folded perimeter
        # and hard pot rims; smooth bark/core normals remain continuous.
        mesh.set_sharp_from_angle(angle=math.radians(75))
        if any(n is not None for n in self.n) or any(n is not None for n in self.corner_n):
            # Core lighting follows the major canopy envelope, not individual
            # tiny ico facets. Leaves retain their thin closed-surface normals.
            split=[tuple(mesh.corner_normals[i].vector) for i in range(len(mesh.loops))]
            for i,loop in enumerate(mesh.loops):
                if self.n[loop.vertex_index] is not None:split[i]=self.n[loop.vertex_index]
            for poly in mesh.polygons:
                normals=self.corner_n[poly.index]
                if normals is not None:
                    for j,li in enumerate(poly.loop_indices):split[li]=normals[j]
            mesh.normals_split_custom_set(split)
        return obj

material=bpy.data.materials.new('Kiez garden • opaque vertex paint')
material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.9
color_node=material.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='Color'
material.node_tree.links.new(color_node.outputs['Color'],bsdf.inputs['Base Color'])
material.diffuse_color=(.35,.50,.11,1)
# A single 512px material atlas supplies fine leaf surfaces on the compact
# interiors. White padding keeps real outer leaves, branches and pots colored
# only by their vertex paint. This is a material on 3D geometry, not a billboard.
surface=bpy.data.images.load(os.path.join(ROOT,'assets/img/berlin-foliage-surface-v1.png'))
surface.scale(480,480)
sample=np.empty(480*480*4,dtype=np.float32);surface.pixels.foreach_get(sample);sample=sample.reshape((480,480,4))
pixels=np.ones((512,512,4),dtype=np.float32)
pixels[32:512,32:512]=sample
atlas=bpy.data.images.new('Linden leaf surface atlas',width=512,height=512,alpha=False)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=os.path.join(OUT,'berlin-kiez-garden-v1-atlas.jpg');atlas.file_format='JPEG'
atlas.save();atlas.pack()
tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas
mul=material.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
material.node_tree.links.new(color_node.outputs['Color'],mul.inputs[1]);material.node_tree.links.new(tex.outputs['Color'],mul.inputs[2]);material.node_tree.links.new(mul.outputs[0],bsdf.inputs['Base Color'])

wood=MeshBuilder();leaf=MeshBuilder();leaf_near=MeshBuilder();planter=MeshBuilder()
wood.tube([(0,0,0),(.06,.04,.9),(-.02,.08,1.8),(.11,.04,2.65),(.13,.11,3.3),(.22,.04,4.0)], [.22,.19,.155,.125,.078,.018],9)
# Seven tapered stems support an asymmetric, mature crown. They remain visible
# below the foliage and branch naturally inside the deeper leaf clusters.
branch_ends=[(-.8,.1,3.8),(.8,.2,3.9),(.06,-.6,3.3),(-.1,.65,3.7),(-.3,.1,4.6),(.45,-.2,4.3),(-.2,-.2,4.1)]
for k in range(7):
    angle=k*2.39996+.25
    end=Vector(branch_ends[k])
    start=Vector((.03,.05,2.15+.20*(k%4)))
    mid=start.lerp(end,.61)+Vector((0,0,.18))
    wood.tube([start,mid,end], [.108,.062,.012],6)
    for j in range(2):
        a=angle+(j-.5)*.9
        tip=end+Vector((math.cos(a)*.44,math.sin(a)*.44,.49+.17*j))
        wood.tube([mid.lerp(end,.65),tip], [.030,.005],5)
clusters=[
    (Vector((-1.10,.10,3.78)),(.83,.77,.76),56,22),
    (Vector((1.10,.18,3.89)),(.84,.74,.79),56,22),
    (Vector((.04,-.76,3.72)),(.92,.75,.78),60,21),
    (Vector((-.08,.76,4.10)),(.88,.77,.76),52,20),
    (Vector((.05,.04,4.98)),(.82,.76,.76),70,22),
    (Vector((-.81,.13,4.66)),(.85,.78,.77),60,23),
    (Vector((.82,.18,4.72)),(.87,.76,.76),60,23),
    (Vector((.24,-.65,4.43)),(.92,.74,.75),70,23),
    (Vector((-.30,.62,4.73)),(.83,.79,.75),76,24)
]

palette=[(153,183,58),(173,194,64),(186,201,77),(134,166,51),(154,181,61),(166,194,72)]
cool_palette=[(65,122,69),(79,140,75),(87,146,68)]
spray_palette=[(198,211,77),(211,220,101),(180,202,65),(193,212,86),(167,193,59),(200,213,79)]
near_spray_counts=[54,54,58,48,64,54,54,62,64]
def fill_crown(builder, near):
    for ci,(center,radius,near_count,grove_count) in enumerate(clusters):
        count=near_spray_counts[ci]
        # Separate the backing mass along branch sprays. The old .49 offsets
        # + .57 radius buried most leaves in one continuous outer shell.
        # Smaller cores now get their own exposed leaf coat; smooth envelope
        # normals remove the individual ico facets from the lighting.
        cores=[]
        for q in range(3):
            angle=q*2.39996+ci*1.71
            offset=Vector((math.cos(angle)*radius[0],math.sin(angle)*radius[1],(q-1)*radius[2]))*.44
            radii=(radius[0]*.46,radius[1]*.44,radius[2]*(.45+.025*q))
            cores.append((center+offset,radii))
            builder.foliage_mass(center+offset,radii,ci*1.76+q*2.13,2 if near else 1,(255,255,216),True,(center,radius))
        # Eight irregular tips establish matching near/far silhouettes. The
        # other leaves coat each small core rather than vanishing inside the
        # major canopy lobe. The grove uses an exact subset of near leaves.
        rng=random.Random(97103+ci*137)
        selected=set(range(count)) if near else set(range(8))|set(8+round(j*(count-9)/(grove_count-9)) for j in range(grove_count-8))
        for j in range(count):
            spray=j%8;rank=j//8
            a=spray*2.39996+ci*1.7
            z=1-2*(spray+.5)/8
            rad=math.sqrt(1-z*z)
            axis=Vector((math.cos(a)*rad,math.sin(a)*rad,z))
            side=Vector((-math.sin(a),math.cos(a),.22*math.sin(ci+spray))).normalized()
            extent=Vector(tuple(axis[k]*radius[k] for k in range(3)))
            # The shared tips establish size/height; exposed small-core coats
            # leave soft gaps between branch sprays.
            if rank==0:
                p=center+extent*1.05+Vector((0,0,.03*math.sin(spray*1.3)))
            else:
                q=(j-8)%3; order=(j-8)//3
                core,extent=cores[q]
                a=order*2.39996+ci*1.71+q*.70
                z=1-2*(order+.5)/math.ceil((count-8)/3)
                rad=math.sqrt(max(0,1-z*z))
                normal=Vector((math.cos(a)*rad,math.sin(a)*rad,z))
                p=core+Vector(tuple(normal[k]*extent[k] for k in range(3)))*rng.uniform(1.11,1.26)
            col=cool_palette[(ci+spray)%3] if z<-.40 and rank>1 else spray_palette[(ci+spray+rank)%6]
            shade=1 if rank==0 else rng.uniform(.93,1.04)
            col=tuple(min(255,int(c*shade)) for c in col)
            azimuth=a+math.pi+(.52 if rank%2 else -.52)
            tilt=.40+z*.8+(.18 if rank%3 else -.30)
            if rank==0:
                length=.10;width=.063
            else:
                length=rng.uniform(.060,.087);width=rng.uniform(.039,.056)
            if j in selected:builder.leaf(p,length,width,azimuth,tilt,col,True)
def fill_coreless_crown(builder,near):
    counts=[106,106,110,96,134,112,112,124,140]
    far_counts=[34,34,35,31,43,35,35,39,44]
    exterior=[(182,202,71),(204,216,92),(167,194,61),(193,210,86),(176,198,69),(197,210,82)]
    interior=[(96,145,65),(112,159,68),(128,171,70),(107,155,72)]
    for ci,(center,radius,_near,_far) in enumerate(clusters):
        count=counts[ci];far_count=far_counts[ci];sprays=12
        # Faint backing exists only in the far mesh. The near crown consists
        # entirely of real leaves; its airy gaps reveal actual branches.
        if not near:
            for q in range(2 if ci<6 else 1):
                a=ci*1.7+q*2.6
                offset=Vector((math.cos(a)*radius[0],math.sin(a)*radius[1],(q-.5)*radius[2]))*.16
                radii=tuple(v*.40 for v in radius)
                builder.foliage_mass(center+offset,radii,ci*1.91+q*1.73,1,(236,249,209),True,(center,radius))
        # Keep the outer two ranks exactly shared, then sample the deeper
        # leaf volume for the far role. The same topology names remain pooled.
        selected=set(range(count)) if near else set(range(24))|set(24+round(j*(count-25)/(far_count-25)) for j in range(far_count-24))
        rng=random.Random(517103+ci*941)
        for j in range(count):
            spray=j%sprays;rank=j//sprays
            a=spray*2.39996+ci*1.37
            zz=1-2*(spray+.5)/sprays
            radial=math.sqrt(1-zz*zz)
            axis=Vector((math.cos(a)*radial,math.sin(a)*radial,zz))
            tangent=Vector((-math.sin(a),math.cos(a),.14*math.cos(ci+spray))).normalized()
            max_rank=math.floor((count-1-spray)/sprays)
            travel=1.01-.78*rank/max(1,max_rank)
            paired=(1 if rank%2 else -1)*(.044+.022*(rank%3)) if rank else 0
            p=center+Vector(tuple(axis[k]*radius[k] for k in range(3)))*travel+tangent*paired
            if rank>1:p+=Vector((rng.uniform(-.065,.065),rng.uniform(-.065,.065),rng.uniform(-.045,.045)))
            p.z-=.055*math.sin(rank*.62+spray*.31)
            palette_choice=exterior if rank<4 and zz>-.65 else interior
            color=palette_choice[(ci+spray+rank)%len(palette_choice)]
            shade=rng.uniform(.94,1.045)
            color=tuple(min(255,int(c*shade)) for c in color)
            # Many leaves tilt toward the street-facing sides of the crown.
            # A mostly horizontal canopy hides leaf area from a runner camera.
            azimuth=a+math.pi+(rng.uniform(-.55,.55) if rank else .22*math.sin(ci+spray))
            tilt=(.95+.22*math.sin(ci+spray)) if rank==0 else rng.uniform(.78,1.52)
            length=.098 if rank<2 else rng.uniform(.082,.10)
            width=.061 if rank<2 else rng.uniform(.053,.063)
            if j in selected:
                # Interior far leaves can cover the spaces left by omitted
                # neighbours while shared boundary leaves retain exact size.
                scale=1 if near or rank<2 else 1.18
                builder.lozenge_leaf(p,length*scale,width*scale,azimuth,tilt,color)

def fill_tetra_crown(builder,near):
    counts=[212,212,220,192,268,224,224,248,280]
    far_counts=[68,68,70,62,86,70,70,78,88]
    exterior=[(166,193,66),(194,210,88),(178,202,73),(205,215,94),(184,203,76),(176,197,67)]
    interior=[(95,145,63),(111,162,67),(133,176,70),(121,164,66)]
    for ci,(center,radius,_n,_f) in enumerate(clusters):
        count=counts[ci];far_count=far_counts[ci]
        if not near:
            for q in range(2 if ci<6 else 1):
                a=ci*1.7+q*2.6
                offset=Vector((math.cos(a)*radius[0],math.sin(a)*radius[1],(q-.5)*radius[2]))*.16
                builder.foliage_mass(center+offset,tuple(v*.40 for v in radius),ci*1.91+q*1.73,1,(236,249,209),True,(center,radius))
        rng=random.Random(630517+ci*971);specs=[];bounds=[]
        for j in range(count):
            # Twelve common tips keep the existing broad shape. Other leaves
            # occupy staggered outer and inner volumes, not radial strings.
            if j<12:
                a=j*2.39996+ci*1.37;z=1-2*(j+.5)/12;depth=1.01
            else:
                a=j*2.39996+ci*.79+rng.uniform(-.35,.35)
                z=max(-.985,min(.985,1-2*(j-11.5)/(count-12)+rng.uniform(-.12,.12)))
                depth=rng.uniform(.72,.95) if j%5<3 else rng.uniform(.30,.76)
            radial=math.sqrt(1-z*z)
            axis=Vector((math.cos(a)*radial,math.sin(a)*radial,z))
            p=center+Vector(tuple(axis[k]*radius[k] for k in range(3)))*depth
            if j>=12:p+=Vector((rng.uniform(-.045,.045),rng.uniform(-.045,.045),rng.uniform(-.035,.035)))
            p.z-=.035*math.sin(a*1.3+ci)
            azimuth=a+math.pi+rng.uniform(-.58,.58)
            tilt=rng.uniform(.84,1.50)
            length=.098 if j<12 else rng.uniform(.080,.10)
            width=.061 if j<12 else rng.uniform(.052,.063)
            palette_choice=exterior if depth>.68 and z>-.66 else interior
            col=palette_choice[(ci+j)%len(palette_choice)]
            color=tuple(min(255,int(c*rng.uniform(.96,1.025))) for c in col)
            # The surface faces outward, but each leaf blade turns freely
            # within that surface. A common vertical blade axis read as paper
            # confetti even once the canopy was dense enough.
            roll=rng.uniform(-math.pi,math.pi)
            spec=(p,length,width,azimuth,tilt,color,roll);specs.append(spec)
            vertices=builder.tetra_leaf(*spec,emit=False)
            bounds.append(([min(v[k] for v in vertices) for k in range(3)],[max(v[k] for v in vertices) for k in range(3)]))
        if near:selected=set(range(count))
        else:
            # Preserve every true minimum/maximum leaf, not merely its centre;
            # far and near therefore retain exactly matching authored bounds.
            selected=set(range(12))
            for k in range(3):
                selected.add(min(range(count),key=lambda j:bounds[j][0][k]))
                selected.add(max(range(count),key=lambda j:bounds[j][1][k]))
            # The golden stride spreads retained leaves across the full shell.
            j=0
            while len(selected)<far_count:
                selected.add((j*73+ci*19)%count);j+=1
        for j in sorted(selected):builder.tetra_leaf(*specs[j])

if TETRA_PROTOTYPE:
    fill_tetra_crown(leaf,False)
    fill_tetra_crown(leaf_near,True)
elif CORELESS_PROTOTYPE:
    fill_coreless_crown(leaf,False)
    fill_coreless_crown(leaf_near,True)
else:
    fill_crown(leaf,False)
    fill_crown(leaf_near,True)

street_wood=None;street_leaf_far=None
if LUSH_PROTOTYPE:
    # Keep background tree/leaves/trunk records untouched. This street-only
    # trunk retains the foot radius and forks low into gently bent limbs that
    # spread inside five mature crown lobes above the shopfront sightlines.
    street_wood=MeshBuilder()
    street_wood.tube([(0,0,0),(.06,.04,.9),(-.02,.08,1.8),(-.23,.04,3.2),(-.42,.11,4.55),(-.62,.04,5.70)],
                     [.22,.19,.155,.145,.098,.028] if SCULPTED_STREET_BRANCHES else [.22,.19,.155,.125,.078,.018],9)
    street_branches=[
        ((-.015,.08,1.90),(-.55,.06,3.8),(-1.13,.12,6.12)),
        ((0,.06,2.10),(.58,.02,3.55),(1.15,.16,6.42)),
        ((-.02,.04,2.32),(-.02,-.44,4.0),(-.05,-.90,6.05)),
        ((-.12,.06,2.70),(.12,.47,4.5),(.06,.90,6.48)),
        ((-.23,.05,3.2),(-.18,.08,5.35),(-.30,.05,7.12)),
        ((.37,.02,3.05),(.70,-.21,5.1),(.65,-.20,6.80)),
        ((-.45,.08,3.95),(-.65,.21,5.4),(-.65,.22,6.60))]
    if SCULPTED_STREET_BRANCHES:
        # Fewer exposed low forks, with roots actually seated in the main
        # trunk at varied heights. Curving elbows distribute the crown rather
        # than forming a row of parallel poles from the pavement.
        street_branches=[
            ((-.19,.05,2.96),(-.79,.11,4.48),(-1.18,.18,6.08)),
            ((-.28,.06,3.65),(.39,.10,4.92),(1.15,.16,6.42)),
            ((-.23,.04,3.22),(-.19,-.56,4.56),(-.05,-.90,6.05)),
            ((-.36,.09,4.18),(.06,.55,5.26),(.06,.90,6.48)),
            ((-.48,.09,4.91),(-.28,.16,6.04),(-.30,.05,7.12)),
            ((-.33,.08,3.98),(.43,-.25,5.24),(.65,-.20,6.80)),
            ((-.51,.08,5.05),(-.87,.34,5.72),(-.65,.22,6.60))]
    for k,path in enumerate(street_branches):
        radii=([.118,.075,.018] if k<3 else [.073,.043,.012]) if SCULPTED_STREET_BRANCHES else ([.12,.080,.016] if k<3 else [.084,.048,.010])
        street_wood.tube(path,radii,6)
        middle,end=Vector(path[1]),Vector(path[2])
        for j in range(2):
            a=k*2.39996+(j-.5)*.95
            tip=end+Vector((math.cos(a)*.52,math.sin(a)*.52,.47+.15*j))
            street_wood.tube([middle.lerp(end,.64),tip],[.030,.005],5)
    leaf_near=MeshBuilder();street_leaf_far=MeshBuilder()
    lush_lobes=[
        (Vector((-1.04,.10,6.05)),(1.38,1.14,1.25),320,80),
        (Vector((1.10,.16,6.35)),(1.37,1.12,1.40),336,84),
        (Vector((-.08,-.80,6.10)),(1.46,1.16,1.26),304,76),
        (Vector((.04,.82,6.57)),(1.43,1.16,1.34),320,80),
        (Vector((-.14,.04,7.11)),(1.46,1.29,1.20),400,98)]
    if SCULPTED_STREET_BRANCHES:
        lush_lobes=[
            (Vector((-1.04,.10,5.90)),(1.38,1.14,1.51),320,80),
            (Vector((1.10,.16,6.41)),(1.37,1.12,1.34),336,84),
            (Vector((-.08,-.80,6.29)),(1.46,1.16,1.13),304,76),
            (Vector((.04,.82,6.67)),(1.43,1.16,1.24),320,80),
            (Vector((-.14,.04,7.10)),(1.46,1.29,1.21),400,98)]
    warm=[(177,191,65),(195,204,83),(167,185,59),(190,202,77),(203,211,94),(174,191,66)]
    cool=[(78,120,55),(95,138,62),(106,149,65),(117,156,66),(89,134,57)]
    original_street_leaf_vertices=[]
    for ci,(center,radius,count,far_count) in enumerate(lush_lobes):
        rng=random.Random(89141+ci*613);specs=[];bounds=[]
        for j in range(count):
            # Shared shell tips establish asymmetric lobe silhouettes. Most
            # other leaves overlap in the lobe's outer volume; a darker inner
            # layer gives depth without solid near-canopy backing spheres.
            angle=j*2.399963+ci*1.19+rng.uniform(-.16,.16)
            z=1-2*(j+.5)/count
            radial=math.sqrt(max(0,1-z*z))
            depth=1.01 if j<18 else rng.uniform(.69,.98) if j%5<3 else rng.uniform(.26,.76)
            if j<18:
                z=1-2*(j+.5)/18;radial=math.sqrt(1-z*z)
            axis=Vector((math.cos(angle)*radial,math.sin(angle)*radial,z))
            p=center+Vector(tuple(axis[k]*radius[k] for k in range(3)))*depth
            p+=Vector((.035*math.sin(j*.71+ci),.029*math.cos(j*.87),.055*math.sin(angle*1.8+ci)))
            outside=depth>.70 and z>-.7
            color=(warm if outside else cool)[(j+ci)% (len(warm) if outside else len(cool))]
            if CURVED_STREET_LEAVES:
                # Narrow the painted difference between adjoining leaves;
                # actual lighting and cast shadows still establish depth.
                middle=(167,186,82) if outside else (130,160,73)
                blend=.20 if outside else .25
                color=tuple(round(value*(1-blend)+middle[k]*blend) for k,value in enumerate(color))
            azimuth=angle+math.pi+rng.uniform(-.48,.48)
            tilt=rng.uniform(.66,1.53)
            length=rng.uniform(.145,.184) if outside else rng.uniform(.128,.163)
            width=length*rng.uniform(.56,.70)
            roll=rng.uniform(-math.pi,math.pi)
            spec=(p,length,width,azimuth,tilt,color,roll);specs.append(spec)
            if CURVED_STREET_LEAVES:original_street_leaf_vertices.extend(leaf_near.oval_leaf(*spec,emit=False))
            verts=leaf_near.oval_leaf(*spec,curved=CURVED_STREET_LEAVES)
            bounds.append(([min(v[k] for v in verts) for k in range(3)],[max(v[k] for v in verts) for k in range(3)]))
        selected=set(range(18))
        for k in range(3):
            selected.add(min(range(count),key=lambda j:bounds[j][0][k]))
            selected.add(max(range(count),key=lambda j:bounds[j][1][k]))
        i=0
        while len(selected)<far_count:
            selected.add((i*73+ci*31)%count);i+=1
        for j in sorted(selected):street_leaf_far.oval_leaf(*specs[j],curved=CURVED_STREET_LEAVES)
        # Only the far street role has a recessed painted backing surface.
        # These interiors remain inside every near/far authored AABB and the
        # retained real leaves own the outer outline in both roles.
        street_leaf_far.foliage_mass(center,tuple(r*.88 for r in radius),ci*2.19,1,(238,245,204),True,(center,radius))
    if CURVED_STREET_LEAVES:
        # Preserve the accepted canopy envelope and near/far LOD anchors.
        # The shallow bend needs only a tiny global fit; its inverse transpose
        # also transforms the authored normals before Blender export.
        target_min=[min(p[k] for p in original_street_leaf_vertices) for k in range(3)]
        target_max=[max(p[k] for p in original_street_leaf_vertices) for k in range(3)]
        if SCULPTED_STREET_BRANCHES:
            # Measured accepted v6 canopy envelope, in Blender Z-up. Reshape
            # its interior volumes without enlarging the street silhouette.
            target_min=[-2.38530,-1.96202,4.67998]
            target_max=[2.54874,2.09675,8.31450]
        source_min=[min(p[k] for p in leaf_near.v) for k in range(3)]
        source_max=[max(p[k] for p in leaf_near.v) for k in range(3)]
        scale=[(target_max[k]-target_min[k])/(source_max[k]-source_min[k]) for k in range(3)]
        def fitted_normal(n):
            return tuple(Vector(tuple(n[k]/scale[k] for k in range(3))).normalized()) if n is not None else None
        for builder in (leaf_near,street_leaf_far):
            builder.v=[tuple(target_min[k]+(p[k]-source_min[k])*scale[k] for k in range(3)) for p in builder.v]
            builder.n=[fitted_normal(n) for n in builder.n]
            builder.corner_n=[[fitted_normal(n) for n in face] if face is not None else None for face in builder.corner_n]

# Retain the existing planter's deterministic variant while crown sampling
# evolves independently. The old crown consumed eight randoms per leaf, plus
# one tilt random every fourth leaf; reconstruct that prior planter seed.
R=random.Random(86012)
for count in [c[3] for c in clusters]+[c[2] for c in clusters]:
    for j in range(count):
        for _ in range(8+(j%4==0)):R.random()

# A flared stone planter with a visible rolled rim, soil, central shoots and
# uneven foliage. The same one-material pool can draw shrubs or street trees.
planter.tube([(0,0,0),(0,0,.06),(0,0,.74),(0,0,.81)], [.31,.33,.45,.47],12,(181,112,72))
planter.tube([(0,0,.77),(0,0,.87)], [.485,.475],12,(229,194,145))
planter.tube([(0,0,.874),(0,0,.879)], [.408,.408],12,(62,54,35))
shrub_clusters=[(Vector((0,0,1.43)),(.35,.33,.38)),(Vector((-.25,.07,1.23)),(.31,.31,.33)),
    (Vector((.25,.02,1.29)),(.32,.30,.34)),(Vector((0,.23,1.25)),(.33,.30,.35)),(Vector((0,-.23,1.16)),(.35,.29,.32))]
for k,(tip,radius) in enumerate(shrub_clusters if not FLOWERING_PLANTER else []):
    planter.tube([(0,0,.84),tip], [.022,.003],5,(110,117,51))
    for q in range(3):
        angle=q*2.39996+k;offset=Vector((math.cos(angle)*radius[0],math.sin(angle)*radius[1],(q-1)*radius[2]))*.28
        planter.foliage_mass(tip+offset,tuple(v*.79 for v in radius),k*3.19+q*2.3,2,(245,255,235),True)
    for j in range(20):
        a2=j*2.39996+k*1.7;z=1-2*(j+.5)/20;r=math.sqrt(1-z*z)
        p=tip+Vector((math.cos(a2)*r*radius[0],math.sin(a2)*r*radius[1],z*radius[2]))
        leaf_color=palette[(k+j)%len(palette)]
        if j in (2,5,8,11):leaf_color=[(247,151,118),(250,214,158),(234,119,140),(247,177,126)][(k+j)%4]
        planter.leaf(p,R.uniform(.050,.085),R.uniform(.033,.051),a2+math.pi+R.uniform(-.5,.5),math.acos(z)+R.uniform(-.5,.5),leaf_color)
for k in range(12 if not FLOWERING_PLANTER else 0):
    flower_roots=[(-.29,-.27,1.43),(.22,-.24,1.58),(.06,.22,1.71)]
    a=(k%4)*math.tau/4+.35
    pos=Vector(flower_roots[k//4])+Vector((math.cos(a)*.095,math.sin(a)*.075,.024*(k%2)))
    planter.foliage_mass(pos,(.082,.077,.060),k*2.27,1,[(245,139,111),(249,215,158),(238,143,160)][k//4])

if FLOWERING_PLANTER:
    # An upright flowering shrub: every green surface is a real closed leaf.
    # Six tapered primary shoots carry 22 airy twig sprays. The original pot
    # remains byte-identical, and only the shrub is fitted to its old envelope.
    shrub=MeshBuilder();rng=random.Random(50726)
    tips=[Vector(p) for p in [(0,.02,1.70),(-.28,.07,1.43),(.29,-.03,1.51),
                              (-.02,-.29,1.40),(.06,.29,1.56),(-.14,.04,1.78)]]
    branches=[]
    for k,tip in enumerate(tips):
        root=Vector((.022*math.sin(k*2.4),.022*math.cos(k*2.4),.842))
        middle=root.lerp(tip,.29)+Vector((.035*math.cos(k),.035*math.sin(k),.025))
        shrub.tube([root,middle,tip],[.018,.013,.003],5,(118,115,58))
        twig_count=4 if k<4 else 3
        for j in range(twig_count):
            a=k*2.39996+j*2.17+.3
            terminal=j==twig_count-1
            begin=middle.lerp(tip,.88 if terminal else .02+j*.28)
            extent=.20+.075*math.sin(k*1.71+j*2.4)
            rise=(.035+.025*math.cos(a+.5)) if terminal else .10+.09*math.cos(a+.5)
            end=begin+Vector((math.cos(a)*extent,math.sin(a)*extent,rise))
            shrub.tube([begin,end],[.009,.002],5,(125,127,62))
            branches.append((begin,end,a,k,j))
    greens=[(140,168,60),(154,177,70),(169,188,78),(128,158,64),(150,180,75),(179,194,91)]
    for bi,(begin,end,a,k,j) in enumerate(branches if not LUSH_PROTOTYPE else []):
        count=8 if bi<6 else 9
        stem=(end-begin).normalized()
        side=Vector((-math.sin(a),math.cos(a),.12)).normalized()
        for li in range(count):
            order=li//2;fraction=.22+.18*order
            axis=stem*.42+side*((1 if li%2 else -1)*.86)+Vector((0,0,.04+.45*math.sin(bi+li)))
            axis.normalize()
            length=rng.uniform(.050,.071)*(1-.035*order)
            center=begin.lerp(end,min(.96,fraction))+axis*length*.83
            azimuth=math.atan2(axis.y,axis.x)+rng.uniform(-.22,.22)
            tilt=math.asin(axis.z)+rng.uniform(-.40,.40)
            color=greens[(bi+li)%len(greens)]
            shrub.leaf(center,length,length*rng.uniform(.52,.65),azimuth,tilt,color,True)
    if LUSH_PROTOTYPE:
        # Refill the whole pot-top volume with overlapping real leaf sprays.
        # More leaves inside five uneven lobes produce a substantial flowering
        # shrub at gameplay distance instead of a few isolated seedling stems.
        shrub_lobes=[(Vector((0,.02,1.41)),(.38,.34,.37),132),
                     (Vector((-.27,.04,1.24)),(.28,.30,.31),92),
                     (Vector((.28,.04,1.31)),(.28,.28,.32),92),
                     (Vector((-.04,-.24,1.20)),(.32,.29,.30),88),
                     (Vector((.04,.27,1.39)),(.30,.29,.33),92)]
        for ci,(center,radius,count) in enumerate(shrub_lobes):
            for j in range(count):
                a=j*2.399963+ci*1.77+rng.uniform(-.2,.2)
                z=1-2*(j+.5)/count;rad=math.sqrt(max(0,1-z*z))
                depth=rng.uniform(.66,1.02) if j%4 else rng.uniform(.28,.73)
                p=center+Vector((math.cos(a)*rad*radius[0],math.sin(a)*rad*radius[1],z*radius[2]))*depth
                color=greens[(ci+j)%len(greens)] if depth>.65 else [(74,114,52),(90,132,57),(109,148,61)][j%3]
                size=rng.uniform(.062,.082)
                shrub.oval_leaf(p,size,size*rng.uniform(.57,.71),a+math.pi+rng.uniform(-.4,.4),rng.uniform(.6,1.5),color,rng.uniform(-math.pi,math.pi))
    # Five shallow solid petals around a raised eight-face gold eye make each
    # flower legible from above and oblique gameplay cameras. Three flowers at
    # each tip form loose cream/blush clusters without rounded proxy balls.
    flower_colors=[(254,237,197),(244,183,184),(252,230,203),(244,181,183),(255,239,211),(249,194,184)]
    bloom_tips=[Vector(p) for p in [(0,-.04,1.76),(-.40,-.15,1.48),(.34,-.25,1.56),
                (-.12,-.47,1.24),(.14,.34,1.65),(-.22,.12,1.73)]] if LUSH_PROTOTYPE else tips
    for k,tip in enumerate(bloom_tips):
        a=k*2.39996+.35
        normal=Vector((math.cos(a)*.36,math.sin(a)*.36,.88)).normalized()
        u=normal.cross(Vector((0,0,1))).normalized();v=normal.cross(u).normalized()
        flower_count=4 if LUSH_PROTOTYPE else 3
        for j in range(flower_count):
            phase=j*math.tau/flower_count+k*.65
            center=tip+(u*math.cos(phase)+v*math.sin(phase))*(.064 if LUSH_PROTOTYPE else .055)+normal*(.010+.010*(j%2))
            shrub.tube([tip-Vector((0,0,.03)),center],[.004,.0015],3,(128,137,66))
            for petal in range(5):
                theta=petal*math.tau/5+k*.7+j*.35
                direction=(u*math.cos(theta)+v*math.sin(theta))
                across=normal.cross(direction)
                ps=1.12 if LUSH_PROTOTYPE else 1
                pc=center+direction*(.026*ps)
                verts=[pc+direction*(.034*ps),pc+across*(.023*ps),pc-direction*(.028*ps),pc-across*(.023*ps),
                       pc+normal*.010,pc-normal*.002]
                faces=[]
                for edge in range(4):faces.extend(((4,edge,(edge+1)%4),(5,(edge+1)%4,edge)))
                col=flower_colors[k]
                factors=[1,.99,.91,.98,1,.88]
                shrub.add([tuple(p) for p in verts],faces,[linear(tuple(int(c*f) for c in col)) for f in factors])
            eye=center+normal*.012
            verts=[eye+u*.013,eye+v*.013,eye-u*.013,eye-v*.013,eye+normal*.014,eye-normal*.006]
            faces=[]
            for edge in range(4):faces.extend(((4,edge,(edge+1)%4),(5,(edge+1)%4,edge)))
            shrub.add([tuple(p) for p in verts],faces,[linear((215,170,64))]*4+[linear((246,209,97)),linear((175,134,51))])
    # Preserve the accepted planter's exact AABB in Blender Z-up coordinates.
    # Foliage roots stay inside the rim; all normal data is generated after fit.
    target_min=(-.56734,-.52996,.842);target_max=(.59477,.55551,1.85933)
    old_min=[min(p[i] for p in shrub.v) for i in range(3)]
    old_max=[max(p[i] for p in shrub.v) for i in range(3)]
    shrub.v=[tuple(target_min[i]+(p[i]-old_min[i])/(old_max[i]-old_min[i])*(target_max[i]-target_min[i]) for i in range(3)) for p in shrub.v]
    planter.add(shrub.v,shrub.f,shrub.c,shrub.uv,shrub.n)

wood_obj=wood.object('Kiez_Tree_Trunk'); leaf_obj=leaf.object('Kiez_Tree_Leaves_Grove'); near_obj=leaf_near.object('Kiez_Tree_Leaves_Street'); planter_obj=planter.object('Kiez_Flower_Planter')
street_wood_obj=street_wood.object('Kiez_Tree_Street_Trunk') if LUSH_PROTOTYPE else wood_obj
street_far_obj=street_leaf_far.object('Kiez_Tree_Leaves_Street_Far') if LUSH_PROTOTYPE else None
objects=[street_wood_obj,near_obj,planter_obj]
for obj in objects:
    obj['source']='tools/build_berlin_garden.py'
    obj['reference']='audit/berlin-kiez-art-direction-v1.png'
    obj['opaque_foliage']=True

def packed(meshes, y_offset=0):
    vertices=[]; normals=[]; colors=[]; uvs=[]; indices=[]; lookup={}
    for ob in meshes:
        me=ob.data; me.calc_loop_triangles();attr=me.color_attributes['Color']
        for tri in me.loop_triangles:
            for li in tri.loops:
                vid=me.loops[li].vertex_index
                # Blender Z-up to Three Y-up; same handedness as glTF exporter.
                p=me.vertices[vid].co; n=me.corner_normals[li].vector;c=attr.data[vid].color;t=me.uv_layers.active.data[li].uv
                point=(round(p.x,5),round(p.z+y_offset,5),round(-p.y,5))
                normal=tuple(max(-32767,min(32767,round(v*32767))) for v in (n.x,n.z,-n.y))
                color=tuple(max(0,min(255,round(v*255))) for v in c[:3])
                texcoord=(round(t.x,6),round(t.y,6))
                key=(*point,*normal,*color,*texcoord)
                if key not in lookup:
                    lookup[key]=len(vertices)//3;vertices.extend(point);normals.extend(normal);colors.extend(color);uvs.extend(texcoord)
                indices.append(lookup[key])
    assert len(vertices)//3 < 65536
    def encode(fmt,values):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
    return dict(position=encode('f',vertices),normal=encode('h',normals),color=encode('B',colors),uv=encode('f',uvs),index=encode('H',indices),vertices=len(vertices)//3,triangles=len(indices)//3,
                min=[min(vertices[i::3]) for i in range(3)],max=[max(vertices[i::3]) for i in range(3)])

data={'version':1,'source':'Blender 5.2 / tools/build_berlin_garden.py','material':{'vertexColors':True,'roughness':.9,'metalness':0,'transparent':False,'side':'FrontSide'},'meshes':{'tree':packed([wood_obj,leaf_obj]),'leaves':packed([leaf_obj]),'treeNear':packed([street_wood_obj,near_obj]),'trunk':packed([wood_obj],-1.95),'planter':packed([planter_obj])}}
if LUSH_PROTOTYPE:
    data['meshes']['treeStreetFar']=packed([street_wood_obj,street_far_obj])
    data['streetCanopyRadius']=2.85
with open(atlas.filepath_raw,'rb') as f:data['atlas']={'width':512,'height':512,'mimeType':'image/jpeg','data':base64.b64encode(f.read()).decode('ascii')}
assert 1500 <= data['meshes']['tree']['triangles'] <= 3500
assert data['meshes']['treeNear']['triangles'] <= (14000 if LUSH_PROTOTYPE else 9000)
assert data['meshes']['planter']['triangles'] <= (6000 if LUSH_PROTOTYPE else 4000)
if LUSH_PROTOTYPE:
    with open(os.path.join(ROOT,'assets/models/berlin-kiez-garden-v1.json')) as f: accepted=json.load(f)
    for key in ('tree','leaves','trunk'):
        assert data['meshes'][key] == accepted['meshes'][key], 'Lush stage must preserve background '+key
    assert data['atlas'] == accepted['atlas'], 'Lush stage must reuse the accepted shared atlas'
    for bound in ('min','max'):
        assert data['meshes']['planter'][bound] == accepted['meshes']['planter'][bound], 'Planter envelope changed'
        assert data['meshes']['treeNear'][bound] == data['meshes']['treeStreetFar'][bound], 'Street near/far bounds differ'
    assert data['meshes']['treeStreetFar']['triangles']<=4000
if '--stage-planter' in sys.argv:
    with open(os.path.join(ROOT,'assets/models/berlin-kiez-garden-v1.json')) as f: accepted=json.load(f)
    for key in ('tree','treeNear','leaves','trunk'):
        assert data['meshes'][key] == accepted['meshes'][key], 'Planter stage must preserve accepted '+key
    assert data['atlas'] == accepted['atlas'], 'Planter must reuse the accepted shared atlas'
    for bound in ('min','max'):
        assert data['meshes']['planter'][bound] == accepted['meshes']['planter'][bound], 'Planter envelope changed'
json_path=os.path.join(OUT,'berlin-kiez-garden-v1.json')
with open(json_path,'w') as f: json.dump(data,f,separators=(',',':'))
js_path=os.path.join(OUT,'berlin-kiez-garden-v1.inline.js')
with open(js_path,'w') as f:
    f.write('/* Blender-authored opaque garden meshes. Generated by tools/build_berlin_garden.py. */\nvar BERLIN_KIEZ_GARDEN_DATA = ')
    json.dump(data,f,separators=(',',':')); f.write(';\n')
with open(os.path.join(AUDIT,'berlin-kiez-garden-v1-manifest.json'),'w') as f:
    json.dump({'source':data['source'],'material':data['material'],'meshes':{k:{kk:vv for kk,vv in v.items() if kk not in ('position','normal','color','uv','index')} for k,v in data['meshes'].items()},'atlas_size':[512,512],'runtime_bytes':os.path.getsize(js_path),**({'streetCanopyRadius':data['streetCanopyRadius']} if LUSH_PROTOTYPE else {})},f,indent=2)

bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=20
bpy.context.scene.cycles.use_denoising=True
bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=2
bpy.context.scene.view_settings.view_transform='AgX'
bpy.context.scene.world.color=(.25,.30,.40)
bpy.ops.object.light_add(type='AREA',location=(-4,-6,9)); key=bpy.context.object;key.name='Preview warm key';key.data.energy=1450;key.data.size=5;key.data.color=(1,.83,.60)
key.rotation_euler=(Vector((0,0,2.5))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(4,3,7));fill=bpy.context.object;fill.data.energy=850;fill.data.size=6;fill.data.color=(.75,.86,1)
fill.rotation_euler=(Vector((0,0,2.5))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(8,-12,7));camera=bpy.context.object;camera.rotation_euler=(Vector((.5,0,2.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=7.3
bpy.context.scene.camera=camera
bpy.context.scene.render.resolution_x=800;bpy.context.scene.render.resolution_y=800;bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.render.image_settings.file_format='PNG';bpy.context.scene.render.filepath=os.path.join(AUDIT,'berlin-kiez-garden-v1-preview.png')
if FLOWERING_PLANTER and not LUSH_PROTOTYPE:
    # A modest close-up exposes leaf/flower construction instead of making
    # the planter a tiny footnote beside the unrelated full-height tree.
    camera.location=(4.9,-4.7,2.8)
    camera.rotation_euler=(Vector((2.65,-.6,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=2.4
    bpy.context.scene.render.resolution_x=640;bpy.context.scene.render.resolution_y=640
if LUSH_PROTOTYPE:
    camera.location=(9,-15,8)
    camera.rotation_euler=(Vector((.4,0,4.2))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=10.0
# Editable source and reusable GLB retain only actual assets in the export.
bpy.ops.object.select_all(action='DESELECT')
for ob in objects: ob.select_set(True)
bpy.context.view_layer.objects.active=wood_obj
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-kiez-garden-v1.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,
    export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False)
planter_obj.location=(2.65,-.6,0)
leaf_obj.hide_render=True;leaf_obj.hide_set(True)
if LUSH_PROTOTYPE:
    wood_obj.hide_render=True;wood_obj.hide_set(True)
    street_far_obj.hide_render=True;street_far_obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-kiez-garden-v1.blend'))
if '--render' in sys.argv:
    if FLOWERING_PLANTER and not LUSH_PROTOTYPE:
        wood_obj.hide_render=True;near_obj.hide_render=True
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01))
    ground=bpy.context.object;ground.name='Preview only ground'
    gm=bpy.data.materials.new('Preview sandstone');gm.diffuse_color=(.48,.42,.33,1);ground.data.materials.append(gm)
    bpy.ops.render.render(write_still=True)
    if LUSH_PROTOTYPE:
        street_wood_obj.hide_render=True;near_obj.hide_render=True
        camera.location=(4.9,-4.7,2.8)
        camera.rotation_euler=(Vector((2.65,-.6,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=2.4
        bpy.context.scene.render.resolution_x=640;bpy.context.scene.render.resolution_y=640
        bpy.context.scene.render.filepath=os.path.join(AUDIT,'berlin-kiez-planter-v6-preview.png')
        bpy.ops.render.render(write_still=True)
print('KIEZ_GARDEN_COMPLETE',json.dumps({k:v['triangles'] for k,v in data['meshes'].items()}))
