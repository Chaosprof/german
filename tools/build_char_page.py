"""Assemble the character-pipeline findings into one self-contained page."""
import base64
import json
import os
import sys

SP = sys.argv[1]
OUT = sys.argv[2]


def uri(path):
    with open(path, 'rb') as fh:
        return 'data:image/webp;base64,' + base64.b64encode(fh.read()).decode()


CAND = os.path.join(SP, 'cand')
STILLS = {}
for tag in ('proc', 'snowboarder', 'm18k', 'gucci'):
    STILLS[tag] = {v: uri(os.path.join(CAND, '%s_%s.webp' % (tag, v)))
                   for v in ('front', 'rear34', 'side')}

RUN = {'proc': {}, 'meshy': {}}
for v in ('rear', 'side'):
    RUN['proc'][v] = [uri(os.path.join(SP, 'ab', 'run_%s_%02d.webp' % (v, i)))
                      for i in range(20)]
    RUN['meshy'][v] = [uri(os.path.join(SP, 'ab2', 'meshy_%s_%02d.webp' % (v, i)))
                       for i in range(20)]

DATA = json.dumps({'stills': STILLS, 'run': RUN}, separators=(',', ':'))

HTML = r'''<title>Hero Asset Teardown</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap">
<style>
:root{
  --bg:#E7E9EC; --surface:#FCFCFD; --sunk:#DDE0E5;
  --ink:#14171C; --muted:#5C636E; --line:#C6CAD1;
  --old:#6B7684; --new:#C24329; --ok:#2F7D5B; --warn:#B4761F;
  --shadow:0 1px 2px rgba(20,23,28,.06),0 8px 24px rgba(20,23,28,.07);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#15171B; --surface:#1D2026; --sunk:#111317;
  --ink:#EDEFF2; --muted:#99A1AD; --line:#31363F;
  --old:#8E99A8; --new:#E2664A; --ok:#5FB98D; --warn:#D69B45;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}}
:root[data-theme="dark"]{
  --bg:#15171B; --surface:#1D2026; --sunk:#111317;
  --ink:#EDEFF2; --muted:#99A1AD; --line:#31363F;
  --old:#8E99A8; --new:#E2664A; --ok:#5FB98D; --warn:#D69B45;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{margin:0; background:var(--bg); color:var(--ink);
  font-family:"Source Sans 3",system-ui,sans-serif; font-size:17px; line-height:1.65;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:980px; margin:0 auto; padding:48px 24px 96px;
  display:flex; flex-direction:column; gap:46px}
h1,h2,h3{font-family:Archivo,system-ui,sans-serif; text-wrap:balance; margin:0}
h1{font-weight:800; font-size:clamp(2rem,5vw,2.9rem); line-height:1.05; letter-spacing:-.022em}
h2{font-weight:700; font-size:1.35rem; letter-spacing:-.012em}
h3{font-weight:700; font-size:.98rem}
p{margin:0; max-width:66ch}
.eyebrow{font-family:"IBM Plex Mono",monospace; font-size:.72rem; font-weight:600;
  letter-spacing:.16em; text-transform:uppercase; color:var(--muted)}
.lede{font-size:1.1rem; color:var(--muted); max-width:64ch}
header,section{display:flex; flex-direction:column; gap:18px}

.grid2{display:grid; grid-template-columns:1fr 1fr; gap:16px}
@media (max-width:680px){.grid2{grid-template-columns:1fr}}
.card{background:var(--surface); border:1px solid var(--line); border-radius:13px;
  overflow:hidden; box-shadow:var(--shadow); display:flex; flex-direction:column}
.card-head{display:flex; align-items:center; gap:9px; padding:12px 15px;
  border-bottom:1px solid var(--line)}
.dot{width:9px;height:9px;border-radius:50%;flex:none}
.card-title{font-family:Archivo,sans-serif; font-weight:700; font-size:.93rem}
.card-sub{font-family:"IBM Plex Mono",monospace; font-size:.7rem; color:var(--muted);
  margin-left:auto}
.shots{display:grid; grid-template-columns:repeat(3,1fr); background:var(--line); gap:1px}
.shots img{display:block; width:100%; height:auto; background:var(--sunk)}
.card-foot{padding:11px 15px; font-size:.88rem; color:var(--muted);
  border-top:1px solid var(--line)}

.viewer .stage{display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line)}
@media (max-width:620px){.viewer .stage{grid-template-columns:1fr}}
.pane{background:var(--sunk); display:flex; flex-direction:column}
.pane img{display:block; width:100%; height:auto}
.controls{display:flex; align-items:center; gap:13px; flex-wrap:wrap;
  padding:14px 15px; border-top:1px solid var(--line)}
button{font:inherit; font-family:Archivo,sans-serif; font-weight:600; font-size:.85rem;
  color:var(--ink); background:var(--surface); border:1px solid var(--line);
  border-radius:8px; padding:7px 14px; cursor:pointer}
button:hover{border-color:var(--muted)}
button:focus-visible{outline:2px solid var(--new); outline-offset:2px}
button[aria-pressed="true"]{background:var(--ink); color:var(--surface); border-color:var(--ink)}
#scrub{flex:1; min-width:140px; accent-color:var(--new)}
.seg{display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden}
.seg button{border:0; border-radius:0}
.seg button+button{border-left:1px solid var(--line)}
.frame-no{font-family:"IBM Plex Mono",monospace; font-size:.78rem; color:var(--muted);
  font-variant-numeric:tabular-nums}

.steps{display:flex; flex-direction:column; gap:0; border:1px solid var(--line);
  border-radius:13px; overflow:hidden; background:var(--surface)}
.step{display:grid; grid-template-columns:auto 1fr auto; gap:16px; align-items:start;
  padding:16px 18px; border-bottom:1px solid var(--line)}
.step:last-child{border-bottom:0}
.step .mark{font-family:"IBM Plex Mono",monospace; font-weight:600; font-size:.95rem;
  width:1.5rem; text-align:center}
.step .body{display:flex; flex-direction:column; gap:3px}
.step p{font-size:.93rem; color:var(--muted)}
.pill{font-family:"IBM Plex Mono",monospace; font-size:.68rem; font-weight:600;
  letter-spacing:.06em; text-transform:uppercase; padding:3px 9px; border-radius:999px;
  white-space:nowrap; align-self:center}
.pass{background:color-mix(in srgb,var(--ok) 16%,transparent); color:var(--ok)}
.fail{background:color-mix(in srgb,var(--new) 16%,transparent); color:var(--new)}
.hold{background:color-mix(in srgb,var(--warn) 18%,transparent); color:var(--warn)}

.stats{display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:13px}
.stat{background:var(--surface); border:1px solid var(--line); border-radius:11px;
  padding:15px 16px; display:flex; flex-direction:column; gap:4px}
.stat .n{font-family:"IBM Plex Mono",monospace; font-size:1.45rem; font-weight:600;
  color:var(--new); font-variant-numeric:tabular-nums; line-height:1}
.stat span{font-size:.85rem; color:var(--muted)}
code{font-family:"IBM Plex Mono",monospace; font-size:.86em; background:var(--sunk);
  padding:1px 5px; border-radius:4px}
.note{border-left:3px solid var(--new); padding:2px 0 2px 15px; color:var(--muted);
  font-size:.95rem; max-width:64ch}
ul{margin:0; padding-left:1.15rem; max-width:66ch; display:flex;
  flex-direction:column; gap:7px}
li::marker{color:var(--muted)}
</style>

<div class="wrap">
<header>
  <span class="eyebrow">Berlin Runner &middot; character pipeline</span>
  <h1>What it takes to replace the hero</h1>
  <p class="lede">The procedural character was never short of geometry &mdash; it was
  short of texture. Here is the current hero against the Meshy asset already in
  your Downloads, how far the Meshy mesh compresses, and exactly where the
  pipeline breaks.</p>
</header>

<section>
  <span class="eyebrow">The gap</span>
  <h2>Same lighting, same camera, same height</h2>
  <div class="grid2">
    <div class="card">
      <div class="card-head">
        <span class="dot" style="background:var(--old)"></span>
        <span class="card-title">Procedural hero</span>
        <span class="card-sub">v11</span>
      </div>
      <div class="shots">
        <img src="" data-still="proc.front" alt="Procedural hero, front">
        <img src="" data-still="proc.side" alt="Procedural hero, side">
        <img src="" data-still="proc.rear34" alt="Procedural hero, rear three-quarter">
      </div>
      <div class="card-foot">47,137 triangles &middot; 2048&sup2; atlas holding
      32 flat swatches, 87.5% of it blank</div>
    </div>
    <div class="card">
      <div class="card-head">
        <span class="dot" style="background:var(--new)"></span>
        <span class="card-title">Meshy character</span>
        <span class="card-sub">decimated</span>
      </div>
      <div class="shots">
        <img src="" data-still="m18k.front" alt="Meshy character, front">
        <img src="" data-still="m18k.side" alt="Meshy character, side">
        <img src="" data-still="m18k.rear34" alt="Meshy character, rear three-quarter">
      </div>
      <div class="card-foot">18,000 triangles &middot; painted 2048&sup2; albedo with
      baked occlusion, knit, stitching, a drawn face</div>
    </div>
  </div>
  <p class="note">Both are lit by the same four-light rig from
  <code>build_hero.py</code>'s preview scene. The difference is entirely in the
  texture: one has painted form-shading, the other has flat colour fields.</p>
</section>

<section>
  <span class="eyebrow">Budget</span>
  <h2>The art survives compression easily</h2>
  <div class="stats">
    <div class="stat"><span class="n">376k</span><span>Meshy's raw output</span></div>
    <div class="stat"><span class="n">&minus;73%</span><span>duplicate shells welded away</span></div>
    <div class="stat"><span class="n">18k</span><span>final, visually identical</span></div>
    <div class="stat"><span class="n">2.6&times;</span><span>lighter than today's hero</span></div>
  </div>
  <p>Meshy exports roughly 98 disconnected shells that overlap heavily. Welding
  at 0.4% of body height collapsed 294k triangles to 78k before a single one was
  decimated away &mdash; three quarters of the mesh was coincident surface nobody
  would ever see. From there, 18k holds up at chase-camera distance with no
  visible loss.</p>
</section>

<section>
  <span class="eyebrow">The rig</span>
  <h2>Your bone names already match Meshy's</h2>
  <p>Meshy's auto-rigger emits <code>Hips</code>, <code>Spine01</code>,
  <code>Spine02</code>, lowercase <code>neck</code>, <code>head_end</code>,
  <code>LeftToeBase</code> &mdash; the exact 23 names in
  <code>build_hero.py:build_armature</code>, oddities included. That is not
  coincidence; the procedural rig was built to Meshy's convention. Every existing
  clip and the retargeted mocap run transfer with no remapping at all.</p>
  <div class="card viewer">
    <div class="stage">
      <div class="pane"><img id="imgA" alt="Procedural hero running"></div>
      <div class="pane"><img id="imgB" alt="Meshy character running"></div>
    </div>
    <div class="controls">
      <button id="play" aria-pressed="false">Play</button>
      <div class="seg" role="group" aria-label="Camera angle">
        <button id="vRear" aria-pressed="false">Rear</button>
        <button id="vSide" aria-pressed="true">Side</button>
      </div>
      <input id="scrub" type="range" min="0" max="19" value="0" step="1"
             aria-label="Cycle position">
      <span class="frame-no" id="fno">00 / 19</span>
    </div>
    <div class="card-foot">Both playing the same retargeted mocap clip. The Meshy
    side is skinned with envelope weights &mdash; watch the jacket smear into
    cones.</div>
  </div>
</section>

<section>
  <span class="eyebrow">Where it stands</span>
  <h2>Four steps, three of them done</h2>
  <div class="steps">
    <div class="step">
      <span class="mark">1</span>
      <div class="body"><h3>Strip the snowboard</h3>
      <p>Removed by shell geometry &mdash; thin plates sitting below the sole
      line. 82,165 triangles gone.</p></div>
      <span class="pill pass">done</span>
    </div>
    <div class="step">
      <span class="mark">2</span>
      <div class="body"><h3>Weld and decimate to budget</h3>
      <p>376k &rarr; 18k with the painted texture intact.</p></div>
      <span class="pill pass">done</span>
    </div>
    <div class="step">
      <span class="mark">3</span>
      <div class="body"><h3>Fit the armature</h3>
      <p>Landmarks measured off the mesh &mdash; crotch at 36% of height,
      shoulders at 54% &mdash; then bones warped through a piecewise height map
      rather than uniformly scaled.</p></div>
      <span class="pill pass">done</span>
    </div>
    <div class="step">
      <span class="mark">4</span>
      <div class="body"><h3>Skin it</h3>
      <p>Blender rejects the mesh: <em>Bone Heat Weighting: failed to find
      solution for one or more bones.</em> Envelope weights are the fallback and
      they smear the jacket. This is the one step left.</p></div>
      <span class="pill fail">blocked</span>
    </div>
  </div>
</section>

<section>
  <span class="eyebrow">The fix</span>
  <h2>Let Meshy do the skinning</h2>
  <p>Bone heat needs watertight, manifold geometry. AI-generated meshes are
  neither &mdash; that is the one genuine weakness of this whole route, and no
  amount of cleanup in Blender reliably fixes it without a full retopology and
  texture rebake.</p>
  <ul>
    <li>Meshy's own auto-rigger handles its own topology. The
    <em>Gucci Monogram Avatar</em> zip in your Downloads proves it: properly
    skinned, correctly animated, and carrying the exact bone names the game
    wants.</li>
    <li>Run the snowboarder through that same rigging step, then the pipeline
    here takes over &mdash; Blender's decimate preserves vertex groups, so the
    order becomes rig first, compress second.</li>
    <li>Better still, generate the Berlin character purpose-built. You now know
    the spec that works: chunky stylised proportions, A-pose, rig in Meshy,
    weld, decimate to ~18k.</li>
  </ul>
  <p class="note">One caveat on the Gucci avatar itself: it is a strong sculpt and
  thematically much closer to a street runner than the snowboarder is, but it
  carries someone else's trademark and cannot ship.</p>
</section>
</div>

<script>
const D = __DATA__;
document.querySelectorAll('[data-still]').forEach(img => {
  const [tag, view] = img.dataset.still.split('.');
  img.src = D.stills[tag][view];
});
const A = document.getElementById('imgA'), B = document.getElementById('imgB');
const scrub = document.getElementById('scrub'), fno = document.getElementById('fno');
const play = document.getElementById('play');
const vRear = document.getElementById('vRear'), vSide = document.getElementById('vSide');
let view = 'side', i = 0, timer = null;

for (const k in D.run) for (const v in D.run[k]) D.run[k][v].forEach(s => {
  const im = new Image(); im.src = s;
});

function draw(){
  A.src = D.run.proc[view][i];
  B.src = D.run.meshy[view][i];
  scrub.value = i;
  fno.textContent = String(i).padStart(2,'0') + ' / 19';
}
function setView(v){
  view = v;
  vRear.setAttribute('aria-pressed', String(v === 'rear'));
  vSide.setAttribute('aria-pressed', String(v === 'side'));
  draw();
}
function stop(){ clearInterval(timer); timer=null;
  play.textContent='Play'; play.setAttribute('aria-pressed','false'); }
function start(){ if(timer) return;
  timer=setInterval(()=>{ i=(i+1)%20; draw(); },55);
  play.textContent='Pause'; play.setAttribute('aria-pressed','true'); }
play.addEventListener('click',()=>timer?stop():start());
vRear.addEventListener('click',()=>setView('rear'));
vSide.addEventListener('click',()=>setView('side'));
scrub.addEventListener('input',()=>{ stop(); i=+scrub.value; draw(); });

draw();
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) start();
</script>
'''

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(HTML.replace('__DATA__', DATA))
print('wrote %s  %.2f MB' % (OUT, os.path.getsize(OUT) / 1e6))
