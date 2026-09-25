# Berlin Runner graphics and performance

## September 9 lossless hero delivery

- Hero v13 replaces the embedded 2048-square PNG atlas with lossless WebP.
  The GLB falls from 7,894,504 to 6,682,576 bytes: 1,211,928 bytes (15.35%)
  less to transfer. Every decoded RGBA pixel remains identical. Resolution,
  GPU texture memory, geometry, skinning and all 15 animations are unchanged.
- The bundled Three r156 loader now recognizes `EXT_texture_webp`, tests a
  lossless VP8L image and rejects failed atlas decodes. Primary load failure
  retries the original PNG model, including its local inline companion on
  `file://`. The retry validates the skinned body's atlas before activation;
  a missing PNG map retains the existing procedural fallback.
- Head preload, runtime loader and service-worker v51 use the same v13 URL.
  The v13 inline companion contains exactly the same GLB bytes. The original
  v12 files remain available and are requested only on fallback.
- `tools/compress_hero_webp.py --check` verifies every decoded pixel, all 390
  non-image bufferViews, unrelated glTF JSON and inline bytes. The courier
  fixture now pins the shipped WebP atlas. `check_berlin_hero_loading.cjs`
  exercises supported/unsupported decoders, null atlas results, HTTP/file
  retries and delivery URL agreement. Graphics/courier/performance checks pass.

Phone-sized browser inspection reports `heroTextureFormat=image/webp`, with
the painted authored character present in `audit/berlin-quality-lossless-phone-v20.png`.
Independent review found no discernible visual regression from v19 and accepted
the decoder failure handling after both null-map paths were covered. The browser
viewport override did not change the observed 390-by-844 canvas during this pass,
so no new desktop screenshot or desktop timing claim is made here.
This is a transfer-size improvement, not a measured frame-rate increase.
The browser security policy blocks direct `file://` navigation; the standalone
companion and fallback path were checked through bytes and code tests instead.
Physical iPhone performance remains unverified.

## September 9 ground color hierarchy

- Cooler, darker asphalt and warm stone give the tram bed a continuous visual
  path toward the gates. Asphalt has fewer and fainter aggregate flecks and
  tonal patches. Tighter cobblestone joints, lower grain and shallower normal
  relief keep the paving subordinate to the character.
- The central bed uses an independent material with a warm emissive floor so
  building shadows retain its color. Gutters have a quieter tint. Both materials
  share the same base, normal and roughness textures; the cel callback is
  reapplied after cloning because Three.js does not copy shader callbacks.
- There are no added draws or texture resources. The road and cobble texture
  families remain approximately 5 MiB including mipmaps, shared across chunks.
  The clone retains the same cel shader program key. Service-worker v50 serves
  the updated art and materials.

Independent review accepted `audit/berlin-quality-ground-phone-v19.png` for the
foreground hierarchy and character separation. The material-sharing regression
uses the embedded Three r156 implementation and verifies texture identity,
independent palette uniforms, shader equivalence and callback chaining. All
graphics, courier and performance checks pass. Browser launch/visual checks
cover phone-sized and desktop viewports; physical iPhone performance remains
unverified.

## September 9 crossing corner silhouettes

- Two existing buildings now frame each open crossing from the approach side,
  with staggered 11 m frontages, broad angled bays and matching cornices. The
  viaduct sits at the crossing center, behind these foreground edges. This
  restores architecture that the old intersection gap rejected entirely.
- The bay variant shares one 12-triangle geometry (about 840 bytes of buffers),
  existing facade materials and the existing projection/cornice pools. It needs
  no new texture. Activating the previously hidden corner buildings adds their
  normal facade/detail work; the effect is limited to two crossing frontages.
- Ordinary blocks retain their original bay footprint. Crossing tree crowns
  clear the new overhangs, and the approach lamp sits ahead of the projected bay.
  The enlarged cornices retain 0.598 m minimum asphalt clearance; both corner
  footprints remain outside the full 18 m crossing opening.
- Service-worker v49 serves the combined update.

