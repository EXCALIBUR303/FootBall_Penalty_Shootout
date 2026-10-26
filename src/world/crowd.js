import * as T from 'three';

/** One imported spectator mesh, one instanced draw, no per-frame matrix uploads. */
export function createCrowd(scene, template) {
  if (!template) return { update() {}, react() {}, quality() {} };
  template.removeFromParent();
  const placements=[];
  for(let row=0;row<24;row++) {
    const y=1.2+row*0.65+(row>=12?2:0);
    for(let col=0;col<104;col++) for(const end of [0,1]) {
      const x=-51.5+col;
      if(row<8 && Math.abs(x)<5) continue;
      if(col%11===0) continue; // radial access aisles
      placements.push([x,y,end?117+row*1.1:-12-row*1.1,end?Math.PI:0,col<52]);
    }
    for(let col=0;col<120;col++) for(const side of [-1,1]) {
      if(col%11===0) continue;
      placements.push([side*(41+row*1.1),y,-7+col,side<0?Math.PI/2:-Math.PI/2,col<60]);
    }
  }
  // Spread the first quarter over every stand so Low never drops an entire seating section.
  // A fixed-stride prefix aliases with the paired near/far and west/east placements.
  // A deterministic permutation keeps the Low prefix evenly spread across all rows and stands.
  const ordered=placements.map((p,i)=>({p,key:Math.imul(i+1,2654435761)>>>0})).sort((a,b)=>a.key-b.key).map(o=>o.p);
  const time={value:0}, cheer={value:0}, motion={value:1};
  const mat=new T.MeshStandardMaterial({roughness:1,metalness:0});
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uCrowdTime:time,uCheer:cheer,uCrowdMotion:motion});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uCrowdTime,uCheer,uCrowdMotion;
      varying float vPersonY;`).replace('#include <begin_vertex>',`#include <begin_vertex>
      vPersonY=position.y;
      float phase=instanceMatrix[3].x*0.34+instanceMatrix[3].z*0.17;
      float wave=pow(max(0.0,sin(uCrowdTime*1.25-phase*0.32)),12.0)*0.22;
      transformed.y+=(sin(uCrowdTime*2.1+phase)*0.035+wave+abs(sin(uCrowdTime*9.0+phase))*uCheer*0.65)*uCrowdMotion;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vPersonY;').replace('#include <color_fragment>',`#include <color_fragment>
      if(vPersonY>0.73) diffuseColor.rgb=mix(vec3(0.38,0.21,0.12),vec3(0.72,0.50,0.34),step(0.5,sin(vPersonY*73.0)));`);
  };
  mat.customProgramCacheKey=()=> 'meridian-crowd-v1';
  const mesh=new T.InstancedMesh(template.geometry,mat,ordered.length);
  mesh.name='supporters'; mesh.frustumCulled=false;
  const dummy=new T.Object3D(), color=new T.Color();
  ordered.forEach(([x,y,z,ry,home],i)=>{
    dummy.position.set(x,y,z); dummy.rotation.y=ry; dummy.scale.setScalar(0.82+(i%5)*0.035); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
    color.set(home?(i%7?'#397bc0':'#e6c277'):(i%7?'#b64759':'#f4a36e')).multiplyScalar(0.55+(i%4)*0.13); mesh.setColorAt(i,color);
  });
  scene.add(mesh);
  // Tiny camera-flash stars. Shader flashes briefly; reduced motion disables all flashes.
  const p=[]; for(let i=0;i<ordered.length;i+=127){const [x,y,z]=ordered[i];p.push(x,y+1.1,z);}
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p,3));
  const fm=new T.ShaderMaterial({uniforms:{uTime:time,uMotion:motion},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime,uMotion; varying float vFlash; void main(){vFlash=step(0.993,sin(floor(uTime*6.0)+position.x*9.4+position.z*4.2))*uMotion;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=7.0*vFlash;}`,
    fragmentShader:`varying float vFlash;void main(){vec2 p=gl_PointCoord-0.5;float a=max(0.,1.-length(p)*2.);gl_FragColor=vec4(0.65,0.85,1.,a*a*vFlash);}`});
  const flashes=new T.Points(g,fm);scene.add(flashes);
  let reaction=0;
  return { mesh, react(){reaction=1;}, quality(low){mesh.count=low?Math.ceil(ordered.length/4):ordered.length;},
    update(dt,reduced){motion.value=reduced?0:1; if(!reduced) time.value+=dt; reaction=Math.max(0,reaction-dt*0.35);cheer.value=reaction;},
  };
}
