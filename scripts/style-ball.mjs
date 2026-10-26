// Preserve the supplied imported ball geometry; strip photographic maps superseded by original panel paint.
import{NodeIO}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';
import{prune,draco}from'@gltf-transform/functions';import draco3d from'draco3dgltf';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const doc=await io.read(process.argv[2] || 'public/assets/models/ball.glb');
for(const m of doc.getRoot().listMaterials())m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setBaseColorFactor([0.82,0.87,0.83,1]).setRoughnessFactor(0.58);
await doc.transform(prune(),draco({method:'edgebreaker'}));await io.write('public/assets/models/ball.glb',doc);
console.log('Imported ball mesh retained; photo maps removed. Original unbranded panel paint is in src/world/ball-style.js.');