Independent phone-frame review accepted the enclosure in
`audit/berlin-quality-corners-phone-v16.png`, while explicitly retaining the
gap to the reference game's overall art quality. The final desktop inspection
checked nearby scenery after clearing tree/lamp intersections. The game ran
past the crossing without reported console errors. Graphics regressions cover
the actual bay and pooled-cap transforms, normals, crossing/road clearance,
ordinary and hidden reuse, canopy exclusion and lamp placement. Courier and
performance checks also pass. These are browser checks, not physical iPhone
GPU or thermal measurements.

## September 8 garment construction

- Cream wrist cuffs and a bottom shirt band match the cap brim and distinguish
  the red top from the hands and jeans at phone size. The trim uses the existing
  skinned surface and texture sample, with no additional draw, triangle or texture.
- Wrist distances follow the authored forearm axes. The hem follows the actual
  shirt/denim atlas boundary, rather than the pelvis skin-weight boundary; a
  red-cloth color gate excludes the blue trousers and skin.
- Service-worker v48 delivers the updated character material. The canvas reports
  `garment-edge-v6` alongside the existing rendering diagnostics. Its static
  two-component attribute occupies 93,560 bytes for the 11,695 source vertices.

The courier check samples the actual rear surface and atlas boundary across five
columns, verifies both cuffs and protected hands/trousers, and exercises 35
authored poses. The graphics and performance checks also pass. Independent
in-game review accepted `audit/berlin-quality-garment-edge-v13.png` at 390 x 844;
the live jump check keeps the trim attached and the character inside the frame.
Physical iPhone performance remains unverified.

## September 8 kiosk landmark and startup cost

- A Blender-authored rooftop coffee cup gives the Kiez Kaffee kiosk a rounded,
  recognizable silhouette: cream cup, coral sleeve, teal lid and steam curves.
  Source: `tools/build_berlin_coffee_sign.py`. Deliverables are
  `models/berlin-coffee-sign-v1.glb` and its synchronous `.mesh.js` companion.
  The game uses the companion so the same geometry works over HTTP and file://.
- One mesh/material, 1,492 triangles, 1,064 vertices, no texture. The companion
  is 73,529 bytes uncompressed; decoded shared GPU buffers total 37,680 bytes.
  Each visible kiosk adds one beauty submission and no shadow submission.
  The shipped prop compactor preserves the shared geometry without duplication.
- Parked vehicles now reserve visible street-fixture footprints, accounting for
  rotation and scale. Trees and lamps reserve only their solid bases. This fixes
  the observed parked car intersecting the kiosk while retaining free curb space
  on the opposite side and beside props set farther back from the road.
- Shader preparation gathers only reachable instance-color variants. The HDR
  warm-up draw uses an 8 × 8 target with matching format/type/color space, plus a
  reduced temporary shadow map. Gameplay targets and shadow resolution stay at
  their selected quality. Temporary targets and instance buffers are disposed.
- Service-worker v47 precaches the new companion and delivers the combined build.

The actual mesh decoder passes bounds, index, color and normal checks. Parking
regressions cover rotated fixtures, chunk offsets, inactive variants and free
curb space. Shader preparation checks cover skinning, hidden objects, depth
programs, instance-color shapes, resource cleanup and the direct-render fallback.
On one desktop reload, phase diagnostics reported 173.2 ms gather, 175.0 ms
compile, 202.0 ms depth and 621.4 ms total preparation; browser shader caches may
affect these figures. This is not a first-load or physical iPhone benchmark.
The rooftop sign was accepted by independent in-game review, and a later live
frame verified the kiosk was clear of parked cars without console errors.

## September 7 footwear, pickups and building profiles

- Broader sneakers preserve all sole heights, skin weights and joints. A
  bind-space underside mask adds charcoal rubber and five broad tread pads
  through the existing material, preserving red uppers and the midsole walls.
  No extra texture or draw; the added vec2 attribute is static after loading.
- Pretzels are 16% larger and rock through ±0.58 radians instead of repeatedly
  turning edge-on. Their tighter, fainter halo keeps attention on the crust and
  three openings. Pickup logic, shared geometry and instance batching remain.
