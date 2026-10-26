import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { fitPortraitFov } from '../src/camera/framing.js';
import { Director, SHOTS } from '../src/camera/director.js';
const spot=new T.Vector3(0,0.11,11);
test('portrait framing keeps both posts, the striker and ball inside the viewport',()=>{
  for(const [w,h]of [[390,844],[768,1024]]){
    const shot=SHOTS.aim(spot)(0),camera=new T.PerspectiveCamera(fitPortraitFov(shot.fov,w/h),w/h,0.1,500);
    camera.position.copy(shot.pos);camera.lookAt(shot.target);camera.updateMatrixWorld();
    const points=[[-3.78,0,0],[-3.78,2.44,0],[3.78,0,0],[3.78,2.44,0],[-1.9,0,13.6],[-1.1,1.8,13.6],[0,0.11,11]];
    for(const point of points){const p=new T.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && p.z<1,`${w}x${h}: ${point} outside view`);}
    const ball=spot.clone().project(camera),screenY=(1-ball.y)/2;
    assert.ok(screenY<0.68,`${w}x${h}: ball falls behind lower power panel`);
  }
});
test('landscape projection retains the authored shot FOVs',()=>{
  for(const aspect of [4/3,16/10,16/9,21/9])for(const fov of [34,40,48,56])assert.equal(fitPortraitFov(fov,aspect),fov);
});

test('portrait-to-landscape resize changes projection without moving the authored camera',()=>{
  const camera=new T.PerspectiveCamera(40,390/844,0.1,500),director=new Director(camera);
  director.cut(SHOTS.aim(spot),{cut:true});director.update(0);
  assert.ok(camera.fov>75);const position=camera.position.clone();
  camera.aspect=16/9;director.update(0);
  assert.equal(camera.fov,40);assert.ok(camera.position.distanceTo(position)<1e-8);
});
