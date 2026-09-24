"""Reauthor the reference tram's coachwork in Blender; stage before installing.

Blender -b -t 2 --python tools/stage_berlin_tram_v123.py
The packed mesh and editable native source are exported from the same geometry.
"""
import bpy,bmesh,base64,json,math,shutil,struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-tram-reference-v123';OUT=STAGE/'models';BASE=STAGE/'baseline'
OUT.mkdir(parents=True,exist_ok=True);BASE.mkdir(parents=True,exist_ok=True)
PREFIX='berlin-vintage-tram-v90'
for ext in ('blend','glb','json','inline.js'):
    p=BASE/(PREFIX+'.'+ext)
    if not p.exists():shutil.copyfile(ROOT/'assets/models'/(PREFIX+'.'+ext),p)
if not (STAGE/'baseline.html').exists():shutil.copyfile(ROOT/'berlin-runner.html',STAGE/'baseline.html')
old=json.loads((BASE/(PREFIX+'.json')).read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
colors={**old['colors'],'yellow':0xe8b22b,'cream':0xf2dfb9,'glass':0xffffff,'steel':0x899bad}
def linear(c):return tuple(((v/255+.055)/1.055)**2.4 if v>10 else v/3294.6 for v in [(c>>s)&255 for s in (16,8,0)])
materials={}
for role,color in colors.items():
    m=bpy.data.materials.new('Tram '+role);m.use_nodes=True;m.diffuse_color=(*linear(color),1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color
    p.inputs['Roughness'].default_value=.25 if role=='glass' else .40
    p.inputs['Metallic'].default_value=.14 if role=='glass' else .08
    if role in ('headlamp','tail'):p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=.8
    materials[role]=m
# Opaque warm cabin depth and restrained sky reflections, one existing 128px map.
# Dark vertical cabin posts and lower seating replace the flat blue mirror wash.
rgba=bytearray();pixels=[]
for iy in range(128):
    v=iy/127
    for ix in range(128):
        u=ix/127;sky=max(0,(v-.48)/.52)*.47
        bar=max(math.exp(-((u-.17)/.021)**2),math.exp(-((u-.76)/.018)**2))
        seat=math.exp(-((v-.18)/.17)**4)
        reflection=math.exp(-((u-.22-.28*v)/.075)**2)*(.25+.75*v)
        light=math.exp(-((u-.55)/.26)**2)*math.exp(-((v-.57)/.36)**2)
        rgb=[(68+33*light-23*bar-13*seat+13*reflection)*(1-sky)+116*sky,
             (65+18*light-22*bar-15*seat+19*reflection)*(1-sky)+138*sky,
             (57+7*light-20*bar-13*seat+26*reflection)*(1-sky)+150*sky]
        rgb=[max(0,min(255,round(c))) for c in rgb];rgba.extend(rgb+[255]);pixels.extend((*linear((rgb[0]<<16)|(rgb[1]<<8)|rgb[2]),1))
glass={'width':128,'height':128,'data':base64.b64encode(rgba).decode()}
im=bpy.data.images.new('Warm tram cabin and sky reflection',width=128,height=128,alpha=False);im.pixels.foreach_set(pixels);im.pack();im.colorspace_settings.name='Non-Color'
tex=materials['glass'].node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
materials['glass'].node_tree.links.new(tex.outputs['Color'],materials['glass'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
objects=[]
def native(p):return (p[0],-p[2],p[1])
def game(p):return (p[0],p[2],-p[1])
def mesh(name,verts,faces,role,smooth=True,uvs=None):
    m=bpy.data.meshes.new(name);m.from_pydata([native(v) for v in verts],[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(materials[role]);o['material_role']=role
    bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
    for f in m.polygons:f.use_smooth=smooth
    m.set_sharp_from_angle(angle=math.radians(52));m.update()
    uv=m.uv_layers.new(name='UVMap')
    for l in m.loops:
        p=verts[l.vertex_index];uv.data[l.index].uv=uvs[l.vertex_index] if uvs else ((p[0]+1.25)/2.5,p[1]/3.2)
    objects.append(o);return o
def apply(o,mod):
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
def box(name,center,size,role,bevel=0):
    x,y,z=center;a,b,c=[v/2 for v in size]
    v=[(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],role,False)
    if bevel:
        m=o.modifiers.new('Rounded enamel edges','BEVEL');m.width=bevel;m.segments=1;apply(o,m)
        for f in o.data.polygons:f.use_smooth=True
        o.data.set_sharp_from_angle(angle=math.radians(52))
    return o
def rod(name,a,b,r,role,segments=8):
    a=Vector(a);b=Vector(b);d=(b-a).normalized();q=d.cross(Vector((0,1,0)))
    if q.length<.01:q=d.cross(Vector((1,0,0)))
    q.normalize();w=d.cross(q);verts=[]
    for p in (a,b):
        for i in range(segments):verts.append(p+r*(q*math.cos(i*math.tau/segments)+w*math.sin(i*math.tau/segments)))
    faces=[tuple(reversed(range(segments))),tuple(range(segments,2*segments))]
    faces.extend((i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments))
    return mesh(name,verts,faces,role)
def dimensions(y):
    # Gentle taper, with the front rolling into the shoulders in plan.
    return (1.075-.045*max(0,min(1,(y-1.5)/1.3)),3.80-.10*max(0,min(1,(y-1.5)/1.3)))
def nose(x,y):
    w,d=dimensions(y);r=.40;t=max(0,min(1,(abs(x)-(w-r))/r))
    return d-.52*(1-math.sqrt(max(0,1-t*t)))-.025*(x/w)**2
def ring(y,w=None,d=None):
    if w is None:w,d=dimensions(y)
    r=min(.4,w*.70);rz=min(.52,d*.30);pts=[]
    for cx,cz,start in [(w-r,d-rz,0),(-w+r,d-rz,90),(-w+r,-d+rz,180),(w-r,-d+rz,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8);pts.append((cx+r*math.cos(a),y,cz+rz*math.sin(a)))
    return pts
def band(name,layers,role,cap=True):
    verts=[]
    for row in layers:verts.extend(ring(*row))
    n=36;faces=[]
    for j in range(len(layers)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if cap:faces.extend([tuple(reversed(range(n))),tuple((len(layers)-1)*n+i for i in range(n))])
    return mesh(name,verts,faces,role)
band('lower_yellow_coach',[(.46,.98,3.70),(.56,1.045,3.77),(.76,1.075,3.80),(1.46,)],'yellow')
band('underbody_skirt',[(.37,.94,3.65),(.43,1.008,3.765),(.51,1.035,3.795)],'dark')
# Upper shell is actually cut open, so the recessed glazing remains visible.
upper=band('cream_window_shell',[(1.46,),(2.66,),(2.79,1.025,3.695)],'cream',False)
solid=upper.modifiers.new('Coachwork thickness','SOLIDIFY');solid.thickness=.025;solid.offset=-1;apply(upper,solid)
def perimeter(w,h,r,cy=0):
    pts=[]
    for x,y,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(6):
            a=math.radians(start+i*18);pts.append((x+r*math.cos(a),cy+y+r*math.sin(a)))
    return pts
def cutter(name,c,size,r,side=False):
    w,h,depth=size;xy=perimeter(w,h,r);v=[]
    for d in [-depth/2,depth/2]:
        for u,y in xy:v.append((c[0]+(d if side else u),c[1]+y,c[2]+(u if side else d)))
    n=len(xy);f=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,v,f,'dark');mod=upper.modifiers.new('Real window opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=o;apply(upper,mod);objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
for end in [-1,1]:cutter('cab aperture',(0,2.095,end*3.7),(1.88,1.22,1.1),.12)
for side in [-1,1]:cutter('passenger aperture',(side*1.04,2.115,0),(6.36,1.19,.5),.035,True)
band('cream_waist_rail',[(1.428,1.084,3.809),(1.473,1.084,3.809)],'cream')
band('roof_cream_lip',[(2.755,1.039,3.713),(2.812,1.043,3.721),(2.858,1.01,3.691)],'cream')
band('blue_grey_barrel_roof',[(2.817,1.026,3.702),(2.90,.98,3.67),(3.025,.81,3.53),(3.10,.49,3.35),(3.12,.13,3.21)],'steel')
# Cab glass wraps around the nose. Its narrow dark gasket and mullion never
# become a bright bus-like centre stripe; the route header sits inside glass.
def front_panel(name,end,w,h,cy,r,offset,role):
    # Grid follows the curved nose, with genuinely rounded outer corners.
    ys=[cy-h/2,cy-h/2+r*.3,cy-h/2+r,cy,cy+h/2-r,cy+h/2-r*.3,cy+h/2]
    verts=[];uvs=[];cols=13 if h>.5 else 7
    for y in ys:
        dy=max(0,abs(y-cy)-(h/2-r));hw=w/2-r+math.sqrt(max(0,r*r-dy*dy))
        for i in range(cols):
            u=i/(cols-1);x=(u*2-1)*hw;verts.append((x,y,end*(nose(x,y)+offset)));uvs.append((u,(y-cy+h/2)/h))
    faces=[]
    for j in range(len(ys)-1):
        for i in range(cols-1):a=j*cols+i;faces.append((a,a+1,a+1+cols,a+cols))
    o=mesh(name,verts,faces,role,True,uvs)
    # Orient open panes explicitly; volume-based normal repair cannot do so.
    expected=Vector(native((0,0,end)))
    if sum(f.normal.dot(expected) for f in o.data.polygons)<0:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    return o
for end in [-1,1]:
    front_panel('cab_rubber_'+str(end),end,1.875,1.215,2.095,.115,-.006,'dark')
    front_panel('cab_glass_'+str(end),end,1.793,1.134,2.095,.090,.002,'glass')
    rod('thin_cab_mullion_'+str(end),(0,1.59,end*(nose(0,1.59)+.013)),(0,2.505,end*(nose(0,2.505)+.013)),.017,'dark',6)
    front_panel('cab_header_'+str(end),end,1.68,.15,2.586,.02,.012,'dark')
    front_panel('small_route_roller_'+str(end),end,.64,.105,2.58,.012,.017,'destination')
    # Fine split wipers meet the lower frame, without crossing the header.
    for side in [-1,1]:
        a=(side*.28,1.56,end*(nose(side*.28,1.56)+.036));b=(side*.67,1.99,end*(nose(side*.67,1.99)+.036))
        rod('wiper_'+str((end,side)),a,b,.011,'dark',6)
        x=side*.785;y=.81;z=end*(nose(x,y)+.029)
        rod('lamp_bezel_'+str((end,side)),(x,y,z-end*.025),(x,y,z+end*.034),.099,'dark',16)
        rod('small_ivory_lamp_'+str((end,side)),(x,y,z+end*.035),(x,y,z+end*.05),.074,'headlamp',16)
        rod('marker_'+str((end,side)),(x,1.04,end*(nose(x,1.04)+.008)),(x,1.04,end*(nose(x,1.04)+.021)),.028,'cream',10)
    # Small central badge and fine bumper, no automotive radiator grille.
    box('nose_badge_'+str(end),(0,.73,end*(nose(0,.73)+.015)),(.14,.047,.021),'steel',.012)
    front_panel('fine_front_bumper_'+str(end),end,1.89,.063,.49,.017,.040,'steel')
    rod('crown_badge_'+str(end),(-.05,2.86,end*3.68),(.05,2.86,end*3.68),.023,'yellow',8)
# Nine tall side bays including folding doors; window surrounds sit in actual
# side apertures. All the following pieces merge into the same shared batches.
for side in [-1,1]:
    for i in range(9):
        z=-2.96+i*.74;isdoor=i in (0,8);width=.65
        box('side_gasket_'+str((side,i)),(side*1.042,2.113,z),(.025,1.19,width),'dark',.025)
        pane=box('side_glass_'+str((side,i)),(side*1.060,2.113,z),(.012,1.095,width-.068),'glass',.020)
        # UVs read vertically and repeat the cabin-depth map per bay.
        for l in pane.data.loops:
            p=game(pane.data.vertices[l.vertex_index].co);pane.data.uv_layers.active.data[l.index].uv=((p[2]-z)/width+.5,(p[1]-1.565)/1.095)
        if isdoor:
            box('door_lower_'+str((side,i)),(side*1.081,.998,z),(.018,.79,width),'yellow',.018)
            box('door_seam_'+str((side,i)),(side*1.095,1.55,z),(.012,2.01,.020),'dark')
            for dz in [-width/2,width/2]:box('door_jamb_'+str((side,i,dz)),(side*1.09,1.56,z+dz),(.028,2.04,.027),'cream')
            box('door_step_'+str((side,i)),(side*1.10,.44,z),(.075,.075,width+.025),'steel',.014)
        else:
            box('side_transom_'+str((side,i)),(side*1.073,2.40,z),(.015,.022,width-.07),'dark')
    for z in [-2.50,2.50]:
        # Four steel wheels stay recessed beneath the coach skirt.
        rod('wheel_'+str((side,z)),(side*.82,.285,z),(side*.99,.285,z),.285,'tyre',16)
        rod('hub_'+str((side,z)),(side*.991,.285,z),(side*1.008,.285,z),.115,'steel',12)
    for z in [-3.46,3.46]:box('side_red_marker_'+str((side,z)),(side*1.042,.62,z),(.025,.055,.055),'tail',.012)
box('chassis',(0,.31,0),(1.46,.22,6.2),'dark',.04)
box('roof_equipment',(0,3.18,0),(1.38,.24,3.9),'steel',.09)
for z in [-1.36,0,1.36]:box('roof_vent_'+str(z),(0,3.312,z),(.73,.018,.25),'dark',.03)
for side in [-1,1]:
    for z in [-.7,.7]:rod('roof_insulator_'+str((side,z)),(side*.35,3.3,z),(side*.35,3.42,z),.065,'cream',10)
box('pantograph_base',(0,3.43,0),(1.02,.055,1.28),'dark',.02)
for side in [-1,1]:
    x=side*.35
    rod('panto_lower_'+str(side),(x,3.44,-.52),(x,3.99,.34),.035,'dark',8)
    rod('panto_upper_'+str(side),(x,3.99,.34),(side*.48,4.43,-.04),.027,'dark',8)
    rod('panto_brace_'+str(side),(x,3.44,.42),(side*.30,4.17,-.05),.013,'steel',6)
rod('contact_shoe',(-.82,4.465,-.04),(.82,4.465,-.04),.028,'dark',8)
for side in [-1,1]:rod('curved_shoe_tip_'+str(side),(side*.82,4.465,-.04),(side*.99,4.36,-.04),.022,'dark',8)
# Strip orphaned boolean debris and pack evaluated triangles with split normals.
def packed(o):
    m=o.data;m.calc_loop_triangles();arr={k:[] for k in ['position','normal','uv','index']};lookup={}
    for t in m.loop_triangles:
        if t.area<1e-11:continue
        for li in t.loops:
            l=m.loops[li];p=game(m.vertices[l.vertex_index].co);n=game(m.corner_normals[li].vector);uv=m.uv_layers.active.data[li].uv
            key=(tuple(round(v,6) for v in p),tuple(max(-32767,min(32767,round(v*32767))) for v in n),tuple(round(v,6) for v in uv))
            if key not in lookup:
                lookup[key]=len(arr['position'])//3
                for k,v in zip(['position','normal','uv'],key):arr[k].extend(v)
            arr['index'].append(lookup[key])
    r={k:base64.b64encode(struct.pack('<'+f*len(arr[k]),*arr[k])).decode() for k,f in [('position','f'),('normal','h'),('uv','f'),('index','H')]}
    r.update(vertices=len(arr['position'])//3,triangles=len(arr['index'])//3,min=[min(arr['position'][i::3]) for i in range(3)],max=[max(arr['position'][i::3]) for i in range(3)])
    return r
data={'source':'Blender 5.2 / tools/stage_berlin_tram_v123.py','finishRevision':'rounded-reference-coach-v123','colors':colors,'glassTexture':glass,'collisionContract':old['collisionContract'],'parts':[],'meshes':{}}
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    zero=[f for f in bm.faces if f.calc_area()<1e-11]
    if zero:bmesh.ops.delete(bm,geom=zero,context='FACES_ONLY')
    bm.to_mesh(o.data);bm.free();o.data.update()
    data['parts'].append({'mesh':o.name,'role':o['material_role'],'translation':[0,0,0],'quaternion':[0,0,0,1],'scale':[1,1,1]});data['meshes'][o.name]=packed(o)
low=[min(r['min'][i] for r in data['meshes'].values()) for i in range(3)];high=[max(r['max'][i] for r in data['meshes'].values()) for i in range(3)]
data['renderBounds']={'min':low,'max':high};total=sum(m['triangles'] for m in data['meshes'].values())
assert total<=8200,total
assert low[0]>=-1.25 and high[0]<=1.25 and low[1]>=-.00001 and high[1]<=4.52 and low[2]>=-4 and high[2]<=4
raw=json.dumps(data,separators=(',',':'));(OUT/(PREFIX+'.json')).write_text(raw);(OUT/(PREFIX+'.inline.js')).write_text('var BERLIN_VINTAGE_TRAM_DATA = '+raw+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=upper
bpy.ops.export_scene.gltf(filepath=str(OUT/(PREFIX+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
report={'triangles':total,'beforeTriangles':sum(m['triangles'] for m in old['meshes'].values()),'batches':len(set(p['role'] for p in data['parts'])),'bounds':data['renderBounds']}
(STAGE/'build-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
