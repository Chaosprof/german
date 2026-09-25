'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function loadCourierSurface(htmlFile='berlin-runner.html'){
  const test=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8'),prefix=test.slice(0,test.indexOf('const before = Buffer'));
  const old=process.env.BERLIN_HTML;let loaded;
  try{process.env.BERLIN_HTML=htmlFile;loaded=new Function('require','__dirname',prefix+'\nreturn {T,doc,nodes,mesh,geometry,skeleton,attribute,glb,html};')(require,__dirname);}
  finally{if(old===undefined)delete process.env.BERLIN_HTML;else process.env.BERLIN_HTML=old;}
  const {T,html,geometry,skeleton}=loaded;
  const section=(a,b)=>{const s=html.indexOf(a),e=html.indexOf(b,s);assert.ok(s>=0&&e>s);return html.slice(s,e);};
  const cloth=section('  // BEGIN COURIER_CLOTH_PATCH_V97','  // END COURIER_CLOTH_PATCH_V97');
  const forms=section('  // BEGIN COURIER_FORMS_PATCH_V114','  // END COURIER_FORMS_PATCH_V114');
  const refine=section('  function refineCourierSilhouette(mesh) {','\n  // Both arms share');
  function apply(withForms){const mesh=new T.SkinnedMesh(geometry,loaded.mesh.material);mesh.bind(skeleton,new T.Matrix4());
    const code=withForms?refine:refine.replace('    applyBerlinCourierFormsPatchV114(geo);','');
    assert.equal(new Function('THREE','atob',cloth+'\n'+forms+'\n'+code+'\nreturn refineCourierSilhouette;')(T,atob)(mesh),true);return mesh;
  }
  loaded.mesh=apply(true);loaded.accepted=loaded.mesh.geometry;loaded.base=apply(false).geometry;
  loaded.joints=skeleton.boneInverses.map(m=>new T.Vector3().setFromMatrixPosition(m.clone().invert()));
  return loaded;
}
module.exports={loadCourierSurface};
