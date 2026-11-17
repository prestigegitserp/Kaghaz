import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSET_REGISTRY,type AssetId } from './asset-registry.ts';
/** Shared resource cache. Scene placements are clones; geometry and textures are shared.
 * Blender's small parts are merged by material and semantic part before placement.
 * SKU IDs and collision volumes remain outside asset topology.
 */
export class AuthoredAssets {
  private cache=new Map<AssetId,Promise<T.Group>>();
  private active=0;private waiting:(()=>void)[]=[];private disposed=false;
  async load(id:AssetId):Promise<T.Group>{
    let promise=this.cache.get(id);
    if(!promise){promise=this.fetch(id);this.cache.set(id,promise);promise.catch(()=>this.cache.delete(id));}
    return promise;
  }
  private async fetch(id:AssetId):Promise<T.Group>{
    if(this.active>=2)await new Promise<void>(resolve=>this.waiting.push(resolve));this.active++;
    try{
      const definition=ASSET_REGISTRY[id],response=await fetch(`${import.meta.env.BASE_URL}${definition.url}`);
      if(!response.ok)throw new Error(`Asset ${id}: ${response.status}`);
      const bytes=await response.arrayBuffer();if(bytes.byteLength>definition.maxBytes)throw new Error(`Asset ${id} exceeds byte budget`);
      const gltf=await new GLTFLoader().parseAsync(bytes,'');gltf.scene.updateMatrixWorld(true);
      const groups=new Map<string,{material:T.Material;part:string;geometry:T.BufferGeometry[]}>();
      let triangles=0;
      gltf.scene.traverse(object=>{
        if(!(object instanceof T.Mesh))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const geo=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geo.applyMatrix4(object.matrixWorld);
        for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);
        if(!geo.attributes.normal)geo.computeVertexNormals();
        if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
        triangles+=geo.attributes.position.count/3;
        const part=String(object.userData.part||'body');
        // The supplied exports use one material per mesh. Retain grouped meshes if future assets differ.
        if(materials.length!==1){geo.dispose();return;}
        const material=materials[0];const key=material.uuid+'/'+part;
        const bucket=groups.get(key)||{material,part,geometry:[] as T.BufferGeometry[]};bucket.geometry.push(geo);groups.set(key,bucket);
      });
      if(triangles>definition.maxTriangles)throw new Error(`Asset ${id} exceeds geometry budget`);
      const root=new T.Group();root.name=id;
      for(const bucket of groups.values()){
        const geometry=mergeGeometries(bucket.geometry,false);bucket.geometry.forEach(g=>g.dispose());
        if(!geometry)continue;const mesh=new T.Mesh(geometry,bucket.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.part=bucket.part;root.add(mesh);
      }
      // Original geometry is replaced by the merged version; original materials/textures are retained.
      gltf.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
      if(this.disposed){disposeTemplate(root);throw new Error('Asset cache disposed');}
      return root;
    }finally{this.active--;this.waiting.shift()?.();}
  }
  async instance(id:AssetId,accent?:string):Promise<T.Group>{
    const source=await this.load(id),root=source.clone(true);
    if(accent)root.traverse(o=>{
      if(o instanceof T.Mesh&&!Array.isArray(o.material)&&o.material.name==='Painted forest green'){
        o.material=o.material.clone();(o.material as T.MeshStandardMaterial).color.set(accent);o.userData.ownedMaterial=true;
      }
    });return root;
  }
  dispose(){this.disposed=true;for(const p of this.cache.values())p.then(disposeTemplate).catch(()=>{});this.cache.clear();}
}
/** Repeated stock placements share a draw call per geometry/material inside each spatial cell. */
export function batchPlacements(pieces:T.Group[]):T.Group {
  const root=new T.Group(),buckets=new Map<string,{source:T.Mesh;matrices:T.Matrix4[]}>();
  for(const piece of pieces){piece.updateMatrixWorld(true);piece.traverse(o=>{
    if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;
    const key=o.geometry.uuid+'/'+o.material.uuid,bucket=buckets.get(key)||{source:o,matrices:[] as T.Matrix4[]};
    bucket.matrices.push(o.matrixWorld.clone());buckets.set(key,bucket);
  });}
  for(const {source,matrices} of buckets.values()){
    const mesh=new T.InstancedMesh(source.geometry,source.material,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();
    mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.userData={...source.userData};root.add(mesh);
  }
  return root;
}
function disposeTemplate(root:T.Group){
  const textures=new Set<T.Texture>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  materials.forEach(m=>{for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);m.dispose();});textures.forEach(t=>{(t.image as ImageBitmap)?.close?.();t.dispose();});
}
