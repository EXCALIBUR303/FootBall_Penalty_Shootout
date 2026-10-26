// Inspectable local size budget. Run after npm run build. No network or extra dependencies.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const rows=[];
for(const name of (await readdir('public/assets/models')).filter(n=>n.endsWith('.glb')).sort()){
 const path=join('public/assets/models',name),data=await readFile(path);
 const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 if(name==='stadium.glb'){
   for(const [prefix,count] of [['LED_',36],['BANNER_',288]]){
     const nodes=json.nodes.filter(n=>n.name?.startsWith(prefix));assert.equal(nodes.length,4,prefix);
     for(const n of nodes){const p=json.meshes[n.mesh].primitives[0];assert.ok(p.attributes.TEXCOORD_0!==undefined,`${n.name} UVs`);assert.equal(json.accessors[p.indices]?.count,count,`${n.name} topology`);}
   }
 }
 if(data.length>5*1024*1024)throw new Error(`${name} exceeds 5 MiB`);
 rows.push(`| ${name} | ${data.length.toLocaleString('en-US')} | ${(data.length/1024).toFixed(1)} | ${(json.extensionsUsed||[]).includes('KHR_draco_mesh_compression')?'Draco':'uncompressed'} |`);
}
let report='# Asset and bundle sizes\n\nMeasured from the local production build; byte counts are uncompressed unless stated.\n\n| Model | Bytes | KiB | Geometry |\n|---|---:|---:|---|\n'+rows.join('\n')+'\n\n';
const chunks=[];
for(const name of (await readdir('dist/assets')).filter(n=>/\.(js|css|wasm)$/.test(n)).sort()){
 const data=await readFile(join('dist/assets',name));chunks.push(`| ${name} | ${(data.length/1000).toFixed(2)} | ${(gzipSync(data).length/1000).toFixed(2)} |`);
}
report+='| Build chunk | kB | gzip kB |\n|---|---:|---:|\n'+chunks.join('\n')+'\n\n';
async function bytes(dir){let n=0;for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);n+=e.isDirectory()?await bytes(p):(await stat(p)).size;}return n;}
report+=`Total public payload: ${(await bytes('public')/1024/1024).toFixed(2)} MiB. Total production directory: ${(await bytes('dist')/1024/1024).toFixed(2)} MiB.\n\nThe large lazy match chunk includes the existing Rapier compatibility build and embedded WASM. No new runtime dependencies were added. The daylight HDR and photo have been removed. The build retains the existing large-chunk warning. Gzip values are estimates from Node zlib; server compression can differ.\n`;
await writeFile(process.argv[2] || 'docs/ASSET-SIZES.md',report);console.log(report);
