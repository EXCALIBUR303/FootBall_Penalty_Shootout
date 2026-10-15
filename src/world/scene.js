import * as THREE from 'three';
import { TARGET_SIZE, PITCH } from '../assets/manifest.js';
import { fitModel, enableShadows } from './normalize.js';
import { preset } from '../core/quality.js';

/**
 * Builds the Phase 1 scene from whichever assets loaded. Anything missing is simply skipped,
 * so the same code serves the real game and the `?test=1` pipeline check.
 */
export function buildScene(renderer, assets) {
  const scene = new THREE.Scene();
  const mixers = [];
  const actors = {};

  // --- Sky / image-based lighting from the HDRI ---------------------------------------------
  if (assets.hdri) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = new THREE.DataTexture(assets.hdri.data, assets.hdri.width, assets.hdri.height, assets.hdri.format, assets.hdri.type);
    tex.flipY = true; // HDRLoader.parse returns rows bottom-up; load() would set this for us
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    scene.background = tex;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
  } else {
    scene.background = new THREE.Color(0x0b1220);
  }

  // --- Lights (lights are not visuals; the models are) --------------------------------------
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a3b22, assets.hdri ? 0.25 : 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(-18, 30, 22);
  sun.castShadow = true;
  const sm = preset().shadowMap;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -8, near: 5, far: 80 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4; // softens PCF edges
  sun.target.position.set(0, 0, 6);
  scene.add(sun, sun.target);

  // --- Models ---------------------------------------------------------------------------------
  const place = (id, group, pos, rotY = 0) => {
    group.position.copy(pos);
    group.rotation.y = rotY;
    scene.add(group);
    actors[id] = group;
    return group;
  };

  if (assets.stadium) {
    const s = assets.stadium.scene;
    enableShadows(s, { cast: false, receive: true });
    scene.add(s); // the stadium GLB is authored in pitch space; adjust in the manifest/asset if not
    actors.stadium = s;
  }
  if (assets.goal) {
    const g = fitModel(assets.goal.scene, 'width', TARGET_SIZE.goalWidth);
    enableShadows(g);
    place('goal', g, new THREE.Vector3(0, 0, 0));
  }
  if (assets.ball) {
    const b = fitModel(assets.ball.scene, 'diameter', TARGET_SIZE.ballDiameter);
    enableShadows(b);
    place('ball', b, new THREE.Vector3(0, 0, PITCH.penaltySpotZ));
  }
  if (assets.keeper) {
    const k = fitModel(assets.keeper.scene, 'height', TARGET_SIZE.keeperHeight);
    enableShadows(k);
    place('keeper', k, new THREE.Vector3(0, 0, 0.4));
    playIdle(assets.keeper, mixers);
  }
  if (assets.striker) {
    const st = fitModel(assets.striker.scene, 'height', TARGET_SIZE.strikerHeight);
    enableShadows(st);
    place('striker', st, new THREE.Vector3(-1.2, 0, PITCH.penaltySpotZ + 1.2), Math.PI);
    playIdle(assets.striker, mixers);
  }

  // --- Camera: broadcast-style shot behind the spot, looking at the goal -----------------------
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.9, PITCH.penaltySpotZ + 7);
  camera.lookAt(0, 1.1, 0);

  return { scene, camera, mixers, actors };
}

/** Plays the clip named like "idle" if there is one, otherwise the first clip. */
function playIdle(gltf, mixers) {
  if (!gltf.animations?.length) return;
  const clip = gltf.animations.find((c) => /idle|stand|survey/i.test(c.name)) ?? gltf.animations[0];
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixers.push(mixer);
}