- Existing bay windows have deeper angled cheeks and occur on five-storey
  buildings as well. Their caps match the new footprint; balcony stacks begin
  on lower floors. Each bay remains 12 triangles and uses existing materials.
- Service-worker v46 serves this combined pass.

Validation uses the actual GLB over 35 authored run/jump/land/roll/lane poses,
including symmetric underside coverage and preservation of sole heights.
The bay check verifies unit normals, sidewalk setback and unchanged triangle
budget. The live material compiled without reported browser errors. Independent
in-game review accepted the footwear and deeper bay profiles; portrait jumping
was rechecked. Reference comparison still favors the reference game's overall art
direction and large shape design, so these changes are progress toward that bar.

## September 7 framing, surface and instance refinement

- Foot-anchored visual rig scale increased from 0.77 to 0.90. Landscape slide
  and portrait jump stay fully contained; physics and bone animation are unchanged.
- Cobblestone joints, stone variation and bevel highlights have lower contrast.
  The speed ribbon is narrower, with peak alpha reduced from 0.55 to 0.16.
- Facade joinery blends toward warm limestone; thinner window muntins and
  quieter glass reflections reduce repetitive bright grids at medium distance.
- Identical opaque street-lamp parts share per-chunk instance batches, saving
  four beauty draws per visible pair. Glass, light cones and flags retain their
  independent nodes and visibility. Matrices change only on chunk rerolls.
- Four-tree groves share rigid instance batches: 16 to 4 beauty submissions
  and 8 to 2 caster submissions when all four are visible. Existing tree culling,
  geometry, vertex colors and materials are preserved; only visibility changes
  and chunk rerolls rewrite matrices. Optional GLB trees bypass this path.
- Service-worker v45 delivers the combined refinement to existing installations.
- Collectible transforms upload only active instance prefixes. A removed outline
  counter left in reset caused a live startup error; it is now removed, both
  pools reset to empty/hidden, and a strict-mode reset regression covers it.

The painted sunset was verified at route distance 1,488 m, phase `1>2:0.000`:
`audit/berlin-quality-sunset-v5.png`. The corrected browser run reported no
console errors. One portrait sample showed 424 calls, 611,031 triangles and a
16.67 ms frame EMA at scale 1.00. This is desktop browser emulation, not an iPhone
GPU or sustained thermal benchmark.

The combined build, including tree batches, was reloaded and played at
1280 × 800 and rotated to 390 × 844 without reported console errors. Graphics,
courier and performance checks pass, including exact grove geometry/transforms,
visibility transitions, recycling, active uploads and the optional asset path.
Independent in-game review accepted the facade/ribbon changes and portrait
jump containment. These acceptance checks do not claim reference-game parity.

## Painted sunset and tunnel entrance

The sunset plate now matches the sculpted cloud language of the daytime sky.
It replaces the second sky texture in the existing two-sampler cross-fade;
there is no new render pass. Both painted plates retain procedural fallbacks.
The new PNG is also bundled in the file:// companion and service-worker v44.

The tunnel's exterior arch and posts use teal enamel, with a narrow cream
edge batched into the existing stone work. Interior soot materials stay dark,
separating the lit entrance from the recessed interior.

Generated asset: `img/berlin-sunset-sky-v2.png`, 1536 × 1024, 1,519,950 bytes.
Created with the built-in image_gen tool and copied unchanged into the project.

Generation prompt:

