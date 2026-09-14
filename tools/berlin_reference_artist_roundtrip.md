# Editing the Blender architecture for the game

Open `assets/models/berlin-reference-architecture-v1.blend`. Preserve each
building object's unique `runtime_key` custom property, its active atlas UV
layer, and its `Color` attribute. The current game uses the 13.5 m bakery and
bookstore with keys `13.5:0:1` and `13.5:1:1` as shared masters.

Edit the mesh, UVs or vertex paint in Blender and save. Modifiers are evaluated
for both runtime meshes and GLB export without destructively applying them in
the saved source. Object transforms arrange the asset sheet: make geometry
changes in Edit Mode, or apply intended object rotation/scale to the mesh.
The sheet's object translations are not baked into game module coordinates.

Re-export the saved `.blend`:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 2 --python tools/reexport_berlin_reference_architecture.py
node tools/check_berlin_reference_glb.cjs
```

This writes the complete runtime JSON and inline data plus the reusable GLB.
The shared conversion retains atlas UVs, baked linear vertex colors,
normalized signed 16-bit normals, and indexed local geometry. GLB export
explicitly maps `Color` to `COLOR_0`. The audit report lists changed modules
and before/after vertex and triangle counts. Existing contact shading is kept;
the re-export step does not rebake it.

After reviewing the asset and coordinating any other HTML edits, install the
two game masters:

```powershell
node tools/install_reference_architecture.cjs
```

Use `build_berlin_reference_architecture.py` only to regenerate the initial
assets from JS source. It is not the artist re-export path: rebuilding replaces
manual Blender edits. Texture-image edits are separate from this mesh round
trip; the game still owns the shared atlas used by these UVs.

## Continuous bakery fabric

The awning candidate in `audit/berlin-awning-v71/models/` replaces only the
`13.5:0:1` bakery master's fabric. Its twelve coral/cream bands share one
closed cloth shell, with a shallow bow, eight-step scallops and a softened
hem. Fabric samples the existing white atlas cell. The old baked fabric had
1,472 triangles; the replacement has 1,756, making the bakery 16,673 triangles
(+284), with one existing material/draw. Openings and the complete module
footprint are unchanged.

The source recipe is in `tools/berlin_kiez_kit.js`. Exported `fabricRanges`
exclude cloth faces from the architecture builder's structural bevel. To
reproduce this candidate without rebuilding protected architecture:

```powershell
node tools/export_kiez_architecture_source.cjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 2 --python tools/stage_berlin_bakery_awning.py -- --render
node tools/check_berlin_awning.cjs
```

The staging script reads the preserved pre-awning Blender/JSON/atlas under
`audit/berlin-awning-v71/baseline/`. Keep that baseline intact after promotion.
Only new cloth passes through Blender; its packed record is spliced into the
original data. All 14,917 other bakery triangles retain exact position,
normal, UV and paint payloads, and the other eleven module records remain
byte-identical. The review `.blend` has identical geometry/UV/paint; Blender's
custom-normal encoding differs by at most 18 signed-normal units, while
shipping protected normals remain exact. No contact shading is rebaked.

`bakery-awning-preview.png` and `validation.json` record the candidate. The
candidate check covers stripe/bow/hem and storefront rays across six
width/side variants, GLB vertex colors, material count and module bounds.
After visual acceptance, copy the matching stage asset files to
`assets/models/`, then run both the Kiez source and reference architecture
installers in the coordinated HTML write window. The full Kiez regression
test's frozen-ground comparison needs an explicit fabric-only exception and
its canopy midpoint should follow the new 4.705 m bow; retain all other
opening/trim checks.
