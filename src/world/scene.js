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
import { createNetRipple } from '../fx/net.js';
import { TEAMS, KEEPER_KIT } from '../game/teams.js';

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

  // Cool overhead fill and warm key. Only the key casts shadows; four tower glints are emissive.
  scene.add(new THREE.HemisphereLight(0x99caff, 0x163d2c, 1.0));
  const sun = new THREE.DirectionalLight(0xffdbab, 3.0);
  sun.position.set(-18,28,16);
  sun.castShadow = true;
  const sm = preset().shadowMap;
  sun.shadow.mapSize.set(sm,sm);
  Object.assign(sun.shadow.camera,{left:-18,right:18,top:20,bottom:-20,near:1,far:90});
  sun.shadow.bias=-0.0003;sun.shadow.normalBias=0.025;
  sun.target.position.set(0,0,7);
  scene.add(sun,sun.target);
  const rim = new THREE.DirectionalLight(0x8dd6ff, 2.3);
  rim.position.set(14,18,-10);scene.add(rim);
  const fill = new THREE.DirectionalLight(0xb2d5ff, 0.7);
  fill.position.set(0,12,35);scene.add(fill);

  // --- Static models ------------------------------------------------------------------------
  let goal = null;
  if (assets.goal) {
    goal = fitModel(assets.goal.scene, 'width', TARGET_SIZE.goalOuterWidth);
    // fitModel centres the model on z; slide it back so the front of the posts sits on the goal line (z = 0).
    // The net then extends towards -z. (The model must face +z: rotate it here if a different goal faces the other way.)
    goal.updateMatrixWorld(true);
    goal.position.z -= new THREE.Box3().setFromObject(goal).max.z - GOAL.postRadius;
    enableShadows(goal);
    styleGoal(goal);
    scene.add(goal);
    const farGoal=goal.clone(true);
    farGoal.name='far-goal';farGoal.rotation.y=Math.PI;farGoal.position.z=105-goal.position.z;
    enableShadows(farGoal,{cast:false,receive:true});scene.add(farGoal);
  }

  const net = createNetRipple(goal);

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

  return { scene, camera, ball, goal, keeper, striker, kits, sun, sky: env.sky, environment: env, net };
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
