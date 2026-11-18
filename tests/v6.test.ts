import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BOOTHS, PRODUCTS } from '../src/domain/catalog.ts';
import { MATERIAL_PROFILES, PROFILE_IDS, STATION_SPECIMENS, type MaterialProfileId } from '../src/domain/material-profiles.ts';
import { ASSET_REGISTRY, assetForProduct, type AssetId } from '../src/scene/asset-registry.ts';

const publicRoot = new URL('../public/v6/', import.meta.url);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('all eight stocked specimen families connect their model, shop and representative to the catalog', () => {
    assert.equal(PRODUCTS.length, 48);
    assert.deepEqual(new Set(Object.values(STATION_SPECIMENS).flat().map(item => item.asset)), new Set(PROFILE_IDS));
    for (const profile of PROFILE_IDS) {
        const products = PRODUCTS.filter(product => product.profile === profile);
        assert.equal(products.length, 3);
        assert.ok(products.some(product => product.id === MATERIAL_PROFILES[profile].lead));
        for (const product of products) {
            assert.ok(BOOTHS.some(booth => booth.id === product.boothId && booth.category === product.category));
            assert.equal(ASSET_REGISTRY[assetForProduct(product.kind, product.profile)].url, `v6/models/${profile}.glb`);
        }
    }
});

test('v6 carries all eight lightweight PBR models and eleven matching high-resolution frames', () => {
    const manifest = JSON.parse(readFileSync(new URL('asset-manifest.json', publicRoot), 'utf8'));
    assert.equal(manifest.version, 6);
    assert.deepEqual(new Set(manifest.assets.map((asset: { id: string }) => asset.id)), new Set(PROFILE_IDS));
    for (const asset of manifest.assets) {
        const bytes = readFileSync(new URL(asset.file, publicRoot)), definition = ASSET_REGISTRY[asset.id as AssetId];
        assert.ok(bytes.length <= definition.maxBytes);
        assert.ok(asset.triangles > 100 && asset.triangles <= definition.maxTriangles);
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        assert.equal(digest(bytes), asset.sha256);
        const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
        assert.ok(gltf.images.every((image: { uri?: string, mimeType: string }) => !image.uri && image.mimeType === 'image/webp'));
        assert.ok(gltf.materials.some((material: { normalTexture?: unknown }) => material.normalTexture));
        if (['honeycomb', 'microflute'].includes(asset.id)) {
            assert.ok(gltf.nodes.some((node: { extras?: { part: string } }) => node.extras?.part === 'core'));
            assert.ok(gltf.nodes.some((node: { extras?: { part: string } }) => node.extras?.part === 'lid'));
        }
    }
    const ids = ['passage', 'balcony', 'store', ...PROFILE_IDS];
    assert.deepEqual(new Set(manifest.renders.map((frame: { file: string }) => frame.file)), new Set(ids.map(id => `renders/${id}.webp`)));
    for (const frame of manifest.renders) {
        const id = frame.file.split('/').at(-1).replace('.webp', '') as MaterialProfileId | 'passage' | 'balcony' | 'store';
        assert.equal(frame.width, id === 'passage' ? 3840 : id === 'balcony' || id === 'store' ? 2560 : 2304);
        assert.ok(frame.preview.width < frame.width);
        assert.ok(frame.preview.bytes < frame.bytes);
        for (const output of [frame, frame.preview]) {
            const bytes = readFileSync(new URL(output.file, publicRoot));
            assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
            assert.equal(bytes.length, output.bytes);
            assert.equal(digest(bytes), output.sha256);
        }
    }
});
