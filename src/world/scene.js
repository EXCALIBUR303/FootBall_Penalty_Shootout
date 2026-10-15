import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { TARGET_SIZE, PITCH } from '../assets/manifest.js';
import { fitModel, enableShadows } from './normalize.js';
import { preset } from '../core/quality.js';
import { GOAL } from '../game/shot.js';
import { buildClip } from '../actors/pose.js';
import { AUTHORED, DIVE_LOW, DIVE_HIGH } from '../actors/clips.js';
import { Keeper } from '../actors/keeper.js';
import { Striker } from '../actors/striker.js';
import { buildEnvironment } from './environment.js';
import { addPitchMarkings } from './pitch.js';
import { applyKit } from './kit.js';
import { TEAMS, KEEPER_KIT } from '../game/teams.js';

// Kit colours (see docs/PLAN.md palette). The Quaternius mannequin has a body material ("M_Main") we tint.
// Sun direction in pitch space (towards the light).
const SUN_DIR = new THREE.Vector3(-0.5, 0.62, 0.55).normalize(); // azimuth from the HDR, elevation ~38°

export const KIT = { keeper: 0xc6f432, home: 0x5b9cff, away: 0xff8a3d };

/**
 * Builds the world from whichever assets loaded; anything missing is skipped so the game still runs
 * (e.g. the goal model — its physics colliders exist regardless).
 */
export function buildScene(renderer, assets) {
  const scene = new THREE.Scene();

  // --- Stadium backdrop (projected photo) + image-based lighting ------------------------------
  const env = buildEnvironment(renderer, scene, assets);
  addPitchMarkings(scene);

  // Invisible floor that only receives shadows, so players and ball are grounded on the photo pitch.
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.5, color: 0x0b1a08 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.002;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // --- Lights (lights are not visuals; the models are) --------------------------------------
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a3b22, assets.hdri ? 0.25 : 0.9));
  // The panorama's sun (measured from the HDR: low, from behind the shooter's left) gives the shadow
  // direction; it is raised from ~10° to ~38° so shadows stay short enough to read under the players.
  const sun = new THREE.DirectionalLight(0xffe9c9, 1.8);
  sun.position.copy(SUN_DIR).multiplyScalar(40).add(new THREE.Vector3(0, 0, 6));
  sun.castShadow = true;
  const sm = preset().shadowMap;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, near: 10, far: 80 });
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
    // fitModel centres the model on z; slide it back so the front of the posts sits on the goal line (z = 0).
    // The net then extends towards -z. (The model must face +z: rotate it here if a different goal faces the other way.)
    goal.updateMatrixWorld(true);
    goal.position.z -= new THREE.Box3().setFromObject(goal).max.z - GOAL.postRadius;
    enableShadows(goal);
    styleGoal(goal);
    scene.add(goal);
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
  const kits = {}; // { keeper, striker }: kit handles — call .set(kit) to change what a player wears
  const source = assets.character;
  if (source) {
    const clips = buildClips(source);
    const make = (height, kit) => {
      const skinned = SkeletonUtils.clone(source.scene);
      const kitHandle = applyKit(skinned, kit);
      const holder = fitModel(skinned, 'height', height);
      enableShadows(holder);
      return { holder, skinned, kit: kitHandle };
    };
    const k = make(TARGET_SIZE.keeperHeight, KEEPER_KIT);
    kits.keeper = k.kit;
    keeper = new Keeper(k.holder, k.skinned, clips, { height: TARGET_SIZE.keeperHeight });
    scene.add(keeper.root);
    const s = make(TARGET_SIZE.strikerHeight, TEAMS[0].kit);
    kits.striker = s.kit;
    striker = new Striker(s.holder, s.skinned, clips);
    scene.add(striker.root);
    if (ball) striker.setUp(ball.position);
  }

  // --- Camera ---------------------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.75, PITCH.penaltySpotZ + 6.5);
  camera.lookAt(0, 1.1, 0);

  return { scene, camera, ball, goal, keeper, striker, kits, sun, sky: env.sky };
}

/**
 * The net is a hex-mesh texture on a few quads. With an alpha cutoff its thin strands vanish once mipmapped
 * (from the penalty spot the net was nearly invisible), so it is alpha-blended instead and fades to a fine
 * veil with distance. It does not cast shadows (a blended quad would cast a solid one).
 */
function styleGoal(goal) {
  goal.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.map) {
        m.alphaTest = 0;
        m.transparent = true;
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
        m.color?.set(0xf4f6f2);
        m.map.anisotropy = 4;
        o.castShadow = false;
        o.renderOrder = 2; // after the players, so they show through it
      } else {
        m.color?.set(0xf2f3ef); // painted aluminium frame: white, slightly satin
        if ('roughness' in m) { m.roughness = 0.45; m.metalness = 0; }
      }
      m.needsUpdate = true;
    }
  });
}

/** Library clips + authored clips (+ mirrored dives), built once from the untouched source rig. */
function buildClips(source) {
  const clips = new Map(source.animations.map((c) => [c.name, c]));
  for (const spec of AUTHORED) clips.set(spec.name, buildClip(source.scene, spec));
  clips.set('GK_DiveLow_R', buildClip(source.scene, DIVE_LOW, { mirror: true, name: 'GK_DiveLow_R' }));
  clips.set('GK_DiveHigh_R', buildClip(source.scene, DIVE_HIGH, { mirror: true, name: 'GK_DiveHigh_R' }));
  return clips;
}
