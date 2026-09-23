// Appends low-cost planting and ironwork to visible upper-window slots.
// The geometry remains part of the existing shared building material/batch.
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
  // roof silhouette clear. Four richer foreground boxes per facade.
  slots=slots.slice(0,4);
  var extra={position:[],normal:[],color:[],uv:[]},extraIndex=[],paint=new THREE.Color();
  function add(g,x,y,z,sx,sy,sz,color,ry,rz){
    var pos=g.attributes.position,norm=g.attributes.normal,ind=g.index;
    var m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry||0,rz||0)),new THREE.Vector3(sx,sy,sz));
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
  // Closed six-sided leaf with a curved normal field. Rounded contours read
  // as geranium/ivy leaves, including the hanging ones seen against plaster.
  var leaf=new THREE.BufferGeometry(),lp=[],ln=[],li=[];
  for(var face=0;face<2;face++){
    var sign=face?-1:1;
    for(var edge=0;edge<6;edge++){
      var a=edge*Math.PI/3,x=Math.cos(a),y=Math.sin(a);
      lp.push(x,y,.035*(x*x-y*y));var nn=new THREE.Vector3(x*.35,y*.35,sign).normalize();ln.push(nn.x,nn.y,nn.z);
    }
    lp.push(0,0,sign*.12);ln.push(0,0,sign);
    for(var edge=0;edge<6;edge++)li.push(face*7+6,face*7+(face?(edge+1)%6:edge),face*7+(face?edge:(edge+1)%6));
  }
  leaf.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));leaf.setAttribute('normal',new THREE.Float32BufferAttribute(ln,3));leaf.setIndex(li);
  var bloom=new THREE.SphereGeometry(1,5,2);
  slots.forEach(function(s,si){
    var x=(s.min[0]+s.max[0])/2,y=s.min[1]-.07,z=s.max[2]+.68;
    var w=Math.min(1.78,s.max[0]-s.min[0]+.18);
    // Shallow wrought-iron balconette and dark container form a readable
    // silhouette below the sill without covering the glazed opening.
    add(box,x,y-.12,z,w,.22,.30,0x3d5548);
    add(box,x,y+.16,z+.19,w+.10,.035,.035,0x344340);
    add(box,x,y-.22,z+.19,w+.10,.035,.035,0x344340);
    for(var r=0;r<3;r++)add(box,x+(r/2-.5)*w,y-.035,z+.19,.025,.38,.027,0x344340);
    for(var j=0;j<5;j++){
      var t=j/4,xx=x+(t-.5)*w,yy=y+.055+Math.sin(j*2.4+si)*.09;
      var zz=z+.02+Math.cos(j*1.7)*.13;
      add(leaf,xx,yy,zz,.23,.17,.30,j%3?0x678641:0x8b9c43,Math.sin(j)*.60,.45*Math.sin(j));
      if(j%3===1){
        add(leaf,xx+.035,y-.26-j%3*.035,z+.23,.135,.18,.30,0x4d753a,Math.sin(j)*.6,.25*Math.cos(j));
        add(bloom,xx+.02,yy+.14,zz+.075,.11,.085,.08,[0xda858a,0xf4c9a3,0xe9b0ad][(j+si)%3]);
      }
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
  out.userData=Object.assign({},geometry.userData,{triangles:indices.length/3,finishRevision:119,finishBaseVertices:oldCount,finishBaseTriangles:faces/3,flowerBoxes:slots.length});
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
      var value=cc.getComponent(i,c)*(cell===1?1+paintVariation:1);
      finishColor[i*4+c]=cc.normalized?Math.round(Math.max(0,Math.min(1,value))*colorScale):value;
    }
    var light=cell===2?roomVariation:(cell<2?brown*lowRoom:0);
    finishColor[i*4+3]=cc.normalized?Math.round(light*colorScale):light;
  }
  out.setAttribute('color',new THREE.BufferAttribute(finishColor,4,cc.normalized));
  geometry.dispose();return out;
}
if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};
