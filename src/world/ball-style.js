import * as T from 'three';

/** Original unbranded panel paint on the imported ball geometry; no replacement sphere/mesh. */
export function styleBall(root) {
  const phi=(1+Math.sqrt(5))/2,vertices=[],faces=[];
  for(const a of [-1,1])for(const b of [-1,1])vertices.push(new T.Vector3(0,a,b*phi).normalize(),new T.Vector3(a,b*phi,0).normalize(),new T.Vector3(b*phi,0,a).normalize());
  const edge=vertices[0].distanceToSquared(vertices[1]);
  const adjacent=(i,j)=>Math.abs(vertices[i].distanceToSquared(vertices[j])-edge)<1e-5;
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++)if(adjacent(i,j)&&adjacent(j,k)&&adjacent(i,k))faces.push(vertices[i].clone().add(vertices[j]).add(vertices[k]).normalize());
  const seeds=[...vertices,...faces].map(v=>`vec3(${v.toArray().map(n=>n.toFixed(7)).join(',')})`).join(',');
  root.traverse(o=>{
    if(!o.isMesh)return;
    o.geometry.computeBoundingBox();const centre=o.geometry.boundingBox.getCenter(new T.Vector3());
    const material=new T.MeshStandardMaterial({name:'Meridian match ball',roughness:0.58,metalness:0});
    material.onBeforeCompile=shader=>{
      shader.uniforms.uBallCentre={value:centre};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uBallCentre;varying vec3 vBallDir;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBallDir=position-uBallCentre;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vBallDir;const vec3 panelSeeds[32]=vec3[32](${seeds});`).replace('vec4 diffuseColor = vec4( diffuse, opacity );',`
        vec3 dir=normalize(vBallDir);float best=-2.0,second=-2.0;int panel=0;
        for(int i=0;i<32;i++){float d=dot(dir,panelSeeds[i]);if(d>best){second=best;best=d;panel=i;}else{second=max(second,d);}}
        vec3 paint=panel<12?vec3(0.009,0.028,0.063):vec3(0.82,0.87,0.83);
        float seam=1.0-smoothstep(0.002,0.006,best-second);
        paint=mix(paint,vec3(0.38,0.23,0.075),seam*0.65);
        vec4 diffuseColor=vec4(paint,opacity);`);
    };material.customProgramCacheKey=()=> 'meridian-match-ball';o.material=material;
  });
}
