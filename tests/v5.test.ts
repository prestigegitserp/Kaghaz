import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { HALL, boothCoordinates, STATION_IDS } from '../src/domain/hall.ts';
import { rollUsage, palletLoad } from '../src/domain/mill.ts';
import { walkRoute,walkLineClear } from '../src/domain/navigation.ts';
import { ASSET_REGISTRY, type AssetId } from '../src/scene/asset-registry.ts';

test('the passage has a connected upper landing, two decks, and seven scoped workstations',()=>{
    assert.deepEqual(HALL.decks,[0,3.58]);
    assert.equal(STATION_IDS.length,7);
    assert.equal(STATION_IDS.filter(id=>HALL.stations[id].level===1).length,2);
    assert.ok(HALL.stairs.landingHigh<HALL.opening.far-.20);
    assert.ok(HALL.stairs.landingLow>HALL.stairs.low+.20);
    assert.equal(boothCoordinates(0).level,0);
    assert.equal(boothCoordinates(6).level,1);
    const opening=HALL.opening,origin:[number,number]=[0,HALL.stairs.landingHigh],end:[number,number]=[-2.08,8.46];
    const blocked=(x:number,z:number)=>Math.abs(x)<opening.halfWidth+.21&&z>opening.far-.2&&z<opening.near+.22;
    const way=walkRoute(origin,end,blocked);
    assert.deepEqual(way.at(-1),end);
    assert.ok(way.every((point,i)=>walkLineClear(way[i-1]||origin,point,blocked)));
});

test('roll unwrapping conserves estimated length and material mass',()=>{
    const start=rollUsage(530,1000,100,0),half=rollUsage(530,1000,100,.5),end=rollUsage(530,1000,100,1);
    assert.equal(start.used,0);
    assert.equal(half.mass,start.mass/2);
    assert.ok(Math.abs(half.used+half.remaining-start.remaining)<.000001);
    assert.ok(half.diameter>76&&half.diameter<530);
    assert.equal(end.remaining,0);
    assert.equal(end.diameter,76);
});

test('pallet layout respects layer height and clamps invalid carton dimensions',()=>{
    const result=palletLoad(395,295,220,6,13)!;
    assert.ok(result.perLayer>=6);
    assert.equal(result.layers,4);
    assert.equal(result.net,result.total*13);
    assert.ok(result.height<=1200);
    assert.equal(palletLoad(1,295,220,3,13),undefined);
    assert.equal(palletLoad(395,295,Infinity,3,13),undefined);
});

test('the three detailed assets contain embedded textures and independent wrap parts',()=>{
    const root=new URL('../public/v5/',import.meta.url);
    const manifest=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8'));
    assert.equal(manifest.version,5);
    assert.equal(manifest.assets.length,3);
    assert.equal(manifest.renders.length,4);
    for(const record of manifest.assets){
        const bytes=readFileSync(new URL(record.file,root));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
        assert.ok(bytes.length<ASSET_REGISTRY[record.id as AssetId].maxBytes);
        const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
        assert.ok(gltf.images.every((image:{uri?:string})=>!image.uri));
        if(record.id==='wrapped-stock-pallet'){
            const parts=new Set(gltf.nodes.map((node:{extras?:{part?:string}})=>node.extras?.part));
            assert.ok(parts.has('straps'));
            for(let i=0;i<4;i++)assert.ok(parts.has(`film-${i}`));
        }
    }
});
