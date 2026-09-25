'use strict';
module.exports=[
 ['var p=[], n=[], uv=[], colors=[], shadeSoffit=false, fabricRanges=[];',
  'var p=[], n=[], uv=[], colors=[], facadeIndices=[], shadeSoffit=false, fabricRanges=[];'],
 ['      colors.push(white.r*f,white.g*f,white.b*f);',
  '      colors.push(white.r*f,white.g*f,white.b*f);\n      facadeIndices.push(p.length/3-1);'],
 ['      var count=geo.index?geo.index.count:pos.count;\n      for(var i=0;i<count;i++) {\n        var j=geo.index?geo.index.getX(i):i;',
  '      var count=geo.index?geo.index.count:pos.count;\n      // Preserve template indexing while applying the transform once per vertex.\n      var vertexMap=new Int32Array(pos.count);vertexMap.fill(-1);\n      for(var i=0;i<count;i++) {\n        var j=geo.index?geo.index.getX(i):i;\n        if(vertexMap[j]>=0){facadeIndices.push(vertexMap[j]);continue;}\n        vertexMap[j]=p.length/3;'],
 ['      var points=[a,b,c,a,c,d],coords=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];',
  '      var points=[a,b,c,a,c,d],coords=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]],quadCorners=[0,1,2,0,2,3],quadVertices=[-1,-1,-1,-1];'],
 ['for(var tv=0;tv<3;tv++){var pi=tr*3+tv,vv=points[pi],t=coords[pi];vertex(vv[0],vv[1],vv[2],nm.x,nm.y,nm.z,t[0],t[1],color,tile||0,cornerShade?cornerShade[[0,1,2,0,2,3][pi]]:1);}',
  'for(var tv=0;tv<3;tv++){var pi=tr*3+tv,corner=quadCorners[pi];if(quadVertices[corner]>=0){facadeIndices.push(quadVertices[corner]);continue;}quadVertices[corner]=p.length/3;var vv=points[pi],t=coords[pi];vertex(vv[0],vv[1],vv[2],nm.x,nm.y,nm.z,t[0],t[1],color,tile||0,cornerShade?cornerShade[corner]:1);}'],
 ['var fabricStart=p.length/9, bandW=aw/stripes, hemRadius=.015;',
  'var fabricStart=facadeIndices.length/3, bandW=aw/stripes, hemRadius=.015;'],
 ['fabricRanges.push([fabricStart,p.length/9]);','fabricRanges.push([fabricStart,facadeIndices.length/3]);'],
 ['    out.addGroup(0,p.length/3,0); out.computeBoundingBox(); out.computeBoundingSphere();',
  '    out.setIndex(facadeIndices);\n    out.addGroup(0,facadeIndices.length,0); out.computeBoundingBox(); out.computeBoundingSphere();'],
 ['triangles:p.length/9,fabricRanges:fabricRanges','triangles:facadeIndices.length/3,fabricRanges:fabricRanges']
];
