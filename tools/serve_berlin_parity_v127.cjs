// Same-build/paired-build test fixture for the Codex in-app browser.
// Chromium child-process launches are unavailable in this session's shell.
// Only the served copy is instrumented; production source is unchanged.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const phase=process.env.REVIEW_PHASE||'audit/berlin-parity-v127';
const phases={facades:'audit/berlin-parity-facades-v119',courier:'audit/berlin-parity-courier-v120',tram:'audit/berlin-parity-tram-v121',final:'audit/berlin-parity-final-v122',full:'audit/berlin-parity-final-v122/benchmark'};
const seed=`<script>let reviewSeed=625341585,reviewThreeSeed=937456173;window.reviewReseed=()=>{reviewSeed=625341585};function reviewRandom(v){let t=Math.imul(v^v>>>15,1|v);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}Math.random=()=>{reviewSeed=reviewSeed+0x6D2B79F5|0;return reviewRandom(reviewSeed)};window.reviewThreeRandom=()=>{reviewThreeSeed=reviewThreeSeed+0x6D2B79F5|0;return reviewRandom(reviewThreeSeed)};</script>`;
const chunkSeedHook=`<script>window.reviewSeededChunk=(z,fn)=>{const held=reviewSeed;reviewSeed=(625341585^Math.imul(Math.round(z),1597334677))|0;try{return fn()}finally{reviewSeed=held}};</script>`;
const hook=`
  var reviewParams = new URLSearchParams(location.search);
  var reviewNode = document.createElement('pre'); reviewNode.id='review-output';
  reviewNode.style='position:fixed;bottom:0;left:0;max-width:95vw;max-height:35vh;overflow:auto;font:11px monospace;background:#fffe;color:#111;z-index:99999;padding:5px;pointer-events:none';
  document.body.appendChild(reviewNode);
  var reviewRows=[],reviewStartPrograms=-1,reviewStop=0,reviewEnd=false,reviewStartedAt=0,reviewPerfFrames=0;
  var reviewStops=[60,140,220,300,380,460,540,620,700,780];
  var reviewShot=Number(reviewParams.get('shot')||0),reviewShotElapsed=0,reviewActionFired=false;
  var reviewTimer=setInterval(function(){
    if(!started){reviewNode.textContent=JSON.stringify({state:'ready',revision:canvas.dataset.graphicsRevision,programs:renderer.info.programs.length});if(reviewParams.has('batch')&&!document.getElementById('start').classList.contains('loading'))document.getElementById('go').click();return;}
    if(reviewStartPrograms<0){reviewStartPrograms=renderer.info.programs.length;reviewStartedAt=performance.now();}
    if(reviewShot)return;
    if(reviewParams.get('mode')==='counts'&&player.z>=reviewStops[reviewStop]){
      var wasPhoto=photoMode;if(!wasPhoto)togglePhotoMode();
      renderer.shadowMap.needsUpdate=true;renderer.info.reset();renderPresent();
      var withS={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      renderer.shadowMap.needsUpdate=false;renderer.info.reset();renderPresent();
      reviewRows.push({z:player.z,beautyCalls:renderer.info.render.calls,beautyTris:renderer.info.render.triangles,shadowCalls:withS.calls-renderer.info.render.calls,shadowTris:withS.triangles-renderer.info.render.triangles,programs:renderer.info.programs.length});
      reviewStop++;if(!wasPhoto)togglePhotoMode();
      if(reviewStop===reviewStops.length)reviewEnd=true;
    }
    if(reviewParams.get('mode')==='perf'&&(reviewParams.has('fixedFrames')?reviewPerfFrames>=Number(reviewParams.get('fixedFrames')):performance.now()-reviewStartedAt>Number(reviewParams.get('seconds')||65)*1000))reviewEnd=true;
    var output={state:reviewEnd?'complete':'running',fixture:reviewParams.has('fixedFrames')?(reviewParams.has('chunkSeed')?'split-rng-v4-chunk-fixed-step':'split-rng-v3-fixed-step'):'split-rng-v2',simulationFrames:reviewPerfFrames,revision:canvas.dataset.graphicsRevision,elapsed:(performance.now()-reviewStartedAt)/1000,programsAtStart:reviewStartPrograms,programsAtEnd:renderer.info.programs.length,rows:reviewRows,profile:reviewEnd?makeDeviceReport('Codex in-app controlled A/B'):null};
    reviewNode.textContent=JSON.stringify(output);
    if(reviewEnd){output.pavingStartup={cpuMs:Number(canvas.dataset.pavingReliefMs||0),applyWallMs:Number(canvas.dataset.pavingReliefLoadMs||0),path:canvas.dataset.pavingRelief||'luminance'};clearInterval(reviewTimer);if(!photoMode)togglePhotoMode();fetch('/save-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:reviewParams.get('phase'),label:reviewParams.get('label'),data:output})}).then(function(){
      if(reviewParams.has('batch')){var next=Number(reviewParams.get('run')||0)+1,builds=reviewParams.get('builds')==='three'?['before','middle','after']:['before','after'];if(next<Number(reviewParams.get('runs')||6)){var target=builds[next%builds.length],q=new URLSearchParams(reviewParams);q.set('run',String(next));q.set('label',reviewParams.get('mode')==='counts'?'counts-'+target:(reviewParams.get('series')||'perf')+'-'+target+'-'+Math.floor(next/builds.length));location.href='/'+target+'.html?'+q.toString();}}
    });}
  },75);
`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/save-review'&&req.method==='POST'){
    let s='';req.on('data',d=>{s+=d;if(s.length>2000000)req.destroy()});req.on('end',()=>{const v=JSON.parse(s),label=String(v.label||'run').replace(/[^\w-]/g,''),savePhase=phases[v.phase]||phase;fs.writeFileSync(path.join(root,savePhase,label+'.json'),JSON.stringify(v.data,null,2));res.end('saved')});return;
  }
  const activePhase=phases[url.searchParams.get('phase')]||phase;
  const builds={'/before.html':activePhase+'/baseline.html','/middle.html':activePhase+'/middle.html','/after.html':activePhase+'/candidate.html'};
  const rel=builds[url.pathname]||decodeURIComponent(url.pathname).replace(/^\//,'');
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(e,d)=>{
    if(e){res.writeHead(404);res.end();return;}
    if(builds[url.pathname]){
      let s=d.toString().replace('<head>','<head>'+seed);
      if(url.searchParams.has('courierProfile')){
        s=s.replace('            var authoredMats = Array.isArray(o.material) ? o.material : [o.material];',
          '            canvas.dataset.courierForms=JSON.stringify(o.geometry.userData.courierFormsV114||null);\n            var authoredMats = Array.isArray(o.material) ? o.material : [o.material];');
      }
      if(url.searchParams.has('pavingProfile')){
        const originalRelief='      relief(MAT.road, paving, 0.45, 0.68, 0.88);';
        s=s.replace(originalRelief,'      var reviewReliefStart=performance.now();\n'+originalRelief+'\n      canvas.dataset.pavingReliefMs=(performance.now()-reviewReliefStart).toFixed(1);');
      }
      // A desktop window can change native DPI between navigations even when
      // its CSS viewport is pinned. Optional benchmark-only DPR keeps every
      // build's drawing buffer identical. Never changes the production file.
      if(url.searchParams.has('dpr')){
        const fixedDpr=Number(url.searchParams.get('dpr'));
        if(!Number.isFinite(fixedDpr)||fixedDpr<.5||fixedDpr>3)throw new Error('Invalid review DPR');
        s=s.replace(/\bwindow\.devicePixelRatio\b/g,String(fixedDpr));
      }
      // Isolate Three.js UUID allocations from the gameplay random stream.
      // Adding a mesh must not change traffic/buildings in an A/B comparison.
      s=s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,block=>block.includes('three.js r156 (MIT)')?block.replace(/Math\.random/g,'window.reviewThreeRandom'):block);
      if(url.searchParams.get('pin')!=='0')s=s.replace('var ladderCeiling = Infinity;','var ladderCeiling = 0;').split('ladderCeiling = QUALITY_TIER_MAX').join('ladderCeiling = 0');
      s=s.replace('\n  var groundChunkIdentity = new THREE.Matrix4();','\n  window.reviewReseed();\n  var groundChunkIdentity = new THREE.Matrix4();');
      // Deferred chunk construction overlaps title/gameplay effects. Seed each
      // street block independently so those async random calls cannot choose
      // different traffic and props across repeats. Production stays unchanged.
      if(url.searchParams.has('chunkSeed')){
        s=s.replace('</head>',chunkSeedHook+'</head>');
        const chunkMarker='  function rollChunk(g, chunkZ) {';
        if(!s.includes(chunkMarker))throw new Error('Missing chunk authoring hook');
        s=s.replace(chunkMarker,'  function rollChunk(g, chunkZ) { return window.reviewSeededChunk(chunkZ,function(){return reviewRollChunk(g,chunkZ);}); }\n  function reviewRollChunk(g, chunkZ) {');
      }
      s=s.replace('\n  function frame(now) {','\n'+hook+'\n  function frame(now) {');
      if(url.searchParams.has('fixedFrames')){
        s=s.replace('    if (raw > 0.25) raw = 0.25;','    if(started&&!photoMode){raw=1/60;reviewPerfFrames++;}\n    if (raw > 0.25) raw = 0.25;');
        s=s.replace('    var t = now / 1000;','    var t = reviewPerfFrames/60;');
      }
      if(url.searchParams.has('shot')){
        // Freeze on a fixed simulation frame, not a wall-clock timer that
        // drifts with preload/compilation and CPU load between two builds.
        s=s.replace('    if (raw > 0.25) raw = 0.25;', '    if(reviewShot && started){raw=1/60;reviewShotElapsed+=raw;if(!reviewActionFired && reviewShotElapsed>=Number(reviewParams.get("actionAt")||1)){var action=reviewParams.get("action");if(["jump","slide","left","right"].indexOf(action)>=0)pressAction(action);reviewActionFired=true;}}\n    if (raw > 0.25) raw = 0.25;');
        s=s.replace('    var t = now / 1000;', '    var t = reviewShot ? reviewShotElapsed : now / 1000;');
        s=s.replace('    profileFrame(profileRaw);', '    profileFrame(profileRaw);\n    if(reviewShot && started && reviewShotElapsed+1e-8>=reviewShot){togglePhotoMode();reviewNode.style.display="none";clearInterval(reviewTimer);}');
      }
      if(url.searchParams.has('shot'))s=s.replace('</head>','<style>#wordstats,#pretzelhud,#mistakehistory,#quiz,#voicebtn,#musicbtn,#photobtn,#touchhint,#powerups,#stumblemsg,#profilepanel,#profilereport,#combo,#toast{visibility:hidden!important}</style></head>');
      // Inspection-only magnification of an observed screen region. This
      // changes the served review copy, never the production camera or shader.
      if(url.searchParams.has('shot')&&url.searchParams.has('detail')){
        const rect=url.searchParams.get('detail').split(',').map(Number);
        if(rect.length!==4||rect.some(v=>!Number.isFinite(v)||v<0)||rect[2]<=0||rect[3]<=0)throw new Error('Invalid detail rectangle');
        s=s.replace('togglePhotoMode();reviewNode.style.display="none";',`camera.setViewOffset(window.innerWidth,window.innerHeight,${rect.join(',')});camera.updateProjectionMatrix();togglePhotoMode();reviewNode.style.display="none";`);
      }
      d=Buffer.from(s);
    }
    const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.json':'application/json'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d);
  });
});const port=Number(process.env.REVIEW_PORT||8777);server.listen(port,'127.0.0.1',()=>console.log('Review fixture http://127.0.0.1:'+port+'/before.html?shot=0.3'));
