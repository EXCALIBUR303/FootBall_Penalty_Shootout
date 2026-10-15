// Optimise raw GLBs for the web: assets/raw/<group>/*.glb -> public/assets/models/<name>.glb
//
//   node scripts/optimize-assets.mjs                 # everything under assets/raw (except khronos/)
//   node scripts/optimize-assets.mjs --test          # also include assets/raw/khronos (pipeline smoke test)
//   node scripts/optimize-assets.mjs path/to/a.glb   # specific files
//
// Pipeline: dedup -> prune -> resample animations -> resize textures -> WebP -> Draco.
// Prints before/after size and warns when a file is over the 5 MB budget.
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';

const RAW = resolve('assets/raw');
const OUT = resolve('public/assets/models');
const BUDGET = 5 * 1024 * 1024;
const MAX_TEXTURE = 2048; // stadium may need 2K; props are usually far smaller already

const args = process.argv.slice(2);
const includeTest = args.includes('--test');
const explicit = args.filter((a) => !a.startsWith('--'));

async function findGlbs(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'khronos' && !includeTest) continue; // sample models never ship
      found.push(...(await findGlbs(p)));
    } else if (entry.name.toLowerCase().endsWith('.glb')) found.push(p);
  }
  return found;
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

await mkdir(OUT, { recursive: true });
const inputs = explicit.length ? explicit.map((f) => resolve(f)) : await findGlbs(RAW);
if (!inputs.length) console.log('No input GLBs found under assets/raw.');

let overBudget = 0;
for (const file of inputs) {
  const doc = await io.read(file);
  await doc.transform(
    dedup(),
    prune(),
    resample(), // drops redundant animation keyframes
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE] }),
    // Draco on geometry. Skinned meshes are fine; quantisation keeps skin weights precise enough.
    draco({ method: 'edgebreaker' }),
  );
  const out = join(OUT, basename(file));
  await io.write(out, doc);

  const before = (await stat(file)).size;
  const after = (await stat(out)).size;
  const clips = doc.getRoot().listAnimations().map((a) => a.getName());
  const flag = after > BUDGET ? '  !! OVER 5 MB BUDGET' : '';
  if (after > BUDGET) overBudget++;
  console.log(
    `${basename(file)}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB` +
      `  clips=[${clips.join(', ')}]${flag}`,
  );
}
if (overBudget) process.exitCode = 1;
