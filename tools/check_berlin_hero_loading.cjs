'use strict';
// Exercise the shipped loader's actual branches, including decoder failure.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
const start = html.indexOf('class GLTFTextureWebPExtension {');
const end = html.indexOf('\n/**', start);
let imageCount = 0, supported = true;
class TestImage {
  constructor() { imageCount++; }
  set src(value) {
    assert.ok(Buffer.from(value.split(',')[1], 'base64').includes(Buffer.from('VP8L')), 'probe tests lossless WebP');
    this.width = this.height = supported ? 1 : 0;
    queueMicrotask(() => this.onload());
  }
}
const Extension = new Function('EXTENSIONS', 'Image', html.slice(start, end) + '\nreturn GLTFTextureWebPExtension;')(
  {EXT_TEXTURE_WEBP:'EXT_texture_webp'}, TestImage);
const fallbackStart = html.indexOf('  function loadCourierWithFallback(');
const fallbackEnd = html.indexOf('\n  if (USE_GENERATED_HERO', fallbackStart);
function fallbackFixture(protocol, scriptWorks = true) {
  const globals = {}, scripts = [];
  const document = {createElement: () => ({}), head:{appendChild(script) {
    scripts.push(script.src);
    if (scriptWorks) { globals.BERLIN_RUNNER_HERO_V12_DATA_URI = 'data:png-model'; script.onload(); }
    else script.onerror();
  }}};
  return {scripts, load: new Function('globalThis','location','document',
    html.slice(fallbackStart, fallbackEnd) + '\nreturn loadCourierWithFallback;')(globals,{protocol},document)};
}
(async () => {
  const texture = {name:'decoded atlas'}, defaultLoader = {}, handler = {};
  let decoded = [], pngCalls = 0, imageResult = texture;
  const parser = {
    json: {textures:[{extensions:{EXT_texture_webp:{source:1}}},{source:0}],
      images:[{mimeType:'image/png'},{mimeType:'image/webp',uri:'hero.webp'}], extensionsRequired:['EXT_texture_webp']},
    options:{manager:{getHandler:() => handler}}, textureLoader:defaultLoader,
    loadTextureImage: async (...args) => { decoded.push(args); return imageResult; },
    loadTexture: async () => { pngCalls++; return texture; }
  };
  const ext = new Extension(parser);
  assert.equal(ext.loadTexture(1), null, 'ordinary PNG uses the core loader');
  assert.equal(await ext.loadTexture(0), texture);
  assert.deepEqual(decoded[0], [0,1,handler], 'extension source and URI handler are honored');
  assert.equal(await ext.loadTexture(0), texture);
  assert.equal(imageCount, 1, 'capability probe is cached across textures');
  imageResult = null;
  await assert.rejects(ext.loadTexture(0), /failed to decode/, 'null decode must not become an unpainted hero');
  supported = false;
  const unsupported = new Extension(parser);
  await assert.rejects(unsupported.loadTexture(0), /unsupported/);
  parser.json.extensionsRequired = [];
  assert.equal(await unsupported.loadTexture(0), texture);
  assert.equal(pngCalls,1, 'optional extensions retain the standard PNG fallback');

  for (const protocol of ['https:','file:']) {
    for (const failure of ['none','primary','both','throw','png-null']) {
      const fixture = fallbackFixture(protocol), urls = [];
      let success = 0, errors = 0;
      const loader = {load(url,onLoad,progress,onError) {
        urls.push(url);
        if (urls.length === 1 && failure === 'throw') throw Error('fetch failed');
        if (failure === 'both' || (urls.length === 1 && ['primary','png-null'].includes(failure))) onError();
        else onLoad({scene:{traverse:visit => visit({isSkinnedMesh:true,
          material:{map: failure === 'png-null' ? null : texture}})}});
      }};
      fixture.load(loader,'primary-webp',() => success++,() => errors++);
      assert.equal(urls.length, failure === 'none' ? 1 : 2);
      assert.equal(success, ['both','png-null'].includes(failure) ? 0 : 1);
      assert.equal(errors, ['both','png-null'].includes(failure) ? 1 : 0);
      assert.equal(fixture.scripts.length, protocol === 'file:' && failure !== 'none' ? 1 : 0);
      if (urls.length === 2) assert.equal(urls[1], protocol === 'file:' ? 'data:png-model' :
        'assets/models/berlin-runner-hero-v12.glb?rev=31');
    }
  }
  const failedScript = fallbackFixture('file:', false);
  let errorCount = 0;
  failedScript.load({load:(url,ok,progress,bad) => bad()},'primary',() => assert.fail('unexpected success'),() => errorCount++);
  assert.equal(errorCount,1, 'missing local fallback releases the game to its procedural character');
  const sw = fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
  const primary = 'assets/models/berlin-runner-hero-v13.glb?rev=32';
  assert.ok(html.includes('href="' + primary + '"'));
  assert.ok(html.includes("'" + primary + "', props:"));
  assert.ok(sw.includes('./' + primary));
  assert.ok(html.includes('berlin-runner-hero-v13.inline.js'));
  assert.ok(html.includes('character: globalThis.BERLIN_RUNNER_HERO_V13_DATA_URI'));
  console.log('PASS: lossless WebP source/handler/probe; required, optional and null-decode paths; HTTP/file PNG retry; delivery URLs agree.');
})().catch(error => {console.error(error); process.exitCode=1;});
