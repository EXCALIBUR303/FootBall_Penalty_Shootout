import * as T from 'three';
import { preset } from '../core/quality.js';
import { createCrowd } from './crowd.js';

/** Explicit night lighting; there is no photographic background or daylight HDR. */
export function buildEnvironment(renderer, scene, assets) {
  scene.background=new T.Color('#040b18');
  scene.fog=new T.FogExp2('#091426',0.0045);
  const stadium=assets.stadium?.scene;
  if(stadium) scene.add(stadium);
  const crowd=createCrowd(scene,stadium?.getObjectByName('CROWD_TEMPLATE'));
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=128;
  const ctx=canvas.getContext('2d');
  const led=new T.CanvasTexture(canvas);led.colorSpace=T.SRGBColorSpace;led.wrapS=T.RepeatWrapping;led.repeat.x=2;
  const drawRibbon=()=>{
    ctx.fillStyle='#124864';ctx.fillRect(0,0,2048,128);
    const brands=['NOVA / SPORT','MERIDIAN / NIGHT LEAGUE','APEX / ENERGY','PENALTY KINGS'];
    brands.forEach((s,i)=>{ctx.fillStyle=i%2?'#7c5333':'#124864';ctx.fillRect(i*512,0,512,128);ctx.fillStyle=i%2?'#ffe0ad':'#b5f2ff';ctx.font='italic 900 44px system-ui';ctx.fillText(s,i*512+28,78);ctx.fillRect(i*512,20,4,88);});
    ctx.fillStyle='#00000030';for(let y=0;y<128;y+=4)ctx.fillRect(0,y,2048,1);
    led.needsUpdate=true;
  };
  drawRibbon();
  const grass=grassTexture();
  const bannerTime={value:0}, bannerMotion={value:1};
  stadium?.traverse(o=>{
    if(!o.isMesh)return;
    o.receiveShadow=true;o.castShadow=false;
    if(o.material?.name==='turfA'||o.material?.name==='turfB') {o.material.map=grass;o.material.roughness=1;o.material.needsUpdate=true;}
    if(o.name.startsWith('BANNER_')) {
      const i=Number(o.name.split('_')[1]);
      const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
      g.fillStyle=i<2?'#174f94':'#912c41';g.fillRect(0,0,512,256);g.strokeStyle='#e8bd72';g.lineWidth=15;g.strokeRect(16,16,480,224);
      g.fillStyle='#f6dfb5';g.font='italic 900 52px system-ui';g.textAlign='center';g.fillText(i<2?'LIONS ROAR':'FOXES RISE',256,145);
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
      o.material=new T.MeshStandardMaterial({map:t,side:T.DoubleSide,roughness:1});
      o.material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{uFlagTime:bannerTime,uFlagMotion:bannerMotion});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uFlagTime,uFlagMotion;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(uv.x*8.0+uFlagTime*2.0)*uv.x*0.18*uFlagMotion;');};
      o.material.customProgramCacheKey=()=> 'supporter-flag';
    }
    if(o.name.startsWith('LED_'))o.material=new T.MeshStandardMaterial({map:led,emissiveMap:led,emissive:'#ffffff',emissiveIntensity:0.65,roughness:0.6});
  });
  // Volumetric-looking floodlight shafts and glare are lightweight effects, not stadium geometry.
  const effects=new T.Group(); effects.name='floodlight-haze';scene.add(effects);
  const glow=glareTexture();
  for(const x of [-39,39])for(const z of [-9,114]){
    const top=new T.Vector3(x,26,z), target=new T.Vector3(x*0.25,0,z<0?13:92);
    const cone=new T.Mesh(new T.ConeGeometry(10,32,20,1,true),new T.MeshBasicMaterial({color:'#86bfff',transparent:true,opacity:0.025,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
    const dir=top.clone().sub(target).normalize();cone.position.copy(top).addScaledVector(dir,-16);cone.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);effects.add(cone);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:glow,color:'#acd9ff',transparent:true,opacity:0.65,depthWrite:false,blending:T.AdditiveBlending}));sprite.position.copy(top);sprite.scale.set(13,13,1);effects.add(sprite);
  }
  let t=0;
  const api={sky:null,crowd,quality(){crowd.quality(preset().name==='low');grass.anisotropy=Math.min(preset().anisotropy,renderer.capabilities.getMaxAnisotropy());led.anisotropy=Math.min(preset().anisotropy,renderer.capabilities.getMaxAnisotropy());},
    update(dt,reduced){bannerMotion.value=reduced?0:1;if(!reduced)bannerTime.value+=dt;crowd.update(dt,reduced);if(!reduced){t+=dt;led.offset.x=t*0.018;}},dispose(){led.dispose();glow.dispose();grass.dispose();}};
  api.quality(); return api;
}
function glareTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'white');r.addColorStop(0.08,'#c8eaffdd');r.addColorStop(0.3,'#8fcfff35');r.addColorStop(1,'#68baff00');g.fillStyle=r;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}

function grassTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  const img=g.createImageData(256,256);let seed=17;
  for(let i=0;i<img.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=220+(seed%35);img.data.set([v,v,v,255],i);}
  g.putImageData(img,0,0);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(34,3);return t;
}
