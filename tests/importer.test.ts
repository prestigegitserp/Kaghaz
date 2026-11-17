import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectGLB, MAX_GLB_BYTES } from '../src/scene/importer.ts';
function glb(json: object): ArrayBuffer {
    const source = JSON.stringify(json);
    const pad = ' '.repeat((4 - source.length % 4) % 4);
    const bytes = new TextEncoder().encode(source + pad);
    const buffer = new ArrayBuffer(20 + bytes.length);
    const v = new DataView(buffer);
    v.setUint32(0, 0x46546c67, true);
    v.setUint32(4, 2, true);
    v.setUint32(8, buffer.byteLength, true);
    v.setUint32(12, bytes.length, true);
    v.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(buffer, 20).set(bytes);
    return buffer;
}
test('GLB rejects truncation, magic mismatch and external texture fetching before decoding', () => {
    assert.throws(() => inspectGLB(new ArrayBuffer(4)));
    assert.throws(() => inspectGLB(new ArrayBuffer(40)));
    assert.throws(() => inspectGLB(glb({ asset: { version: '2.0' }, images: [{ uri: 'https://tracking.invalid/image.png' }] })), /مستقل/);
});
test('GLB enforces bytes, geometry and instancing budgets', () => {
    assert.throws(() => inspectGLB(new ArrayBuffer(MAX_GLB_BYTES + 1)), /۲۵/);
    assert.throws(() => inspectGLB(glb({ nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ indices: 0 }] }], accessors: [{ count: 900000 }] })), /۲۵۰/);
    assert.throws(() => inspectGLB(glb({ nodes: Array.from({ length: 601 }, () => ({})) })), /بودجه/);
});
test('GLB counts shared meshes once per node instead of undercounting instances', () => {
    const report = inspectGLB(glb({ nodes: [{ mesh: 0 }, { mesh: 0 }], meshes: [{ primitives: [{ indices: 0 }] }], accessors: [{ count: 300 }] }));
    assert.equal(report.triangles, 200);
    assert.equal(report.nodes, 2);
});
