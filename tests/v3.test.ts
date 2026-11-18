import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { planCut } from '../src/domain/cut.ts';
import { ASSET_REGISTRY, assetForProduct, type AssetId } from '../src/scene/asset-registry.ts';
import { MATERIAL_PLATES, REVIEW_VIEWS } from '../src/domain/review.ts';

const stock = { stockWidth: 700, stockHeight: 1000, pieceWidth: 210, pieceHeight: 280,
    margin: 5, gap: 2, grammage: 80, rotate: false };

test('cut planner optimizes mixed rotation while preserving trim and spacing', () => {
    const fixed = planCut(stock)!;
    const mixed = planCut({ ...stock, rotate: true })!;
    assert.equal(fixed.pieces, 9);
    assert.equal(mixed.pieces, 10);
    assert.ok(mixed.bands.some(band => band.rotated));
    assert.ok(mixed.bands.some(band => !band.rotated));
    for (const band of mixed.bands) {
        assert.ok(band.x >= stock.margin && band.y >= stock.margin);
        assert.ok(band.x + band.columns * band.width + (band.columns - 1) * stock.gap <= stock.stockWidth - stock.margin);
        assert.ok(band.y + band.rows * band.height + (band.rows - 1) * stock.gap <= stock.stockHeight - stock.margin);
    }
    assert.ok(mixed.waste < fixed.waste);
    assert.equal(mixed.grams, 80 * 210 * 280 * 10 / 1_000_000);
});

test('cut planner handles exact fits, no fits and malformed input', () => {
    const exact = planCut({ ...stock, stockWidth: 210, stockHeight: 280, margin: 0 })!;
    assert.equal(exact.pieces, 1);
    assert.equal(exact.waste, 0);
    assert.equal(planCut({ ...stock, pieceWidth: 1000 })!.pieces, 0);
    assert.equal(planCut({ ...stock, margin: 400 }), undefined);
    assert.equal(planCut({ ...stock, gap: NaN }), undefined);
});

test('new assets are self-contained, size-budgeted and include the published Cycles views', () => {
    const root = new URL('../public/v3/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('asset-manifest.json', root), 'utf8'));
    assert.equal(manifest.version, 3);
    let bytes = 0;
    for (const asset of manifest.assets) {
        const definition = ASSET_REGISTRY[asset.id as AssetId];
        const data = readFileSync(new URL(asset.file, root));
        assert.equal(definition.url, `v3/${asset.file}`);
        assert.equal(data.toString('ascii', 0, 4), 'glTF');
        assert.equal(data.readUInt32LE(8), data.length);
        assert.equal(data.length, asset.bytes);
        assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
        assert.ok(asset.bytes < definition.maxBytes);
        assert.ok(asset.triangles < definition.maxTriangles);
        const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
        assert.equal(gltf.buffers.length, 1);
        assert.ok(!gltf.buffers[0].uri);
        for (const image of gltf.images) {
            assert.ok(Number.isInteger(image.bufferView) && !image.uri);
            assert.equal(image.mimeType, 'image/webp');
        }
        if (asset.id === assetForProduct('ream')) {
            for (const part of ['wrapper', 'sheets', 'loose-sheets']) {
                assert.ok(gltf.nodes.some((n: { extras?: { part?: string } }) => n.extras?.part === part));
            }
        }
        bytes += data.length;
    }
    assert.equal(manifest.assets.length, 6);
    assert.ok(bytes < 3 * 1024 * 1024);
    for (const view of REVIEW_VIEWS) {
        const file = `renders/${view.id}.webp`;
        const entry = manifest.renders.find((render: { file: string }) => render.file === file);
        assert.ok(entry && entry.width >= 1200);
        assert.equal(readFileSync(new URL(file, root)).toString('ascii', 8, 12), 'WEBP');
    }
    for (const id of new Set(Object.values(MATERIAL_PLATES))) {
        assert.equal(readFileSync(new URL(`renders/${id}-thumb.webp`, root)).toString('ascii', 8, 12), 'WEBP');
    }
});
