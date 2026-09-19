# Berlin garden mesh integration

The current canonical pack combines the V95 layered stone planter with the
V100 broad canopy paint, accepted in the V101 game. Its geometry remains the
V8 street trees and original grove. Use the current rebuild guidance below;
the original procedural builder does not reproduce these later asset passes.

Run `node tools/install_berlin_garden.cjs` to update the existing garden block.
The installer embeds the new packed meshes, atlas and factory and preserves
exactly one shared `decodeBerlinMeshRecord` declaration for architecture too.
No changes to the current tree/planter factories or garden pool writers are
required when updating an already integrated game.

For a fresh integration, embed `assets/models/berlin-kiez-garden-v1.inline.js`, the function from
`tools/berlin_packed_geometry.js`, then `tools/berlin_garden_integration.js`
(strip CommonJS exports) before `makeTree`. All runtime data is embedded;
no additional network requests or GLB loader are needed.

Initialize one shared kit once, after the material factory exists:

```js
var berlinGardenKit = createBerlinGardenKit(THREE, mat, BERLIN_KIEZ_GARDEN_DATA);
```

In `makeTree`, replace trunk, branch, and sculpted canopy creation with:

```js
var tree = new THREE.Mesh(berlinGardenKit.geometry('treeNear'), berlinGardenKit.material);
tree.castShadow = true; tree.receiveShadow = true; g.add(tree);
g.userData.canopyRadius = berlinGardenKit.canopyRadius;
```

Keep existing kerb/grate and `registerProp('tree', g)`. This produces one
shared tree draw within the current chunk/world instance pools. The combined
near street-tree mesh is 13,992 triangles; no material arrays or independent parts.
The current `getStreetTreeFarGeometry` uses the matching 3,996-triangle
`treeStreetFar` record directly. Its AABB and trunk match the near mesh, so it
needs no affine enlargement. Older packs retain the existing fallback path.
The kit reads `streetCanopyRadius: 2.85` from asset metadata, with 2.60 for
older packs. Street instance pools and their existing LOD/culling paths remain
shared; the background grove continues to use its original records below.

For the separate garden layer:

```js
var gardenCrownGeo = berlinGardenKit.geometry('leaves');
var gardenCrowns = new THREE.InstancedMesh(gardenCrownGeo, berlinGardenKit.material, GARDEN_COUNT);
var gardenTrunks = new THREE.InstancedMesh(berlinGardenKit.geometry('trunk'), berlinGardenKit.material, GARDEN_COUNT);
```

Keep the existing `1.95 * p.size` trunk position, beds, frustum bounds,
compaction, and update ranges. Exported trunk vertices are offset by -1.95 m
to preserve this existing convention. Grove trees use 3,492 triangles total.
The leaves already have final painted color: replace `gardenColors` with subtle
near-white tints `[0xffffff,0xf6fff0,0xfffae4,0xf5fff6,0xffffef]` so per-instance
color no longer multiplies them by the former deep green sphere colors.

In `makePlanter`, replace the existing pot and icosahedron parts with one mesh:

```js
var plant = new THREE.Mesh(berlinGardenKit.geometry('planter'), berlinGardenKit.material);
plant.scale.setScalar(0.72); // 1.34 m shop planter, 0.84 m overall foliage width
plant.castShadow = true; plant.receiveShadow = true; g.add(plant);
return registerProp('planter', g);
```

One shared opaque material, front faces only, vertex color and a 512 x 512
JPEG foliage atlas. Each near-canopy leaf is a thin closed solid with split
front/back normals; overlapping leaves form the whole near crown without
hard interior core meshes. The far canopy retains deeply recessed backing
cores. There is no alpha clipping, transparent sorting, or shader wind.
The atlas maps real 3D core surfaces, with a padded white sample
for leaves, wood and pot. It is embedded with the meshes and decoded once
through the game's existing `assetManager`. The factory sets sRGB, mipmaps,
and anisotropy 2. All instances share the same material, atlas and geometry.
Tree/planter source models remain in the editable .blend and
reusable GLB. The .blend hides the grove leaf object, which is retained for
editing, and displays the near tree plus planter.

