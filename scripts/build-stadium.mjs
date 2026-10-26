/** Original Meridian Arena. Reproducible, offline, no runtime geometry authoring for the stadium. */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdir, stat } from 'node:fs/promises';

const doc = new Document(), scene = doc.createScene('Meridian Arena'), buffer = doc.createBuffer();
const groups = new Map();
const emission=doc.createExtension(KHRMaterialsEmissiveStrength);
const palette = {
  concrete: '#182538', tread: '#25364b', roof: '#0d1829', steel: '#435b72', trim: '#51c6ed',
  turfA: '#276d39', turfB: '#216033', apron: '#122c2a', seatBlue: '#214b81', seatRed: '#71303e',
  dark: '#050a12', white: '#d8eaf1', gold: '#ffc67a',
};
function add(key, geo) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(geo.toNonIndexed()); geo.dispose(); }
function box(key, x,y,z, w,h,d, ry=0) { add(key, new T.BoxGeometry(w,h,d).rotateY(ry).translate(x,y,z)); }
function pole(key, x,y,z, radius,height) { add(key, new T.CylinderGeometry(radius,radius,height,6).translate(x,y,z)); }
// The complete 68 x 105 m pitch is in the imported stadium, including crisp mowing bands.
box('apron',0,-0.22,52.5,100,0.35,137);
for(let i=0;i<20;i++) box(i%2?'turfA':'turfB',0,-0.03,2.625+i*5.25,68,0.06,5.25);

