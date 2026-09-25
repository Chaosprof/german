function finishBerlinKiezFacade(THREE, geometry, variant, width, side) {
  var p=geometry.attributes.position,uv=geometry.attributes.uv,n=geometry.attributes.normal;
  var index=geometry.index,faces=index?index.count:p.count;
  var panes=new Map(),parent=[],pointIds=new Map(),weld=[];
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function tile(i){return Math.floor(uv.getX(i)*4)+4*Math.floor((1-uv.getY(i))*4);}
  // Pane faces can have split vertices at their fan centre. Weld positions
  // before extracting openings, so every real opening gets one decoration.
  for(var i=0;i<p.count;i++)if(tile(i)===2&&p.getY(i)>5&&n.getZ(i)>.70){
    var key=[p.getX(i).toFixed(4),p.getY(i).toFixed(4),p.getZ(i).toFixed(4)].join(',');
    if(!pointIds.has(key)){pointIds.set(key,parent.length);parent.push(parent.length);}
    weld[i]=pointIds.get(key);
  }
  for(var f=0;f<faces;f+=3){
    var ids=[0,1,2].map(function(j){return index?index.getX(f+j):f+j;});
    if(!ids.every(function(i){return weld[i]!==undefined;}))continue;
    var root=find(weld[ids[0]]);ids.forEach(function(i){parent[find(weld[i])]=root;});
  }
  for(var i=0;i<p.count;i++)if(weld[i]!==undefined){
    var root=find(weld[i]),slot=panes.get(root);
    if(!slot){slot={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};panes.set(root,slot);}
    [p.getX(i),p.getY(i),p.getZ(i)].forEach(function(v,k){slot.min[k]=Math.min(slot.min[k],v);slot.max[k]=Math.max(slot.max[k],v);});
  }
  var slots=Array.from(panes.values()).filter(function(s){return s.max[0]-s.min[0]>.70&&s.max[1]-s.min[1]>1.5&&s.min[1]<13.5&&s.max[2]<.5;});
  slots.sort(function(a,b){return a.min[1]-b.min[1]||a.min[0]-b.min[0];});
  // Uppermost windows retain the original sparse planting to keep the
  // roof silhouette clear. V125: the art direction's lower storeys are
  // nearly all planted, so plain frontages dress their lowest ten windows,
  // the bookstore eight; the apricot master keeps three (27k budget).
  slots=slots.filter(function(s,i){return variant===0||((i*7+variant*3)%11)<8;}).slice(0,variant===0?2:variant===1?6:8);
  var extra={position:[],normal:[],color:[],uv:[]},extraIndex=[],paint=new THREE.Color();
  function add(g,x,y,z,sx,sy,sz,color,ry,rz,rx){
    var pos=g.attributes.position,norm=g.attributes.normal,ind=g.index;
    var m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx,sy,sz));
    var nm=new THREE.Matrix3().getNormalMatrix(m),v=new THREE.Vector3(),nn=new THREE.Vector3(),off=extra.position.length/3;
    paint.setHex(color);
    for(var j=0;j<pos.count;j++){
      v.fromBufferAttribute(pos,j).applyMatrix4(m);nn.fromBufferAttribute(norm,j).applyMatrix3(nm).normalize();
      extra.position.push(v.x,v.y,v.z);extra.normal.push(nn.x,nn.y,nn.z);
      var shade=.78+.22*Math.max(0,nn.y);
      extra.color.push(paint.r*shade,paint.g*shade,paint.b*shade);extra.uv.push(.125,.875);
    }
    for(var j=0;j<(ind?ind.count:pos.count);j++)extraIndex.push(off+(ind?ind.getX(j):j));
  }
  var box=new THREE.BoxGeometry(1,1,1);
  // Small curved oval leaves: eight outline corners, a shallow front,
  // and a closed back. Independent rim normals soften the folded leaf surface.
  var leaf=new THREE.BufferGeometry(),lp=[],ln=[],li=[];
  for(var edge=0;edge<8;edge++){
    var angle=edge*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle);
    lp.push(x,y,Math.abs(y)*.075);var nn=new THREE.Vector3(x*.55,y*.60,.62).normalize();ln.push(nn.x,nn.y,nn.z);
  }
  lp.push(0,0,.19,0,0,-.065);ln.push(0,0,1,0,0,-1);
  for(var edge=0;edge<8;edge++){
    var angle=edge*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle);
    lp.push(x,y,Math.abs(y)*.075);var nn=new THREE.Vector3(x*.40,y*.44,-.66).normalize();ln.push(nn.x,nn.y,nn.z);
    li.push(8,edge,(edge+1)%8,9,10+(edge+1)%8,10+edge);
  }
  leaf.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));leaf.setAttribute('normal',new THREE.Float32BufferAttribute(ln,3));leaf.setIndex(li);
  // Rounded blooms retain volume when viewed along the street. Weld the
  // twenty-face sphere to twelve vertices and use a smooth radial normal field.
  var bloomSource=new THREE.IcosahedronGeometry(1,0),bloom=new THREE.BufferGeometry();
  var bp=[],bn=[],bi=[],bloomPoints=new Map(),positions=bloomSource.attributes.position;
  for(var vi=0;vi<positions.count;vi++){
    var v=new THREE.Vector3().fromBufferAttribute(positions,vi),key=v.toArray().join(',');
    if(!bloomPoints.has(key)){
      bloomPoints.set(key,bp.length/3);bp.push(v.x,v.y,v.z);v.normalize();bn.push(v.x,v.y,v.z);
    }
    bi.push(bloomPoints.get(key));
  }
  bloom.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));
  bloom.setAttribute('normal',new THREE.Float32BufferAttribute(bn,3));bloom.setIndex(bi);bloomSource.dispose();
  var geranium=[0xd56c79,0xed9a9a,0xc84e67,0xffe8cd,0xe8b1a4];
  slots.forEach(function(s,si){
    var x=(s.min[0]+s.max[0])/2,y=s.min[1]-.07,z=s.max[2]+.68;
    var w=Math.min(1.78,s.max[0]-s.min[0]+.18);
    // Dark container and one wrought-iron rail below the sill.
    add(box,x,y-.12,z,w,.22,.30,0x3d5548);
    add(box,x,y-.22,z+.19,w+.10,.035,.035,0x344340);
    // Three overlapping, uneven rows of smaller leaves make a rounded mound.
    for(var j=0;j<24;j++){
      var t=(j%8+.5)/8,tier=Math.floor(j/8),phase=j*2.17+si*.91+variant*.43;
      var size=.88+.18*(.5+.5*Math.sin(phase*1.7));
      add(leaf,x+(t-.5)*w*.99+Math.sin(phase)*.04,y+.07+tier*.115+Math.sin(phase*.81)*.055,
        z+.04+tier*.065+Math.cos(phase)*.06,.115*size,.13*size,.18,
        j%3?0x4e7137:0x758b40,-side*.38+Math.sin(phase)*.70,Math.cos(phase*.73)*.65,Math.sin(phase*.91)*.55);
    }
    // Seven loose clusters: coherent pink/cream families per box, with one
    // pale accent cluster. Unequal heights break the horizontal flower strip.
    for(var j=0;j<21;j++){
      var cluster=Math.floor(j/3),floret=j%3,t=(cluster+.5)/7;
      var a=floret*Math.PI*2/3+cluster*.83+si*.37,r=.077+.012*((cluster+si)%3);
      var cx=x+(t-.5)*w*.96+Math.sin(cluster*2.3+si)*.038;
      var cy=y+.27+Math.sin(cluster*1.9+si*.73)*.105;
      var family=cluster===(si+2)%7?3:(si*2+variant)%geranium.length;
      add(bloom,cx+Math.cos(a)*.076,cy+Math.sin(a)*.074,z+.17+Math.cos(j*1.7+si)*.045,
        r*1.05,r,r*.88,geranium[family],Math.sin(j+si)*.42,a*.27);
    }
    // Three unequal ivy trails follow bent paths; their leaf pairs overlap
    // the container edge and taper toward each hanging tip.
    for(var j=0;j<8;j++){
      var stem=j<3?0:j<6?1:2,tier=j-(stem===0?0:stem===1?3:6);
      var t=[-.37,.04,.38][stem],phase=si*.9+stem*1.7;
      var drop=tier*(stem===1?.20:.155)+(stem===0?.03:stem===1?.12:0);
      var size=1-tier*.12;
      add(leaf,x+t*w+Math.sin(tier*1.1+phase)*.085,y-.17-drop,z+.245+tier*.012,
        .105*size,.125*size,.20,j%3?0x4d753a:0x678642,
        -side*.48+Math.sin(j+si)*.34,(tier%2?-.48:.38)+Math.cos(phase+tier*.7)*.26,Math.sin(j+si)*.35);
    }
  });
  // A small number of stepped chimney stacks break the repeated mansard
  // rhythm. They stay behind the front cornice and in the same geometry.
  var roofY=geometry.userData.height||17;
  for(var stack=0;stack<(variant%3===1?2:1);stack++){
    var chimneyX=(stack?-.27:.22)*width*side,chimneyZ=-3.5-stack*2;
    var chimneyH=variant%2?1.50:1.15;
    add(box,chimneyX,roofY+2.15,chimneyZ,.72,chimneyH,.86,variant%2?0xa47c62:0xae9475);
    add(box,chimneyX,roofY+2.15+chimneyH/2,chimneyZ,.88,.13,1.02,0xc5b69a);
  }

  var displayBookStart=faces/3+extraIndex.length/3;
  if(variant===1){
    var cover=new THREE.PlaneGeometry(1,1),bookScale=width/13.5*side;
    [-4.2,0,4.2].forEach(function(bay,bi){
      [-.82,.82].forEach(function(offset,j){
        var x=(bay+offset)*bookScale,y=1.345,z=.39,tilt=(j?-.055:.065)*side;
        add(box,x,y,z,.38*Math.abs(bookScale),.58,.09,j?0x526c65:0x936850,0,tilt);
        add(box,x,y-.285,z-.025,.43*Math.abs(bookScale),.035,.18,0x71634e);
        var firstUV=extra.uv.length;
        add(cover,x,y,z+.047,.345*Math.abs(bookScale),.545,1,0xffffff,0,tilt);
        for(var cv=0;cv<cover.attributes.uv.count;cv++){
          var u=cover.attributes.uv.getX(cv),v=cover.attributes.uv.getY(cv);
          if(side<0)u=1-u;
          extra.uv[firstUV+cv*2]=(.143+u*.139)/4;
          extra.uv[firstUV+cv*2+1]=.5+(.125+v*.29)/4;
        }
      });
    });
    cover.dispose();
  }
  var displayBookEnd=faces/3+extraIndex.length/3;

  var bicycleStart=faces/3+extraIndex.length/3;
  var bicycleVertexStart=extra.position.length/3;
  if(variant===0){
    var bikeX=side*(-width/2+1.10),bikeZ=1.10;
    var wheel=new THREE.TorusGeometry(1,.072,3,12),tube=new THREE.CylinderGeometry(1,1,1,3,1),spoke=new THREE.PlaneGeometry(1,1);
    [-.63,.63].forEach(function(wx){
      add(wheel,bikeX+wx,.37,bikeZ,.35,.35,.35,0x343e3c);
      for(var s=0;s<3;s++)add(spoke,bikeX+wx,.37,bikeZ+.002,.62,.009,1,0x9caba4,0,s*Math.PI/3);
    });
    function bar(a,b,r,color){
      var dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      add(tube,bikeX+(a[0]+b[0])/2,(a[1]+b[1])/2,bikeZ+.02,r,length,r,color,0,-Math.atan2(dx,dy));
    }
    var A=[-.63,.37],B=[-.09,.34],C=[-.30,.88],D=[.44,.88],E=[.63,.37],H=[.49,1.08];
    [[A,B],[B,C],[C,A],[C,D],[D,B],[D,E]].forEach(function(pair){bar(pair[0],pair[1],.018,0x43695f);});
    bar(D,H,.014,0x87978f);bar(H,[.72,1.06],.016,0x394644);
    add(box,bikeX-.30,.935,bikeZ+.02,.29,.058,.16,0x55463a);
    add(box,bikeX-.04,.31,bikeZ+.10,.29,.034,.08,0x777e73);
    bar([-.12,.35],[-.30,.022],.009,0x4f5b55);
    wheel.dispose();tube.dispose();spoke.dispose();
  }
  // The pavement surface is 16 cm above the road/building origin.
  for(var bv=bicycleVertexStart;bv<extra.position.length/3;bv++)extra.position[bv*3+1]+=.17;
  var bicycleEnd=faces/3+extraIndex.length/3;
  box.dispose();leaf.dispose();bloom.dispose();
  if(!extraIndex.length)return geometry;
  var out=new THREE.BufferGeometry(),oldCount=p.count,addedCount=extra.position.length/3;
  Object.keys(geometry.attributes).forEach(function(name){
    var old=geometry.attributes[name],values=extra[name];
    if(!values)throw new Error('Unexpected facade attribute '+name);
    var array=new old.array.constructor((oldCount+addedCount)*old.itemSize);array.set(old.array);
    var scale=old.normalized?(old.array instanceof Int16Array?32767:255):1;
    for(var i=0;i<values.length;i++)array[old.array.length+i]=old.normalized?Math.round(values[i]*scale):values[i];
    out.setAttribute(name,new THREE.BufferAttribute(array,old.itemSize,old.normalized));
  });
  var IndexType=oldCount+addedCount>65535?Uint32Array:Uint16Array,indices=new IndexType(faces+extraIndex.length);
  for(var i=0;i<faces;i++)indices[i]=index?index.getX(i):i;
  for(var i=0;i<extraIndex.length;i++)indices[faces+i]=oldCount+extraIndex[i];
  out.setIndex(new THREE.BufferAttribute(indices,1));out.addGroup(0,indices.length,0);
  out.computeBoundingBox();out.computeBoundingSphere();out.name=geometry.name;
  out.userData=Object.assign({},geometry.userData,{triangles:indices.length/3,finishRevision:119,finishBaseVertices:oldCount,finishBaseTriangles:faces/3,flowerBoxes:slots.length,flowerClusterRevision:147,flowerHeads:slots.length*21,displayBookFaces:[displayBookStart,displayBookEnd],displayBookCount:variant===1?6:0,bicycleFaces:[bicycleStart,bicycleEnd],parkedBicycles:variant===0?1:0});
  // These fields depend on fixed building geometry, not the camera or light.
  // Bake paint into the existing RGB and use its spare alpha component for
  // room light. Opaque output forces alpha to one; no added varying/attribute.
  var cp=out.attributes.position,cc=out.attributes.color,cu=out.attributes.uv;
  var finishColor=new cc.array.constructor(cp.count*4),colorScale=cc.normalized?255:1;
  function smooth(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  for(var i=0;i<cp.count;i++){
    var x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),cell=Math.floor(cu.getX(i)*4)+4*Math.floor((1-cu.getY(i))*4);
    var paintVariation=Math.sin(x*.31+y*.59+z*.27+variant)*.021+Math.sin(x*.83+y*.37-z*.71+variant)*.012;
    var roomVariation=.5+.5*Math.sin(y*.81+z*.19+x*.13+variant*.71);
    var brown=smooth(.02,.065,cc.getX(i)-cc.getY(i))*(1-smooth(.28,.45,cc.getX(i)));
    var lowRoom=(1-smooth(3.8,4.5,y))*smooth(.8,1.15,y);
    for(var c=0;c<3;c++){
      // V125: the apricot corner's upper plaster leans salmon-pink, as in the
      // art direction. Its warm tan and cream paint gain red and blue; trim,
      // joinery, glass and the added planting keep their colours.
      var value=cc.getComponent(i,c)*(cell===1?1+paintVariation:1)*(variant===0&&i<oldCount&&y>6.2&&cell<=1&&cc.getX(i)>cc.getY(i)&&cc.getY(i)>cc.getZ(i)&&cc.getX(i)-cc.getZ(i)>.12?[1.13,.985,1.11][c]:1);
      finishColor[i*4+c]=cc.normalized?Math.round(Math.max(0,Math.min(1,value))*colorScale):value;
    }
    var light=cell===2?roomVariation:(cell<2?brown*lowRoom:0);
    finishColor[i*4+3]=cc.normalized?Math.round(light*colorScale):light;
  }
  out.setAttribute('color',new THREE.BufferAttribute(finishColor,4,cc.normalized));
  geometry.dispose();return out;
}

if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};
