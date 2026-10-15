// Prints scene structure, bounding box, skins and animation clips of a GLB. Usage: node scripts/inspect-glb.mjs file.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const b = getBounds(doc.getRoot().getDefaultScene() || root.listScenes()[0]);
const f = (v) => v.map((n) => n.toFixed(2)).join(', ');
console.log('bounds min', f(b.min), 'max', f(b.max));
console.log('meshes', root.listMeshes().map((m) => m.getName()), 'skins', root.listSkins().length, 'materials', root.listMaterials().map((m) => m.getName()));
console.log('textures', root.listTextures().map((t) => `${t.getName()} ${t.getMimeType()} ${(t.getImage()?.length / 1024) | 0}KB`));
const clips = root.listAnimations().map((a) => `${a.getName()} (${Math.max(...a.listSamplers().map((s) => s.getInput().getMax([])[0])).toFixed(2)}s)`);
console.log(`clips ${clips.length}:`); console.log(clips.join('\n'));
