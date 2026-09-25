// Height follows the joints of the bundled reference paving, not slab colour.
// Coordinates are the observed 1024px source joints, in image order.
function buildReferencePavingHeightV144() {
  var rows = [0,72,147,221,297,375,450,526,602,677,754,828,904,981,1024];
  var columns = [
    [0,107,236,361,489,614,742,868,993,1024],
    [0,23,150,276,401,529,654,782,908,1024],
    [0,81,206,332,460,587,712,840,965,1024],
    [0,18,144,269,397,522,651,778,905,1024],
    [0,64,190,316,444,569,697,824,949,1024],
    [0,125,254,381,506,634,762,890,1015,1024],
    [0,53,180,304,431,559,686,811,937,1024],
    [0,101,226,354,481,606,734,863,990,1024],
    [0,26,156,281,409,534,662,788,917,1024],
    [0,88,217,342,469,596,724,849,977,1024],
    [0,18,143,270,397,524,649,776,905,1024],
    [0,67,194,320,448,575,696,824,955,1024],
    [0,1,129,256,383,510,637,764,893,1021,1024],
    [0,78,199,327,456,583,710,837,965,1024]
  ];
  var size=1024, heights=new Float32Array(size*size), sx=7.2/size, sy=10/size;
  for(var row=0;row<columns.length;row++){
    var breaks=columns[row], xd=new Float32Array(size), c=1;
    for(var x=0;x<size;x++){
      while(c<breaks.length-1&&x+.5>breaks[c])c++;
      // Source borders cut through stones. They are not extra mortar joints.
      var left=c>1?x+.5-breaks[c-1]:Infinity;
      var right=c<breaks.length-1?breaks[c]-x-.5:Infinity;
      xd[x]=Math.min(left,right)*sx;
    }
    for(var y=rows[row];y<rows[row+1];y++){
      var top=row>0?y+.5-rows[row]:Infinity;
      var bottom=row<columns.length-1?rows[row+1]-y-.5:Infinity;
      var yd=Math.min(top,bottom)*sy;
      for(var px=0;px<size;px++){
        var t=Math.max(0,Math.min(1,(Math.min(xd[px],yd)-.005)/.031));
        heights[y*size+px]=t*t*(3-2*t);
      }
    }
  }
  // Bake the complete 2x2 mirrored period into the same 512px normal map.
  // Its encoded slope then changes sign correctly across every mirror axis.
  // The colour/roughness sheets keep their original mirrored wrapping.
  var n=512, field=new Float32Array(n*n);
  for(var ny=0;ny<n;ny++)for(var nx=0;nx<n;nx++){
    // Texture upload flips Y: the doubled normal period must start at the
    // source bottom, just like the single colour period, after that flip.
    var bx=(nx<256?nx:511-nx)*4, by=(ny<256?255-ny:ny-256)*4, sum=0;
    for(var oy=0;oy<4;oy++)for(var ox=0;ox<4;ox++)sum+=heights[(by+oy)*size+bx+ox];
    field[ny*n+nx]=sum/16;
  }
  return {w:n,h:n,L:field,source:heights,sourceSize:size,depth:.006,worldWidth:14.4,worldLength:20};
}
if (typeof module !== 'undefined') module.exports={buildReferencePavingHeightV144};
