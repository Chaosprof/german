// One-time bind-space cloth sculpt, after the accepted courier refinement.
// No topology, skin, UV, texture, animation, accessory, or GPU-path changes.
function sculptCourierClothV97(THREE, geo, source, sk, bonePoints, shoeCuffY) {
  var p = geo.attributes.position, n = geo.attributes.normal;
  var raw = source.attributes.position, si = source.attributes.skinIndex, sw = source.attributes.skinWeight;
  var names = sk.bones.map(function (b) { return b.name; });
  var smooth = function (a,b,x) { var t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  var bell = function (x,c,w) { var t=(x-c)/w; return Math.exp(-t*t); };
  var dot = function (a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; };
  var cross = function (a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; };
  var torsoMin=[Infinity,Infinity,Infinity],torsoMax=[-Infinity,-Infinity,-Infinity],meta=[];
  function joint(name) { return bonePoints[names.indexOf(name)].toArray(); }
  function frame(a,b) {
    var axis=b.map(function(v,k){return v-a[k];}),length=Math.hypot.apply(Math,axis);
    return {a:a,axis:axis.map(function(v){return v/length;}),length:length};
  }
  var frames=['Left','Right'].map(function(side){
    return {upper:frame(joint(side+'Arm'),joint(side+'ForeArm')),
      fore:frame(joint(side+'ForeArm'),joint(side+'Hand')),
      thigh:frame(joint(side+'UpLeg'),joint(side+'Leg')),
      calf:frame(joint(side+'Leg'),joint(side+'Foot'))};
  });
  function radial(q,f) {
    var d=q.map(function(v,k){return v-f.a[k];}),along=dot(d,f.axis);
    return {along:along,r:d.map(function(v,k){return v-along*f.axis[k];})};
  }
  for (var i=0;i<p.count;i++) {
    var m={arm:[0,0],leg:[0,0],head:0,hand:0,foot:0,spine:0};
    for(var c=0;c<4;c++) {
      var name=names[si.getComponent(i,c)],w=sw.getComponent(i,c),side=name.indexOf('Left')===0?0:1;
      if(/^(Left|Right)(Arm|ForeArm)$/.test(name))m.arm[side]+=w;
      if(/^(Left|Right)(UpLeg|Leg)$/.test(name))m.leg[side]+=w;
      if(/^(Head|head_end|headfront|neck)$/.test(name))m.head+=w;
      if(/^(Left|Right)Hand$/.test(name))m.hand+=w;
      if(/^(Left|Right)(Foot|ToeBase)$/.test(name))m.foot+=w;
      if(/^(Spine|Spine01|Spine02)$/.test(name))m.spine+=w;
    }
    m.body=Math.max(0,1-m.arm[0]-m.arm[1]-m.hand-m.head);
    m.protected=m.head>.001||m.hand>.45||m.foot>.45||raw.getY(i)<=shoeCuffY+.008||raw.getY(i)>=1.285;
    if(m.spine>.45)for(var k=0;k<3;k++){
      torsoMin[k]=Math.min(torsoMin[k],p.getComponent(i,k));torsoMax[k]=Math.max(torsoMax[k],p.getComponent(i,k));
    }
    meta.push(m);
  }
  // Keep the accepted accessory measurement independent of the shaped cloth.
  geo.userData.courierAccessoryBounds={min:torsoMin.slice(),max:torsoMax.slice()};
  function deform(q,m) {
    var out=q.slice(),y=q[1],body=m.body*(1-smooth(.235,.320,Math.abs(q[0])))*(1-smooth(1.17,1.27,y));
    var shirt=smooth(.675,.755,y)*(1-smooth(1.10,1.255,y))*body;
    if(shirt>0) {
      // Raise the long lower skirt into a gathered waist; swell the cloth above
      // it, while preserving the neck and shoulder attachment. Broad diagonal
      // compression near the hem replaces the donor's flat trapezoid.
      var waist=-.15*bell(y,.772,.055)+.19*bell(y,.935,.110);
      var hemPlane=.772+.075*Math.abs(q[0]);
      var rolled=.0077*bell(y,hemPlane,.019)-.00495*bell(y,hemPlane+.043,.030);
      var x=q[0],z=q[2]-.018,r=Math.max(.05,Math.hypot(x,z));
      out[0]+=shirt*(x*waist+rolled*x/r);
      out[2]+=shirt*(z*(waist*.78)+rolled*z/r);
      out[1]+=.082*body*smooth(.665,.765,y)*(1-smooth(.840,1.075,y));
      // Two quiet back/side gathers, with a broad upper return, not noise.
      var gather=.0055*bell(y,.855+.26*Math.abs(x),.034)-.0033*bell(y,.904+.20*Math.abs(x),.042);
      out[2]+=shirt*gather*(z/r)*smooth(.030,.135,Math.abs(x));
    }
    for(var side=0;side<2;side++) {
      var f=frames[side],arm=m.arm[side];
      if(arm>.001) {
        var fore=radial(q,f.fore),upper=radial(q,f.upper),r=fore.r,rl=Math.max(.018,Math.hypot.apply(Math,r));
        var plane=fore.along+.22*r[2]+(side===0?1:-1)*.12*r[0];
        var directional=.52+.48*smooth(-.035,.035,-r[2]);
        var fold=(.0077*bell(plane,-.034,.028)-.00495*bell(plane,.004,.019)+.0055*bell(plane,.043,.030))*directional;
        var wrist=f.fore.length-fore.along;
        var cuff=(.00715*bell(wrist,.038,.027)-.00385*bell(wrist,.090,.044))*smooth(.003,.028,wrist);
        var sleeveGate=smooth(.002,.018,wrist)*(1-smooth(.060,.13,m.hand));
        for(var k=0;k<3;k++)out[k]+=arm*sleeveGate*(fold+cuff)*r[k]/rl;
        var ur=upper.r,ul=Math.max(.020,Math.hypot.apply(Math,ur));
        var shoulder=.009*bell(upper.along,.078,.066)*arm;
        for(var k=0;k<3;k++)out[k]+=shoulder*ur[k]/ul;
      }
      var leg=m.leg[side];
      if(leg>.001) {
        var calf=radial(q,f.calf),r=calf.r,rl=Math.max(.025,Math.hypot.apply(Math,r));
        var plane=calf.along+.24*r[2]+(side===0?1:-1)*.12*r[0];
        var compression=.60+.40*smooth(-.045,.030,-r[2]);
        var fold=(.013*bell(plane,-.037,.070)-.005*bell(plane,.072,.085))*compression;
        var ankle=f.calf.length-calf.along;
        var cuff=.010*bell(ankle,.091,.044)-.005*bell(ankle,.152,.052);
        var gate=smooth(shoeCuffY+.010,shoeCuffY+.075,y)*(1-smooth(.64,.735,y));
        for(var k=0;k<3;k++)out[k]+=leg*gate*(fold+cuff)*r[k]/rl;
      }
    }
    return out;
  }
  var changed=0,maxMove=0,minDet=Infinity,maxNormalError=0,epsilon=.00001,changedIds=[];
  var weldKeys=[],weldVertices={},priorPositions=p.array.slice(),priorNormals=n.array.slice();
  for(var i=0;i<p.count;i++) {
    var key=[p.getX(i),p.getY(i),p.getZ(i)].map(function(v){return v.toFixed(6);}).join(',');
    weldKeys.push(key);if(!weldVertices[key])weldVertices[key]=[];weldVertices[key].push(i);
  }
  for(var i=0;i<p.count;i++) {
    var m=meta[i];if(m.protected)continue;
    var q=[p.getX(i),p.getY(i),p.getZ(i)],out=deform(q,m);
    var movement=Math.hypot(out[0]-q[0],out[1]-q[1],out[2]-q[2]);
    if(movement<1e-10)continue;
    var columns=[];
    for(var c=0;c<3;c++) {
      var lo=q.slice(),hi=q.slice();lo[c]-=epsilon;hi[c]+=epsilon;
      var a=deform(lo,m),b=deform(hi,m);
      columns.push(b.map(function(v,k){return (v-a[k])/(2*epsilon);}));
    }
    var c0=cross(columns[1],columns[2]),c1=cross(columns[2],columns[0]),c2=cross(columns[0],columns[1]);
    var det=dot(columns[0],c0),normal=[n.getX(i),n.getY(i),n.getZ(i)];
    if(!isFinite(det)||det<=.12)throw new Error('Courier cloth deformation folds its local frame: '+i+' '+det);
    var nn=[0,1,2].map(function(k){return (c0[k]*normal[0]+c1[k]*normal[1]+c2[k]*normal[2])/det;});
    var length=Math.hypot.apply(Math,nn);
    p.setXYZ(i,out[0],out[1],out[2]);n.setXYZ(i,nn[0]/length,nn[1]/length,nn[2]/length);
    changed++;changedIds.push(i);maxMove=Math.max(maxMove,movement);minDet=Math.min(minDet,det);
    maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1));
  }
  // Preserve artist smoothing. A few donor sliver faces cross the averaged
  // normal's hemisphere under a finite deformation even with positive face
  // orientation. Correct only those cloth normals against the actual surface,
  // and apply the same correction to their position-welded UV duplicates.
  var index=geo.index,constraints=[],normalRepairs={},changedMap={};
  changedIds.forEach(function(i){changedMap[i]=true;});
  for(var t=0;t<index.count;t+=3) {
    var ids=[index.getX(t),index.getX(t+1),index.getX(t+2)];
    if(!ids.some(function(i){return changedMap[i];}))continue;
    var a=ids.map(function(v){return [p.getX(v),p.getY(v),p.getZ(v)];});
    var old=ids.map(function(v){return Array.from(priorPositions.slice(v*3,v*3+3));});
    var oldFace=cross(old[1].map(function(v,k){return v-old[0][k];}),old[2].map(function(v,k){return v-old[0][k];}));
    var oldNormal=[0,0,0];ids.forEach(function(v){for(var k=0;k<3;k++)oldNormal[k]+=priorNormals[v*3+k];});
    if(dot(oldFace,oldNormal)<=.2*Math.hypot.apply(Math,oldFace)*Math.hypot.apply(Math,oldNormal))continue;
    var ab=a[1].map(function(v,k){return v-a[0][k];}),ac=a[2].map(function(v,k){return v-a[0][k];});
    var face=cross(ab,ac),length=Math.hypot.apply(Math,face);if(length<1e-12)continue;
    constraints.push({ids:ids,face:face.map(function(v){return v/length;})});
  }
  for(var pass=0;pass<8;pass++)constraints.forEach(function(item){
    var sum=[0,0,0];item.ids.forEach(function(v){for(var k=0;k<3;k++)sum[k]+=n.getComponent(v,k);});
    var length=Math.hypot.apply(Math,sum),alignment=dot(sum,item.face)/length;if(alignment>=.015)return;
    item.ids.forEach(function(v){if(!changedMap[v])return;
      var normal=[n.getX(v),n.getY(v),n.getZ(v)],amount=(.018-alignment)*1.2;
      for(var k=0;k<3;k++)normal[k]+=amount*item.face[k];var len=Math.hypot.apply(Math,normal);
      weldVertices[weldKeys[v]].forEach(function(id){if(!changedMap[id]||meta[id].protected)return;
        n.setXYZ(id,normal[0]/len,normal[1]/len,normal[2]/len);normalRepairs[id]=true;
      });
    });
  });
  geo.userData.courierClothV97={changedVertices:changed,maximumMove:maxMove,minimumJacobianDeterminant:minDet,
    maximumNormalLengthError:maxNormalError,localSurfaceNormalCorrections:Object.keys(normalRepairs).length,
    accessoryTorsoMin:torsoMin,accessoryTorsoMax:torsoMax};
}
if(typeof module!=='undefined')module.exports={sculptCourierClothV97};
