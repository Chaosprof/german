"""Replace only isolated facade flower components in the accepted Blender kit.

Run Blender -b -t 2 --python tools/stage_berlin_facade_planting_v86.py.
The immutable v85 baseline is copied once. Nothing in assets/ or HTML is written.
Runtime protected triangle corners retain exact position/normal/UV/color values.
"""
import base64
import collections
import hashlib
import json
import math
import os
import random
import shutil
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, 'audit', 'berlin-facade-planting-v86')
BASE = os.path.join(STAGE, 'baseline')
OUT = os.path.join(STAGE, 'models')
KEYS = ('13.5:0:1', '13.5:1:1')
FORMATS = {'position': 'f', 'normal': 'h', 'color': 'B', 'uv': 'f', 'index': 'H'}
SIZES = {'position': 3, 'normal': 3, 'color': 3, 'uv': 2}


def unpack(record):
    result = {}
    for key, fmt in FORMATS.items():
        if key == 'index' and record['vertices'] >= 65536:
            fmt = 'I'
        raw = base64.b64decode(record[key])
        result[key] = struct.unpack('<' + fmt * (len(raw) // struct.calcsize(fmt)), raw)
    return result


def components(data):
    p, idx = data['position'], data['index']
    lookup, parents, weld = {}, [], []

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for first in range(0, len(p), 3):
        key = tuple(p[first:first+3])
        if key not in lookup:
            lookup[key] = len(parents)
            parents.append(len(parents))
        weld.append(lookup[key])
    for first in range(0, len(idx), 3):
        root = find(weld[idx[first]])
        for k in (1, 2):
            parents[find(weld[idx[first+k]])] = root
    groups = {}
    for first in range(0, len(idx), 3):
        g = groups.setdefault(find(weld[idx[first]]), {'faces': [], 'vertices': set()})
        g['faces'].append(first // 3)
        g['vertices'].update(idx[first:first+3])
    for g in groups.values():
        g['min'] = [min(p[i*3+k] for i in g['vertices']) for k in range(3)]
        g['max'] = [max(p[i*3+k] for i in g['vertices']) for k in range(3)]
        g['center'] = [(a+b)/2 for a,b in zip(g['min'], g['max'])]
        g['tiles'] = sorted(set(math.floor(data['uv'][i*2]*4) +
            4*math.floor((1-data['uv'][i*2+1])*4) for i in g['vertices']))
        g['meanColor'] = [sum(data['color'][i*3+k] for i in g['vertices']) /
                          len(g['vertices']) for k in range(3)]
    return list(groups.values())


def planters(key):
    # Actual existing source positions, not a new decorative arrangement.
    variant = int(key.split(':')[1])
    ground = 6.0 if variant == 0 else 4.7
    floors = 2 if variant == 0 else 4
    boxes = []
    for col in range(3):
        x = (col-1)*12.5/3
        if variant == 0 and abs(x-4.65) < 2.1:
            continue
        for floor in range(floors):
            if (col+floor+variant) % 3 == 0:
                y = ground+floor*3.05+3.05*.51-1.13
                boxes.append({'kind': 'box', 'center': [x,y,.43], 'width': 1.54,
                              'id': 'box-%s-%s' % (col, floor)})
    if variant == 0:
        boxes.append({'kind': 'balcony', 'center': [4.65,9.25,-.05],
                      'width': 3.98, 'id': 'bay-balcony'})
    return boxes


def plant_group(g, box):
    # Leaves / centres have 20 triangles and flowers 24. Structural rims,
    # boxes, mullions, panes and cloth have different topology and/or tiles.
    if len(g['faces']) not in (20, 24) or g['tiles'] != [0]:
        return False
    lo, hi, c = g['min'], g['max'], g['center']
    if max(hi[k]-lo[k] for k in range(3)) > .75:
        return False
    x,y,z = box['center']
    if box['kind'] == 'box':
        inside = (x-.98 < c[0] < x+.98 and y-.65 < c[1] < y+.75 and .30 < c[2] < .90)
    else:
        inside = (2.05 < c[0] < 6.55 and 8.98 < c[1] < 9.99 and .65 < c[2] < 2.40)
    if not inside:
        return False
    r,gc,b = g['meanColor']
    green = gc > r*1.08 and gc > b*1.15
    rose_or_cream = r > gc*1.05 and r > b*1.10
    return green or rose_or_cream


def preserve_baseline():
    os.makedirs(BASE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    hashes = {}
    for suffix in ('blend', 'glb', 'json', 'inline.js', 'atlas.png'):
        name = 'berlin-reference-architecture-v1' + ('-' if suffix == 'atlas.png' else '.') + suffix
        path = os.path.join(BASE, name)
        if not os.path.exists(path):
            shutil.copyfile(os.path.join(ROOT, 'assets', 'models', name), path)
        with open(path, 'rb') as f:
            hashes[name] = hashlib.sha256(f.read()).hexdigest()
    manifest = os.path.join(BASE, 'sha256.json')
    if os.path.exists(manifest):
        with open(manifest) as f:
            assert hashes == json.load(f), 'Immutable baseline was modified'
    else:
        with open(manifest, 'w') as f:
            json.dump(hashes, f, indent=2)
    return hashes


def inspect(data):
    report = {}
    for key in KEYS:
        raw = unpack(data['meshes'][key])
        groups = components(raw)
        selected = []
        for box in planters(key):
            matching = [g for g in groups if plant_group(g,box)]
            selected.append({**box, 'components': len(matching),
                             'triangles': sum(len(g['faces']) for g in matching),
                             'types': dict(collections.Counter(len(g['faces']) for g in matching))})
        report[key] = {'triangles': data['meshes'][key]['triangles'], 'planters': selected}
    return report


def corner(data, i):
    return tuple(data[k][i*SIZES[k]:(i+1)*SIZES[k]]
                 for k in ('position','normal','color','uv'))


def payloads(data, omit=()):
    omit = set(omit)
    return collections.Counter(tuple(sorted(corner(data,i) for i in data['index'][t:t+3]))
        for t in range(0,len(data['index']),3) if t//3 not in omit)


def payload_hash(counter):
    digest = hashlib.sha256()
    for face, count in sorted(counter.items()):
        digest.update(repr((face,count)).encode('ascii'))
    return digest.hexdigest()


def splice(parts, metadata):
    output = {key: [] for key in FORMATS}
    lookup = {}
    for raw, omit in parts:
        for t in range(0,len(raw['index']),3):
            if t//3 in omit:
                continue
            for i in raw['index'][t:t+3]:
                values = corner(raw,i)
                if values not in lookup:
                    lookup[values] = len(output['position'])//3
                    for k,v in zip(('position','normal','color','uv'),values):
                        output[k].extend(v)
                output['index'].append(lookup[values])
    record = dict(metadata)
    for key, values in output.items():
        record[key] = base64.b64encode(struct.pack('<'+FORMATS[key]*len(values),*values)).decode('ascii')
    record.update(vertices=len(output['position'])//3, triangles=len(output['index'])//3,
                  min=[min(output['position'][i::3]) for i in range(3)],
                  max=[max(output['position'][i::3]) for i in range(3)])
    assert record['vertices'] < 65536
    return record


def linear(hexvalue):
    def channel(v):
        v /= 255
        return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
    return tuple(channel((hexvalue>>shift)&255) for shift in (16,8,0))


def create_plants(boxes, seed, material):
    """Author small, watertight, directional leaves and five-lobed flowers."""
    import bpy
    from mathutils import Vector
    rng = random.Random(seed)
    vertices, faces, normals, colors, corner_normals = [], [], [], [], []
    counts = collections.Counter()
    groups_report = []
    greens = [linear(v) for v in (0x527445,0x648342,0x75944a,0x42603b,0x86a45a)]
    blooms = [linear(v) for v in (0xc9787c,0xe2a09b,0xd98d91,0xf0d8b3)]
    frame = None

    def in_frame(vector, is_normal=False):
        value=Vector(vector)
        if frame is None:
            return value
        ca,sa=math.cos(frame),math.sin(frame)
        x,z=value.x*ca+value.z*sa,-value.x*sa+value.z*ca
        if is_normal:
            return Vector((x/1.14,value.y,z)).normalized()
        return Vector((4.65+x*1.14,value.y,-.05+z))

    def form(center, axis, across, normal, length, width, color, bloom=False):
        center,axis,across,normal = map(Vector,(center,axis,across,normal))
        axis.normalize();across.normalize();normal.normalize()
        count = 10 if bloom else 8
        start = len(vertices)
        # Every form is a closed lens: one rounded front, one shallow back.
        rim = []
        for j in range(count):
            a = 2*math.pi*j/count
            petal = (1 if j%2==0 else .89) if bloom else 1
            along,side = math.cos(a)*length*.5*petal, math.sin(a)*width*.5*petal
            bow = 0 if bloom else abs(math.cos(a))*.012
            rim.append(center+axis*along+across*side+normal*bow)
        points = rim+[center+normal*(width*(.15 if bloom else .095)),
                      center-normal*(width*(.11 if bloom else .055))]
        for j,p in enumerate(points):
            p=in_frame(p)
            vertices.append((p.x,-p.z,p.y))
            if j<count:
                a=2*math.pi*j/count
                n=(axis*(math.cos(a)*.36)+across*math.sin(a)+normal*.18).normalized()
                factor=.87+.13*(.5+.5*math.cos(a-.65))
            else:
                n=normal if j==count else -normal
                factor=1.06 if j==count else .69
            n=in_frame(n,True)
            normals.append((n.x,-n.z,n.y))
            # A centre tint joins the petals rather than adding a cream dot.
            tint=color if not bloom or j<count else tuple(v*.87 for v in color)
            colors.append((*[min(1,v*factor) for v in tint],1))
        for j in range(count):
            k=(j+1)%count
            face=(start+count,start+j,start+k)
            a,b,c=[Vector(vertices[v]) for v in face]
            target=in_frame(normal,True)
            target=Vector((target.x,-target.z,target.y))
            if (b-a).cross(c-a).dot(target)<0:
                face=(face[0],face[2],face[1])
            faces.append(face)
            backface=(start+count+1,face[2],face[1])
            faces.append(backface)
            # Separate plane-following front/back normals keep thin lenses
            # from shading as inflated pebbles. A shallow bend catches light
            # across each leaf while preserving its directional flat read.
            for poly,front in ((face,True),(backface,False)):
                for index in poly:
                    local=index-start
                    if local<count:
                        a=2*math.pi*local/count
                        bend=across*(math.sin(a)*(.27 if bloom else .13))+axis*(math.cos(a)*.08)
                        n=(normal*(1 if front else -1)+bend).normalized()
                    else:
                        n=normal if front else -normal
                    n=in_frame(n,True)
                    corner_normals.append((n.x,-n.z,n.y))
        counts['flowers' if bloom else 'leaves']+=1

    def leaf(center, direction, length, width, tone):
        axis=Vector(direction).normalized()
        preferred=Vector((rng.uniform(-.3,.3),.55,1)).normalized()
        across=axis.cross(preferred)
        if across.length<.05:
            across=axis.cross(Vector((1,0,0)))
        across.normalize();normal=across.cross(axis).normalized()
        form(center,axis,across,normal,length,width,greens[tone%len(greens)])

    def flower(center,radius,tone,tilt):
        normal=Vector((tilt,.45,1)).normalized()
        across=normal.cross(Vector((0,1,0))).normalized()
        axis=across.cross(normal).normalized()
        form(center,axis,across,normal,radius*2,radius*2,blooms[tone%len(blooms)],True)

    for bi,box in enumerate(boxes):
        startv,startf=len(vertices),len(faces)
        bx,by,bz=box['center']
        balcony=box['kind']=='balcony'
        clusters = [(-.53,.44,.88),(.00,.59,1.12),(.54,.48,.94)]
        for ci,(offset,height,size) in enumerate(clusters):
            if balcony:
                # Physical radial frames follow the exposed curved railing.
                # Tangent offsets, leaf planes and blossoms rotate together.
                frame=(-.98,-.50,-.05)[ci]
                cx=0
                cz=(2.22,2.24,2.14)[ci]
                # The actual widened v81 rail tops out at 9.755 m. Its
                # planting must crest that rail, not sit hidden behind it.
                cy=9.62
                span=.82*size
                number=(19,23,18)[ci]
            else:
                frame=None
                cx,cy,cz=bx+offset,by+.06,.57
                span=.48*size
                number=(11,14,11)[ci]
            for i in range(number):
                a=i*2.399963229728653+ci*.7
                radial=math.sqrt((i+.6)/number)
                xx=math.cos(a)*span*.54*radial
                yy=.11+(height-.22)*(1-radial*.48)+math.sin(a)*.075
                zz=math.sin(a)*.13
                center=(cx+xx,cy+yy,cz+zz)
                direction=(xx*1.9+rng.uniform(-.12,.12), .18+math.cos(a)*.17, .12+zz)
                leaf(center,direction,rng.uniform(.23,.31)*size,rng.uniform(.105,.15),i+ci+bi)
            # Irregular bloom clusters: rose dominates; a few cream blossoms
            # punctuate the leaf silhouettes, never evenly spaced upright dots.
            flower_count=(4,5,4)[ci] if balcony else (3,4,2)[ci]
            for fi in range(flower_count):
                a=fi*2.25+ci*.9
                xx=math.cos(a)*span*.31
                yy=.28+math.sin(a)*.065+(height-.48)*.38
                center=(cx+xx,cy+yy,cz+.12+math.sin(a)*.03)
                flower(center, rng.uniform(.071,.091)*(1.12 if balcony else 1),
                       (fi+ci+bi)%4,rng.uniform(-.35,.35))
        # Three short, unequal draping sprays turn the box silhouette into a
        # connected planting mass, without hanging into the clear glass centre.
        trails=((-0.60,.33),(.40,.43)) if balcony else ((-.60,.29),(-.13,.43),(.54,.25))
        for di,(offset,drop) in enumerate(trails):
            if balcony:
                frame=(-.83,-.20)[di]
                cx=0
                cz=2.23
                cy=9.84
                number=9
            else:
                frame=None
                cx,cy,cz=bx+offset,by+.24,.70
                number=4
            for i in range(number):
                t=i/(number-1)
                xx=math.sin(i*2.1)*.075
                leaf((cx+xx,cy-drop*t,cz+.055*math.sin(t*math.pi)),
                     ((-1 if i%2 else 1)*.13,-.24,.055),
                     .24-t*.055,.12-t*.023,di+i+1)
        plantpoints=[(p[0],p[2],-p[1]) for p in vertices[startv:]]
        groups_report.append({**box, 'newTriangles':len(faces)-startf,
            'min':[min(v[k] for v in plantpoints) for k in range(3)],
            'max':[max(v[k] for v in plantpoints) for k in range(3)],
            'clumps':3,'trailingClusters':2 if balcony else 3,
            **({'radialFrameAngles':[-.98,-.50,-.05]} if balcony else {})})
    mesh=bpy.data.meshes.new('Closed directional foliage and clustered rose flowers')
    mesh.from_pydata(vertices,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        uv.data[loop.index].uv=(.125,.875)
        paint.data[loop.index].color=colors[loop.vertex_index]
    for face in mesh.polygons:
        face.use_smooth=True
    assert len(corner_normals)==len(mesh.loops)
    mesh.normals_split_custom_set(corner_normals)
    mesh.materials.append(material)
    obj=bpy.data.objects.new('Facade planting v86 temporary authoring',mesh)
    bpy.context.collection.objects.link(obj)
    # Every independently authored leaf or bloom has two faces per edge.
    edge_use=collections.Counter(tuple(sorted((a,b))) for face in faces
        for a,b in zip(face,face[1:]+face[:1]))
    assert set(edge_use.values())=={2}, 'All authored plants must be closed'
    return obj,groups_report,dict(counts)


def build(accepted, hashes):
    import bpy
    from mathutils import Vector
    sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
    from berlin_mesh_pack import packed_geometry
    bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'berlin-reference-architecture-v1.blend'))
    bpy.context.preferences.filepaths.save_version=0
    objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
    updated=dict(accepted);updated['meshes']=dict(accepted['meshes'])
    reports={}
    for key in KEYS:
        obj=objects[key];original=accepted['meshes'][key];raw=unpack(original)
        groups=components(raw);boxes=planters(key);removed=set();old_groups=[]
        for box in boxes:
            matching=[g for g in groups if plant_group(g,box)]
            expected=27 if box['kind']=='balcony' else 35
            assert len(matching)==expected,(key,box['id'],len(matching),expected)
            faces={ti for g in matching for ti in g['faces']}
            assert not removed.intersection(faces),'Plant classification overlaps'
            removed.update(faces)
            old_groups.append({**box,'oldComponents':len(matching),'oldTriangles':len(faces)})
        plant,group_report,counts=create_plants(boxes,86+int(key.split(':')[1]),obj.data.materials[0])
        for group in group_report:
            centre=10.6055 if group['kind']=='balcony' else group['center'][1]+1.13
            group['glassCentreY']=centre
            group['glassCentreClearance']=centre-group['max'][1]
            assert group['glassCentreClearance']>.30,'Keep upper glazing centres clear'
            if group['kind']=='balcony':
                group['topRailY']=9.755
                group['growthAboveRail']=group['max'][1]-9.755
                assert group['growthAboveRail']>.30,'Curved foliage must visibly crest the actual rail'
        plant_record=packed_geometry(plant);new_raw=unpack(plant_record)
        after=splice([(raw,removed),(new_raw,set())],original)
        after['plantingRevision']='directional-facade-clumps-v86'
        after_raw=unpack(after)
        protected=payloads(raw,removed)
        retained_count=original['triangles']-len(removed)
        after_protected=payloads(after_raw,range(retained_count,after['triangles']))
        assert protected==after_protected,'Protected position, normal, color or UV changed'
        assert after['triangles'] <= original['triangles']*1.15
        for field in ('upperFloors','roofBase','upperTurretScaleX','upperTurretAngles','upperTopArched'):
            if field in original:
                assert after[field]==original[field]
        assert after['max'][2]<=original['max'][2]+.00001,'Planting changed road clearance'
        assert after['max'][1]<=original['max'][1]+.00001,'Planting changed roof silhouette'
        for bound in ('min','max'):
            assert all(abs(a-b)<.00001 for a,b in zip(after[bound],original[bound])), 'Planting changed building bounds'
            after[bound]=original[bound]
        # Recreate the same exact packed corner payloads. Full-precision saved
        # normals are reused for protected corners to limit Blender encoding.
        source=obj.data;source.calc_loop_triangles()
        source_uv=source.uv_layers.active.data;source_col=source.color_attributes['Color']
        normal_lookup={}
        for loop in source.loops:
            p=source.vertices[loop.vertex_index].co;n=source.corner_normals[loop.index].vector
            t=source_uv[loop.index].uv;c=source_col.data[loop.index].color
            lookup=(*[round(v,5) for v in (p.x,p.z,-p.y)],
                    *[round(v,6) for v in t],*[round(v*255) for v in c[:3]])
            normal_lookup.setdefault(lookup,[]).append(tuple(n))
        points=[];normals=[]
        for i in range(after['vertices']):
            p=after_raw['position'][i*3:i*3+3];n=after_raw['normal'][i*3:i*3+3]
            t=after_raw['uv'][i*2:i*2+2];c=after_raw['color'][i*3:i*3+3]
            points.append((p[0],-p[2],p[1]))
            approximate=Vector((n[0]/32767,-n[2]/32767,n[1]/32767))
            lookup=(*[round(v,5) for v in p],*[round(v,6) for v in t],*c)
            candidates=normal_lookup.get(lookup)
            normals.append(max(candidates,key=lambda normal:approximate.dot(Vector(normal))) if candidates else tuple(approximate))
        faces=[after_raw['index'][i:i+3] for i in range(0,len(after_raw['index']),3)]
        mesh=bpy.data.meshes.new(source.name+' / clustered flowering foliage v86')
        mesh.from_pydata(points,[],faces);mesh.update()
        uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for loop in mesh.loops:
            i=loop.vertex_index;uv.data[loop.index].uv=after_raw['uv'][i*2:i*2+2]
            paint.data[loop.index].color=(*[v/255 for v in after_raw['color'][i*3:i*3+3]],1)
        for polygon in mesh.polygons:
            polygon.use_smooth=True
        mesh.normals_split_custom_set([normals[l.vertex_index] for l in mesh.loops])
        mesh.materials.append(source.materials[0]);obj.data=mesh
        obj['planting_revision']='directional-facade-clumps-v86'
        bpy.data.objects.remove(plant,do_unlink=True)
        actual=unpack(packed_geometry(obj))
        def nonnormal_payload(data):
            return collections.Counter(tuple(sorted((c[0],c[2],c[3]) for c in
                (corner(data,i) for i in data['index'][t:t+3])))
                for t in range(0,len(data['index']),3))
        # v81's clipped structural corners retain interpolated UV float bytes
        # beyond the packer's six decimals. Check the editable mesh directly:
        # a round-trip through packed_geometry intentionally rounds these.
        direct=collections.Counter()
        mesh.calc_loop_triangles()
        for tri in mesh.loop_triangles:
            corners=[]
            for li in tri.loops:
                loop=mesh.loops[li];p=mesh.vertices[loop.vertex_index].co
                corners.append(((p.x,p.z,-p.y),tuple(round(v*255) for v in paint.data[li].color[:3]),tuple(uv.data[li].uv)))
            direct[tuple(sorted(corners))]+=1
        assert direct==nonnormal_payload(after_raw),'Blender geometry/UV/color must match runtime'
        expected_by_key=collections.defaultdict(list)
        for i in range(after['vertices']):
            p,n,c,t=corner(after_raw,i)
            expected_by_key[(tuple(round(v,5) for v in p),c,tuple(round(v,6) for v in t))].append(n)
        normal_error=0
        for i in range(len(actual['position'])//3):
            p,n,c,t=corner(actual,i)
            normal_error=max(normal_error,min(max(abs(a-b) for a,b in zip(n,other)) for other in expected_by_key[(tuple(round(v,5) for v in p),c,tuple(round(v,6) for v in t))]))
        # Two generations of Blender custom-normal encoding can differ from
        # the byte-exact runtime baseline by about .1 degree per component.
        assert normal_error<=96,('Blender custom normal precision',normal_error)
        updated['meshes'][key]=after
        reports[key]={'beforeTriangles':original['triangles'],'afterTriangles':after['triangles'],
            'triangleIncreasePercent':round((after['triangles']/original['triangles']-1)*100,3),
            'removedPlantTriangles':len(removed),'newPlantTriangles':plant_record['triangles'],
            'protectedTriangles':retained_count,'protectedPayloadSha256':payload_hash(protected),
            'stagedProtectedPayloadSha256':payload_hash(after_protected),
            'exactProtectedPositionNormalColorUV':True,'clothesRoomsGlazingArchitecturePreserved':True,
            'plantGroups':[dict(a,**b) for a,b in zip(old_groups,group_report)],'forms':counts,
            'blenderGeometryUVColorMatchesRuntime':True,'blenderMaxNormalEncodingDelta':normal_error,
            'min':after['min'],'max':after['max'],'materialsAdded':0,'drawsAdded':0}
        print('FACADE_PLANTING_STAGED',key,json.dumps(reports[key]),flush=True)
    untouched=[key for key in accepted['meshes'] if key not in KEYS]
    for key in untouched:
        assert accepted['meshes'][key]==updated['meshes'][key]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects.values():
        obj.select_set(True)
        ci=obj.data.color_attributes.find('Color')
        obj.data.color_attributes.active_color_index=ci;obj.data.color_attributes.render_color_index=ci
    bpy.context.view_layer.objects.active=objects[KEYS[0]]
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),
        use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,
        export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,
        export_extras=True,export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
    updated['source']='Blender 5.2 / tools/stage_berlin_facade_planting_v86.py'
    for suffix in ('json','inline.js'):
        with open(os.path.join(OUT,'berlin-reference-architecture-v1.'+suffix),'w') as f:
            f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='inline.js' else '')+
                json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='inline.js' else ''))
    shutil.copyfile(os.path.join(BASE,'berlin-reference-architecture-v1-atlas.png'),os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png'))
    report={'masters':reports,'otherRecordsIdentical':len(untouched),'baselineSha256':hashes,
            'allNewFormsClosed':True,'newMaterials':0,'newTextures':0,'newDraws':0,
            'atlasIdentical':True,'bakeReapplied':False}
    with open(os.path.join(STAGE,'validation.json'),'w') as f:
        json.dump(report,f,indent=2)
    print('FACADE_PLANTING_V86_COMPLETE',flush=True)


def preview():
    import bpy
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
    objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
    bakery=objects[KEYS[0]]
    for obj in objects.values():
        obj.hide_render=obj!=bakery
    origin=bakery.location.copy();target=origin+Vector((-4.1667,-.60,6.74))
    bpy.ops.object.camera_add(location=origin+Vector((-5.55,-4.3,8.03)))
    camera=bpy.context.object
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=2.82
    scene=bpy.context.scene;scene.camera=camera
    for location,energy,color in [((-7,-5,12),1100,(1,.88,.71)),((-1,-3,10),550,(.78,.87,1))]:
        bpy.ops.object.light_add(type='AREA',location=origin+Vector(location))
        light=bpy.context.object;light.data.energy=energy;light.data.color=color;light.data.size=4
        light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.world.color=(.28,.34,.40);scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=os.path.join(STAGE,'bakery-window-box-preview.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    hashes=preserve_baseline()
    with open(os.path.join(BASE, 'berlin-reference-architecture-v1.json')) as f:
        accepted = json.load(f)
    if '--preview-only' in sys.argv:
        preview()
    elif '--inspect' in sys.argv:
        print(json.dumps(inspect(accepted), indent=2), flush=True)
    else:
        build(accepted,hashes)
        if '--preview' in sys.argv:
            preview()
