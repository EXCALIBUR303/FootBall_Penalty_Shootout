// Final static inspection of the real scene: aim framing, complete pitch and all four stadium sides.
import {createRequire} from 'node:module';import{mkdirSync}from'node:fs';import assert from'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');const out=process.argv[2]||'docs/qa/arena';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(120000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/GPU stall/.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('penalty-kings.settings',JSON.stringify({quality:'low',onboarded:true})));
 await page.goto(`http://localhost:${process.env.PORT||5173}/?play`);await page.waitForFunction(()=>window.__game?.game?.phase==='aim');
 const stats=await page.evaluate(()=>{
  const g=window.__game;g.renderer.setAnimationLoop(null);g.game.setPaused(true);g.renderer.info.reset();g.post.render(0);
  const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {device:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,crowd:g.world.environment.crowd.mesh.count};
 });
 await page.screenshot({path:`${out}/aim-final.png`});
 await page.setViewportSize({width:1280,height:800});
 await page.evaluate(()=>{const g=window.__game,c=g.world.camera;document.getElementById('ui').hidden=true;c.position.set(120,110,180);c.lookAt(0,2,52.5);c.fov=48;c.updateProjectionMatrix();g.post.render(0);});
 await page.screenshot({path:`${out}/stadium-overview.png`});
 assert.equal(stats.crowd,2400);assert.deepEqual(errors,[]);console.log(JSON.stringify({stats,errors},null,2));
}finally{await browser.close();}
