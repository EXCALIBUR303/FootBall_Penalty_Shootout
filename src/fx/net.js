import { Vector3 } from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

/** Subdivide the imported net's textured panels so the actual net can flex on impact. */
export function createNetRipple(goal) {
  const time={value:10}, strength={value:0}, impact={value:new Vector3()};
  goal?.traverse(o=>{
    if(!o.isMesh || !o.material?.map) return;
    o.geometry=new TessellateModifier(0.25,5).modify(o.geometry);
    o.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uNetTime:time,uNetStrength:strength,uNetImpact:impact});
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float uNetTime,uNetStrength;uniform vec3 uNetImpact;`).replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 wp=(modelMatrix*vec4(transformed,1.)).xyz;
        float r=distance(wp,uNetImpact);
        float pulse=sin(r*12.-uNetTime*18.)*exp(-r*1.2)*exp(-uNetTime*3.)*uNetStrength;
        transformed+=inverse(mat3(modelMatrix))*vec3(0.,0.,pulse);`);
    };o.material.customProgramCacheKey=()=> 'net-ripple-v1';
  });
  return {hit(p){impact.value.copy(p);time.value=0;strength.value=0.22;},reset(){strength.value=0;},update(dt,reduced){time.value+=dt;if(reduced)strength.value=0;}};
}
