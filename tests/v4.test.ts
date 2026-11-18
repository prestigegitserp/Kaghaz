import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cartonPanels, cartonSize, pileDimensions } from '../src/domain/carton.ts';
import legacyHall from '../src/domain/hall-layout.json' with { type: 'json' };
import { walkLineClear, walkRoute } from '../src/domain/navigation.ts';

test('the dieline folds to the requested dimensions and keeps the base fixed', () => {
    const size=cartonSize(160,106,55);
    const flat=cartonPanels(size,0),folded=cartonPanels(size,1),dims=pileDimensions(folded);
    assert.equal(flat.length,11);
    assert.deepEqual(flat[0].vertices,folded[0].vertices);
    assert.ok(flat.every(p=>p.vertices.every(v=>v[1]===0)));
    assert.ok(pileDimensions(flat).depth>size.depth*2);
    for(const key of ['width','depth','height'] as const) assert.ok(Math.abs(dims[key]-size[key])<1e-7);
    assert.deepEqual(cartonSize(-1,Infinity,999),{width:60,depth:104,height:150});
});
test('click-to-walk plans around furniture and refuses endpoints inside it', () => {
    const blocked=(x:number,z:number)=>Math.abs(x)<1.2&&Math.abs(z)<1;
    const route=walkRoute([-4,0],[4,0],blocked);
    assert.ok(route.length>1);
    assert.deepEqual(route.at(-1),[4,0]);
    assert.ok(route.every((to,i)=>walkLineClear(route[i-1]||[-4,0],to,blocked)));
    assert.deepEqual(walkRoute([-4,0],[0,0],blocked),[]);
    assert.deepEqual(walkRoute([1,3],[2,3],blocked),[[2,3]]);
});
test('original v4 render specification retains its three stations',()=>{
    assert.equal(legacyHall.booths.length,10);
    assert.equal(Object.keys(legacyHall.stations).length,3);
});
test('the v4 photographed materials and Cycles images are available locally', () => {
    const root=new URL('../public/v4/',import.meta.url);
    const manifest=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8'));
    assert.equal(manifest.version,4);
    const asset=manifest.assets.find((item:{id:string})=>item.id==='paper-ream-modern');
    const bytes=readFileSync(new URL(asset.file,root));
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.length,asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.ok(bytes.length<125_000);
    for(const name of ['floor','plaster','wood'])for(const kind of ['color','normal','arm']){
        const map=readFileSync(new URL(`materials/${name}-${kind}.webp`,root));
        assert.equal(map.toString('ascii',8,12),'WEBP');
    }
    assert.equal(manifest.assets.length,2);
    const open=manifest.assets.find((item:{id:string})=>item.id==='paper-ream-open-modern');
    const glb=readFileSync(new URL(open.file,root));
    const g=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
    assert.ok(g.nodes.some((node:{extras?:{part:string}})=>node.extras?.part==='loose-sheets'));
    assert.equal(manifest.renders.length,4);
    for(const view of manifest.renders){
        assert.ok(view.width>=1280);
        assert.equal(readFileSync(new URL(view.file,root)).length,view.bytes);
    }
});
