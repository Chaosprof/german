/* Berlin Kiez: authored modular architecture, shared atlas and one draw per building.
 * This factory is embedded in berlin-runner.html by tools/install_berlin_kiez.cjs.
 * Geometry is local +Z-facing, with its entire footprint behind the pavement edge.
 */
function createBerlinKiezKit(THREE, makeMaterial, canvasFactory) {
  'use strict';
  var atlasSize = typeof IS_MOBILE !== 'undefined' && IS_MOBILE ? 1024 : 2048;
  var atlas = canvasFactory(atlasSize, atlasSize), ctx = atlas.getContext('2d');
  var CELL = atlasSize / 4, cells = 4;
  function tile(id, paint) {
    ctx.save(); ctx.translate((id % cells) * CELL, Math.floor(id / cells) * CELL);
    ctx.scale(CELL/256,CELL/256);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256); paint(ctx); ctx.restore();
  }
  function gradient(g, top, bottom) {
    var fill = g.createLinearGradient(0, 0, 0, 256);
    fill.addColorStop(0, top); fill.addColorStop(1, bottom);
    g.fillStyle = fill; g.fillRect(0, 0, 256, 256);
  }
  tile(0, function () {});
  tile(1, function (g) {
    gradient(g, '#fffdf8', '#d8d5ce');
    g.fillStyle = 'rgba(255,255,255,.11)';
    for (var i = 0; i < 18; i++) g.fillRect((i * 73) % 256, (i * 41) % 256, 35, 2);
  });
  tile(2, function (g) {
    // Broad sky and warm opposite-wall reflections. Fine repeated foliage
    // baked into every pane made the whole street look dirty at running speed.
    var sky=g.createLinearGradient(0,0,0,256);
    sky.addColorStop(0,'#7e9baa');sky.addColorStop(.45,'#596f75');
    sky.addColorStop(.68,'#4d574e');sky.addColorStop(1,'#353c39');
    g.fillStyle=sky;g.fillRect(0,0,256,256);
    var returnLight=g.createLinearGradient(0,0,256,0);
    returnLight.addColorStop(0,'rgba(211,180,133,.02)');
    returnLight.addColorStop(.26,'rgba(211,180,133,.26)');
    returnLight.addColorStop(.52,'rgba(211,180,133,.11)');
    returnLight.addColorStop(1,'rgba(211,180,133,.02)');
    g.fillStyle=returnLight;g.fillRect(0,45,256,211);
    g.fillStyle='rgba(231,231,205,.09)';g.fillRect(19,6,5,242);
    g.fillStyle='rgba(23,33,36,.24)';g.fillRect(0,0,256,11);
  });
  tile(3, function (g) {
    gradient(g, '#edf0f0', '#aeb9bc');
    for (var y = 0; y < 256; y += 32) {
      g.fillStyle = 'rgba(36,55,65,.22)'; g.fillRect(0, y, 256, 3);
      g.fillStyle = 'rgba(255,255,255,.24)'; g.fillRect(0, y + 3, 256, 2);
      for (var x = (y % 64 ? -16 : 0); x < 256; x += 64) {
        g.fillStyle = 'rgba(36,55,65,.16)'; g.fillRect(x, y, 2, 32);
      }
    }
  });
  var bookColors = ['#bc6044', '#d5b65e', '#7baca0', '#b99a7e', '#7493ac', '#ede2bf'];
  tile(4, function (g) {
    gradient(g, '#af8559', '#342c31');
    for (var row = 0; row < 4; row++) {
      for (var b = 0; b < 13; b++) {
        var bh = 30 + (b * 17 + row * 13) % 21;
        g.fillStyle = bookColors[(b + row * 3) % 6];
        g.fillRect(10 + b * 18, 42 + row * 55 - bh, 12, bh);
        g.fillStyle = 'rgba(255,241,193,.45)'; g.fillRect(12 + b * 18, 33 + row * 55, 8, 2);
      }
      g.fillStyle = '#d3ab76'; g.fillRect(0, 44 + row * 55, 256, 6);
      g.fillStyle = '#372f2c'; g.fillRect(0, 50 + row * 55, 256, 7);
    }
    g.fillStyle = 'rgba(246,246,213,.12)'; g.beginPath(); g.moveTo(8, 0);
    g.lineTo(72, 0); g.lineTo(256, 184); g.lineTo(256, 245); g.closePath(); g.fill();
  });
  tile(5, function (g) {
    gradient(g, '#b58d58', '#493a31');
    for (var row = 0; row < 3; row++) {
      for (var b = 0; b < 4; b++) {
        var bx = 34 + b * 62, by = 66 + row * 67;
        g.fillStyle = '#6a4126'; g.beginPath(); g.ellipse(bx, by + 6, 25, 10, 0, 0, 7); g.fill();
        g.fillStyle = '#e3b56c'; g.beginPath(); g.ellipse(bx, by, 24, 15, -.18, 0, 7); g.fill();
        g.strokeStyle = '#f8dfa0'; g.lineWidth = 4;
        for (var k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(bx + k * 11 - 3, by - 8); g.lineTo(bx + k * 11 + 3, by + 5); g.stroke(); }
      }
      g.fillStyle = '#d6ad78'; g.fillRect(0, 86 + row * 67, 256, 7);
      g.fillStyle = '#6b4b32'; g.fillRect(0, 93 + row * 67, 256, 5);
    }
  });
  tile(6, function (g) {
    gradient(g, '#dcc08b', '#5c5650');
    g.fillStyle = '#59483f'; g.fillRect(24, 104, 25, 137); g.fillRect(194, 104, 25, 137);
    g.fillStyle = '#8e6a47'; g.fillRect(10, 152, 236, 17);
    g.fillStyle = '#fff0bd'; g.beginPath(); g.ellipse(130, 87, 24, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#b89159'; g.fillRect(127, 0, 5, 75);
    g.fillStyle = '#e2dbbf'; g.fillRect(72, 131, 26, 21); g.fillRect(160, 131, 24, 21);
  });
  tile(7, function (g) {
    gradient(g, '#c4b89b', '#746b61');
    // Framed studio prints: large shapes remain legible through the glazing.
    [[19,28,91,124],[141,54,96,126]].forEach(function(r,i){
      g.fillStyle='#544c43';g.fillRect(r[0]-5,r[1]-5,r[2]+10,r[3]+10);
      g.fillStyle='#eee0bd';g.fillRect(r[0],r[1],r[2],r[3]);
      g.fillStyle=i?'#739e97':'#ba7259';g.fillRect(r[0]+13,r[1]+15,r[2]-26,r[3]-30);
      g.fillStyle='#e3c482';g.beginPath();g.arc(r[0]+r[2]*.5,r[1]+r[3]*.38,21,0,Math.PI*2);g.fill();
      g.fillStyle='#566971';g.beginPath();g.moveTo(r[0]+13,r[1]+r[3]-15);
      g.lineTo(r[0]+r[2]*.55,r[1]+r[3]*.49);g.lineTo(r[0]+r[2]-13,r[1]+r[3]-15);g.fill();
    });
    g.fillStyle='#ac8c65';g.fillRect(0,216,256,13);
  });
  tile(8, function (g) {
    gradient(g, '#78918a', '#2a4446');
    for(var row=0;row<2;row++) for(var b=0;b<4;b++) {
      var bx=30+b*65,by=107+row*107;
      g.fillStyle='#bc9a70';g.fillRect(bx-16,by-18,32,29);
      g.strokeStyle='#63855b';g.lineWidth=5;
      for(var k=-1;k<=1;k++) {
        g.beginPath();g.moveTo(bx,by-15);g.lineTo(bx+k*15,by-58-Math.abs(k)*8);g.stroke();
        g.fillStyle=['#eac580','#d88276','#ebe0ba'][(b+row+k+3)%3];
        g.beginPath();g.ellipse(bx+k*15,by-60-Math.abs(k)*8,13,14,0,0,Math.PI*2);g.fill();
      }
    }
    g.fillStyle='#c5a573';g.fillRect(0,126,256,7);g.fillRect(0,234,256,8);
  });
  var signs = ['BÄCKEREI', 'BÜCHER', 'KAFFEE', 'BLUMEN', 'ATELIER', 'SPÄTI'];
  signs.forEach(function (word, index) {
    tile(9 + index, function (g) {
      g.fillStyle = '#263f43'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#bca775'; g.lineWidth = 3; g.strokeRect(7, 56, 242, 144);
      g.fillStyle = '#fff0c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold ' + (word.length > 7 ? 34 : 43) + 'px Georgia';
      g.fillText(word, 128, 126, 226);
      g.fillStyle = '#bea876'; g.fillRect(97, 173, 62, 2);
    });
  });
  tile(15, function(g) {
    gradient(g,'#7d9690','#344b4b');
    for(var row=0;row<4;row++) {
      for(var b=0;b<9;b++) {
        var bx=8+b*28,by=14+row*57;
        g.fillStyle=['#d9c591','#b87256','#80a697','#dedbbd'][(b+row)%4];
        g.fillRect(bx,by+7,19,34);g.fillRect(bx+5,by,9,7);
        g.fillStyle='#f0dec0';g.fillRect(bx+2,by+17,15,11);
      }
      g.fillStyle='#b99e77';g.fillRect(0,56+row*57,256,6);
    }
  });
  var texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  texture.name = 'Kiez shared painted surfaces '+atlasSize;
  // The generated interiors are source art, sampled behind the real window
  // reveals. All buildings share one atlas at the device's texture budget.
  function loadPaintedCells(data,cells,loadedFlag,wholeImage) {
    if(typeof Image==='undefined')return;
    var referenceImage = new Image();
    referenceImage.onload = function () {
      cells.forEach(function (entry) {
        var id=entry[0], halfW=referenceImage.width/(wholeImage?1:2),halfH=referenceImage.height/(wholeImage?1:2);
        // A late room-atlas decode must not replace the newer plaster cell.
        if(id===1 && !wholeImage && texture.userData.plasterLoaded)return;
        ctx.drawImage(referenceImage,entry[1]*halfW,entry[2]*halfH,halfW,halfH,
          (id%4)*CELL,Math.floor(id/4)*CELL,CELL,CELL);
        if(id===1){ctx.fillStyle='rgba(255,255,255,.40)';ctx.fillRect(CELL,0,CELL,CELL);}
      });
      texture.needsUpdate=true;texture.userData[loadedFlag]=true;
    };
    referenceImage.src = data;
  }
  if(typeof BERLIN_REFERENCE_INTERIORS!=='undefined')loadPaintedCells(BERLIN_REFERENCE_INTERIORS,[[5,0,0],[4,1,0],[1,1,1]],'referenceLoaded');
  if(typeof BERLIN_SECONDARY_ROOMS!=='undefined')loadPaintedCells(BERLIN_SECONDARY_ROOMS,[[6,0,0],[8,1,0],[7,0,1],[15,1,1]],'secondaryLoaded');
  if(typeof BERLIN_REFERENCE_PLASTER!=='undefined')loadPaintedCells(BERLIN_REFERENCE_PLASTER,[[1,0,0]],'plasterLoaded',true);
  var material = makeMaterial(0xffffff, { map: texture, vertexColors: true,
    roughness: 0.86, metalness: 0, emissive: 0x34303a, emissiveIntensity: 0.08 });
  material.name = 'Kiez painted architecture';
  var baseCompile=material.onBeforeCompile,baseProgramKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer) {
    if(baseCompile)baseCompile.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n#ifdef USE_MAP\n'+
      'float kiezPaintTile=floor(vMapUv.x*4.0)+floor((1.0-vMapUv.y)*4.0)*4.0;\n'+
      'float kiezPane=1.0-step(0.5,abs(kiezPaintTile-2.0));\n'+
      'float kiezRoom=step(3.5,kiezPaintTile)*(1.0-step(8.5,kiezPaintTile))+step(14.5,kiezPaintTile);\n'+
      'vec2 kiezLocal=fract(vMapUv*4.0);\n'+
      'float kiezEdge=min(min(kiezLocal.x,1.0-kiezLocal.x),min(kiezLocal.y,1.0-kiezLocal.y));\n'+
      'diffuseColor.rgb*=mix(1.0,mix(0.70,1.0,smoothstep(0.025,0.15,kiezEdge)),max(kiezPane,kiezRoom));\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_MAP\n'+
      'float kiezTile=floor(vMapUv.x*4.0)+floor((1.0-vMapUv.y)*4.0)*4.0;\n'+
      'float kiezShop=step(3.5,kiezTile)*(1.0-step(8.5,kiezTile))+step(14.5,kiezTile);\n'+
      'totalEmissiveRadiance+=diffuseColor.rgb*kiezShop*0.46;\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n#ifdef USE_MAP\n'+
      'float kiezSurface=floor(vMapUv.x*4.0)+floor((1.0-vMapUv.y)*4.0)*4.0;\n'+
      'float kiezGlass=1.0-step(0.5,abs(kiezSurface-2.0));\n'+
      'float kiezGlazing=step(3.5,kiezSurface)*(1.0-step(8.5,kiezSurface));\n'+
      'roughnessFactor=mix(roughnessFactor,0.17,kiezGlass);\n'+
      'roughnessFactor=mix(roughnessFactor,0.34,kiezGlazing);\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\n#ifdef USE_MAP\n'+
      'metalnessFactor=mix(metalnessFactor,0.16,kiezGlass);\n#endif');
  };
  material.customProgramCacheKey=function(){return (baseProgramKey?baseProgramKey.call(this):'')+'|kiez-window-light-v4';};
  var cache = Object.create(null), templates = Object.create(null);
  var authoredMasters = Object.create(null);
  var cream = 0xe9d9bd, trimShade = 0xbbae95, teal = 0x3b5a53;
  var palettes = [0xdca480, 0xaebba0, 0xdccdb5, 0xd4ad96, 0xc1c1b2, 0xd5b99a];

  function shape(w, h, arch) {
    var hw = w / 2, hh = h / 2, r = arch ? Math.min(w * .5, h * .37) : 0;
    if (!r) return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
    var a = [[-hw,-hh],[hw,-hh],[hw,hh-r]];
    for (var i=1;i<=10;i++) { var t=i*Math.PI/10; a.push([Math.cos(t)*hw,hh-r+Math.sin(t)*r]); }
    return a;
  }
  function build(w, variant, side) {
    var key = w + ':' + variant + ':' + side;
    if (cache[key]) return cache[key];
    // Two Blender masters supply the focal architecture. Shared CPU geometry
    // is resized once per frontage and mirrored once per street side; no GLTF
    // loader, additional materials, or per-frame asset work is needed.
    if (typeof BERLIN_REFERENCE_ARCHITECTURE !== 'undefined' &&
        typeof decodeBerlinMeshRecord === 'function' && variant < 2) {
      var record = BERLIN_REFERENCE_ARCHITECTURE.meshes['13.5:' + variant + ':1'];
      if (record) {
        var master = authoredMasters[variant] ||
          (authoredMasters[variant] = decodeBerlinMeshRecord(THREE, record));
        var authored = master.clone(), xScale = w / 13.5 * side;
        authored.scale(xScale, 1, 1);
        if (side < 0) {
          var indices=authored.index.array, texcoords=authored.attributes.uv;
          for (var ai=0;ai<indices.length;ai+=3) {
            var swap=indices[ai+1];indices[ai+1]=indices[ai+2];indices[ai+2]=swap;
          }
          // Keep shop lettering and interior images readable after mirroring.
          for (var ti=0;ti<texcoords.count;ti++) {
            var u=texcoords.getX(ti), cell=Math.floor(u*4);
            texcoords.setX(ti,(2*cell+1)/4-u);
          }
        }
        authored.addGroup(0,authored.index.count,0);
        authored.computeBoundingBox();authored.computeBoundingSphere();
        authored.name='Blender Kiez '+variant+' '+w+'m';
        authored.userData={kiez:true,blender:true,variant:variant,width:w,
          height:record.roofBase!==undefined?record.roofBase:(variant===0?6.0:4.70)+(variant===1?4:3)*3.05,triangles:record.triangles,
          masterWidth:13.5,bevel:.027,contactBaked:true};
        cache[key]=authored;return authored;
      }
    }
    var p=[], n=[], uv=[], colors=[], shadeSoffit=false, fabricRanges=[];
    var white = new THREE.Color(), normal = new THREE.Vector3(), point = new THREE.Vector3();
    var matrix = new THREE.Matrix4(), rotation = new THREE.Euler(), scale = new THREE.Vector3(1,1,1);
    var quaternion = new THREE.Quaternion(), offset = new THREE.Vector3();
    function vertex(x,y,z,nx,ny,nz,u,v,color,tile,paintShade) {
      p.push(x,y,z); n.push(nx,ny,nz);
      var cx=tile%4, cy=Math.floor(tile/4), pad=3/256;
      uv.push((cx+pad+u*(1-pad*2))/4, 1-(cy+pad+(1-v)*(1-pad*2))/4);
      white.setHex(color);
      if(shadeSoffit&&ny<-.99)white.setHex(0x8d8170);
      // Broad painted bounce: enough shading to hold the forms even in low quality.
      var f = (.90 + Math.max(0,ny)*.10 + Math.max(0,nz)*.03)*(paintShade===undefined?1:paintShade);
      colors.push(white.r*f,white.g*f,white.b*f);
    }
    function geometry(geo,x,y,z,color,tile,rx,ry,rz,sx,sy,sz) {
      offset.set(x||0,y||0,z||0); rotation.set(rx||0,ry||0,rz||0);
      quaternion.setFromEuler(rotation); scale.set(sx||1,sy||1,sz||1);
      matrix.compose(offset,quaternion,scale);
      var normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
      var pos=geo.attributes.position, norms=geo.attributes.normal, tex=geo.attributes.uv;
      var count=geo.index?geo.index.count:pos.count;
      for(var i=0;i<count;i++) {
        var j=geo.index?geo.index.getX(i):i;
        point.fromBufferAttribute(pos,j).applyMatrix4(matrix);
        normal.fromBufferAttribute(norms,j).applyMatrix3(normalMatrix).normalize();
        vertex(point.x,point.y,point.z,normal.x,normal.y,normal.z,
          tex?Math.max(0,Math.min(1,tex.getX(j))):.5,tex?Math.max(0,Math.min(1,tex.getY(j))):.5,color,tile||0);
      }
    }
    function box(x,y,z,ww,hh,dd,color,tile,rx,ry,rz) {
      var geo=templates.box||(templates.box=new THREE.BoxGeometry(1,1,1));
      geometry(geo,x,y,z,color,tile,rx,ry,rz,ww,hh,dd);
    }
    function cylinder(x,y,z,r1,r2,height,color,segments) {
      var ck='c'+r1+':'+r2+':'+height+':'+(segments||16);
      var geo=templates[ck]||(templates[ck]=new THREE.CylinderGeometry(r1,r2,height,segments||16,1));
      geometry(geo,x,y,z,color,1);
    }
    function leaf(x,y,z,rx,ry,rz,color) {
      var geo=templates.leaf||(templates.leaf=new THREE.IcosahedronGeometry(1,1));
      geometry(geo,x,y,z,color,0,0,(x+y)*.7,0,rx,ry,rz);
    }
    function quad(a,b,c,d,color,tile,cornerShade) {
      var uvec=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
      var vvec=new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
      var nm=uvec.cross(vvec).clone();
      // An arch's top corner can collapse one half of a quad to a point.
      // Use its other face for the normal, then omit the zero-area triangle.
      if(nm.lengthSq()<1e-14)nm.set(d[0]-a[0],d[1]-a[1],d[2]-a[2]).cross(vvec).negate();
      nm.normalize();
      var points=[a,b,c,a,c,d],coords=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
      for(var tr=0;tr<2;tr++) {
        var p0=points[tr*3],p1=points[tr*3+1],p2=points[tr*3+2];
        uvec.set(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]);
        vvec.set(p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]);
        if(uvec.cross(vvec).lengthSq()<1e-14)continue;
        for(var tv=0;tv<3;tv++){var pi=tr*3+tv,vv=points[pi],t=coords[pi];vertex(vv[0],vv[1],vv[2],nm.x,nm.y,nm.z,t[0],t[1],color,tile||0,cornerShade?cornerShade[[0,1,2,0,2,3][pi]]:1);}
      }
    }
    function windowUnit(x,y,z,ww,hh,arch,tile,frame,angle,recess,compactSill,wallInset) {
      var inner=shape(ww,hh,arch), outer=shape(ww+.22,hh+.22,arch), N=inner.length;
      var depth=recess||.12, isShop=tile>=4&&tile<=8||tile===15;
      var rim=wallInset?.06:.16, barDepth=wallInset?-depth+.045:.17;
      var ca=Math.cos(angle||0),sa=Math.sin(angle||0);
      function at(v,depth){return [x+v[0]*ca+depth*sa,y+v[1],z-v[0]*sa+depth*ca];}
      for(var i=0;i<N;i++) {
        var j=(i+1)%N;
        quad(at(outer[i],rim),at(outer[j],rim),at(inner[j],rim),at(inner[i],rim),frame,1);
        // A restrained contact gradient follows the real 23cm upper reveal.
        // Its front lip stays light; the wall end beside the glass is deeper.
        quad(at(inner[i],rim),at(inner[j],rim),at(inner[j],-depth),at(inner[i],-depth),isShop?0x756049:wallInset?0x9e927e:trimShade,1,wallInset?[1,1,.72,.72]:undefined);
        if(wallInset)quad(at(outer[j],0),at(outer[i],0),at(outer[i],rim),at(outer[j],rim),frame,1);
      }
      if(isShop&&arch)for(var sp=2;sp<outer.length-1;sp++) {
        var va=outer[sp],vb=outer[sp+1],top=hh/2+.11;
        quad(at(va,.01),at([va[0],top],.01),at([vb[0],top],.01),at(vb,.01),frame,1);
      }
      // Convex arch fan. Texture remains continuous across every triangle.
      var center=at([0,0],-depth+.005);
      for(var k=0;k<N;k++) {
        var a=inner[k],b=inner[(k+1)%N],pa=at(a,-depth+.005),pb=at(b,-depth+.005);
        [[center,.5,.5],[pa,a[0]/ww+.5,a[1]/hh+.5],[pb,b[0]/ww+.5,b[1]/hh+.5]].forEach(function(vv){vertex(vv[0][0],vv[0][1],vv[0][2],sa,0,ca,vv[1],vv[2],0xffffff,tile);});
      }
      var mullionColor=tile===2?0x766654:frame;
      if(tile!==5)box(x+sa*barDepth,y,z+ca*barDepth,.045,hh,.09,mullionColor,0,0,angle||0);
      if(!isShop)box(x+sa*(barDepth+.01),y+hh*.06,z+ca*(barDepth+.01),ww,.045,.10,mullionColor,0,0,angle||0);
      // Pronounced sill and its cool contact seam make the openings read at speed.
      var sillPush=compactSill?.04:.10;
      box(x+sa*sillPush,y-hh/2-.19,z+ca*sillPush,ww+(compactSill?.25:.49),.17,compactSill?.21:.38,wallInset?frame:cream,1,0,angle||0);
      box(x+sa*.06,y+hh/2+.21,z+ca*.06,ww+.37,.10,.27,trimShade,0,0,angle||0);
    }
    // Flat wall skins leave genuine openings over a set-back structural core.
    // Coplanar bands/pier faces weld during the Blender polish, so windows add
    // depth without making every wall fragment a separately beveled cuboid.
    function piercedUpperWall(span,x,z,centers,angle,allArches) {
      var ca=Math.cos(angle),sa=Math.sin(angle),ww=1.47,hh=2.03;
      function at(u,v){return [x+u*ca,v,z-u*sa];}
      function panel(left,right,bottom,top){
        if(right-left>.00001&&top-bottom>.00001)quad(at(left,bottom),at(right,bottom),at(right,top),at(left,top),body,1);
      }
      centers=centers.slice().sort(function(a,b){return a-b;});
      for(var floor=0;floor<floors;floor++) {
        var cy=groundH+floor*floorH+floorH*.51,bottom=cy-hh/2,top=cy+hh/2;
        panel(-span/2,span/2,groundH+floor*floorH,bottom);
        panel(-span/2,span/2,top,groundH+(floor+1)*floorH);
        var start=-span/2;
        centers.forEach(function(center){
          panel(start,center-ww/2,bottom,top);start=center+ww/2;
          if(allArches||floor===floors-1) {
            var arch=shape(ww,hh,true);
            for(var segment=2;segment<arch.length-1;segment++) {
              var a=arch[segment],b=arch[segment+1];
              quad(at(center+a[0],cy+a[1]),at(center+a[0],top),at(center+b[0],top),at(center+b[0],cy+b[1]),body,1);
            }
          }
        });
        panel(start,span/2,bottom,top);
      }
    }
    function flowers(x,y,z,ww) {
      box(x,y,z,ww,.22,.37,teal,1);
      box(x,y+.13,z+.02,ww+.08,.055,.42,cream,0);
      var small=templates.flowerLeaf||(templates.flowerLeaf=new THREE.IcosahedronGeometry(1,0));
      var petal=templates.petal||(templates.petal=new THREE.SphereGeometry(1,6,3));
      for(var i=0;i<13;i++) {
        var xx=x+((i*7%13)/12-.5)*ww*.94;
        var yy=y+.21+Math.sin(i*2.7)*.13, zz=z+.08+Math.cos(i*1.8)*.12;
        geometry(small,xx,yy,zz,i%3?0x627d45:0x879e51,0,.4,i*.8,0,.16,.10,.13);
        if(i<9) {
          var flowerColor=[0xe8a29a,0xf1d6b0,0xd98386][i%3];
          geometry(petal,xx+.03,yy+.10,zz+.05,flowerColor,0,0,i,0,.073,.049,.066);
          geometry(small,xx+.03,yy+.14,zz+.055,0xe3be68,0,0,0,0,.026,.019,.026);
        }
        if(i%4===0)geometry(small,xx,y-.10-(i%3)*.12,z+.22,0x547245,0,.4,i,0,.13,.19,.09);
      }
    }
    var floors=[3,4,3,3,4,3][variant], floorH=3.05, groundH=variant===0?6.0:4.70;
    var h=groundH+floors*floorH, body=palettes[variant], roof=variant%2?0x526c76:0x64777a;
    var focal=variant<2, upperTrim=focal?new THREE.Color(cream).multiplyScalar(.80).getHex():cream;
    var shopCount=variant===1?3:w===16&&variant!==0?3:2, shopSpacing=(w-.9)/shopCount;
    var bakerySpan=w-3.65,shopFronts=[];
    for(var panel=0;panel<shopCount;panel++) {
      var panelX=variant===0?-side*1.15+side*bakerySpan*(panel===0?-.165:.36):(panel-(shopCount-1)/2)*shopSpacing;
      var panelW=variant===0?bakerySpan*(panel===0?.65:.22)-.20:shopSpacing-.60;
      shopFronts.push({x:panelX,w:panelW});
    }
    var groundColor=variant===0?body:variant===1?0x39594f:0x67716a;
    // The upper mass sits over true recessed shop rooms. An unbroken box
    // behind the windows would hide their back walls and flatten every portal.
    box(0,(h+groundH)/2,-4.20,w-.80,h-groundH,7.60,body,1);
    box(0,groundH/2,-4.50,w,groundH,7.0,groundColor,1);
    box(0,.24,.05,w+.12,.48,.50,trimShade,1);
    var shopHeight=variant===0?4.56:3.36, shopCenter=.53+shopHeight/2;
    box(0,groundH-.35,-.05,w,.70,.50,groundColor,1);
    var openings=shopFronts.slice().sort(function(a,b){return a.x-b.x;}), wallStart=-w/2;
    openings.forEach(function(opening){
      var wallEnd=opening.x-opening.w/2-.11;
      if(wallEnd>wallStart)box((wallStart+wallEnd)/2,shopCenter+.01,-.24,wallEnd-wallStart,shopHeight+.12,1.42,groundColor,1);
      wallStart=opening.x+opening.w/2+.11;
    });
    if(wallStart<w/2)box((wallStart+w/2)/2,shopCenter+.01,-.24,w/2-wallStart,shopHeight+.12,1.42,groundColor,1);
    box(0,groundH,.18,w+.34,.26,.45,cream,1);
    box(0,groundH+.23,.10,w+.20,.12,.30,trimShade,0);
    // Facade pilasters and paired cornices articulate the whole silhouette.
    [-1,1].forEach(function(s){
      box(s*(w/2-.22),(h+groundH)/2,.10,.36,h-groundH,.29,upperTrim,1);
      for(var q=0;q<4;q++) box(s*(w/2-.22),groundH+q*.30,.16,.56,.12,.36,cream,1);
    });
    for(var f=1;f<floors;f++) {
      shadeSoffit=true;
      box(0,groundH+f*floorH-.13,focal?.13:.04,w,focal?.18:.12,focal?.30:.19,trimShade,0);
      shadeSoffit=false;
    }
    box(0,h+.05,.12,w+.50,.22,.54,upperTrim,1);
    shadeSoffit=true;
    box(0,h+.29,.22,w+.80,.18,.76,upperTrim,1);
    shadeSoffit=false;
    box(0,h+.45,.14,w+.55,.12,.59,trimShade,0);
    // Close the roof spring line on the side/rear walls too. Front cornices
    // alone leave daylight under the mansard from an airborne oblique view.
    box(0,h+.245,-3.98,w+.60,.50,8.64,cream,1);
    // A real mansard with inclined faces, not an extra cuboid on the roof.
    var lo=[[-w/2-.3,h+.47,.34],[w/2+.3,h+.47,.34],[w/2+.3,h+.47,-8.3],[-w/2-.3,h+.47,-8.3]];
    var hi=[[-w/2+.85,h+2.65,-1.10],[w/2-.85,h+2.65,-1.10],[w/2-.85,h+2.65,-7.10],[-w/2+.85,h+2.65,-7.10]];
    for(var rf=0;rf<4;rf++) quad(lo[rf],lo[(rf+1)%4],hi[(rf+1)%4],hi[rf],roof,3);
    quad(hi[0],hi[1],hi[2],hi[3],roof,3);
    var bays=w===16?4:3, spacing=(w-1.0)/bays;
    var turret=variant===0||variant===3;
    var turretX=side*(w/2-(variant===0?2.10:1.5)), turretR=variant===0?1.95:1.5;
    {
      // Every neighbour uses actual recessed openings. The solid core sits
      // behind these skins so side and front panes share the same 23cm depth.
      var frontCenters=[];
      for(var bay=0;bay<bays;bay++) {
        var center=(bay-(bays-1)/2)*spacing;
        if(!turret||Math.abs(center-turretX)>=2.1)frontCenters.push(center);
      }
      piercedUpperWall(w,0,0,frontCenters,0,variant===1);
      [-1,1].forEach(function(edge){
        piercedUpperWall(8,edge*w/2,-4,[-1.95*edge,1.85*edge],edge*Math.PI/2,false);
        // Close the rear corners exposed by the narrower inner structure.
        var a=edge*w/2,b=edge*(w/2-.40);
        quad([Math.max(a,b),groundH,-8],[Math.min(a,b),groundH,-8],[Math.min(a,b),h,-8],[Math.max(a,b),h,-8],body,1);
      });
    }
    for(var col=0;col<bays;col++) {
      var xx=(col-(bays-1)/2)*spacing;
      for(var floor=0;floor<floors;floor++) {
        if(turret&&Math.abs(xx-turretX)<2.1) continue;
        var yy=groundH+floor*floorH+floorH*.51;
        windowUnit(xx,yy,0,1.47,2.03,variant===1||floor===floors-1,2,upperTrim,0,.235,false,true);
        if((col+floor+variant)%3===0) flowers(xx,yy-1.13,.43,1.54);
      }
      if(col%2===0) {
        box(xx,h+1.10,-.05,1.31,1.31,1.22,body,1);
        windowUnit(xx,h+1.19,.63,.74,.94,true,2,cream);
        // Small pitched dormer cap.
        box(xx-.37,h+1.96,-.04,.92,.14,1.47,roof,3,0,0,.43);
        box(xx+.37,h+1.96,-.04,.92,.14,1.47,roof,3,0,0,-.43);
      }
    }
    // The staggered street exposes return walls. Continue the same window
    // language around them instead of revealing a tall featureless rectangle.
    [-1,1].forEach(function(edge) {
      for(var floor=0;floor<floors;floor++) {
        [-2.05,-5.85].forEach(function(depth) {
          windowUnit(edge*w/2,groundH+floor*floorH+floorH*.51,depth,
            1.47,2.03,floor===floors-1,2,upperTrim,edge*Math.PI/2,.235,false,true);
        });
      }
    });
    for(var sh=0;sh<shopCount;sh++) {
      var shopX=shopFronts[sh].x,shopW=shopFronts[sh].w;
      var shopArch=variant!==0||sh===1;
      windowUnit(shopX,shopCenter,.25,shopW,shopHeight,shopArch,[5,4,6,8,7,15][variant],variant===0?0x947451:0x30534d,0,.88);
      // Real room ceiling, display counter and shelves project in front of
      // the softly lit background image and reveal their thickness in motion.
      box(shopX,.77,-.22,shopW-.16,.44,.58,variant===1?0x665441:0xa1805d,0);
      box(shopX,1.015,-.20,shopW-.08,.075,.64,0xd2bc94,1);
      [1.60,2.31].forEach(function(shelfY){
        box(shopX,shelfY,-.45,shopW-.14,.045,.24,0x947249,0);
      });
      if(variant===0&&sh===0) {
        var rollGeo=templates.bread||(templates.bread=new THREE.SphereGeometry(1,8,4));
        for(var loaf=0;loaf<11;loaf++)geometry(rollGeo,shopX+(loaf-5)*shopW/13,1.10,-.15,
          loaf%3?0xc79243:0xe1b46b,0,0,.23,loaf%2?.12:-.1,.14,.075,.075);
      }
      if(variant===0&&sh===1)box(shopX+side*shopW*.32,1.84,.44,.035,.40,.08,0xc7a971,0);
      // A single broad bakery awning is a focal point. The bookstore's tall
      // arches remain open to view rather than repeating stripes everywhere.
      if((variant===0&&sh===0)||(variant===2&&sh===0)||variant===5) {
        var aw=shopW+(variant===0?.64:.50),stripes=variant===0?12:Math.max(9,Math.round(aw/.44));
        var awningX=shopX;
        if(variant===0) {
          // One continuous fabric shell. Color boundaries share the same
          // surface; they are not separate boxes with beveled structural seams.
          var fabricStart=p.length/9, bandW=aw/stripes, hemRadius=.015;
          function clothRow(row,u) {
            var t, yy, zz, slope=0, bottom=3.65-.14*Math.sin(u*Math.PI);
            if(row<=4){t=row/4;yy=5.65-1.80*t-.045*Math.sin(t*Math.PI);zz=.20+1.95*t;}
            else if(row===5){yy=3.815;zz=2.185;}
            else if(row===6){yy=bottom+hemRadius;zz=2.185;slope=-.14*Math.PI*Math.cos(u*Math.PI)/bandW;}
            else if(row===7){yy=bottom;zz=2.185-hemRadius;slope=-.14*Math.PI*Math.cos(u*Math.PI)/bandW;}
            else if(row===8){yy=bottom;zz=2.125+hemRadius;slope=-.14*Math.PI*Math.cos(u*Math.PI)/bandW;}
            else if(row===9){yy=bottom+hemRadius;zz=2.125;slope=-.14*Math.PI*Math.cos(u*Math.PI)/bandW;}
            else if(row===10){yy=3.815;zz=2.125;}
            else {
              t=(15-row)/4;
              var dy=-1.80-.045*Math.PI*Math.cos(t*Math.PI), len=Math.hypot(dy,1.95);
              yy=5.65-1.80*t-.045*Math.sin(t*Math.PI)-.025*1.95/len;
              zz=.20+1.95*t+.025*dy/len;
            }
            return [yy,zz,slope];
          }
          function clothNormal(row,u) {
            var a=clothRow((row+15)%16,u),b=clothRow(row,u),c=clothRow((row+1)%16,u);
            function edge(q,r){var dy=r[0]-q[0],dz=r[1]-q[1],v=[-dz*b[2],dz,-dy],l=Math.hypot(v[0],v[1],v[2]);return v.map(function(x){return x/l;});}
            var ab=edge(a,b),bc=edge(b,c),nn=ab.map(function(v,i){return v+bc[i];}),ll=Math.hypot(nn[0],nn[1],nn[2]);
            return nn.map(function(v){return v/ll;});
          }
          function clothVertex(st,row,u){var q=clothRow(row,u);return {p:[awningX-aw/2+(st+u)*bandW,q[0],q[1]],n:clothNormal(row,u)};}
          function clothTri(a,b,c,color,faceNormal) {
            [a,b,c].forEach(function(q){var nn=faceNormal||q.n;vertex(q.p[0],q.p[1],q.p[2],nn[0],nn[1],nn[2],.5,.5,color,0);});
          }
          for(var band=0;band<stripes;band++) {
            var clothColor=band%2?0xe49a84:0xf5e8d0;
            for(var row=0;row<16;row++) {
              var next=(row+1)%16,divA=row>=4&&row<=11?8:1,divB=next>=4&&next<=11?8:1;
              if(divA===divB)for(var j=0;j<divA;j++){
                var a=clothVertex(band,row,j/divA),b=clothVertex(band,next,j/divB),c=clothVertex(band,next,(j+1)/divB),d=clothVertex(band,row,(j+1)/divA);
                clothTri(a,b,c,clothColor);clothTri(a,c,d,clothColor);
              }
              else if(divA===1){
                var a=clothVertex(band,row,0),d=clothVertex(band,row,1);
                for(var j=0;j<divB;j++)clothTri(a,clothVertex(band,next,j/divB),clothVertex(band,next,(j+1)/divB),clothColor);
                clothTri(a,clothVertex(band,next,1),d,clothColor);
              } else {
                var b=clothVertex(band,next,0),c=clothVertex(band,next,1);
                clothTri(clothVertex(band,row,0),b,c,clothColor);
                for(var j=0;j<divA;j++)clothTri(clothVertex(band,row,j/divA),c,clothVertex(band,row,(j+1)/divA),clothColor);
              }
            }
          }
          // End caps close only the outer cloth edges, never each color band.
          [0,1].forEach(function(edge){
            var band=edge?stripes-1:0,u=edge?1:0;
            var outline=[];for(var row=0;row<16;row++)outline.push(new THREE.Vector2(clothRow(row,u)[1],clothRow(row,u)[0]));
            var cap=THREE.ShapeUtils.triangulateShape(outline,[]),color=edge?0xe49a84:0xf5e8d0;
            cap.forEach(function(f){var a=clothVertex(band,f[0],u),b=clothVertex(band,f[1],u),c=clothVertex(band,f[2],u);
              var cross=(b.p[1]-a.p[1])*(c.p[2]-a.p[2])-(b.p[2]-a.p[2])*(c.p[1]-a.p[1]);
              if((cross>0)!==!!edge){var swap=b;b=c;c=swap;}
              clothTri(a,b,c,color,[edge?1:-1,0,0]);
            });
          });
          fabricRanges.push([fabricStart,p.length/9]);
        }
        for(var st=0;variant!==0&&st<stripes;st++) {
          var sx=awningX-aw/2+(st+.5)*aw/stripes;
          var ac=st%2===0?0xf0e4cf:0xd3947b;
          box(sx,3.88,.96,aw/stripes+.012,.075,1.80,ac,1,.27,0,0);
          box(sx,3.53,1.82,aw/stripes+.012,.27,.065,ac,1);
        }
        box(awningX,variant===0?5.67:4.12,.22,aw+.10,.12,.18,trimShade,0);
      }
    }
    // One storefront identity per building, not one repeated word per pane.
    var signX=variant===0?shopFronts[1].x:0, signY=variant===0?5.53:4.31;
    var signWidth=variant===0?Math.min(2.50,shopFronts[1].w+.45):Math.min(6.6,w-.43);
    box(0,groundH-.39,.31,w-.25,.56,.23,variant===0?body:teal,1);
    box(signX,signY,.44,signWidth,.43,.045,0x263f43,0);
    if(!templates.sign) {
      templates.sign=new THREE.PlaneGeometry(1,1);
      var signUV=templates.sign.attributes.uv;
      for(var si=0;si<signUV.count;si++) signUV.setY(si,.31+signUV.getY(si)*.38);
    }
    geometry(templates.sign,signX,signY,.471,0xffffff,9+variant,0,0,0,variant===0?signWidth-.14:Math.min(5.5,w-.6),.38,1);
    if(turret) {
      var th=h-groundH+1.05, tz=-.05;
      cylinder(turretX,groundH+th/2,tz,turretR,turretR,th,body,20);
      var turretTrim=turretR+.15;
      cylinder(turretX,groundH-.02,tz,turretTrim,turretTrim,.29,cream,20);
      if(variant===0) {
        // The bay continues to the pavement instead of hanging from the
        // upper floors. Its narrower ground drum preserves the shop doorway.
        cylinder(turretX,groundH/2+.10,tz,1.22,1.22,groundH-.20,body,20);
        cylinder(turretX,.24,tz,1.35,1.35,.30,cream,20);
        cylinder(turretX,groundH-.32,tz,1.47,1.25,.42,cream,20);
        windowUnit(turretX+Math.sin(.10)*1.38,2.72,tz+Math.cos(.10)*1.38,.94,3.32,true,2,cream,.10,0,true);
      }
      for(var fl=0;fl<floors;fl++) {
        var ty=groundH+fl*floorH+floorH*.51;
        [-.74,.28].forEach(function(a){
          windowUnit(turretX+Math.sin(a)*turretTrim,ty,tz+Math.cos(a)*turretTrim,1.00,2.03,true,2,cream,a,0,variant===0);
        });
        cylinder(turretX,groundH+(fl+1)*floorH-.10,tz,turretTrim-.01,turretTrim-.01,.15,cream,20);
      }
      cylinder(turretX,h+.70,tz,variant===0?2.16:1.78,variant===0?2.07:1.62,.36,cream,20);
      // Lathed copper dome with a softly pinched crown and broad spring line.
      var pts=[[1.77,0],[1.80,.14],[1.68,.35],[1.59,.79],[1.33,1.35],[.94,1.92],[.40,2.36],[.12,2.58]];
      if(variant===0)pts=pts.map(function(v){return [v[0]*1.20,v[1]];});
      var dome=new THREE.LatheGeometry(pts.map(function(v){return new THREE.Vector2(v[0],v[1]);}),20);
      geometry(dome,turretX,h+.88,tz,0x588a87,1); dome.dispose();
      for(var rib=0;rib<12;rib++) {
        var ra=rib*Math.PI/6;
        var curve=new THREE.CatmullRomCurve3(pts.map(function(v){return new THREE.Vector3(Math.sin(ra)*(v[0]+.018),v[1],Math.cos(ra)*(v[0]+.018));}));
        var ribGeo=new THREE.TubeGeometry(curve,10,.026,4,false);
        geometry(ribGeo,turretX,h+.88,tz,0x789b91,0);ribGeo.dispose();
      }
      cylinder(turretX,h+3.63,tz,.07,.12,.48,0xc7b385,10);
      if(variant===0) {
        // One broad curved iron balcony replaces the old straight flower
        // shelf. Its opaque geometry joins the same baked facade batch.
        var balconyY=groundH+floorH-.18, balconyR=2.22, balconySegments=14;
        function balconyPoint(angle,radius,yy){return [turretX+Math.sin(angle)*radius,yy,tz+Math.cos(angle)*radius];}
        for(var bs=0;bs<balconySegments;bs++) {
          var a0=-1.12+bs*1.92/balconySegments,a1=-1.12+(bs+1)*1.92/balconySegments;
          [0,.83].forEach(function(lift){
            var low=balconyY+lift,high=low+(lift?.055:.15),radius=balconyR-(lift?.025:0);
            quad(balconyPoint(a0,radius,low),balconyPoint(a1,radius,low),balconyPoint(a1,radius,high),balconyPoint(a0,radius,high),lift?0x394f49:cream,1);
            quad(balconyPoint(a0,radius-.09,high),balconyPoint(a0,radius,high),balconyPoint(a1,radius,high),balconyPoint(a1,radius-.09,high),lift?0x394f49:cream,1);
          });
          if(bs%2===0) {
            var post=balconyPoint(a0,balconyR-.025,balconyY+.46);
            box(post[0],post[1],post[2],.045,.72,.045,0x394f49,0);
          }
        }
        var balconyLeaf=templates.flowerLeaf||(templates.flowerLeaf=new THREE.IcosahedronGeometry(1,0));
        var balconyPetal=templates.petal||(templates.petal=new THREE.SphereGeometry(1,6,3));
        for(var bf=0;bf<13;bf++) {
          var plant=balconyPoint(-1.06+bf*1.72/12,2.17,balconyY+.71+Math.sin(bf*2.7)*.10);
          geometry(balconyLeaf,plant[0],plant[1],plant[2],bf%3?0x627d45:0x879e51,0,.4,bf*.8,0,.23,.15,.18);
          if(bf<9)geometry(balconyPetal,plant[0]+.02,plant[1]+.15,plant[2]+.03,[0xe8a29a,0xf1d6b0,0xd98386][bf%3],0,0,bf,0,.13,.09,.10);
          if(bf%3===0)geometry(balconyLeaf,plant[0],plant[1]-.26,plant[2]+.04,0x547245,0,.4,bf,0,.15,.26,.11);
        }
      } else flowers(turretX,groundH-.26,1.30,2.25);
    } else if(variant===2||variant===5) {
      // Curved central pediment and round attic oculus distinguish the atelier.
      var pediment=new THREE.Shape(); pediment.moveTo(-2.4,0); pediment.lineTo(2.4,0);
      pediment.bezierCurveTo(2.4,1.15,1.1,2.6,0,2.65);
      pediment.bezierCurveTo(-1.1,2.6,-2.4,1.15,-2.4,0);
      var pg=new THREE.ExtrudeGeometry(pediment,{depth:.32,bevelEnabled:false,curveSegments:10});
      geometry(pg,0,h+.45,.35,body,1); pg.dispose();
      windowUnit(0,h+1.46,.75,.94,1.14,true,2,cream);
      cylinder(0,h+3.29,.51,.13,.23,.35,cream,12);
    }
    // Tall chimney pairs give the skyline a deliberate, asymmetrical rhythm.
    box(-w*.31,h+2.82,-5.1,.67,1.31,.82,variant%2?0xb77661:0xd5b98d,1);
    box(-w*.31,h+3.51,-5.1,.89,.15,1.0,cream,1);
    var out=new THREE.BufferGeometry();
    out.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    out.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    out.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    // One material array slot is used by the existing far/near building path.
    out.addGroup(0,p.length/3,0); out.computeBoundingBox(); out.computeBoundingSphere();
    out.name='Kiez '+variant+' '+w+'m';
    out.userData={kiez:true,variant:variant,width:w,height:h,triangles:p.length/9,fabricRanges:fabricRanges};
    cache[key]=out; return out;
  }
  return { geometry: build, material: material, texture: texture, cache: cache,
    palette: palettes, revision: 'kiez-v1' };
}
if (typeof module !== 'undefined') module.exports = createBerlinKiezKit;
