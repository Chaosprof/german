# Berlin Runner graphics pass

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
