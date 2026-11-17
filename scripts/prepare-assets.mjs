import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const threeRoot=path.resolve(path.dirname(require.resolve('three')),'..');
for(const name of ['draco','basis']) {
  const destination=path.resolve('public/decoders',name);fs.mkdirSync(destination,{recursive:true});
  const source=path.join(threeRoot,'examples/jsm/libs',name,name==='draco'?'gltf':'');
  for(const file of fs.readdirSync(source)) {
    if(/\.(js|wasm)$/.test(file)&&!file.includes('encoder'))fs.copyFileSync(path.join(source,file),path.join(destination,file));
  }
  const encoder=path.join(destination,'draco_encoder.js');if(fs.existsSync(encoder))fs.unlinkSync(encoder);
}
fs.copyFileSync(path.join(threeRoot,'LICENSE'),path.resolve('public/decoders/THREE-LICENSE.txt'));
fs.copyFileSync(path.resolve('node_modules/typescript/LICENSE.txt'),path.resolve('public/decoders/APACHE-LICENSE.txt'));
fs.copyFileSync(path.resolve('node_modules/@fontsource/vazirmatn/LICENSE'),path.resolve('public/assets/Vazirmatn-OFL.txt'));
fs.copyFileSync(path.resolve('THIRD_PARTY_NOTICES.md'),path.resolve('public/decoders/THIRD_PARTY_NOTICES.md'));
console.log('Local Draco and Basis decoders prepared.');