The accepted v8 near crown uses 1,680 closed eight-face leaves with six
outline corners, arranged through five overlapping asymmetric lobes. Its
street far mesh retains 418 identical leaf anchors and five recessed painted
cores. Both roles share a 552-triangle trunk that preserves the original
foot and forks around 1.9–2.2 m into bent, tapering limbs. Cooler inner leaves
and warmer outer sprays give the crown depth without near backing masses.
V8 adds a shallow leaf bend and distinct curved upper/lower corner normals,
with a narrower painted contrast between adjacent leaves. A stronger main
trunk above 3.2m supports elbowed forks rooted at varied heights from 2.96m
to 5.05m. One lower, elongated crown lobe overlaps the branches. The altered
crown is fitted to the accepted envelope, including inverse-transpose normal
transformation. Leaf counts, triangles, GPU buffers and atlas are unchanged.
Near geometry remains 684,890 bytes. The v6, curved-only v7 and structured v8
sources remain in audit/berlin-garden-lush-v6, berlin-garden-curved-v7 and
berlin-garden-branch-v8 respectively. The generator defaults to v8; explicit
--stage-lush, --stage-curved and --stage-structure reproduce those stages.

Near/far street bounds are exactly min [-2.38530, -0.01708, -2.09675] and
max [2.54874, 8.31450, 1.96202]. The crown floor is 4.67998 m, top 8.31450 m,
and width 4.93404 m. Measured horizontal radius is 2.58 m; metadata supplies
the conservative street radius of 2.85 m. Background `tree`, `leaves` and
`trunk` remain byte-identical to the prior grove assets, at their old size
and with their existing origin conventions.

The historical v79 planter used 6,000 triangles for a chamfered square stone container,
pale rim and soil, six shoots, 22 twig sprays, 496 closed oval leaves and
24 five-petal blush flowers with raised gold centres. The shrub has no green
backing spheres. Larger flower clusters face outward on its exterior. The
180-triangle base retains its topology and UVs, with reshaped positions and
normals. Exact overall bounds remain min [-0.56734, 0, -0.55551],
max [0.59477, 1.85933, 0.52996]. The prior terracotta asset remains in v8 audit.

Authoritative outputs are `assets/models/berlin-kiez-garden-v1.blend`, `.glb`,
`.json`, `.inline.js`, and `berlin-kiez-garden-v1-atlas.jpg`. The near runtime
geometry uses 684,890 bytes, shared once. The JPEG is 93,914 bytes and the
complete inline pack is 2,267,197 bytes; the reusable GLB is 1,402,472 bytes.
The texture source and exact image
generation prompt are documented in `audit/berlin-garden-surface-generation.md`.
Reproduce the current accepted pack and its canopy comparison with:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 2 --python tools/stage_berlin_canopy_paint_v100.py -- --render
node tools/check_berlin_canopy_paint_v100.cjs
```

This opens the immutable V100 baseline, which already contains the accepted
V87 tree paint and V95 planter. It writes matching `.blend`, `.glb`, `.json`,
`.inline.js` and atlas outputs under `audit/berlin-canopy-paint-v100/models/`.
It changes only near/far leaf RGB and preserves the complete planter. Promote
those five outputs to `assets/models/` before running the existing garden
installer. The current preview is
`audit/berlin-canopy-paint-v100/canopy-comparison.png`; measured preservation
and paint results are in that stage's `validation.json`.

For the historical pre-bake geometry and stone planter, the original command is:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 2 --python tools/build_berlin_garden.py -- --render
```

The tree render is `audit/berlin-kiez-garden-v1-preview.png`; the planter
close-up is `audit/berlin-kiez-planter-v6-preview.png`. Measured counts and
bounds are in `audit/berlin-kiez-garden-v1-manifest.json`.
The default builder selects historical v8 street trees and the v79 stone planter,
preserving the original grove records. It resets later V95/V100 work and is
not the current canonical rebuild path. Add `--stage-stone` to stage that
set under `audit/berlin-storefront-stone-v79/`. Historical `--stage-lush`
reproduces the v6 tree/planter set under `audit/berlin-garden-lush-v6/`.
Explicit historical modes `--stage-planter`, `--stage-tetra`,
`--stage-coreless` and `--stage-sprays` retain their v5/v4/v3/v2 recipes and
separate audit folders. The legacy explicit `--flowering-planter` flag still
selects the v5 recipe at canonical paths; omit it for the v8/v79 default.

The accepted v87 canopy pass adds local overlap shading to the v8 street-tree
leaf colors. Its source is `tools/stage_berlin_canopy_depth.py`; outputs and
immutable pre-bake baseline are in `audit/berlin-canopy-depth-v87/`. It changes
only near/far leaf paint, with matching colors on all 418 retained far leaves.
The default garden builder above regenerates the pre-bake geometry and paint;
it does not reproduce this later color pass. Use the staged v87 outputs or
the saved Blender file to retain that historical version. Its complete pack
predates the V95 planter. Never rebake on an already darkened input.

