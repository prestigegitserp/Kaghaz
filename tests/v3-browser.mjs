import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';

const base = '/Kaghaz/v3/';
const dist = resolve('dist');
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', webp: 'image/webp',
    svg: 'image/svg+xml', glb: 'model/gltf-binary', woff2: 'font/woff2', txt: 'text/plain' };
const output = process.env.KAGHAZ_QA_OUTPUT || 'qa';
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(dist, pathname === base ? 'index.html' : pathname.slice(base.length));
    if (!pathname.startsWith(base) || !path.startsWith(dist + '/')) {
        res.writeHead(404).end();
        return;
    }
    try {
        const file = await stat(path);
        if (!file.isFile()) throw Error('Not a file');
        res.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] || 'application/octet-stream' });
        createReadStream(path).pipe(res);
    } catch {
        res.writeHead(404).end();
    }
});

let browser;
try {
    await mkdir(output, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = process.env.KAGHAZ_QA_URL || `http://127.0.0.1:${server.address().port}${base}`;
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 930 }, reducedMotion: 'reduce' });
    const live = await context.newPage();
    const errors = [], missing = [];
    live.on('pageerror', error => errors.push(error.message));
    live.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
    const waitForModel = live.waitForResponse(response => response.url().endsWith('/paper-ream-open.glb') && response.ok(), { timeout: 60_000 });
    await live.goto(url);
    await live.locator('#scene canvas').waitFor({ timeout: 45_000 });
    await waitForModel;
    await live.locator('[data-action="quality"]').click();
    await live.locator('[data-action="diagnostics"]').click();
    await live.waitForFunction(() => /[1-9]\d* draws/.test(document.querySelector('#metrics').textContent));
    await live.locator('[data-action="quality"]').click();
    await live.screenshot({ path: `${output}/market-live.png` });
    await live.locator('[data-action="shots"]').click();
    await live.locator('[data-shot="counter"]').click();
    await live.locator('[data-lighting="night"]').click();
    assert.equal(await live.locator('[data-lighting="night"]').getAttribute('aria-pressed'), 'true');
    await live.screenshot({ path: `${output}/market-evening.png` });
    await live.locator('[data-lighting="day"]').click();
    await live.locator('button[data-product="a4-80"]').first().click();
    await live.locator('#product-studio canvas').waitFor({ timeout: 45_000 });
    await live.locator('button[data-inspection="macro"]').click();
    await live.locator('#studio-angle').fill('12');
    await live.locator('#studio-separation').fill('60');
    assert.equal(await live.locator('button[data-inspection="macro"]').getAttribute('aria-pressed'), 'true');
    await live.screenshot({ path: `${output}/macro-live.png` });
    await live.locator('[data-modal-add="a4-80"]').click();
    await live.locator('dialog [data-action="close"]').click();

    await live.locator('.main-nav [data-action="cut"]').click();
    assert.equal(await live.locator('.cut-stats strong').first().textContent(), '۹');
    await live.locator('[name="pieceHeight"]').fill('280');
    assert.equal(await live.locator('.cut-stats strong').first().textContent(), '۱۰');
    await live.locator('[name="rotate"]').uncheck();
    assert.equal(await live.locator('.cut-stats strong').first().textContent(), '۹');
    await live.screenshot({ path: `${output}/cut-layout.png` });
    await live.keyboard.press('Escape');
    await live.locator('.main-nav [data-action="creator"]').click();
    await live.locator('[name="name"]').fill('غرفهٔ آزمایشی');
    await live.locator('[name="subtitle"]').fill('آزمون ثبت غرفه');
    await live.locator('[name="productName"]').fill('کاغذ نمونهٔ شخصی');
    await live.locator('#creator-form button[type="submit"]').click();
    await live.getByRole('button', { name: /غرفهٔ آزمایشی/ }).first().waitFor();
    await live.reload();
    assert.equal(await live.evaluate(() => JSON.parse(localStorage.getItem('kaghaz.workspace.v3')).customBooths.length), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    console.log('WebGL2 market, camera, lights, GLB macro viewer, inquiry, cutting and booth persistence passed.');

    const mobileContext = await browser.newContext(devices['iPhone 13']);
    await mobileContext.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...options) {
            return type === 'webgl2' || type === 'webgl' ? null : getContext.call(this, type, ...options);
        };
    });
    const mobile = await mobileContext.newPage();
    await mobile.goto(url);
    await mobile.locator('.fallback-shell').waitFor();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.screenshot({ path: `${output}/mobile-fallback.png` });
    await mobile.locator('.render-link').click();
    await mobile.locator('[data-review="roll"]').click();
    await mobile.locator('[data-action="gallery-zoom"]').click();
    await mobile.waitForFunction(() => {
        const img = document.querySelector('.gallery-stage.zoomed img');
        return img?.complete && img.naturalWidth > 1000;
    });
    assert.ok((await mobile.locator('#gallery-download').getAttribute('href')).endsWith('/roll.webp'));
    assert.deepEqual(await mobile.locator('.version-menu a').evaluateAll(links => links.map(a => new URL(a.href).pathname)), ['/Kaghaz/v2/', '/Kaghaz/v1/']);
    console.log('Mobile fallback, gallery zoom, render download and historical version links passed.');
} finally {
    await browser?.close();
    server.close();
}
