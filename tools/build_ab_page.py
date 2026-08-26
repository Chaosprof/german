"""Assemble the run-cycle A/B frames into a single self-contained page."""
import base64
import json
import os
import sys

SP = sys.argv[1]
OUT = sys.argv[2]
CLIPS = ['run_authored', 'run']
VIEWS = ['rear', 'side']
STEPS = 20

frames = {}
for clip in CLIPS:
    frames[clip] = {}
    for view in VIEWS:
        seq = []
        for i in range(STEPS):
            p = os.path.join(SP, '%s_%s_%02d.webp' % (clip, view, i))
            with open(p, 'rb') as fh:
                seq.append('data:image/webp;base64,'
                           + base64.b64encode(fh.read()).decode('ascii'))
        frames[clip][view] = seq

DATA = json.dumps(frames, separators=(',', ':'))

MEASURE = [
    ('Left foot',  '0.106', '0.993', '0.789', '0.087', '0.843', '0.409'),
    ('Right foot', '0.106', '0.993', '0.789', '0.124', '0.841', '0.324'),
    ('Left hand',  '0.225', '0.272', '0.598', '0.311', '0.486', '0.386'),
    ('Right hand', '0.225', '0.272', '0.598', '0.252', '0.380', '0.386'),
    ('Spine02',    '0.000', '0.180', '0.000', '0.032', '0.016', '0.064'),
    ('Head',       '0.000', '0.179', '0.000', '0.049', '0.047', '0.063'),
    ('Hips',       '0.001', '0.180', '0.000', '0.017', '0.014', '0.066'),
]

rows = '\n'.join(
    '<tr><th scope="row">{0}</th>'
    '<td>{1}</td><td>{2}</td><td class="hi">{3}</td>'
    '<td>{4}</td><td>{5}</td><td class="hi">{6}</td></tr>'.format(*r)
    for r in MEASURE)

