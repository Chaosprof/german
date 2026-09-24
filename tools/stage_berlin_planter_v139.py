"""Refine the accepted street planter into denser, finer branching foliage.

Reuse the V114 native/runtime/GLB preservation pipeline against a new immutable
baseline. All tree records, material, atlas and the stone pot remain exact.
Run with Blender 5.2 --python-exit-code 1.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
source = (ROOT/'tools/stage_berlin_planter_forms_v114.py').read_text()

def replace(before, after):
    global source
    assert source.count(before)==1, before[:100]
    source=source.replace(before,after)

replace("BRANCH_SPRAYS = '--branch-sprays' in sys.argv", 'BRANCH_SPRAYS = True')
replace("STAGE = ROOT / 'audit/berlin-model-forms-v114/garden' / ('planter-sprays' if BRANCH_SPRAYS else 'planter-forms')",
        "STAGE = ROOT / 'audit/berlin-parity-v139'")
start=source.index('def rounded_leaf(')
end=source.index('MeshBuilder.oval_leaf=rounded_leaf',start)
source=source[:start]+'''def rounded_leaf(self,center,length,width,azimuth,tilt,color,roll=0,emit=True,curved=False):
    # Eight rim corners make a closed twelve-triangle thin leaf. Separate
    # surface normals and the shared atlas retain the accepted tree response.
    u=Vector((math.cos(azimuth)*math.cos(tilt),math.sin(azimuth)*math.cos(tilt),math.sin(tilt))).normalized()
    v=Vector((-math.sin(azimuth),math.cos(azimuth),0)).normalized()
    n=u.cross(v).normalized();v=n.cross(u).normalized();c=Vector(center)
    u,v=u*math.cos(roll)+v*math.sin(roll),v*math.cos(roll)-u*math.sin(roll)
    xy=[(math.cos(i*math.tau/8),math.sin(i*math.tau/8)) for i in range(8)]
    verts=[c+u*x*length+v*y*width+n*width*(.055 if i%2==0 else -.055) for i,(x,y) in enumerate(xy)]
    faces=[(0,2,4),(0,4,6),(1,7,5),(1,5,3),(0,1,2),(2,3,4),(4,5,6),(6,7,0),(1,0,7),(3,2,1),(5,4,3),(7,6,5)]
    corner=[];tex=[]
    for i,face in enumerate(faces):
        a,b,d=[verts[j] for j in face]
        fn=(b-a).cross(d-a)
        if fn.dot((a+b+d)/3-c)<0:face=tuple(reversed(face));faces[i]=face;fn=-fn
        sign=1 if fn.dot(n)>0 else -1
        corner.append([tuple((n*sign+u*xy[j][0]*.14+v*xy[j][1]*.20).normalized()) for j in face])
        tex.append([((151+xy[j][0]*25+xy[j][1]*27)/512,1-(51-xy[j][0]*35+xy[j][1]*20)/512) for j in face])
    colors=[linear(tuple(round(value*(.98-.05*abs(y)-.02*max(0,-x))) for value in color)) for x,y in xy]
    if emit:self.add([tuple(p) for p in verts],faces,colors,face_uv=tex,corner_normals=corner)
    return verts
''' + source[end:]
replace('for j in range(2 if i<3 else 1):','for j in range(3 if i<3 else 2):')
replace('assert len(sprays)==15','assert len(sprays)==21')
replace('sprays.append((points[1].lerp(points[2],.48),points[2],points[3],i))',
        'sprays.append((points[0].lerp(points[1],.70),points[2],points[3],i))')
replace('t = .38+j*.24','t = .18+j*.24')
replace('math.sin(angle)*.19,.12-j*.11','math.sin(angle)*.19,.16-j*.06')
replace('for pair in range(8):','for pair in range(10):')
replace('t=.10+pair*.115','t=.08+pair*.09')
replace('pair*1.71+.24*math.sin(si*1.8+pair)','pair*1.35+.24*math.sin(si*1.8+pair)')
replace('length=rng.uniform(.079,.112)*(1-.27*t)','length=rng.uniform(.067,.090)*(1-.20*t)')
replace('width=length*rng.uniform(.40,.51)','width=length*rng.uniform(.49,.62)')
replace('light=.86+.10*t+.04*math.sin(si*1.7)','light=.85+.10*t+.04*math.sin(si*1.7)')
replace('base=((132,161,66),(146,167,72),(157,177,77),(118,151,62))[shoot_id%4]',
        'base=((121,157,68),(132,166,72),(107,146,61),(148,174,78))[shoot_id%4]')
replace('assert len(shrub.f)-leaf_start == 240*24','assert len(shrub.f)-leaf_start == 420*12')
replace('clusters=[tuple(sprays[i][2]) for i in (0,4,7,10,13)]',
        'clusters=[tuple(sprays[i][2]) for i in (0,5,9,14,18)]')
start=source.index('        if BRANCH_SPRAYS:\n            # A continuous five-lobed corolla')
end=source.index('assert len(shrub.f)-flower_start == 20*56',start)
source=source[:start]+'''        # Three small rounded florets replace each large isolated corolla.
        # They share the opaque material; no alpha cards or separate eyes.
        for floret in range(3):
            phase=floret*math.tau/3+k*.73+h*.46
            pc=center+(u*math.cos(phase)+v*math.sin(phase))*.026
            radius=(.035,.031,.033)[floret]
            ring=[pc+(u*math.cos(phase+i*math.tau/6)+v*math.sin(phase+i*math.tau/6))*radius for i in range(6)]
            vertices=ring+[pc+normal*radius*.34,pc-normal*radius*.12]
            faces=[];corner=[]
            for edge in range(6):
                for sign,face in [(1,(6,edge,(edge+1)%6)),(-1,(7,(edge+1)%6,edge))]:
                    faces.append(face)
                    corner.append([tuple((normal*sign+((vertices[vi]-pc)/radius if vi<6 else Vector())*.32).normalized()) for vi in face])
            colors=[linear(tuple(round(t*.95) for t in palettes[k]))]*6+[linear(palettes[k]),linear(tuple(round(t*.72) for t in palettes[k]))]
            shrub.add([tuple(p) for p in vertices],faces,colors,corner_normals=corner)
''' + source[end:]
replace('assert len(shrub.f)-flower_start == 20*56','assert len(shrub.f)-flower_start == 20*44')
replace('assert record[\'triangles\']==180+branch_triangles+240*24+20*56 and record[\'vertices\']<65536',
        "assert record['triangles']==180+branch_triangles+420*12+20*44 and record['vertices']<65536\nassert record['triangles']<oldrecord['triangles']")
replace("data['planterRevision']='twig-spray-shrub-v114' if BRANCH_SPRAYS else 'rounded-branching-shrub-v114'",
        "data['planterRevision']='fine-layered-shrub-v139'\ndata['source']='Blender 5.2 / tools/stage_berlin_planter_v139.py'")
replace("'leaf_count':240,'flower_heads':20,'flower_clusters':5", "'leaf_count':420,'flower_heads':60,'flower_clusters':5")
replace("'twigs':9 if BRANCH_SPRAYS else 8", "'twigs':15")
source=source.replace('tools/stage_berlin_planter_forms_v114.py','tools/stage_berlin_planter_v139.py')
source=source.replace('LAYERED_PLANTER_COMPLETE','LAYERED_PLANTER_V139_COMPLETE')
stage=ROOT/'audit/berlin-parity-v139'
stage.mkdir(parents=True,exist_ok=True)
(stage/'resolved-recipe.py').write_text(source)
exec(compile(source,str(ROOT/'tools/stage_berlin_planter_forms_v114.py'),'exec'),globals())
