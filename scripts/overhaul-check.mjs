// Structural, reduced-motion and presentation checks on the real loaded world. Needs the dev server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium }=createRequire(import.meta.url)('playwright');
const out=process.argv[2] || 'docs/qa/overhaul';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(240000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/GPU stall/.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('penalty-kings.settings',JSON.stringify({quality:'low',onboarded:true})));
  await page.goto(`http://localhost:${process.env.PORT || 5173}/`);await page.waitForFunction(()=>window.__game);
  const inspect=()=>page.evaluate(()=>{
    const {world,assets,renderer}=window.__game;const leds=[],flags=[];
    world.scene.traverse(o=>{if(o.name.startsWith('LED_'))leds.push(o);if(o.name.startsWith('BANNER_'))flags.push(o);});
    const density={near:0,far:0,west:0,east:0},mesh=world.environment.crowd.mesh,a=mesh.instanceMatrix.array;
    for(let i=0;i<mesh.count;i++){const x=a[i*16+12],y=a[i*16+13],z=a[i*16+14];if(y<9)density[z< -11?'near':z>116?'far':x<0?'west':'east']++;}
    const boneNames=[...world.keeper.bones.keys()];const bound=[...world.keeper.actions.values()].every(a=>a.getClip().tracks.every(t=>boneNames.includes(t.name.split('.')[0])));
    return {lowerStandDensity:density,assets:Object.keys(assets),crowd:world.environment.crowd.mesh.count,leds:leds.length,flags:flags.length,ledMapped:leds.every(o=>!!o.material.map && !!o.geometry.attributes.uv && o.geometry.index?.count===36),flagUVs:flags.every(o=>!!o.geometry.attributes.uv && o.geometry.index?.count===288),offset:leds[0].material.map.offset.x,bound,actions:[...world.keeper.actions.keys()],stats:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}};
  });
  const low=await inspect();assert.equal(low.crowd,2400);assert.ok(Object.values(low.lowerStandDensity).every(n=>n>100),'Low must populate every lower stand');assert.equal(low.leds,4);assert.equal(low.flags,4);assert.ok(low.ledMapped);assert.ok(low.flagUVs);assert.ok(low.bound);assert.ok(!low.assets.includes('backdrop')&&!low.assets.includes('hdri'));
  for(const name of ['GK_DiveLow_L','GK_DiveLow_R','GK_DiveHigh_L','GK_DiveHigh_R','GK_Block','GK_Jump','ST_Kick','ST_Celebrate','Idle_Loop'])assert.ok(low.actions.includes(name),name);
  await page.screenshot({path:`${out}/menu-low.png`});
  await page.evaluate(()=>window.__game.settings.set('reducedMotion',true));
  const before=(await inspect()).offset;await page.waitForTimeout(1400);assert.equal((await inspect()).offset,before,'LED scroll must stop under reduced motion');
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>window.__game.settings.set('quality','high'));await page.waitForTimeout(1600);const high=await inspect();assert.equal(high.crowd,9600);
  await page.screenshot({path:`${out}/menu-high.png`});
  await page.click('[data-action="play-1p"]');await page.screenshot({path:`${out}/setup-high.png`});
  // Initialize physics on Low, then verify actual High match rendering at a smaller software-GL viewport.
  await page.evaluate(()=>window.__game.settings.set('quality','low'));
  await page.setViewportSize({width:960,height:540});
  await page.evaluate(()=>document.querySelector('.setup__go').click());
  await page.waitForFunction(()=>window.__game.game?.phase==='aim');
  await page.screenshot({path:`${out}/aim-low.png`});
  await page.evaluate(()=>window.__game.settings.set('quality','high'));
  await page.screenshot({path:`${out}/aim-high.png`});
  await page.evaluate(()=>{window.__game.settings.set('quality','low');window.__game.settings.set('reducedMotion',false);window.__game.settings.set('autoReplay',true);const g=window.__game.game;g.debugForceSave({kind:'low',side:-1,reach:0.5,speed:1,height:0.5},0.4);g.debugShoot({x:2.6,y:1.2},0.8,0);});
  await page.waitForFunction(()=>window.__game.world.net.active,null,{timeout:120000});
  await page.screenshot({path:`${out}/net-impact.png`});
  await page.waitForFunction(()=>window.__game.game.phase==='replay',null,{timeout:120000});
  await page.screenshot({path:`${out}/replay-low.png`});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({low,high,netImpact:true,errors},null,2));
} finally {await browser.close();}