> Use case: stylized-concept. Create one production-ready sky texture for a
> premium stylized 3D mobile endless runner set in Berlin. Wide 3:2 landscape
> bitmap, 1536 x 1024 if available. SKY ONLY, absolutely no ground, buildings,
> horizon silhouettes, text, borders, sun disk or objects. Warm summer sunset:
> soft rich periwinkle blue at the very top smoothly transitioning through clear
> rose pink in the middle to luminous pale peach near the bottom. A few beautifully
> sculpted fluffy cumulus clusters with polished three-dimensional volumes,
> peach-gold sunlit tops and restrained lavender shaded undersides. Clean animated
> feature-film art, rounded broad cloud shapes, smooth subtle gradients, crisp
> soft contours. Avoid flat vector cloud discs, heavy purple outlines, photographic
> noise and busy tiny detail. Composition: generous clear negative space in middle
> 50 percent, cloud clusters gathered asymmetrically in upper left and right
> thirds; a few small distant cloudlets below; lowest 20 percent almost cloudless
> pale peach haze. Clouds occupy only about 25 percent of image. Match a cheerful
> high-quality arcade game art direction. Left and right borders should be plain
> matching gradient sky so horizontal mirrored tiling is unobtrusive. Light from
> upper left. This will be used on a sky dome, not as concept art: deliver only
> the texture.

## September 7 runner and framing pass

- Fuller arms, legs, head, hands and sneakers, with a consistent red sleeve on
  both sides. The refinement runs once on a geometry clone at load time; source
  GLB data, bone lengths, weights, sole height and animation clips stay intact.
  No extra character draw calls or texture downloads; seven accessory batches.
- Raised chase camera for clearer approaching hazards, with landscape dolly
  compensation and a gentler slide zoom to keep the full runner in frame.
- Four Berlin station nameboards share a single 1024 × 512 enamel atlas painted
  in the existing canvas art system. Enlarged pier plaques remain in the same
  material batch. Courtyard silhouettes add one 48-triangle draw per open chunk.
- Short landscape launch screens use two columns so the start button, deck and
  speed choices all fit. The landscape quiz banner is more compact.
- Effect-only quality changes avoid canvas/depth-buffer reallocation. Rotation
  commits dimensions and DPR together and preserves the current quality domain
  when the available resolution steps change.
- Traffic updates use a 30 Hz clock; shadow refresh uses 10/7.5/5 Hz clocks
  according to quality. High-refresh screens no longer multiply that work.
- Service-worker cache v43 delivers the updated game to existing installations.

Validation: graphics, courier and performance checks pass. The courier check
uses the actual GLB to verify finite vertices/normals, sleeve coverage, unchanged
skin weights and skeleton, sole contact and accessory attachment. Performance
checks cover buffer allocation, rotation, quality-tier remapping and presentation
and work cadence through 144 Hz. Browser checks cover 390 × 844 portrait,
844 × 390 landscape and 1280 × 800 desktop, including gameplay, jump, slide,
HUD and launch-card bounds, without reported JavaScript/shader errors.

These are browser layout/render checks and deterministic performance regressions,
not physical iPhone GPU or thermal benchmarks. The reference game remains the visual
target; this pass does not claim equivalent production art quality.

## September 2026 rendering polish

- Softer silhouette ink, more directional daylight, and calmer asphalt relief.
- Sculpted foliage with twelve overlapping leaf masses and baked warm/cool
  colour. Canopies share one geometry and material: one foliage draw per tree
  instead of three, and 3,456 triangles instead of 4,320.
- Matte courier fabric, curved shoulder strap, pocket piping, zipper pull and
  transit badge, still within the existing seven accessory material batches.
- Restored desktop MSAA at startup. Phones and reduced-quality desktop frames
  use edge-directed antialiasing in the existing composite, with no extra
  framebuffer or scene submission.
- Enabled the previously disabled adaptive controller. Sustained pressure
  reduces cost; twelve seconds of comfortable frames permits promotion.
  Retries retain measured quality, and resizing rebuilds the available tiers.
- A real 1.25-million-pixel phone / 2.1-million-pixel desktop scene budget,
  including 1x-DPR 4K screens. DOM text retains its native resolution.
- Phone presentation capped at 60 Hz; title/results presentation at 30 Hz.
  Simulation still uses elapsed time and fixed collision steps. Hidden tabs
  skip rendering; GPU context restoration resets stale simulation time.
- Portrait instructions show swipes/taps. The service-worker cache is v42.

No new external assets, dependencies, asset-generation services, or Blender
export are required for this pass. The existing character and painted sky remain.

Validation:

```text
node tools/check_berlin_graphics.cjs
node tools/check_berlin_courier.cjs
node tools/check_berlin_performance.cjs
```

