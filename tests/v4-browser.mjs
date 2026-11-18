import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';

const base = '/Kaghaz/v4/';
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
    const waitForModel = live.waitForResponse(response => response.url().endsWith('/paper-ream-modern.glb') && response.ok(),{timeout:60_000});
    await live.goto(url);
    const scene=live.locator('#scene');
    const canvas=scene.locator('canvas');
    await canvas.waitFor({timeout:45_000});
    await waitForModel;
    await live.waitForFunction(()=>document.querySelector('#scene').dataset.pose);
    await live.locator('[data-live-station="fold"]').waitFor();
    await live.screenshot({path:`${output}/hall-live.png`});
    const start=await scene.getAttribute('data-pose');
    const box=await canvas.boundingBox();
    await canvas.click({position:{x:box.width*.51,y:box.height*.718}});
    await live.waitForFunction(previous=>document.querySelector('#scene').dataset.pose!==previous,start);
    await live.locator('.scene-tools [data-action="shots"]').click();
    await live.locator('[data-shot="entry"]').click();
    await live.locator('[data-lighting="warm"]').click();
    assert.equal(await live.locator('[data-lighting="warm"]').getAttribute('aria-pressed'),'true');

    await live.locator('[data-live-station="fold"]').click();
    const fold=live.locator('#fold-canvas');
    const checkPixel=canvas=>canvas.evaluate(el=>{
        const ctx=el.getContext('2d'),pix=ctx.getImageData(0,0,el.width,el.height).data;
        let n=0;
        for(let i=0;i<pix.length;i+=1723)n=(n*31+pix[i])>>>0;
        return n;
    });
    const initial=await checkPixel(fold);
    await live.locator('#fold-width').fill('190');
    assert.match(await live.locator('#fold-spec').textContent(),/۱۹۰/);
    await live.locator('#fold-play').click();
    await live.waitForFunction(()=>document.querySelector('#fold-canvas').dataset.progress==='100');
    assert.notEqual(await checkPixel(fold),initial);
    await live.screenshot({path:`${output}/fold-station.png`});
    await live.locator('#fold-plan').click();
    assert.equal(await live.locator('#fold-plan').getAttribute('aria-pressed'),'true');
    await live.keyboard.press('Escape');

    await live.locator('.station-dock [data-station="proof"]').click();
    const proof=live.locator('#proof-canvas'), sample=await checkPixel(proof);
    await live.locator('#proof-a').selectOption('gloss');
    await live.locator('#proof-light').selectOption('warm');
    await live.locator('#proof-split').fill('71');
    assert.equal(await proof.getAttribute('data-split'),'71');
    assert.equal(await live.locator('#proof-name-a').textContent(),'گلاسه');
    assert.notEqual(await checkPixel(proof),sample);
    await live.screenshot({path:`${output}/proof-station.png`});
    await live.keyboard.press('Escape');

    await live.locator('.station-dock [data-station="samples"]').click();
    await live.locator('.lab-samples button[data-product="a4-80"]').first().click();
    await live.locator('#product-studio canvas').waitFor({timeout:45_000});
    await live.locator('button[data-inspection="macro"]').click();
    await live.locator('[data-modal-add="a4-80"]').click();
    await live.keyboard.press('Escape');
    await live.locator('.main-nav [data-action="cut"]').click();
    assert.equal(await live.locator('.cut-stats strong').first().textContent(),'۹');
    await live.keyboard.press('Escape');
    await live.locator('.main-nav [data-action="creator"]').click();
    await live.locator('[name="name"]').fill('غرفهٔ آزمایشی');
    await live.locator('[name="subtitle"]').fill('آزمون ثبت غرفه');
    await live.locator('[name="productName"]').fill('مقوای نمایشی');
    await live.locator('#creator-form button[type="submit"]').click();
    await live.waitForFunction(()=>JSON.parse(localStorage.getItem('kaghaz.workspace.v4')).customBooths.length===1);
    await live.reload();
    assert.equal(await live.evaluate(()=>JSON.parse(localStorage.getItem('kaghaz.workspace.v4')).inquiry[0].productId),'a4-80');
    assert.deepEqual(errors,[]);
    assert.deepEqual(missing,[]);
    console.log('WebGL2 hall, ground walking, live stations, folding, print proof, catalog, and saved booths passed.');

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
    await mobile.locator('[data-review="sample-table"]').click();
    await mobile.locator('[data-action="gallery-zoom"]').click();
    await mobile.waitForFunction(()=>{
        const img=document.querySelector('.gallery-stage.zoomed img');
        return img?.complete && img.naturalWidth>1300;
    });
    assert.ok((await mobile.locator('#gallery-download').getAttribute('href')).endsWith('/sample-table.webp'));
    await mobile.locator('dialog [data-action="close"]').click();
    await mobile.locator('.station-dock [data-station="fold"]').click();
    await mobile.locator('#fold-amount').fill('42');
    assert.equal(await mobile.locator('#fold-canvas').getAttribute('data-progress'),'42');
    assert.deepEqual(await mobile.locator('.version-menu a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname)),['/Kaghaz/v3/','/Kaghaz/v2/','/Kaghaz/v1/']);
    console.log('Mobile fallback, Cycles gallery zoom and folding without WebGL passed.');
} finally {
    await browser?.close();
    server.close();
}