HTML = r'''<title>Run Cycle Dailies</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Mono:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap">
<style>
:root{
  --bg:#E7E9EC; --surface:#FCFCFD; --sunk:#DDE0E5;
  --ink:#14171C; --muted:#5C636E; --line:#C6CAD1;
  --authored:#6B7684; --mocap:#C24329; --ok:#2F7D5B;
  --shadow:0 1px 2px rgba(20,23,28,.06),0 8px 24px rgba(20,23,28,.07);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#15171B; --surface:#1D2026; --sunk:#111317;
    --ink:#EDEFF2; --muted:#99A1AD; --line:#31363F;
    --authored:#8E99A8; --mocap:#E2664A; --ok:#5FB98D;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"]{
  --bg:#15171B; --surface:#1D2026; --sunk:#111317;
  --ink:#EDEFF2; --muted:#99A1AD; --line:#31363F;
  --authored:#8E99A8; --mocap:#E2664A; --ok:#5FB98D;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:"Source Sans 3",system-ui,sans-serif; font-size:17px; line-height:1.65;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:960px; margin:0 auto; padding:48px 24px 96px;
  display:flex; flex-direction:column; gap:44px}
h1,h2,h3{font-family:Archivo,system-ui,sans-serif; text-wrap:balance; margin:0}
h1{font-weight:800; font-size:clamp(2rem,5vw,2.9rem); line-height:1.05; letter-spacing:-.022em}
h2{font-weight:700; font-size:1.35rem; letter-spacing:-.012em}
h3{font-weight:700; font-size:1rem; letter-spacing:-.006em}
p{margin:0; max-width:66ch}
.eyebrow{font-family:"IBM Plex Mono",monospace; font-size:.72rem; font-weight:600;
  letter-spacing:.16em; text-transform:uppercase; color:var(--muted)}
.lede{font-size:1.1rem; color:var(--muted); max-width:64ch}
header{display:flex; flex-direction:column; gap:14px}
section{display:flex; flex-direction:column; gap:18px}

/* ---- viewer ---- */
.viewer{background:var(--surface); border:1px solid var(--line); border-radius:14px;
  box-shadow:var(--shadow); overflow:hidden}
.stage{display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line)}
@media (max-width:620px){.stage{grid-template-columns:1fr}}
.pane{background:var(--sunk); display:flex; flex-direction:column}
.pane-head{display:flex; align-items:center; gap:9px; padding:12px 16px;
  border-bottom:1px solid var(--line); background:var(--surface)}
.dot{width:9px; height:9px; border-radius:50%; flex:none}
.pane-title{font-family:Archivo,sans-serif; font-weight:700; font-size:.94rem}
.pane-sub{font-family:"IBM Plex Mono",monospace; font-size:.7rem; color:var(--muted);
  margin-left:auto; letter-spacing:.04em}
.pane img{display:block; width:100%; height:auto; image-rendering:auto}
.controls{display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:14px 16px; border-top:1px solid var(--line); background:var(--surface)}
button{font:inherit; font-family:Archivo,sans-serif; font-weight:600; font-size:.86rem;
  color:var(--ink); background:var(--surface); border:1px solid var(--line);
  border-radius:8px; padding:7px 15px; cursor:pointer}
button:hover{border-color:var(--muted)}
button:focus-visible{outline:2px solid var(--mocap); outline-offset:2px}
button[aria-pressed="true"]{background:var(--ink); color:var(--surface); border-color:var(--ink)}
#scrub{flex:1; min-width:150px; accent-color:var(--mocap)}
#scrub:focus-visible{outline:2px solid var(--mocap); outline-offset:3px}
.frame-no{font-family:"IBM Plex Mono",monospace; font-size:.78rem; color:var(--muted);
  font-variant-numeric:tabular-nums}
.seg{display:flex; gap:0; border:1px solid var(--line); border-radius:8px; overflow:hidden}
.seg button{border:0; border-radius:0; padding:7px 13px}
.seg button+button{border-left:1px solid var(--line)}

/* ---- findings ---- */
.findings{display:grid; grid-template-columns:repeat(auto-fit,minmax(215px,1fr)); gap:14px}
.card{background:var(--surface); border:1px solid var(--line); border-radius:12px;
  padding:17px 18px; display:flex; flex-direction:column; gap:7px}
.card .n{font-family:"IBM Plex Mono",monospace; font-size:1.5rem; font-weight:600;
  color:var(--mocap); font-variant-numeric:tabular-nums; line-height:1}
.card p{font-size:.93rem; color:var(--muted)}

/* ---- table ---- */
.scroller{overflow-x:auto; border:1px solid var(--line); border-radius:12px;
  background:var(--surface)}
table{border-collapse:collapse; width:100%; min-width:560px; font-size:.88rem}
caption{text-align:left; padding:14px 16px 0; color:var(--muted); font-size:.86rem}
th,td{padding:9px 14px; text-align:right; font-variant-numeric:tabular-nums;
  font-family:"IBM Plex Mono",monospace; border-bottom:1px solid var(--line)}
thead th{font-family:Archivo,sans-serif; font-weight:700; font-size:.76rem;
  letter-spacing:.05em; text-transform:uppercase; color:var(--muted)}
tbody th{text-align:left; font-family:"Source Sans 3",sans-serif; font-weight:600}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
td.hi{font-weight:600; color:var(--ink)}
.grp{border-left:1px solid var(--line)}
.sw{display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:6px}

ul{margin:0; padding-left:1.15rem; max-width:66ch; display:flex;
  flex-direction:column; gap:8px}
li::marker{color:var(--muted)}
code{font-family:"IBM Plex Mono",monospace; font-size:.86em;
  background:var(--sunk); padding:1px 5px; border-radius:4px}
.note{border-left:3px solid var(--mocap); padding:2px 0 2px 15px; color:var(--muted);
  font-size:.95rem; max-width:64ch}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
<header>
  <span class="eyebrow">Berlin Runner &middot; hero v11</span>
  <h1>Authored keyframes vs. retargeted mocap</h1>
  <p class="lede">The same 23-bone rig, the same 0.5&thinsp;s cycle, phase-locked frame
  for frame. Left is the hand-authored run from <code>tools/hero_actions.py</code>;
  right is a Mixamo run cycle retargeted onto the rig with no change to the mesh.</p>
</header>

<section>
  <div class="viewer">
    <div class="stage">
      <div class="pane">
        <div class="pane-head">
          <span class="dot" style="background:var(--authored)"></span>
          <span class="pane-title">Authored</span>
          <span class="pane-sub">hero_actions.py</span>
        </div>
        <img id="imgA" alt="Authored run cycle">
      </div>
      <div class="pane">
        <div class="pane-head">
          <span class="dot" style="background:var(--mocap)"></span>
          <span class="pane-title">Mocap</span>
          <span class="pane-sub">retargeted</span>
        </div>
        <img id="imgB" alt="Retargeted mocap run cycle">
      </div>
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
  </div>
  <p class="note">Rear is what the chase camera shows in game; side is where a run
  cycle actually reads. Scrub slowly through the side view &mdash; the tell is the
  torso, not the legs.</p>
</section>

<section>
  <span class="eyebrow">What the numbers say</span>
  <h2>Three defects that keyframes can't easily avoid</h2>
  <div class="findings">
    <div class="card">
      <span class="n">0.000</span>
      <h3>A rigid torso</h3>
      <p>Authored <code>Spine02</code> and <code>Head</code> travel exactly zero
      laterally and vertically. The limbs swing on a mannequin that never
      counter-rotates.</p>
    </div>
    <div class="card">
      <span class="n">&plusmn;0</span>
      <h3>Mirror-perfect sides</h3>
      <p>Left and right foot travel match to three decimals, as do the hands.
      Real gait is never symmetric; the eye reads the symmetry as mechanical.</p>
    </div>
    <div class="card">
      <span class="n">1.9&times;</span>
      <h3>Overdriven feet, no bob</h3>
      <p>Feet lift nearly twice as high as mocap, while the hips bob
      <em>zero</em> vertically and instead slide 0.18&thinsp;m fore-and-aft.</p>
    </div>
  </div>
</section>

<section>
  <span class="eyebrow">Measurement</span>
  <h2>World-space joint travel over one cycle</h2>
  <div class="scroller">
    <table>
      <caption>Metres, sampled at 24 points across the cycle.
      <strong>z</strong> is vertical.</caption>
      <thead>
        <tr>
          <th scope="col">Joint</th>
          <th scope="col" colspan="3"><span class="sw" style="background:var(--authored)"></span>Authored</th>
          <th scope="col" colspan="3" class="grp"><span class="sw" style="background:var(--mocap)"></span>Mocap</th>
        </tr>
        <tr>
          <th scope="col"></th>
          <th scope="col">x</th><th scope="col">y</th><th scope="col">z</th>
          <th scope="col" class="grp">x</th><th scope="col">y</th><th scope="col">z</th>
        </tr>
      </thead>
      <tbody>
__ROWS__
      </tbody>
    </table>
  </div>
</section>

<section>
  <span class="eyebrow">How it works</span>
  <h2>Why the rig accepted this without edits</h2>
  <p><code>build_hero.py</code> already names its 23 bones the way Mixamo does &mdash;
  <code>Hips</code>, <code>Spine01/02</code>, <code>LeftForeArm</code>,
  <code>LeftToeBase</code>. The mapping is a rename table. What the two rigs do
  <em>not</em> share is the rest pose, and that is the whole difficulty:</p>
  <ul>
    <li>Mixamo binds in a <strong>T-pose</strong>; the hero binds with
    <strong>arms straight down</strong>. A plain delta-from-rest transfer drives the
    arms a further 90&deg; past &ldquo;down&rdquo;, backwards through the torso.</li>
    <li>The fix is to align the rest poses first: rotate each source rest bone
    direction onto the target's, then transfer the delta relative to
    <em>that</em>. Source T-pose then maps to target T-pose, and source
    arms-hanging maps to the hero's own rest &mdash; both ends check out.</li>
    <li>Bone <em>directions</em> have to come from joint head positions. glTF has
    no bone tails, so Blender invents them, and for Mixamo exports it gets them
    badly wrong &mdash; every bone arrives pointing +Z with lengths in the
    thousands.</li>
    <li>Hips keep their vertical bob only. Forward and lateral drift are stripped,
    because gameplay owns the collision root.</li>
  </ul>
  <p class="note">The game needs no JavaScript change: it already plays
  <code>run</code> as a raw absolute clip and converts only the other clips to
  additive at load. The mesh is untouched &mdash; 47,137 triangles either way.</p>
</section>
</div>

<script>
const F = __DATA__;
const A = document.getElementById('imgA'), B = document.getElementById('imgB');
const scrub = document.getElementById('scrub'), fno = document.getElementById('fno');
const play = document.getElementById('play');
const vRear = document.getElementById('vRear'), vSide = document.getElementById('vSide');
let view = 'side', i = 0, timer = null;

// Decode every frame up front: a flipbook that fetches mid-playback stutters
// on the first pass through the cycle.
for (const clip in F) for (const v in F[clip]) F[clip][v].forEach(src => {
  const im = new Image(); im.src = src;
});

function draw(){
  A.src = F.run_authored[view][i];
  B.src = F.run[view][i];
  scrub.value = i;
  fno.textContent = String(i).padStart(2,'0') + ' / 19';
}
function setView(v){
  view = v;
  vRear.setAttribute('aria-pressed', String(v === 'rear'));
  vSide.setAttribute('aria-pressed', String(v === 'side'));
  draw();
}
function stop(){
  clearInterval(timer); timer = null;
  play.textContent = 'Play'; play.setAttribute('aria-pressed','false');
}
function start(){
  if (timer) return;
  timer = setInterval(() => { i = (i + 1) % 20; draw(); }, 55);
  play.textContent = 'Pause'; play.setAttribute('aria-pressed','true');
}
play.addEventListener('click', () => timer ? stop() : start());
vRear.addEventListener('click', () => setView('rear'));
vSide.addEventListener('click', () => setView('side'));
scrub.addEventListener('input', () => { stop(); i = +scrub.value; draw(); });

draw();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) start();
</script>
'''

HTML = HTML.replace('__ROWS__', rows).replace('__DATA__', DATA)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(HTML)
print('wrote %s  %.2f MB' % (OUT, os.path.getsize(OUT) / 1e6))
