'use strict';
// Appearance mapping for an image-generated RGB tower. The old skyline owns
// alpha and position; only this explicit material domain receives new RGB.
// Deliberately no mipmaps: low mip levels would mix unused checkerboard pixels
// into the very narrow antenna. All UVs leave a bilinear-filter safety margin.
function mapTowerPixel(x,y,linearRGB) {
  if(x<2170||x>2246||y<0||y>=387)return null;
  let mask=1,half=6,sourceY=y*.92,sourceHalf=1.30;
  if(y>=181){
    const left=2193.5-(y-181)*.039-2,right=2218.5+(y-181)*.040+2;
    if(x<left||x>right)return null;
    if(y>=278){
      const t=Math.max(0,Math.min(1,((linearRGB[2]-linearRGB[0])-.07)/.08));
      mask=1-t*t*(3-2*t);
    }
  }
  if(y>=42&&y<52){sourceY=44+(y-42)*.60;sourceHalf=4.4;half=10;}
  else if(y>=52&&y<59){sourceY=54+(y-52)*.50;sourceHalf=1.5;half=9;}
  else if(y>=59&&y<70){sourceY=62+(y-59)*.50;sourceHalf=12;half=18;}
  else if(y>=70&&y<93){sourceY=72+(y-70)*.80;sourceHalf=10;half=15;}
  else if(y>=93&&y<99){sourceY=94.5+(y-93)*.33;sourceHalf=11.5;half=19;}
  else if(y>=99&&y<157){
    sourceY=100.5+(y-99)*.94;
    sourceHalf=20.5*Math.sqrt(Math.max(.08,1-Math.pow((sourceY-128)/29.3,2)));
    half=33*Math.sqrt(Math.max(.08,1-Math.pow((y-128)/30.5,2)));
  }
  else if(y>=157&&y<169){sourceY=159+(y-157)*.65;sourceHalf=8;half=14;}
  else if(y>=169&&y<179){sourceY=170.5+(y-169)*.75;sourceHalf=11.5;half=19;}
  else if(y>=179){sourceY=181+(y-179)*.97;sourceHalf=9+(sourceY-181)*.022;half=14+(y-179)*.04;}
  const nx=Math.max(-1,Math.min(1,(x-2206.3)/half));
  return {u:(107.5+nx*sourceHalf)/200,v:1-sourceY/400,mask,sourceY,sourceHalf};
}
const glsl = `
uniform sampler2D uTurmSurface;
uniform float uTurmSurfaceOn;
vec3 berlinTowerAppearance(highp vec2 stripUv, vec4 original) {
  highp vec2 p=vec2(fract(stripUv.x)*4096.0,(1.0-stripUv.y)*512.0);
  if(uTurmSurfaceOn<.5 || original.a<=.001 || p.x<2170.0 || p.x>2246.0 || p.y<0.0 || p.y>=387.0) return original.rgb;
  float mask=1.0, halfWidth=6.0, sourceY=p.y*.92, sourceHalf=1.30;
  if(p.y>=181.0) {
    float left=2193.5-(p.y-181.0)*.039-2.0, right=2218.5+(p.y-181.0)*.040+2.0;
    if(p.x<left || p.x>right) return original.rgb;
    if(p.y>=278.0) mask=1.0-smoothstep(.07,.15,original.b-original.r);
  }
  if(mask<=0.0) return original.rgb;
  if(p.y>=42.0 && p.y<52.0) {sourceY=44.0+(p.y-42.0)*.60;sourceHalf=4.4;halfWidth=10.0;}
  else if(p.y>=52.0 && p.y<59.0) {sourceY=54.0+(p.y-52.0)*.50;sourceHalf=1.5;halfWidth=9.0;}
  else if(p.y>=59.0 && p.y<70.0) {sourceY=62.0+(p.y-59.0)*.50;sourceHalf=12.0;halfWidth=18.0;}
  else if(p.y>=70.0 && p.y<93.0) {sourceY=72.0+(p.y-70.0)*.80;sourceHalf=10.0;halfWidth=15.0;}
  else if(p.y>=93.0 && p.y<99.0) {sourceY=94.5+(p.y-93.0)*.33;sourceHalf=11.5;halfWidth=19.0;}
  else if(p.y>=99.0 && p.y<157.0) {
    sourceY=100.5+(p.y-99.0)*.94;
    sourceHalf=20.5*sqrt(max(.08,1.0-pow((sourceY-128.0)/29.3,2.0)));
    halfWidth=33.0*sqrt(max(.08,1.0-pow((p.y-128.0)/30.5,2.0)));
  }
  else if(p.y>=157.0 && p.y<169.0) {sourceY=159.0+(p.y-157.0)*.65;sourceHalf=8.0;halfWidth=14.0;}
  else if(p.y>=169.0 && p.y<179.0) {sourceY=170.5+(p.y-169.0)*.75;sourceHalf=11.5;halfWidth=19.0;}
  else if(p.y>=179.0) {sourceY=181.0+(p.y-179.0)*.97;sourceHalf=9.0+(sourceY-181.0)*.022;halfWidth=14.0+(p.y-179.0)*.04;}
  float nx=clamp((p.x-2206.3)/halfWidth,-1.0,1.0);
  vec2 appearanceUv=vec2((107.5+nx*sourceHalf)/200.0,1.0-sourceY/400.0);
  return mix(original.rgb,texture2D(uTurmSurface,appearanceUv).rgb,mask);
}`;
module.exports={mapTowerPixel,glsl};
