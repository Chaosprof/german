'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v140'),read=f=>fs.readFileSync(path.join(stage,f),'utf8'),before=read('baseline.html'),after=read('candidate.html');
const ctx=vm.createContext({console});vm.runInContext([...before.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),ctx);
const T=ctx.THREE;
function extract(h){const end=h.indexOf('    groundBounce.position.copy(bounceFollow);')+'    groundBounce.position.copy(bounceFollow);'.length,anchor=h.lastIndexOf('    sampleRoutePoint(player.x, 0.65',end),start=h.lastIndexOf('    var bounceBlend',end);return h.slice(start>anchor-80&&start<anchor?start:anchor,end);}
const sourceBefore=extract(before),sourceAfter=extract(after);assert.ok(sourceBefore.includes('bounceBlend'));assert.ok(sourceAfter.includes('bounceFollow.set'));
function simulate(source,speed,dt,curved){
  const bounceFollow=new T.Vector3(0,.65,1.8),groundBounce={position:new T.Vector3()},player={x:0,y:0,z:0},offsets=[];let routePointX=0,routePointY=0,routePointZ=0,expected=new T.Vector3();
  const sampleRoutePoint=(x,y,z)=>{routePointX=x+(curved?Math.sin(z*.012)*7:0);routePointY=y;routePointZ=z;expected.set(routePointX,routePointY,routePointZ);};
  const playerSurfaceY=z=>curved?Math.sin(z*.02)*.6:0,damp=(k,t)=>1-Math.exp(-k*t);
  const frame=new Function('state',`with(state){${source}}`);
  const state={bounceFollow,groundBounce,player,dt,damp,playerSurfaceY,sampleRoutePoint,get routePointX(){return routePointX},get routePointY(){return routePointY},get routePointZ(){return routePointZ}};
  for(let i=0;i<180;i++){player.z+=speed*dt;player.x=Math.sin(i*.075)*1.8;player.y=Math.max(0,Math.sin(i*.04))*.8;frame(state);offsets.push({error:groundBounce.position.distanceTo(expected),relativeZ:groundBounce.position.z-player.z});}
  return{maxError:Math.max(...offsets.map(p=>p.error)),steadyZ:offsets.at(-1).relativeZ};
}
const cases=[];for(const speed of [12,20,26,36,48,60])for(const dt of [1/120,1/60,1/30,.05])for(const curved of [false,true]){const a=simulate(sourceBefore,speed,dt,curved),b=simulate(sourceAfter,speed,dt,curved);assert.ok(b.maxError<1e-10,'actual frame code retains authored offset through pace/route/jump changes');assert.ok(Math.abs(b.steadyZ-1.8)<1e-10);cases.push({speed,dt,curved,before:a,after:b});}
const example=cases.find(c=>c.speed===20&&c.dt===1/60&&!c.curved);assert.ok(Math.abs(example.before.steadyZ)<.25,'old code demonstrably moves the point source into the runner vicinity');
const light=h=>h.match(/var groundBounce = new THREE.PointLight\((0x[\da-f]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/).slice(1);
const oldLight=light(before),newLight=light(after);for(const k of [0,1,3])assert.equal(newLight[k],oldLight[k]);assert.equal(+oldLight[2],18);assert.equal(+newLight[2],8);
const attenuation=(d,r)=>.22/(d*d)*Math.max(0,1-(d/r)**4)**2;
assert.ok(attenuation(8,18)<.0032,'removed far-tail radiance is below 0.0032 before material response');
assert.ok(1-attenuation(1.8,8)/attenuation(1.8,18)<.005,'nominal courier-distance radiance changes less than half a percent');
const report={passed:true,candidateSha256:require('crypto').createHash('sha256').update(after).digest('hex'),cases:cases.length,addedLights:0,lightColorIntensityDecayUnchanged:true,range:{before:+oldLight[2],after:+newLight[2],removedFarTailRadianceBound:attenuation(8,18)},example,maximumOldOffsetError:Math.max(...cases.map(c=>c.before.maxError)),maximumNewOffsetError:Math.max(...cases.map(c=>c.after.maxError))};
fs.writeFileSync(path.join(stage,'bounce-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
