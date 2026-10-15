import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';

/**
 * Stadium environment from one Poly Haven panorama ("Stadium 01", CC0), used two ways:
 *
 *  - What you SEE is the 4K tonemapped photo, projected onto a dome whose floor is the pitch. A display-
 *    referred photo keeps the stands and sky at the exposure the photographer graded, instead of the
 *    washed-out look the raw HDR gets through tone mapping.
 *  - What LIGHTS the players, ball and goal is the 1K HDR (prefiltered into an environment map), so the
 *    lighting matches the photo.
 *
 * The dome is centred near the penalty spot rather than on the goal: a projected floor is sharpest close to
 * its centre, and the cameras spend their time between the goal and the spot.
 */
export const STADIUM = {
  height: 1.7, // camera height of the panorama (m) — sets the floor scale
  radius: 60, // how far the projected floor reaches before it curves up into the stands
  centreZ: 8,
  // Turns the panorama so its pitch runs along ours: the photo's own goal sits straight behind our goal
  // (hidden behind it from the shooting cameras) and the long stands run down the sides.
  yaw: THREE.MathUtils.degToRad(-87),
};

export function buildEnvironment(renderer, scene, assets) {
  let hdrTex = null;
  if (assets.hdri) {
    hdrTex = new THREE.DataTexture(assets.hdri.data, assets.hdri.width, assets.hdri.height, assets.hdri.format, assets.hdri.type);
    hdrTex.flipY = true; // HDRLoader.parse returns rows bottom-up; load() would set this for us
    hdrTex.mapping = THREE.EquirectangularReflectionMapping;
    hdrTex.colorSpace = THREE.LinearSRGBColorSpace;
    hdrTex.minFilter = hdrTex.magFilter = THREE.LinearFilter;
    hdrTex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdrTex).texture;
    pmrem.dispose();
    scene.environmentRotation.y = STADIUM.yaw;
  }

  let map = null;
  if (assets.backdrop) {
    map = new THREE.Texture(assets.backdrop);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.needsUpdate = true;
  } else if (hdrTex) {
    map = hdrTex; // fallback: show the HDR itself, as before
  }

  let sky = null;
  if (map) {
    sky = new GroundedSkybox(map, STADIUM.height, STADIUM.radius, 160);
    sky.name = 'stadium';
    sky.position.set(0, STADIUM.height, STADIUM.centreZ); // floor at y = 0
    sky.rotation.y = STADIUM.yaw;
    sky.renderOrder = -1;
    exactProjection(sky.material);
    scene.add(sky);
  } else {
    scene.background = new THREE.Color(0x0b1220);
  }
  return { sky, hdrTex };
}

/**
 * GroundedSkybox interpolates the panorama's UVs per vertex, which warps the flattened floor between rings.
 * Its vertices were only scaled along their direction from the centre, so the original view direction is
 * just the normalised local position: compute the equirectangular lookup per pixel from that instead.
 * textureGrad with derivatives of a seam-free longitude avoids the one-pixel mip seam where u wraps.
 */
function exactProjection(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkyDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkyDir = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkyDir;')
      .replace('#include <map_fragment>', /* glsl */ `
        vec3 skyD = normalize(vSkyDir);
        // SphereGeometry (with GroundedSkybox's z flip): x = -cos(phi) sin(theta), z = -sin(phi) sin(theta).
        float skyU = atan(-skyD.z, -skyD.x) / (2.0 * PI);      // -0.5 .. 0.5
        float skyV = 1.0 - acos(clamp(skyD.y, -1.0, 1.0)) / PI;
        float uA = fract(skyU);
        float uB = fract(skyU + 0.5) - 0.5;                    // continuous where uA wraps
        vec2 gxA = vec2(dFdx(uA), dFdx(skyV)), gyA = vec2(dFdy(uA), dFdy(skyV));
        vec2 gxB = vec2(dFdx(uB), dFdx(skyV)), gyB = vec2(dFdy(uB), dFdy(skyV));
        bool useB = abs(gxB.x) + abs(gyB.x) < abs(gxA.x) + abs(gyA.x);
        vec4 sampledDiffuseColor = textureGrad(map, vec2(uA, skyV), useB ? gxB : gxA, useB ? gyB : gyA);
        diffuseColor *= sampledDiffuseColor;`);
  };
  material.customProgramCacheKey = () => 'grounded-sky-exact';
}
