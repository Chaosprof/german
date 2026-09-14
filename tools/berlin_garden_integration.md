# Berlin garden mesh integration

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

The accepted v6 planter uses 6,000 triangles for the original terracotta pot,
cream rim and soil, six shoots, 22 twig sprays, 496 closed oval leaves and
24 five-petal cream/blush flowers with raised gold centres. The shrub has no
green backing spheres. Flower clusters sit on its exterior. Original pot
geometry and exact planter bounds remain unchanged: min [-0.56734, 0, -0.55551],
max [0.59477, 1.85933, 0.52996].

Authoritative outputs are `assets/models/berlin-kiez-garden-v1.blend`, `.glb`,
`.json`, `.inline.js`, and `berlin-kiez-garden-v1-atlas.jpg`. The near runtime
geometry uses 684,890 bytes, shared once. The JPEG is 93,914 bytes and the
complete inline pack is 2,219,958 bytes; the reusable GLB is 1,394,236 bytes.
The texture source and exact image
generation prompt are documented in `audit/berlin-garden-surface-generation.md`.
Rebuild assets and preview with:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 2 --python tools/build_berlin_garden.py -- --render
```

The tree render is `audit/berlin-kiez-garden-v1-preview.png`; the planter
close-up is `audit/berlin-kiez-planter-v6-preview.png`. Measured counts and
bounds are in `audit/berlin-kiez-garden-v1-manifest.json`.
The default build selects accepted v6 street trees and the v6 flowering
planter, preserving the original grove records. Add `--stage-lush` to write
that current set under `audit/berlin-garden-lush-v6/` before replacing
canonical assets. Explicit historical modes `--stage-planter`, `--stage-tetra`,
`--stage-coreless` and `--stage-sprays` retain their v5/v4/v3/v2 recipes and
separate audit folders. The legacy explicit `--flowering-planter` flag still
selects the v5 recipe at canonical paths; omit it for the accepted v6 default.

Run `node tools/check_berlin_garden.cjs --lush` to verify decoded geometry, closed
components (welded by position across normal/UV splits), normals, UVs,
triangle budgets, shared texture decoding, GLB material, trunk placement,
the original pot bytes and outward closed leaf/flower surfaces.
Before embedding a newly rebuilt asset, `--assets-only` checks its geometry
without requiring the current HTML to contain the new bytes already.
For staged assets, add `--asset-dir=audit/berlin-garden-lush-v6/models`.
Caps are 14,000 near triangles, 4,000 street far triangles, 6,000 planter
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
