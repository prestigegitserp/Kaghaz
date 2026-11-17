import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3,Quaternion,Box3} from 'three';
import {ASSET_REGISTRY,assetForProduct} from '../src/scene/asset-registry.ts';
import {toggleComparison} from '../src/domain/comparison.ts';
import {STORAGE_KEY} from '../src/domain/model.ts';
const root=new URL('../public/v2/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8'));
function parse(data:Buffer){
 assert.equal(data.toString('utf8',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const length=data.readUInt32LE(12);assert.equal(data.readUInt32LE(16),0x4e4f534a);
 const doc=JSON.parse(data.toString('utf8',20,20+length));const bin=data.subarray(28+length);return {doc,bin};
}
function bounds(doc:any){
 const result=new Box3();
 function visit(index:number,parent:Matrix4){
  const n=doc.nodes[index],local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation||[0,0,0]),new Quaternion().fromArray(n.rotation||[0,0,0,1]),new Vector3().fromArray(n.scale||[1,1,1]));const matrix=parent.clone().multiply(local);
  if(n.mesh!==undefined)for(const p of doc.meshes[n.mesh].primitives){const a=doc.accessors[p.attributes.POSITION];result.union(new Box3(new Vector3().fromArray(a.min),new Vector3().fromArray(a.max)).applyMatrix4(matrix));}
  for(const child of n.children||[])visit(child,matrix);
 }
 for(const n of doc.scenes[doc.scene||0].nodes)visit(n,new Matrix4());return result;
}
test('all product families resolve to an existing authored asset; v1 browser data is isolated',()=>{
 for(const kind of ['ream','sheet','kraft','box','swatch','roll','notebook'] as const)assert.ok(ASSET_REGISTRY[assetForProduct(kind)]);
 assert.equal(STORAGE_KEY,'kaghaz.workspace.v2');
 assert.ok(readFileSync(new URL('../src/domain/storage.ts',import.meta.url),'utf8').includes('kaghaz.assets.v2'));
});
test('actual GLB files are self-contained, aligned and inside the documented geometry and download budgets',()=>{
 assert.equal(manifest.assets.length,Object.keys(ASSET_REGISTRY).length);
 let total=0;
 for(const record of manifest.assets){
  const buffer=readFileSync(new URL(record.file,root)),{doc,bin}=parse(buffer),definition=ASSET_REGISTRY[record.id as keyof typeof ASSET_REGISTRY];
  assert.equal(buffer.length,record.bytes);assert.equal(createHash('sha256').update(buffer).digest('hex'),record.sha256);
  assert.ok(buffer.length<=definition.maxBytes);total+=buffer.length;
  let triangles=0;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives){assert.equal(primitive.mode||4,4);assert.ok(primitive.attributes.NORMAL!==undefined);const a=doc.accessors[primitive.indices??primitive.attributes.POSITION];triangles+=a.count/3;}
  assert.equal(triangles,record.triangles);assert.ok(triangles<=definition.maxTriangles);
  assert.equal(doc.buffers.length,1);assert.ok(!doc.buffers[0].uri);
  for(const view of doc.bufferViews){assert.equal((view.byteOffset||0)%4,0);assert.ok((view.byteOffset||0)+view.byteLength<=bin.length);}
  for(const image of doc.images||[]){assert.equal(image.mimeType,'image/webp');assert.ok(image.bufferView!==undefined);assert.ok(!image.uri);const view=doc.bufferViews[image.bufferView];assert.equal(bin.toString('ascii',view.byteOffset,view.byteOffset+4),'RIFF');}
  if(doc.images?.length)assert.ok(doc.extensionsRequired.includes('EXT_texture_webp'));
 }
 assert.ok(total<6*1024*1024,`Asset transfer is ${total} bytes`);
});
test('merchant fixtures and paper objects retain distinct real-world proportions and floor origins',()=>{
 const expected:Record<string,number[]>={'paper-ream':[.215,.055,.305],'wood-pallet':[1.2,.152,.8],'paper-bundle':[.72,.19,1.01],'merchant-counter':[3.65,.933,.98],'kraft-roll':[.96,.922,.64]};
 for(const [id,target] of Object.entries(expected)){
  const {doc}=parse(readFileSync(new URL(`models/${id}.glb`,root))),box=bounds(doc),size=box.getSize(new Vector3());
  [size.x,size.y,size.z].forEach((n,i)=>assert.ok(Math.abs(n-target[i])<.035,`${id} axis ${i}: ${n} vs ${target[i]}`));
  assert.ok(Math.abs(box.min.y)<.025,`${id} floor origin ${box.min.y}`);
 }
 const {doc}=parse(readFileSync(new URL('models/paper-ream.glb',root)));
 assert.ok(doc.nodes.some((n:any)=>n.extras?.part==='wrapper'));assert.ok(doc.nodes.some((n:any)=>n.extras?.part==='sheets'));
 const carton=parse(readFileSync(new URL('models/carton-open.glb',root))).doc;
 assert.ok(carton.nodes.some((n:any)=>n.extras?.part==='flaps'));
});
test('PBR sources separate color, roughness and OpenGL normals; review renders ship with the site',()=>{
 const doc=JSON.parse(readFileSync(new URL('materials/manifest.json',root),'utf8'));
 for(const m of Object.values(doc.materials) as any[]){assert.equal(m.normalConvention,'OpenGL +Y');assert.equal(new Set([m.color,m.normal,m.roughness]).size,3);for(const path of [m.color,m.normal,m.roughness])assert.ok(existsSync(new URL(path,root)));}
 for(const path of manifest.renders)assert.ok(existsSync(new URL(path,root)));
});
test('comparison deduplicates selections, refuses unknown IDs and allows removal even when full',()=>{
 const valid=['a','b','c','d'];assert.deepEqual(toggleComparison(['a','b'],'c',valid),{ids:['a','b','c'],full:false});
 assert.deepEqual(toggleComparison(['a','b','c'],'d',valid),{ids:['a','b','c'],full:true});
 assert.deepEqual(toggleComparison(['a','b','c'],'b',valid),{ids:['a','c'],full:false});
 assert.deepEqual(toggleComparison(['a','a','gone'],'invalid',valid),{ids:['a'],full:false});
});