The accepted V100 pass replaces most scalar V87 contrast with broader canopy
color groups: warmer exposed foliage and cooler connected interiors. It uses
48 upward-biased visibility rays per leaf over 2.6 m, with 0.72 m neighbor
grouping and no fixed horizontal sun direction. Area-weighted leaf luminance
changes by only -0.0076%; all 418 retained far leaves copy their near RGB
exactly. Five far cores receive the corresponding local color change. It adds
no runtime shader work, attributes, materials, textures or draws. Geometry,
curved normals, trunks, the full V95 planter and atlas stay byte-identical.
Parent and critic accepted the live V101 opening and approach views; the
approach tree showed coherent darker interiors beneath lighter leaves without
muddy or crushed regions. Evidence:
`audit/berlin-reference-canopy-paint-v101.png`,
`audit/berlin-reference-canopy-paint-approach-v101.png` and
`audit/berlin-garden-validation-v101.log`.

The accepted V102 contour pass rounds 400 exposed leaves and removes 200
deeply concealed leaves. It preserves the 13,992-triangle budget, exact crown
bounds, all 418 far-retained leaves, V100 paint, trunks, planter and atlas.
The shared near geometry falls from 684,890 to 661,690 bytes. Live V103 opening
and approach review found a modest silhouette improvement without visible
thinning; motion aliasing has not been established by those stills.
Current editable source and matching exports are under
`audit/berlin-leaf-contours-v102/models/`, authored with
`tools/stage_berlin_leaf_contours_v102.py`. Copying V100 would undo this pass.

Run `node tools/check_berlin_garden.cjs --lush --curved --stone --canopy-depth --layered-planter --canopy-paint --leaf-contours` to verify decoded geometry, closed
components (welded by position across normal/UV splits), normals, UVs,
triangle budgets, shared texture decoding, GLB material, trunk placement,
the original base topology/UVs, reshaped stone faces and outward closed leaf/flower surfaces.
Before embedding a newly rebuilt asset, `--assets-only` checks its geometry
without requiring the current HTML to contain the new bytes already.
For current staged assets, add `--asset-dir=audit/berlin-leaf-contours-v102/models`.
The explicit `--canopy-depth` flag validates the independent whole-leaf bake
checks and exact shipping payload before allowing its intentional paint change.
The additional `--canopy-paint` flag independently verifies the current
color-only pass and permits only those exact near/far RGB changes. Historical
V87/V95 checks retain their old behavior without this flag. Omit both canopy
flags when validating the historical pre-bake v79 stone stage.
`--leaf-contours` requires `--canopy-paint` and independently verifies the
immutable V100 source, protected geometry, new closed blades and GLB parity
before allowing the exact V102 near payload. Omit it for historical V100.
Caps are 14,000 near triangles, 4,000 street far triangles, 6,800 planter
triangles and 750,000 bytes for the single shared near buffer. Grove budgets
remain unchanged. Keep existing pool and shadow-caster behavior, with the
new measured street bounds and metadata radius used by culling assertions.

Art limitation: this is stylized opaque leaf geometry built against a still
reference. It does not reconstruct invisible branches or identical pixels.
At close range, the reference's leaf softness and organic detail remain
higher; this version removes visible opaque rounded interiors, but the leaves
remain simplified in a close view. V6 was accepted after the live opening
frame `audit/berlin-reference-lush-opening-v69.png` showed fuller, taller crowns
and substantial planter foliage, with layout rays keeping shops clear.
Combined desktop rendering and performance must
be checked in the integrated game; the offline preview is not an FPS test.

The accepted v95 planter replaces only foliage above the original stone pot.
Its taller central shrub and lower spreading shoulders use 640 closed leaves,
seven shoots and five flower clusters (20 heads), totaling 6,698 triangles.
The final outward leaf planes retain the initial candidate's colors while
removing its horizontal stacked appearance. Source:
`tools/stage_berlin_layered_planter_v95.py`; authoritative matching exports:
`audit/berlin-layered-planter-v95/models/`. The pot, exact envelope, V87 tree
records and atlas remained unchanged in that stage. The staged baseline and
initial revision are immutable. V100's later pack preserves this entire
planter. Default regeneration or copying the older V87 pack would lose it;
copying the V95 stage alone would reset the later V100 tree paint. Preserve
the current saved Blender file or use the V100 rebuild above for the full set.
The explicit `--layered-planter` check retains all historical canopy checks
and independently verifies the changed planter and protected payloads.
