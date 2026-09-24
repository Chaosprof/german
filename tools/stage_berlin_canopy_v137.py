"""Re-author V134 leaves with a restrained thin-sheet normal field.

Reuse the deterministic V134 construction, changing only the two tangent
normal coefficients. Runtime geometry and all other roles must remain exact.
Run with Blender 5.2 in background mode.
"""
import pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v137'
BASE = STAGE / 'baseline'
BASE.mkdir(parents=True, exist_ok=True)
for suffix in ('.json', '.inline.js', '.blend', '.glb', '-atlas.jpg'):
    target = BASE / ('berlin-kiez-garden-v1' + suffix)
    if not target.exists():
        shutil.copyfile(ROOT / 'assets/models' / target.name, target)

source = (ROOT / 'tools/stage_berlin_canopy_v134.py').read_text()
edits = {
    "STAGE = ROOT / 'audit/berlin-parity-v134'":
        "STAGE = ROOT / 'audit/berlin-parity-v137'",
    "BASE, OUT = STAGE / 'baseline', STAGE / 'models'":
        "BASE, OUT = ROOT / 'audit/berlin-parity-v134/baseline', STAGE / 'models'",
    "n*sign+u*xy[j%side_count][0]*.35+v*xy[j%side_count][1]*.55":
        "n*sign+u*xy[j%side_count][0]*.14+v*xy[j%side_count][1]*.20",
    "fine-twig-linden-v134": "thin-sheet-linden-v137",
}
for before, after in edits.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
source = source.replace('tools/stage_berlin_canopy_v134.py', 'tools/stage_berlin_canopy_v137.py')
source = source.replace('Fine clustered linden crown v134', 'Thin-sheet linden crown v137')
source = source.replace('Fine clustered linden crown far v134', 'Thin-sheet linden crown far v137')
source = source.replace('CANOPY_V134_COMPLETE', 'CANOPY_V137_COMPLETE')
exec(compile(source, str(ROOT / 'tools/stage_berlin_canopy_v134.py'), 'exec'), globals())
