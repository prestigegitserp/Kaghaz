import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boothPose, emptyState, escapeHtml, inquiryText, normalize, parseState, quantity, searchProducts } from '../src/domain/model.ts';
import { BOOTHS, PRODUCTS } from '../src/domain/catalog.ts';
test('Persian search matches Arabic forms, ZWNJ, Persian numerals and multiple tokens', () => {
    assert.equal(normalize('كاغذِ يک ۸۰'), 'کاغذ یک 80');
    assert.ok(searchProducts(PRODUCTS, BOOTHS, 'كاغذ ٨٠').some(p => p.id === 'a4-80'));
    assert.ok(searchProducts(PRODUCTS, BOOTHS, 'سرای سپيد A4').some(p => p.id === 'a4-80'));
    assert.equal(searchProducts(PRODUCTS, BOOTHS, '', 'creative').length, 6);
    assert.equal(searchProducts(PRODUCTS, BOOTHS, '', 'all', 'sepid').length, 3);
});
test('quantity accepts local digits, bounds invalid input, and preserves minimum order', () => {
    assert.equal(quantity('۱۲۳'), 123);
    assert.equal(quantity('١٢٣'), 123);
    assert.equal(quantity('-4', 50), 50);
    assert.equal(quantity('NaN'), 1);
    assert.equal(quantity(Infinity), 1);
    assert.equal(quantity(1e9), 99999);
});
test('workspace import strips scriptable fields and local attachment references', () => {
    const s = parseState({ version: 1, customBooths: [{ id: 'custom-test', name: '<img src=x>', accent: 'red;display:none', category: 'invalid', modelKey: 'catalog:victim', slot: -900 }], customProducts: [], favorites: ['valid', 'valid', '<script>'], inquiry: [{ productId: 'valid', quantity: -2 }, { productId: 'valid', quantity: 500 }] });
    assert.equal(s.customBooths[0].accent, '#3d6051');
    assert.equal(s.customBooths[0].slot, 8);
    assert.equal(s.customBooths[0].modelKey, undefined);
    assert.deepEqual(s.favorites, ['valid']);
    assert.deepEqual(s.inquiry, [{ productId: 'valid', quantity: 1 }]);
    assert.equal(escapeHtml(s.customBooths[0].name), '&lt;img src=x&gt;');
    assert.throws(() => parseState({ version: 2 }));
    assert.throws(() => parseState(null));
});
test('workspace bounds two personal shops and rejects orphan product records', () => {
    const b = (i: number) => ({ id: `custom-${i}`, name: 'غرفه', accent: '#345645', category: 'printing' });
    const s = parseState({ version: 1, customBooths: [b(1), b(2), b(3)], customProducts: [{ id: 'custom-orphan', boothId: 'missing', name: 'x' }] });
    assert.equal(s.customBooths.length, 2);
    assert.deepEqual(s.customBooths.map(b => b.slot), [8, 9]);
    assert.equal(s.customProducts.length, 0);
});
test('inquiry keeps units separate and plainly identifies a local unsent draft', () => {
    const s = emptyState();
    s.inquiry = [{ productId: 'a4-80', quantity: 10 }, { productId: 'kraft-roll', quantity: 50 }];
    const text = inquiryText(s, PRODUCTS, BOOTHS);
    assert.ok(text.includes('ارسال نشده'));
    assert.ok(text.includes('بند ۵۰۰ برگی'));
    assert.ok(text.includes('کیلوگرم'));
    assert.ok(!text.includes('جمع کل'));
});
test('catalog ids are unique and each item belongs to a visible booth with an explicit unit', () => {
    assert.equal(new Set(PRODUCTS.map(p => p.id)).size, PRODUCTS.length);
    for (const p of PRODUCTS) {
        assert.ok(BOOTHS.some(b => b.id === p.boothId));
        assert.ok(p.unit);
        assert.ok(p.minOrder > 0);
    }
});
test('metric booth placement leaves a central aisle and fixed eight metre bay pitch', () => {
    assert.equal(boothPose(0).x, -2.85);
    assert.equal(boothPose(1).x, 2.85);
    assert.equal(boothPose(0).z - boothPose(2).z, 8);
    assert.equal(boothPose(8).z, -22);
});
