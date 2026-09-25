  // Focal shop merchandise uses the same opaque facade atlas and batch.
  // Find actual backdrop components so native openings, mirroring and all
  // frontage widths receive correctly fitted displays.
  var shopDisplayStart=faces/3+extraIndex.length/3,shopDisplayVertexStart=extra.position.length/3;
  var displayBackdropVertices=new Set(),shopBays=[],breadCount=0,spineCount=0;
  if(variant===0||variant===1){
    var shopTile=variant===0?5:4,sp=[],sw=[],points=new Map();
    function rootShop(i){while(sp[i]!==i){sp[i]=sp[sp[i]];i=sp[i];}return i;}
    for(var i=0;i<p.count;i++)if(tile(i)===shopTile&&p.getY(i)<5.2&&n.getZ(i)>.90){
      var key=[p.getX(i).toFixed(4),p.getY(i).toFixed(4),p.getZ(i).toFixed(4)].join(',');
      if(!points.has(key)){points.set(key,sp.length);sp.push(sp.length);}sw[i]=points.get(key);
    }
    for(var f=0;f<faces;f+=3){
      var ids=[0,1,2].map(function(j){return index?index.getX(f+j):f+j;});
      if(ids.every(function(i){return sw[i]!==undefined;}))ids.forEach(function(i){sp[rootShop(sw[i])]=rootShop(sw[ids[0]]);});
    }
    var bays=new Map();
    for(var i=0;i<p.count;i++)if(sw[i]!==undefined){
      var root=rootShop(sw[i]),bay=bays.get(root);
      if(!bay){bay={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],vertices:[]};bays.set(root,bay);}
      bay.vertices.push(i);[p.getX(i),p.getY(i),p.getZ(i)].forEach(function(v,k){bay.min[k]=Math.min(bay.min[k],v);bay.max[k]=Math.max(bay.max[k],v);});
    }
    shopBays=Array.from(bays.values()).filter(function(b){return b.max[0]-b.min[0]>(variant===0?width*.32:1.5)&&b.max[1]-b.min[1]>2.5;});
    shopBays.sort(function(a,b){return a.min[0]-b.min[0];});
    var loaf=new THREE.SphereGeometry(1,12,6),crescent=new THREE.BufferGeometry(),pp=[],pi=[];
    function breadSurface(g,start,croissant){
      // Project existing crust/lamination detail onto the solid bread. The
      // shared atlas and sampling count stay unchanged, unlike adding a decal.
      var pos=g.attributes.position;
      for(var k=0;k<pos.count;k++){
        var x=pos.getX(k)/(croissant?.29:1),y=pos.getY(k)/(croissant?.085:1);
        var u=(croissant?.523:.199)+x*(croissant?.038:.045),v=(croissant?.654:.650)+y*(croissant?.043:.035);
        extra.uv[(start+k)*2]=(1+u)/4;extra.uv[(start+k)*2+1]=(2+v)/4;
      }
    }
    // A closed tapered crescent with shallow folds in its laminated surface.
    for(var ring=0;ring<=10;ring++){
      var t=ring/10,a=-2.03+t*4.06,r=(.014+.065*Math.sin(t*Math.PI))*(ring%2?.88:1);
      var nx=Math.sin(a)*.12,nz=Math.cos(a)*.20,nlen=Math.hypot(nx,nz);nx/=nlen;nz/=nlen;
      for(var j=0;j<6;j++){var phi=j*Math.PI/3;pp.push(Math.sin(a)*.20+nx*Math.cos(phi)*r,.025*Math.sin(t*Math.PI)+Math.sin(phi)*r*.78,Math.cos(a)*.12+nz*Math.cos(phi)*r);}
    }
    for(var ring=0;ring<10;ring++)for(var j=0;j<6;j++){
      var a=ring*6+j,b=ring*6+(j+1)%6,c=(ring+1)*6+j,d=(ring+1)*6+(j+1)%6;pi.push(a,c,b,b,c,d);
    }
    pp.push(Math.sin(-2.03)*.20,0,Math.cos(-2.03)*.12,Math.sin(2.03)*.20,0,Math.cos(2.03)*.12);
    for(var j=0;j<6;j++){pi.push(66,j,(j+1)%6,67,60+(j+1)%6,60+j);}
    crescent.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));crescent.setIndex(pi);crescent.computeVertexNormals();
    var covers=[0x60756b,0x84664e,0xa8754b,0x496979,0x9a6859,0xb5a282,0x53605b,0x7c7856];
    shopBays.forEach(function(bay,bi){
      bay.vertices.forEach(function(i){displayBackdropVertices.add(i);});
      var cx=(bay.min[0]+bay.max[0])/2,w=bay.max[0]-bay.min[0]-.22,z=bay.max[2];
      if(variant===0){
        [1.055,1.64,2.35,3.06].forEach(function(shelf,row){
          if(row){
            add(box,cx,shelf-.012,z+.09,w,.034,.40,0x8b6039);
            add(box,cx,shelf-.026,z+.295,w,.062,.025,0xae8152);
          }
          var count=[12,11,12,10][row],clusters=Math.ceil(count/4);
          for(var j=0;j<count;j++){
            var cluster=Math.floor(j/4),piece=j%4,phase=j*2.17+row*.83,size=.90+.14*(.5+.5*Math.sin(phase));
            var x=cx+(cluster-(clusters-1)/2)*w/(clusters+.15)+(piece===3?Math.sin(phase)*.045:(piece-1)*w*.067);
            var lift=piece===3?.15:0,depth=piece===3?-.03:0;
            var breadStart=extra.position.length/3;
            if((j+row)%3===1){
              add(crescent,x,shelf+.072+lift,z+.13+depth,size,size*1.5,size,0xffffff,Math.sin(phase)*.27,0);breadSurface(crescent,breadStart,true);
            }else{
              var length=(j+row)%4===0?.26:.205;
              add(loaf,x,shelf+.115*size+lift,z+.11+depth,length*size,.115*size,.115*size,0xffffff,((j%4)*.45-.675)*side+Math.sin(phase)*.10,0);breadSurface(loaf,breadStart,false);
            }
            breadCount++;
          }
        });
      }else{
        [1.055,1.64,2.35].forEach(function(shelf,row){
          if(row){add(box,cx,shelf-.012,z+.065,w,.034,.35,0x786044);add(box,cx,shelf-.027,z+.247,w,.053,.025,0xa98b5c);}
          var count=22,step=w/(count+1);
          for(var j=0;j<count;j++){
            // Break each shelf into two groups and vary height, width and lean.
            var gap=j<11?-.025:.025,x=cx+(j-(count-1)/2)*step+gap;
            var h=.34+.145*(.5+.5*Math.sin(j*2.61+row*1.17+bi*.43));
            var bw=step*(.80+.16*(.5+.5*Math.sin(j*1.71+row))),lean=(j===0?-.075:j===21?.065:Math.sin(j*2.1+bi)*.014)*side;
            var start=extra.position.length/3;
            add(box,x,shelf+h/2,z+.082,bw,h,.145,covers[(j+row*3+bi)%covers.length],0,lean);
            // Existing atlas spines supply paper/gilt detail on the actual
            // front faces; side covers and pale page tops retain solid colour.
            var spineU=[.055,.090,.145,.179,.225,.261,.288][(j+row*3+bi)%7];
            for(var k=start;k<extra.position.length/3;k++){
              if(extra.normal[k*3+1]>.8){extra.color[k*3]=.58;extra.color[k*3+1]=.51;extra.color[k*3+2]=.37;}
              if(box.attributes.normal.getZ(k-start)>.9){
                extra.uv[k*2]=(spineU+box.attributes.position.getX(k-start)*.020)/4;
                extra.uv[k*2+1]=(2+.595+(box.attributes.position.getY(k-start)+.5)*.140)/4;
                extra.color[k*3]=extra.color[k*3+1]=extra.color[k*3+2]=.88;
              }
            }
            spineCount++;
          }
        });
      }
    });
    loaf.dispose();crescent.dispose();
  }
  var shopDisplayEnd=faces/3+extraIndex.length/3,shopDisplayVertexEnd=extra.position.length/3;
