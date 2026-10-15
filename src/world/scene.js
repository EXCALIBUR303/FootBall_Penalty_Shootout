import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TARGET_SIZE, PITCH } from '../assets/manifest.js';
import { fitModel, enableShadows } from './normalize.js';
import { preset } from '../core/quality.js';
import { buildClip } from '../actors/pose.js';
import { AUTHORED, DIVE_LOW, DIVE_HIGH } from '../actors/clips.js';
import { Keeper } from '../actors/keeper.js';
import { Striker } from '../actors/striker.js';

// Kit colours (see docs/PLAN.md palette). The Quaternius mannequin has a body material ("M_Main") we tint.
export const KIT = { keeper: 0xc6f432, home: 0x5b9cff, away: 0xff8a3d };

/**
 * Builds the world from whichever assets loaded; anything missing is skipped so the game still runs
 * (e.g. the goal model — its physics colliders exist regardless).
 */
export function buildScene(renderer, assets) {
  const scene = new THREE.Scene();

  // --- Sky, pitch and image-based lighting from the HDRI ------------------------------------
  if (assets.hdri) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = new THREE.DataTexture(assets.hdri.data, assets.hdri.width, assets.hdri.height, assets.hdri.format, assets.hdri.type);
    tex.flipY = true; // HDRLoader.parse returns rows bottom-up; load() would set this for us
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    // The HDRI is a photo taken on the pitch, so projecting it onto a dome with a flat floor gives
    // real mowed grass (and stands) to stand on, without a separate pitch mesh.
    // `height` is the camera height at capture; `radius` is how far the floor extends.
    const sky = new GroundedSkybox(tex, 1.7, 60);
    sky.position.y = 1.7; // lifts the dome so its floor sits at y = 0
    scene.add(sky);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
  } else {
    scene.background = new THREE.Color(0x0b1220);
  }

  // Invisible floor that only receives shadows, so players and ball are grounded on the photo pitch.
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.002;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // --- Lights (lights are not visuals; the models are) --------------------------------------
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a3b22, assets.hdri ? 0.25 : 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(-18, 30, 22);
  sun.castShadow = true;
  const sm = preset().shadowMap;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -8, near: 5, far: 80 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4; // softens PCF edges
  sun.target.position.set(0, 0, 6);
  scene.add(sun, sun.target);

  // --- Static models ------------------------------------------------------------------------
  let goal = null;
  if (assets.stadium) {
    enableShadows(assets.stadium.scene, { cast: false, receive: true });
    scene.add(assets.stadium.scene); // stadium GLB is expected in pitch space
  }
  if (assets.goal) {
    goal = fitModel(assets.goal.scene, 'width', TARGET_SIZE.goalOuterWidth);
    enableShadows(goal);
    scene.add(goal); // goal line z = 0; adjust rotation here if a model faces the other way
  }

  // Ball: centred on its own origin so it can copy the physics body's position and rotation directly.
  let ball = null;
  if (assets.ball) {
    const fitted = fitModel(assets.ball.scene, 'diameter', TARGET_SIZE.ballDiameter);
    fitted.position.y = -PITCH.ballRadius;
    enableShadows(fitted);
    ball = new THREE.Group();
    ball.name = 'ball';
    ball.add(fitted);
    ball.position.set(0, PITCH.ballRadius, PITCH.penaltySpotZ);
    scene.add(ball);
  }

  // --- Players --------------------------------------------------------------------------------
  let keeper = null;
  let striker = null;
  const source = assets.character;
  if (source) {
    const clips = buildClips(source);
    const make = (height, kit) => {
      const skinned = SkeletonUtils.clone(source.scene);
      tintKit(skinned, kit);
      const holder = fitModel(skinned, 'height', height);
      enableShadows(holder);
      return { holder, skinned };
    };
    const k = make(TARGET_SIZE.keeperHeight, KIT.keeper);
    keeper = new Keeper(k.holder, k.skinned, clips, { height: TARGET_SIZE.keeperHeight });
    scene.add(keeper.root);
    const s = make(TARGET_SIZE.strikerHeight, KIT.home);
    striker = new Striker(s.holder, s.skinned, clips);
    scene.add(striker.root);
    if (ball) striker.setUp(ball.position);
  }

  // --- Camera ---------------------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.75, PITCH.penaltySpotZ + 6.5);
  camera.lookAt(0, 1.1, 0);

  return { scene, camera, ball, goal, keeper, striker, sun };
}

/** Library clips + authored clips (+ mirrored dives), built once from the untouched source rig. */
function buildClips(source) {
  const clips = new Map(source.animations.map((c) => [c.name, c]));
  for (const spec of AUTHORED) clips.set(spec.name, buildClip(source.scene, spec));
  clips.set('GK_DiveLow_R', buildClip(source.scene, DIVE_LOW, { mirror: true, name: 'GK_DiveLow_R' }));
  clips.set('GK_DiveHigh_R', buildClip(source.scene, DIVE_HIGH, { mirror: true, name: 'GK_DiveHigh_R' }));
  return clips;
}

function tintKit(root, color) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const tinted = mats.map((m) => {
      if (m.name !== 'M_Main') return m;
      const c = m.clone(); // clone so players don't share (and fight over) one material
      c.color.set(color);
      return c;
    });
    o.material = tinted.length === 1 ? tinted[0] : tinted;
  });
}

/** Re-tints a player (used when switching which team is shooting). */
export function setKit(root, color) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === 'M_Main') m.color.set(color);
  });
}
