// Capture the Kiez street panorama the V152 vehicles reflect.
//
//   node tools/capture_berlin_street_env.mjs [out=assets/img/berlin-street-env-v1.jpg]
//
// Serves the repository, seeds the page like the parity fixture (same city as
// the review captures), freezes the opening frame 0.3 s into a run, hides the
// runner, pickups, gates, obstacles and all vehicles, and renders a 512 px cube
// map from the middle of the street (2.2 m up, 20 m ahead of the runner). The
// cube becomes a three.js-convention equirectangular image (u = 0.5 looks down
// +x, u = 0.75 up the street), the thin wires and billboard streaks high in the
// sky are softened, and it is written as a 1024 x 512 sRGB JPEG: the exact
// size vehicleEnvTexture() pre-allocates its PMREM target for.
// Needs puppeteer-core in C:/Users/tamas/node_modules and system Chrome.
import puppeteer from 'file:///C:/Users/tamas/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'assets/img/berlin-street-env-v1.jpg');
const SEED = `<script>let reviewSeed=625341585,reviewThreeSeed=937456173;window.reviewReseed=()=>{reviewSeed=625341585};function reviewRandom(v){let t=Math.imul(v^v>>>15,1|v);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}Math.random=()=>{reviewSeed=reviewSeed+0x6D2B79F5|0;return reviewRandom(reviewSeed)};window.reviewThreeRandom=()=>{reviewThreeSeed=reviewThreeSeed+0x6D2B79F5|0;return reviewRandom(reviewThreeSeed)};
(function(){var n=0,raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(cb){return raf(function(ts){n++;if(n>=150&&!window.__clicked){var s=document.getElementById('start');if(s&&!s.classList.contains('loading')&&document.getElementById('go')){window.__clicked=n;document.getElementById('go').click();}}cb(ts);});};})();
</script>`;
const HOOK = `
  var reviewShot = 0.3, reviewShotElapsed = 0;
  window.__ENV = { frozen: function () { return photoMode; }, capture: function (THREE_) {
    var hidden = [];
    function hide(o) { if (o && o.visible) { o.visible = false; hidden.push(o); } }
    obstacles.forEach(function (o) { hide(o.holder); });
    gates.forEach(function (g) { hide(g.holder || g.group || g.root || g.mesh); });
    hide(rig); hide(trafficRoot);
    parkedCarInst.concat(parkedBusInst).forEach(hide);
    pretzels.forEach(function (p) { hide(p.sprite); });
    if (typeof pretzelSolidInst !== 'undefined') hide(pretzelSolidInst);
    if (typeof pretzelHaloInst !== 'undefined') hide(pretzelHaloInst);
    powerups.forEach(function (p) { hide(p.holder); });
    var rt = new THREE_.WebGLCubeRenderTarget(512, { type: THREE_.HalfFloatType, generateMipmaps: false });
    var cam = new THREE_.CubeCamera(0.05, 4000, rt);
    cam.position.set(0, 2.2, player.z + 20);
    scene.add(cam); cam.update(renderer, scene); scene.remove(cam);
    var W = 2048, H = 1024, eq = new THREE_.WebGLRenderTarget(W, H, { type: THREE_.FloatType });
    var mat = new THREE_.ShaderMaterial({ uniforms: { uCube: { value: rt.texture } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform samplerCube uCube; varying vec2 vUv; void main(){ float th = (vUv.x - 0.5) * 6.2831853; float la = (vUv.y - 0.5) * 3.14159265; gl_FragColor = vec4(textureCube(uCube, vec3(cos(la) * cos(th), sin(la), cos(la) * sin(th))).rgb, 1.0); }' });
    var qs = new THREE_.Scene(); qs.add(new THREE_.Mesh(new THREE_.PlaneGeometry(2, 2), mat));
    var prev = renderer.getRenderTarget();
    renderer.setRenderTarget(eq); renderer.render(qs, new THREE_.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    var px = new Float32Array(W * H * 4); renderer.readRenderTargetPixels(eq, 0, 0, W, H, px);
    renderer.setRenderTarget(prev); hidden.forEach(function (o) { o.visible = true; });
    rt.dispose(); eq.dispose(); mat.dispose();
    function enc(v) { v = Math.max(0, v); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); }
    var full = document.createElement('canvas'); full.width = W; full.height = H;
    var g = full.getContext('2d'), img = g.createImageData(W, H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4;
      img.data[d] = enc(px[s]); img.data[d + 1] = enc(px[s + 1]); img.data[d + 2] = enc(px[s + 2]); img.data[d + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // Soften the upper sky (catenary wires, billboard edges) with a latitude ramp.
    var soft = document.createElement('canvas'); soft.width = W; soft.height = H;
    var sg = soft.getContext('2d'); sg.filter = 'blur(10px)'; sg.drawImage(full, 0, 0);
    var mask = document.createElement('canvas'); mask.width = W; mask.height = H;
    var mg = mask.getContext('2d'), grad = mg.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.25, 'rgba(0,0,0,1)'); grad.addColorStop(0.40, 'rgba(0,0,0,0)');
    mg.drawImage(soft, 0, 0); mg.globalCompositeOperation = 'destination-in'; mg.fillStyle = grad; mg.fillRect(0, 0, W, H);
    g.drawImage(mask, 0, 0);
    var out = document.createElement('canvas'); out.width = 1024; out.height = 512;
    var og = out.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(full, 0, 0, 1024, 512);
    return out.toDataURL('image/jpeg', 0.9);
  } };
`;
let page = fs.readFileSync(path.join(ROOT, 'berlin-runner.html'), 'utf8').replace('<head>', '<head>' + SEED);
page = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, b => b.includes('three.js r156 (MIT)') ? b.replace(/Math\.random/g, 'window.reviewThreeRandom') : b);
page = page.replace('var ladderCeiling = Infinity;', 'var ladderCeiling = 0;').split('ladderCeiling = QUALITY_TIER_MAX').join('ladderCeiling = 0');
for (const [from, to] of [
  ['\n  var groundChunkIdentity = new THREE.Matrix4();', '\n  window.reviewReseed();\n  var groundChunkIdentity = new THREE.Matrix4();'],
  ['\n  function frame(now) {', '\n' + HOOK + '\n  function frame(now) {'],
  ['    if (raw > 0.25) raw = 0.25;', '    if(started){raw=1/60;reviewShotElapsed+=raw;}\n    if (raw > 0.25) raw = 0.25;'],
  ['    var t = now / 1000;', '    var t = started ? reviewShotElapsed : now / 1000;'],
  ['    profileFrame(profileRaw);', '    profileFrame(profileRaw);\n    if(started && !photoMode && reviewShotElapsed+1e-8>=reviewShot){togglePhotoMode();}'],
]) {
  if (page.split(from).length !== 2) throw new Error('anchor not unique: ' + from.slice(0, 60));
  page = page.replace(from, () => to);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/capture.html') { res.writeHead(200, { 'content-type': types['.html'] }); res.end(page); return; }
  if (p === '/sw.js') { res.writeHead(404); res.end(); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p).toLowerCase()] || 'application/octet-stream' }); res.end(d);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  protocolTimeout: 600000, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1280, height: 720 });
await tab.goto(`http://127.0.0.1:${server.address().port}/capture.html`, { waitUntil: 'domcontentloaded', timeout: 240000 });
const t0 = Date.now();
while (!(await tab.evaluate(() => !!(window.__ENV && window.__ENV.frozen())).catch(() => false))) {
  if (Date.now() - t0 > 240000) throw new Error('the opening frame never froze');
  await new Promise(r => setTimeout(r, 250));
}
const uri = await tab.evaluate(() => window.__ENV.capture(window.THREE));
fs.writeFileSync(OUT, Buffer.from(uri.split(',')[1], 'base64'));
console.log('wrote', path.relative(ROOT, OUT), fs.statSync(OUT).size, 'bytes');
await browser.close(); server.close();
