import * as THREE from 'three';

/**
 * Football kits painted onto the shared Quaternius mannequin in the shader — no new geometry, no texture
 * files, and the rig/animations are untouched.
 *
 * Each vertex is classified by the bone that influences it most (skinIndex / skinWeight) plus its height in
 * the bind pose (the rig is in a T-pose, 1.83 m tall, so heights are stable reference lines):
 *
 *   shirt   spine, clavicles, upper arms (short sleeves; a keeper's sleeves run to the wrist)
 *   shorts  pelvis and the top of the thighs
 *   socks   calves (with a trim band at the top)
 *   boots   feet
 *   skin    head, neck, forearms, knees
 *   gloves  hands (keeper) — outfield players' hands are skin
 *
 * The colours come from uniforms, so changing kit between kicks is just a uniform update.
 */

// Region ids (floats in GLSL).
const R = { shirt: 0, shorts: 1, socks: 2, boots: 3, skin: 4, hands: 5, forearm: 6, thigh: 7 };

function regionForBone(name) {
  if (/^(spine_0[1-3]|clavicle_[lr]|upperarm_[lr])$/.test(name)) return R.shirt;
  if (/^lowerarm_[lr]$/.test(name)) return R.forearm;
  if (/^(hand_[lr]|(index|middle|ring|pinky|thumb)_\d+.*)$/.test(name)) return R.hands;
  if (name === 'pelvis') return R.shorts;
  if (/^thigh_[lr]$/.test(name)) return R.thigh;
  if (/^calf_[lr]$/.test(name)) return R.socks;
  if (/^(foot|ball)_[lr]|ball_leaf_[lr]$/.test(name)) return R.boots;
  return R.skin; // Head, neck, root
}

const SKIN = new THREE.Color('#b98a6c');

/**
 * Replaces the mannequin's materials under `root` with kit materials. Returns a handle to recolour them.
 * @param {THREE.Object3D} root cloned character scene
 * @param {{ shirt, shorts, socks, trim?, pattern?, gloves?, longSleeves? }} kit
 */
export function applyKit(root, kit) {
  const uniforms = {
    uShirt: { value: new THREE.Color() },
    uShirt2: { value: new THREE.Color() }, // pattern colour (stripes, hoops, sash)
    uShorts: { value: new THREE.Color() },
    uSocks: { value: new THREE.Color() },
    uTrim: { value: new THREE.Color() },
    uBoots: { value: new THREE.Color('#15181d') },
    uSkin: { value: SKIN.clone() },
    uGloves: { value: new THREE.Color() },
    uPattern: { value: 0 }, // 0 plain, 1 vertical stripes, 2 hoops, 3 sash
    uLongSleeves: { value: 0 },
    uGlovesOn: { value: 0 },
  };
  const materials = new Map(); // source material -> kit material (meshes share them)

  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const regions = new Float32Array(Math.max(o.skeleton.bones.length, 1));
    o.skeleton.bones.forEach((b, i) => { regions[i] = regionForBone(b.name); });
    const src = o.material;
    // One material per (source material, skeleton layout); the joint caps get a slightly rougher, darker finish.
    let mat = materials.get(src);
    if (!mat) {
      mat = makeKitMaterial(src, uniforms, regions, src.name === 'M_Joints');
      materials.set(src, mat);
    }
    o.material = mat;
  });

  const handle = {
    uniforms,
    set(next) {
      uniforms.uShirt.value.set(next.shirt);
      uniforms.uShirt2.value.set(next.shirt2 ?? next.trim ?? next.shirt);
      uniforms.uShorts.value.set(next.shorts);
      uniforms.uSocks.value.set(next.socks);
      uniforms.uTrim.value.set(next.trim ?? next.shorts);
      uniforms.uGloves.value.set(next.gloves ?? '#f2f2f2');
      uniforms.uPattern.value = { plain: 0, stripes: 1, hoops: 2, sash: 3 }[next.pattern ?? 'plain'] ?? 0;
      uniforms.uLongSleeves.value = next.longSleeves ? 1 : 0;
      uniforms.uGlovesOn.value = next.gloves ? 1 : 0;
    },
  };
  handle.set(kit);
  return handle;
}

function makeKitMaterial(src, uniforms, regions, isJoint) {
  const mat = new THREE.MeshStandardMaterial({
    name: `${src.name}_kit`,
    roughness: isJoint ? 0.85 : 0.78, // fabric-like: no plastic sheen
    metalness: 0,
    envMapIntensity: 0.75,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uRegion = { value: regions };
    shader.uniforms.uJoint = { value: isJoint ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uRegion[${regions.length}];
        varying float vRegion;
        varying vec3 vBind;`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        {
          // Dominant bone → body region (dynamic uniform-array indexing is fine in GLSL ES 3.0).
          int best = int(skinIndex.x); float bw = skinWeight.x;
          if (skinWeight.y > bw) { bw = skinWeight.y; best = int(skinIndex.y); }
          if (skinWeight.z > bw) { bw = skinWeight.z; best = int(skinIndex.z); }
          if (skinWeight.w > bw) { bw = skinWeight.w; best = int(skinIndex.w); }
          vRegion = uRegion[best];
          vBind = position; // bind-pose (T-pose) position, metres
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform vec3 uShirt, uShirt2, uShorts, uSocks, uTrim, uBoots, uSkin, uGloves;
        uniform float uPattern, uLongSleeves, uGlovesOn, uJoint;
        varying float vRegion;
        varying vec3 vBind;
        vec3 shirtColour(vec3 p) {
          float k = 0.0;
          if (uPattern > 0.5 && uPattern < 1.5) k = step(0.5, fract(p.x * 5.5 + 0.25));          // vertical stripes
          else if (uPattern > 1.5 && uPattern < 2.5) k = step(0.5, fract(p.y * 7.0));            // hoops
          else if (uPattern > 2.5) k = step(abs(p.y - 1.25 + p.x * 0.9), 0.07);                  // diagonal sash
          return mix(uShirt, uShirt2, k);
        }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', /* glsl */ `
        vec3 kit = uSkin;
        float r = floor(vRegion + 0.5);
        vec3 p = vBind;
        if (r == 0.0) {                                        // shirt; tucked over the waist down to 1.0 m
          kit = abs(p.x) > 0.40 ? uTrim : shirtColour(p);      // sleeve cuff in trim colour
          if (abs(p.x) > 0.44) kit = uLongSleeves > 0.5 ? uShirt : uSkin;
        } else if (r == 6.0) {                                 // forearm: sleeve for keepers, skin otherwise
          kit = uLongSleeves > 0.5 ? uShirt : uSkin;
        } else if (r == 5.0) {                                 // hands: gloves or skin
          kit = uGlovesOn > 0.5 ? uGloves : uSkin;
        } else if (r == 1.0) {                                 // pelvis: shirt above the waistband
          kit = p.y > 1.02 ? shirtColour(p) : uShorts;
        } else if (r == 7.0) {                                 // thighs: shorts to mid-thigh, then skin
          kit = p.y > 0.66 ? uShorts : uSkin;
        } else if (r == 2.0) {                                 // socks with a band at the top
          kit = p.y > 0.42 ? uTrim : uSocks;
        } else if (r == 3.0) {
          kit = uBoots;
        }
        if (uJoint > 0.5) kit *= 0.82;                         // joint caps read as seams/shading
        vec4 diffuseColor = vec4( kit, opacity );`);
  };
  mat.customProgramCacheKey = () => `kit-${regions.length}-${isJoint ? 1 : 0}`;
  return mat;
}
