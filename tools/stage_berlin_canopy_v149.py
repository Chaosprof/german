"""Stage finer grouped foliage using closed eight-corner leaves.

Rebuild only the two street crowns from the existing deterministic constructor;
preserve the current native source, trunk, background grove, pots and atlas.
The prototype must pass a visual comparison and measured performance gates.
"""
import hashlib, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v149'
BASE = STAGE / 'baseline'
BASE.mkdir(parents=True, exist_ok=True)
for suffix in ('.json', '.inline.js', '.blend', '.glb', '-atlas.jpg'):
    target = BASE / ('berlin-kiez-garden-v1' + suffix)
    if not target.exists():
        shutil.copyfile(ROOT / 'assets/models' / target.name, target)
page = STAGE / 'baseline.html'
if not page.exists():
    current = (ROOT / 'berlin-runner.html').read_bytes()
    assert hashlib.sha256(current).hexdigest() == '865a3301b5878e7d4de039a8ba7f3519e200d9a216cffe823782b8a6af53f484'
    page.write_bytes(current)

source = (ROOT / 'tools/stage_berlin_canopy_v134.py').read_text()
edits = {
    "STAGE = ROOT / 'audit/berlin-parity-v134'": "STAGE = ROOT / 'audit/berlin-parity-v149'",
    'n*sign+u*xy[j%side_count][0]*.35+v*xy[j%side_count][1]*.55':
        'n*sign+u*xy[j%side_count][0]*.14+v*xy[j%side_count][1]*.20',
    'count=round(count*2.00)': 'count=round(count*3.50)',
    'length=(.137+.046*rng.random())*(1-.10*max(0,normal[1]))':
        'length=(.137+.046*rng.random())*(1-.10*max(0,normal[1]))*.78',
    'leaf(p,length*1.85,width*2.10,axis,roll,color,True),j%3==0':
        'leaf(p,length*2.44,width*2.78,axis,roll,color,True),j%5==0',
    "assert near_record['triangles']<=25000 and far_record['triangles']<=4000":
        "assert near_record['triangles']<=44000 and far_record['triangles']<=4000",
    'fine-twig-linden-v134': 'fine-rounded-linden-v149',
}
for before, after in edits.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
source = source.replace('tools/stage_berlin_canopy_v134.py', 'tools/stage_berlin_canopy_v149.py')
source = source.replace('Fine clustered linden crown v134', 'Fine rounded linden crown v149')
source = source.replace('Fine clustered linden crown far v134', 'Fine rounded linden crown far v149')
source = source.replace('CANOPY_V134_COMPLETE', 'CANOPY_V149_COMPLETE')
exec(compile(source, str(ROOT / 'tools/stage_berlin_canopy_v134.py'), 'exec'), globals())
# Keep the existing inline wrapper in sync with the embedded page. The JSON
# source/revision fields describe this canopy; the preserved header also names
# the unchanged planter forms carried by the same asset pack.
inline_name = 'berlin-kiez-garden-v1.inline.js'
marker = b'var BERLIN_KIEZ_GARDEN_DATA'
header = (BASE / inline_name).read_bytes().split(marker, 1)[0]
output = OUT / inline_name
output.write_bytes(header + marker + output.read_bytes().split(marker, 1)[1])
