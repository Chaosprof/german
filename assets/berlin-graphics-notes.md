# Berlin Runner graphics and performance

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
