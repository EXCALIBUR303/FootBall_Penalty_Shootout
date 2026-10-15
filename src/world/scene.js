import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
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
    // The HDRI is a photo taken on the pitch, so projecting it onto a dome with a flat floor gives us
    // a real mowed-grass ground (and stands) for the models to stand on, without a separate pitch mesh.
    // `height` is the camera height at capture time; `radius` is how far the "ground" extends.
    const sky = new GroundedSkybox(tex, 1.7, 60);
    sky.position.y = 1.7; // lifts the dome so its floor sits at y = 0
    scene.add(sky);
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
  // Role-specific asset if present (test mode), otherwise a clone of the shared character rig.
  const makePlayer = (role, height, kit) => {
    const src = assets[role] ?? assets.character;
    if (!src) return null;
    const instance = { scene: SkeletonUtils.clone(src.scene), animations: src.animations };
    if (!assets[role]) tintKit(instance.scene, kit);
    const group = fitModel(instance.scene, 'height', height);
    enableShadows(group);
    return { group, instance };
  };
  const keeper = makePlayer('keeper', TARGET_SIZE.keeperHeight, KIT.keeper);
  if (keeper) {
    place('keeper', keeper.group, new THREE.Vector3(0, 0, 0.4));
    playIdle(keeper.instance, mixers);
  }
  const striker = makePlayer('striker', TARGET_SIZE.strikerHeight, KIT.home);
  if (striker) {
    place('striker', striker.group, new THREE.Vector3(-1.2, 0, PITCH.penaltySpotZ + 1.2), Math.PI);
    playIdle(striker.instance, mixers);
  }

  // --- Camera: broadcast-style shot behind the spot, looking at the goal -----------------------
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.9, PITCH.penaltySpotZ + 7);
  camera.lookAt(0, 1.1, 0);

  return { scene, camera, mixers, actors };
}

// Kit colours (see docs/PLAN.md palette). The Quaternius mannequin has a body material ("M_Main") we tint.
const KIT = { keeper: 0xc6f432, home: 0x5b9cff };

function tintKit(root, color) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      if (m.name !== 'M_Main') return m;
      const c = m.clone(); // clone so the two players don't share (and fight over) one material
      c.color.set(color);
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
}

/** Plays the clip named like "idle" if there is one, otherwise the first clip. */
function playIdle(gltf, mixers) {
  if (!gltf.animations?.length) return;
  const clip =
    gltf.animations.find((c) => c.name === 'Idle_Loop') ?? // Quaternius rig
    gltf.animations.find((c) => /idle|survey/i.test(c.name)) ??
    gltf.animations[0];
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixers.push(mixer);
}
