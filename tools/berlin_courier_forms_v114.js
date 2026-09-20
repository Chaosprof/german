// Authoring-only sculpt. The game installs its baked position/normal patch.
// Applied to the accepted V97 surface, never to the original donor GLB.
function sculptCourierFormsV114(THREE, geo, source, sk, bonePoints) {
  var p=geo.attributes.position,n=geo.attributes.normal,raw=source.attributes.position;
  var si=source.attributes.skinIndex,sw=source.attributes.skinWeight,garment=geo.attributes.aCourierGarment;
  var names=sk.bones.map(function(b){return b.name;});
  var smooth=function(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  var bell=function(x,c,w){var t=(x-c)/w;return Math.exp(-t*t);};
  var dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];};
  var cross=function(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};
  function joint(name){return bonePoints[names.indexOf(name)].toArray();}
  function frame(a,b){var d=b.map(function(v,k){return v-a[k];}),l=Math.hypot.apply(Math,d);return{a:a,axis:d.map(function(v){return v/l;}),length:l};}
  function radial(q,f){var d=q.map(function(v,k){return v-f.a[k];}),t=dot(d,f.axis);return{along:t,r:d.map(function(v,k){return v-t*f.axis[k];})};}
  var frames=['Left','Right'].map(function(s){return{fore:frame(joint(s+'ForeArm'),joint(s+'Hand')),calf:frame(joint(s+'Leg'),joint(s+'Foot'))};});
  var meta=[];
  for(var i=0;i<p.count;i++){
    var m={arm:[0,0],leg:[0,0],head:0,hand:0,foot:0,spine:0,q:[p.getX(i),p.getY(i),p.getZ(i)],wrist:garment.getY(i),rawY:raw.getY(i)};
    for(var c=0;c<4;c++){
      var name=names[si.getComponent(i,c)],w=sw.getComponent(i,c),side=name.indexOf('Left')===0?0:1;
      if(/^(Left|Right)(Arm|ForeArm)$/.test(name))m.arm[side]+=w;
      if(/^(Left|Right)(UpLeg|Leg)$/.test(name))m.leg[side]+=w;
      if(/^(Head|head_end|headfront|neck)$/.test(name))m.head+=w;
      if(/^(Left|Right)Hand$/.test(name))m.hand+=w;
      if(/^(Left|Right)(Foot|ToeBase)$/.test(name))m.foot+=w;
      if(/^(Spine|Spine01|Spine02)$/.test(name))m.spine+=w;
    }
    m.protected=m.head>.001||m.hand>.45||m.foot>.45||m.rawY<.215||m.rawY>1.285;
    meta.push(m);
  }
  function deform(q,m){
    var out=q.slice();
    for(var s=0;s<2;s++){
      var f=frames[s],arm=m.arm[s];
      if(arm>.001){
        var radialFore=radial(q,f.fore),r=radialFore.r,rl=Math.max(.018,Math.hypot.apply(Math,r));
        // This coordinate follows the existing V111 material edge exactly.
        // Its local differential follows the limb, so normals curve over the
        // complete rolled ridge instead of retaining a smooth painted tube.
        var wrist=m.wrist-dot(q.map(function(v,k){return v-m.q[k];}),f.fore.axis);
        var gate=smooth(.104,.117,wrist)*(1-smooth(.205,.255,wrist))*(1-smooth(.060,.13,m.hand));
        var roll=.0235*bell(wrist,.140,.021);
        var compression=-.0045*bell(wrist,.171,.013)+.0135*bell(wrist,.197,.026);
        // A broad slightly diagonal compression above the roll. Quiet front
        // variation avoids a stack of mechanically perfect torus shapes.
        var direction=.88+.12*smooth(-.03,.03,-r[2]);
        var displacement=arm*gate*(roll+compression*direction);
        for(var k=0;k<3;k++)out[k]+=displacement*r[k]/rl;
      }
      var leg=m.leg[s];
      if(leg>.001){
        var calf=radial(q,f.calf),r=calf.r,rl=Math.max(.024,Math.hypot.apply(Math,r));
        var plane=calf.along+.30*r[2]+(s===0?1:-1)*.16*r[0];
        var compression=.0095*bell(plane,-.056,.037)-.004*bell(plane,-.005,.026)+.0060*bell(plane,.042,.032);
        var gate=smooth(.260,.320,m.rawY)*(1-smooth(.610,.690,m.rawY));
        var back=.70+.30*smooth(-.04,.04,-r[2]);
        for(var k=0;k<3;k++)out[k]+=leg*gate*compression*back*r[k]/rl;
      }
    }
    // Fullness gathers above the waist and returns into a soft lower edge.
    // Preserve the centre back under the bag; it retains its attachment fit.
    var body=(1-m.arm[0]-m.arm[1])*(1-smooth(.04,.25,m.leg[0]+m.leg[1]));
    var shirt=smooth(.735,.775,m.rawY)*(1-smooth(.930,1.020,m.rawY))*body;
    var x=q[0],z=q[2]-.018,r=Math.max(.06,Math.hypot(x,z));
    var side=smooth(.065,.115,Math.abs(x));
    var edge=.008*bell(q[1],.854+.050*Math.abs(x),.026)-.004*bell(q[1],.892+.040*Math.abs(x),.027);
    out[0]+=shirt*side*edge*x/r;out[2]+=shirt*side*edge*z/r;
    return out;
  }
  var changed=0,maxMove=0,minDet=Infinity,epsilon=.00001,protectedCount=0;
  var prior=p.array.slice(),welds={},repairs={};
  function key(i){return meta[i].q.map(function(v){return v.toFixed(6);}).join(',');}
  for(var i=0;i<p.count;i++){var id=key(i);if(!welds[id])welds[id]=[];welds[id].push(i);}
  for(var i=0;i<p.count;i++){
    var m=meta[i];if(m.protected){protectedCount++;continue;}
    var q=m.q,out=deform(q,m),move=Math.hypot.apply(Math,out.map(function(v,k){return v-q[k];}));
    if(move<1e-10)continue;
    var columns=[];
    for(var c=0;c<3;c++){
      var lo=q.slice(),hi=q.slice();lo[c]-=epsilon;hi[c]+=epsilon;
      var a=deform(lo,m),b=deform(hi,m);columns.push(b.map(function(v,k){return(v-a[k])/(2*epsilon);}));
    }
    var c0=cross(columns[1],columns[2]),c1=cross(columns[2],columns[0]),c2=cross(columns[0],columns[1]);
    var det=dot(columns[0],c0),nn=[n.getX(i),n.getY(i),n.getZ(i)];
    if(!isFinite(det)||det<.15)throw Error('V114 courier fold has invalid local frame at '+i+': '+det);
    var normal=[0,1,2].map(function(k){return(c0[k]*nn[0]+c1[k]*nn[1]+c2[k]*nn[2])/det;}),len=Math.hypot.apply(Math,normal);
    p.setXYZ(i,out[0],out[1],out[2]);n.setXYZ(i,normal[0]/len,normal[1]/len,normal[2]/len);
    changed++;maxMove=Math.max(maxMove,move);minDet=Math.min(minDet,det);
  }
  // A handful of donor triangles are almost collinear along the sleeve and
  // denim rings. Keep their short altitude on the same side of their longest
  // edge after sculpting; propagate the small correction through UV welds.
  // This preserves the original topology and avoids a folded sliver face.
  var idx=geo.index;
  function at(i){return new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));}
  function old(i){return new THREE.Vector3().fromArray(prior,i*3);}
  for(var pass=0;pass<12;pass++){
    var repaired=0;
    for(var t=0;t<idx.count;t+=3){
      var ids=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)],before=ids.map(old),after=ids.map(at);
      var bf=before[1].clone().sub(before[0]).cross(before[2].clone().sub(before[0]));
      var af=after[1].clone().sub(after[0]).cross(after[2].clone().sub(after[0]));
      if(bf.length()<1e-9||bf.clone().normalize().dot(af.clone().normalize())>.04)continue;
      var lengths=[before[0].distanceToSquared(before[1]),before[1].distanceToSquared(before[2]),before[2].distanceToSquared(before[0])];
      var edge=lengths.indexOf(Math.max.apply(Math,lengths)),a=edge,b=(edge+1)%3,c=(edge+2)%3;
      if(meta[ids[c]].protected)throw Error('V114 protected sliver cannot be adjusted');
      var line=after[b].clone().sub(after[a]),axis=line.clone().normalize(),offset=after[c].clone().sub(after[a]);
      var projection=after[a].clone().addScaledVector(axis,offset.dot(axis));
      var perpendicular=bf.clone().normalize().cross(axis).normalize();
      var altitude=bf.length()/Math.sqrt(lengths[edge]);
      var target=projection.addScaledVector(perpendicular,Math.max(altitude*.65,.000015));
      welds[key(ids[c])].forEach(function(v){p.setXYZ(v,target.x,target.y,target.z);repairs[v]=true;});
      repaired++;
    }
    if(!repaired)break;
  }
  geo.userData.courierFormsV114={changedVertices:changed,maximumMove:maxMove,minimumJacobianDeterminant:minDet,protectedHeadHandShoeVertices:protectedCount,sliverVertexCorrections:Object.keys(repairs).length};
}
if(typeof module!=='undefined')module.exports={sculptCourierFormsV114};