// Stand coordinates are mirrored by crowd.js. Two tiers, aisles and tunnel gap.
for(const end of [0,1]) {
  for(let row=0;row<24;row++) {
    const tier=row>=12?2:0, y=1.2+row*0.65+tier;
    const z=end?117+row*1.1: -12-row*1.1;
    if(row<8) for(const s of [-1,1]) box('tread',s*29,y-0.4,z,50,0.65,1.16);
    else box('tread',0,y-0.4,z,108,0.65,1.16);
    for(let block=0;block<10;block++) {
      const x=-48.6+block*10.8;
      if(row<8 && Math.abs(x)<6) continue;
      box(block<5?'seatBlue':'seatRed',x,y,z,9.7,0.25,0.55);
    }
  }
  const rz=end?132:-27;
  box('roof',0,21.5,rz,113,0.7,25);
  box('trim',0,21.0,end?119.5:-14.5,113,0.18,0.25);
  for(let x=-54;x<=54;x+=18) {
    pole('steel',x,10.5,end?145:-40,0.23,21);
    box('steel',x,20.8,rz,0.18,0.45,25);
  }
  // Tunnel is an open dark recess with a luminous lintel, rather than a billboard over the goal.
  box('dark',0,1.65,end?118:-13,7.8,3.3,1);
  box('trim',0,3.45,end?117.4:-12.4,8.3,0.15,0.2);
  for(const s of [-1,1]) box('concrete',s*4.15,1.65,end?116:-11,0.35,3.3,5);
}
for(const side of [-1,1]) {
  for(let row=0;row<24;row++) {
    const y=1.2+row*0.65+(row>=12?2:0), x=side*(41+row*1.1);
    box('tread',x,y-0.4,52.5,1.16,0.65,128);
    for(let block=0;block<12;block++) box(block<6?'seatBlue':'seatRed',x,y,-6+block*10.6,0.55,0.25,9.5);
  }
  box('roof',side*56,21.5,52.5,25,0.7,151);
  box('trim',side*43.5,21,52.5,0.25,0.18,151);
  for(let z=-20;z<135;z+=22) {
    pole('steel',side*69,10.5,z,0.23,21);
    box('steel',side*56,20.8,z,25,0.45,0.18);
  }
  // Covered dugouts, translucent canopy coloured to the stadium steel (single material, no sorting).
  for(const z of [35,68]) {
    box('concrete',side*37,0.2,z,3,0.4,10);
    box('steel',side*38,2.0,z,0.15,3.6,10);
    box('steel',side*37,3.5,z,3,0.18,10);
    for(let j=0;j<7;j++) box('seatBlue',side*37,0.7,z-4+j*1.3,1,0.4,0.8);
  }
}
// Perimeter boards: runtime canvas texture is assigned to these named meshes.
for(const [name,x,z,w,d] of [['end',0,-7,76,0.16],['far',0,112,76,0.16],['west',-37,52.5,0.16,116],['east',37,52.5,0.16,116]]) {
  const g=new T.BoxGeometry(w,1,d).translate(x,0.65,z);
  emit('LED_'+name,g,'dark'); g.dispose();
}
// Four freestanding floodlight towers with cross braces, imported lamp banks.
for(const x of [-39,39]) for(const z of [-9,114]) {
  for(const dx of [-0.65,0.65]) pole('steel',x+dx,13,z,0.12,26);
  for(let y=2;y<26;y+=3) box('steel',x,y,z,1.4,0.12,0.15);
  box('concrete',x,26,z,6.5,2.6,0.7);
  for(let i=0;i<6;i++) for(let j=0;j<2;j++) box('lamp',x-2.6+i*1.04,25.4+j*1.2,z+(z<0?0.42:-0.42),0.8,0.8,0.1);
  const marker=doc.createNode('FLOOD').setTranslation([x,26,z]); scene.addChild(marker);
}
for(const x of [-33.8,33.8]) for(const z of [0.2,104.8]) {
  pole('white',x,0.8,z,0.025,1.6);
  box('gold',x+0.19,1.38,z,0.4,0.32,0.015);
}
// Supporter flags and banners are imported cloth meshes, deformed gently at runtime.
for(const [i,x] of [-28,-17,17,28].entries()) {
  const z=-25-(i%2)*4,y=11+(i%2)*2;
  pole('steel',x,y-1,z,0.035,4);
  const cloth=new T.PlaneGeometry(3,1.6,12,4).translate(x+1.5,y,z);
  emit('BANNER_'+i,cloth,i<2?'seatBlue':'seatRed');cloth.dispose();
}
// Crowd prototype ships as part of the authored asset; renderer instantiates its geometry.
const person = mergeGeometries([
  new T.CylinderGeometry(0.24,0.19,0.56,6).translate(0,0.42,0).toNonIndexed(),
  new T.BoxGeometry(0.12,0.45,0.18).rotateZ(0.16).translate(-0.28,0.4,0).toNonIndexed(),
  new T.BoxGeometry(0.12,0.45,0.18).rotateZ(-0.16).translate(0.28,0.4,0).toNonIndexed(),
  new T.BoxGeometry(0.14,0.22,0.2).translate(-0.12,0.11,0).toNonIndexed(),
  new T.BoxGeometry(0.14,0.22,0.2).translate(0.12,0.11,0).toNonIndexed(),
  new T.IcosahedronGeometry(0.19,0).translate(0,0.88,0).toNonIndexed(),
]);
emit('CROWD_TEMPLATE',person,'white'); person.dispose();
for(const [key, parts] of groups) { const g=mergeGeometries(parts); emit('arena_'+key,g,key); g.dispose(); parts.forEach(p=>p.dispose()); }
function emit(name,g,key) {
  const a=(sem,attr,type)=>doc.createAccessor().setType(type).setArray(g.getAttribute(attr).array).setBuffer(buffer);
  const p=doc.createPrimitive().setAttribute('POSITION',a('POSITION','position','VEC3')).setAttribute('NORMAL',a('NORMAL','normal','VEC3'));
  if(g.index)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(g.index.array).setBuffer(buffer));
  if(g.getAttribute('uv')) p.setAttribute('TEXCOORD_0',a('TEXCOORD_0','uv','VEC2'));
  const c=new T.Color(palette[key]||'#e9f4ff');
  const m=doc.createMaterial(key).setBaseColorFactor([c.r,c.g,c.b,1]).setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(name.startsWith('BANNER_'));
  if(key==='lamp')m.setEmissiveFactor([0.8,0.9,1]).setExtension('KHR_materials_emissive_strength',emission.createEmissiveStrength().setEmissiveStrength(5));
  if(key==='trim')m.setEmissiveFactor([0.12,0.48,0.7]);
  p.setMaterial(m); scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)));
}
await doc.transform(dedup(),prune({keepAttributes:true}),draco({method:'edgebreaker'}));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule()});
await mkdir('public/assets/models',{recursive:true});
await io.write('public/assets/models/stadium.glb',doc);
console.log(`stadium.glb: ${((await stat('public/assets/models/stadium.glb')).size/1024).toFixed(1)} KiB (Draco)`);
