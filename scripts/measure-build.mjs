import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(file);}}
walk('dist');
const scripts=files.filter(p=>p.endsWith('.js')&&p.startsWith('dist/assets/')).map(file=>({file:path.basename(file),bytes:fs.statSync(file).size,gzipBytes:zlib.gzipSync(fs.readFileSync(file)).length}));
const textures=files.filter(p=>p.endsWith('.webp')).map(file=>({file:path.basename(file),bytes:fs.statSync(file).size}));
console.log(JSON.stringify({scripts,textures,totalFiles:files.length,totalUncompressedBytes:files.reduce((s,p)=>s+fs.statSync(p).size,0),note:'Artifact sizes, not browser timing or FPS.'},null,2));