The performance check exercises the actual embedded controller, cadence and
canopy code: 59.94/60/90/120/144 Hz schedules, Retina/4K pixel budgets, sustained
slow frames and recovery, isolated hitches, hidden tabs, resize and context
restoration. These are deterministic logic checks, not device benchmarks.

Browser checks covered 1280 × 800 desktop, 390 × 844 portrait and rotation to
844 × 390 landscape, with no horizontal document overflow. Both desktop MSAA
and phone FXAA rendered with shader diagnostics enabled and no reported shader
errors. Gameplay launch, keyboard lane/jump input and the resized scene were
inspected. Native touch gestures were not emulated by these browser controls.

The browser preview validates rendered output and layout. Its frame counters
include automation and shader-warmup interruptions, so they must not be presented
as sustained iPhone performance. A physical Safari/iPhone session is still needed
to establish thermal stability and a device-specific frame-rate guarantee.

## Existing art and provenance

The game retains its existing Three.js engine, vocabulary decks, controls,
authored character rig and animation clips.

- Painted summer sky with mirrored panorama sampling and horizon haze; the
  existing sunset/night transitions and procedural fallback remain available.
- Stronger warm directional light, cooler ambient fill, deeper contact shading,
  and a higher-resolution reflection environment with cloud and city shapes.
- More irregular, shaded foliage with a consistent upward lighting gradient.
- Teal cap with curved cream brim, raised panel seams, and matching courier bag.
  Accessories use the actual GLB inverse bind matrices and seven material batches.
- Tapered Trabant cabins, sloped glass, curved wheel arches, whitewall tires,
  and more reflective body paint.
- Shared illustrated Kiez Kaffee kiosk mural, authored in Canvas 2D.
- Updated service-worker precache and generated data-URI companion for file://.

## Generated art

File: `img/berlin-summer-sky-v1.png` (1536 × 1024).

Generated with the built-in image_gen tool. Original output was copied into the
project without image editing. The runtime shader handles panoramic projection.
No Gemini assets or additional asset services are required.

Final generation prompt:

> Create a production-ready game sky texture, wide 3:2 landscape image, SKY ONLY with no ground, architecture, text, borders, sun disc, or objects. A beautiful premium stylized 3D animated movie / mobile endless runner summer sky: brilliant cerulean blue at the top, smooth soft pale turquoise blue toward the bottom. A few beautifully sculpted fluffy cumulus cloud clusters with three-dimensional volumes, warm ivory sunlit tops and subtly lavender blue shadowed undersides. Painterly polished digital matte painting, rich clean colors, no noise, no photographic grain, no outlines, no flat vector cloud discs. Composition: generous uninterrupted blue negative space in middle 50 percent; clouds asymmetrically gathered in upper left and right thirds, a few small wisps below; lowest 20 percent almost cloudless pale blue atmospheric horizon. Clouds occupy about 25 percent of image. Broad panoramic feel for mapping to the upper hemisphere of a game sky dome. Edges should be plain matching blue to tile horizontally. Lighting comes from upper left. High quality art asset, crisp smooth contours with soft volumetric shading. Save as image.

## Checks

```text
node tools/check_berlin_graphics.cjs
node tools/check_berlin_courier.cjs
node tools/inline_berlin_art.cjs
```

The courier check reads the real bundled GLB, verifies human-scale bind-space
placement, bone-following motion, unchanged source skin geometry, the seven-draw
accessory budget and the presence of the inline summer sky.

The existing adaptive quality ladder remains enabled. Browser emulation checks
layout and functionality; physical phone GPU performance needs device testing.

Visual checks used 1280 × 800 desktop and 390 × 844 portrait viewports. Gameplay,
lane movement, and airborne accessory fit were inspected; no console errors were
reported. A portrait telemetry sample showed a 19.96 ms frame EMA at render scale
1.00; this is a short desktop-browser sample, not a sustained phone benchmark.
Direct file:// browser navigation was blocked by browser security policy, so
that mode was checked through its inline asset bundle and code tests only.
