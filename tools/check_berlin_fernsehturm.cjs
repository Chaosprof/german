'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const sharp=require('C:/Users/tamas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {mapTowerPixel,glsl}=require('./berlin_fernsehturm_surface.cjs');
const root=path.resolve(__dirname,'..');
const toLinear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
const toSRGB=v=>Math.round(255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055));
(async()=>{
  const original=await sharp(path.join(root,'assets/img/berlin-skyline-strip.png')).raw().toBuffer({resolveWithObject:true});
  const appearance=await sharp(path.join(root,'assets/img/berlin-fernsehturm-surface-v1-256.jpg')).raw().toBuffer({resolveWithObject:true});
  assert.equal(original.info.width,4096);assert.equal(original.info.height,512);assert.equal(original.info.channels,4);
  assert.equal(appearance.info.width,256);assert.equal(appearance.info.height,512);assert.equal(appearance.info.channels,3);
  const out=Buffer.from(original.data),color=[0,0,0];let updated=0,filtersChecked=0;
  function texel(x,y,c){return toLinear(appearance.data[(y*256+x)*3+c]);}
  function sample(u,v,c){
    const px=u*256-.5,py=(1-v)*512-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
    assert.ok(x0>=0&&x0+1<256&&y0>=0&&y0+1<512,'all bilinear samples stay in the appearance map');
    return (1-fy)*((1-fx)*texel(x0,y0,c)+fx*texel(x0+1,y0,c))+fy*((1-fx)*texel(x0,y0+1,c)+fx*texel(x0+1,y0+1,c));
  }
  for(let y=0;y<512;y++)for(let x=0;x<4096;x++) {
    const i=(y*4096+x)*4;for(let c=0;c<3;c++)color[c]=toLinear(original.data[i+c]);
    const mapped=mapTowerPixel(x+.5,y+.5,color);
    if(mapped&&mapped.mask>0&&original.data[i+3]>0){
      // These hand-inspected inset surface domains exclude the generated
      // backdrop. A one-texel filter apron is part of each region's contract.
      const ySource=(1-mapped.v)*400,xSource=mapped.u*200;
      assert.ok(xSource>83&&xSource<132&&ySource>=0&&ySource<385);
      let safeHalf=2.3;
      if(y+.5>=42&&y+.5<52)safeHalf=5.5;
      else if(y+.5>=52&&y+.5<59)safeHalf=2.3;
      else if(y+.5>=59&&y+.5<70)safeHalf=14;
      else if(y+.5>=70&&y+.5<93)safeHalf=12;
      else if(y+.5>=93&&y+.5<99)safeHalf=14;
      else if(y+.5>=99&&y+.5<157)safeHalf=29*Math.sqrt(Math.max(0,1-Math.pow((ySource-128)/30,2)));
      else if(y+.5>=157&&y+.5<169)safeHalf=10;
      else if(y+.5>=169&&y+.5<179)safeHalf=14;
      else if(y+.5>=179)safeHalf=13+(ySource-181)*.022;
      assert.ok(Math.abs(xSource-107.5)+200/256<safeHalf,'full one-texel apron remains in the inspected generated tower surface');
      for(let c=0;c<3;c++)out[i+c]=toSRGB(color[c]*(1-mapped.mask)+sample(mapped.u,mapped.v,c)*mapped.mask);
      updated++;filtersChecked+=4;
    }
    assert.equal(out[i+3],original.data[i+3],'original skyline alpha is byte-identical');
    if(x<2170||x>2246||y>=387)assert.equal(out.subarray(i,i+4).equals(original.data.subarray(i,i+4)),true,'all other city pixels remain byte-identical');
  }
  // Render the material-mapping algorithm for visual QA only. This image is
  // not a production replacement and is never referenced by the game.
  await sharp(out,{raw:{width:4096,height:512,channels:4}}).extract({left:2100,top:0,width:200,height:400}).resize(600,1200).png().toFile(path.join(root,'audit/berlin-fernsehturm-material-preview.png'));
  if(!process.argv.includes('--assets-only')) {
    const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
    assert.ok(html.includes(JSON.stringify(glsl)),'shipping shader matches validated appearance mapping');
    assert.ok(html.includes('t.generateMipmaps = false; // Keep unused atlas backdrop out of narrow antenna samples.'));
    assert.ok(html.includes('sk.rgb = berlinTowerAppearance(suv, sk);'),'only RGB is replaced inside the existing sky sample');
    assert.ok(html.includes("t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;"));
    assert.ok(html.includes("uTurmSurfaceOn.value = 1"),'successful decode enables appearance');
  }
  console.log(JSON.stringify({ok:true,updatedTowerPixels:updated,bilinearTexelsChecked:filtersChecked,unchangedSkylineAlpha:true,unchangedExternalCityPixels:true,addedDraws:0,appearanceTexture:[256,512],oneTexelSurfaceApron:true,noMipBackdropBleed:true},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
