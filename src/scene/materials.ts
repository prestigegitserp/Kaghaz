import * as T from 'three';
export function seeded(seed: number): () => number { let n = seed >>> 0; return () => ((n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296); }
function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): T.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    draw(ctx);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
}
export function textTexture(title: string, subtitle: string, color = '#3d5748', background = '#f2ecdd'): T.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#b9a47d';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 996, 228);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '600 76px Vazirmatn, sans-serif';
    ctx.fillText(title, 512, 122, 940);
    ctx.font = '400 27px Vazirmatn, sans-serif';
    ctx.fillStyle = color;
    ctx.globalAlpha = .78;
    ctx.fillText(subtitle, 512, 190, 920);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
export class MaterialLibrary {
    private owned = new Set<T.Material>();
    private textures = new Set<T.Texture>();
    private signs = new Map<string, T.MeshStandardMaterial>();
    readonly materials: Record<string, T.MeshStandardMaterial> = {};
    constructor(onTexture: () => void) {
        const noise = canvasTexture(256, ctx => {
            const r = seeded(83);
            ctx.fillStyle = '#e9e3d5';
            ctx.fillRect(0, 0, 256, 256);
            for (let i = 0; i < 15000; i++) {
                const v = 160 + r() * 95;
                ctx.fillStyle = `rgba(${v},${v * .98},${v * .94},.12)`;
                ctx.fillRect(r() * 256, r() * 256, 1 + r() * 1.2, .4 + r());
            }
        });
        this.textures.add(noise);
        const edge = canvasTexture(256, ctx => {
            const r = seeded(48);
            ctx.fillStyle = '#e7e1d3';
            ctx.fillRect(0, 0, 256, 256);
            for (let y = 0; y < 256; y += 2 + r() * 2.2) {
                ctx.fillStyle = `rgba(91,81,61,${.08 + r() * .12})`;
                ctx.fillRect(0, y, 256, .45 + r() * .6);
            }
        });
        this.textures.add(edge);
        const kraft = canvasTexture(256, ctx => {
            const r = seeded(17);
            ctx.fillStyle = '#b89869';
            ctx.fillRect(0, 0, 256, 256);
            for (let i = 0; i < 9000; i++) {
                ctx.strokeStyle = `rgba(${r() > .5 ? '70,43,20' : '225,205,160'},${.05 + r() * .12})`;
                ctx.beginPath();
                const x = r() * 256, y = r() * 256;
                ctx.moveTo(x, y);
                ctx.lineTo(x + 1 + r() * 5, y + 1);
                ctx.stroke();
            }
        });
        this.textures.add(kraft);
        const label = canvasTexture(512, ctx => {
            ctx.fillStyle = '#efeee5';
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#355448';
            ctx.fillRect(0, 0, 512, 125);
            ctx.fillStyle = '#f4efdf';
            ctx.textAlign = 'center';
            ctx.font = '700 65px Vazirmatn';
            ctx.fillText('کاغذ', 256, 90);
            ctx.fillStyle = '#2e4335';
            ctx.font = '700 94px sans-serif';
            ctx.fillText('A4', 256, 254);
            ctx.font = '32px sans-serif';
            ctx.fillText('80 gsm · 500 sheets', 256, 319);
            ctx.fillStyle = '#847454';
            ctx.fillRect(55, 355, 402, 2);
            const r = seeded(69);
            for (let x = 95; x < 420; x += 3 + r() * 3) {
                ctx.fillStyle = '#3a4037';
                ctx.fillRect(x, 396, 1 + r() * 2, 63);
            }
        });
        this.textures.add(label);
        const rollEnd = canvasTexture(512, ctx => {
            ctx.fillStyle = '#ddd1b7';
            ctx.fillRect(0, 0, 512, 512);
            const r = seeded(99);
            for (let radius = 25; radius < 360; radius += 1 + r() * 1.8) {
                ctx.strokeStyle = `rgba(98,79,46,${.05 + r() * .2})`;
                ctx.lineWidth = .5 + r() * .4;
                ctx.beginPath();
                ctx.arc(256, 256, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        this.textures.add(rollEnd);
        const floor = canvasTexture(512, ctx => {
            const r = seeded(79);
            ctx.fillStyle = '#c7bca5';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 45000; i++) {
                const v = 100 + r() * 120;
                ctx.fillStyle = `rgba(${v},${v * .97},${v * .9},.06)`;
                ctx.fillRect(r() * 512, r() * 512, r() * 3, r() * 2);
            }
            ctx.strokeStyle = '#9d9482';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 512, 256);
            ctx.strokeRect(-256, 256, 512, 256);
            ctx.strokeRect(256, 256, 512, 256);
        });
        floor.repeat.set(8, 24);
        this.textures.add(floor);
        const brick = canvasTexture(512, ctx => {
            const r = seeded(14);
            ctx.fillStyle = '#bfb093';
            ctx.fillRect(0, 0, 512, 512);
            for (let row = 0; row < 16; row++)
                for (let col = -1; col < 9; col++) {
                    const shade = 1 + r() * .15;
                    ctx.fillStyle = new T.Color('#b79768').multiplyScalar(shade).getStyle();
                    ctx.fillRect(col * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
                }
        });
        this.textures.add(brick);
        this.add('paper', { color: '#f1eddf', map: noise, roughness: .93, bumpMap: noise, bumpScale: .003 });
        this.add('edge', { color: '#f8f3e6', map: edge, roughness: .95 });
        this.add('kraft', { map: kraft, roughness: .96, bumpMap: kraft, bumpScale: .007 });
        this.add('cardboard', { map: kraft, color: '#b89c75', roughness: .95 });
        this.add('wood', { color: '#6d5136', map: kraft, roughness: .79, bumpMap: kraft, bumpScale: .012 });
        this.add('darkwood', { color: '#513c2a', roughness: .79 });
        this.add('plaster', { color: '#e5dac2', map: noise, roughness: .97, bumpMap: noise, bumpScale: .01 });
        this.add('brick', { map: brick, roughness: .97, bumpMap: brick, bumpScale: .025 });
        this.add('floor', { map: floor, color: '#d6cbb7', roughness: .72, bumpMap: floor, bumpScale: .018 });
        this.add('metal', { color: '#38473f', roughness: .61, metalness: .52 });
        this.add('brass', { color: '#ae8d51', roughness: .48, metalness: .7 });
        this.add('rubber', { color: '#2b2d27', roughness: .92 });
        this.add('dark', { color: '#28271f', roughness: .9 });
        this.add('ream', { map: label, roughness: .67 });
        this.add('rollend', { map: rollEnd, roughness: .95 });
        this.add('tape', { color: '#a58650', roughness: .5 });
        this.add('lamp', { color: '#fff3ce', emissive: '#ffe7b4', emissiveIntensity: 1.7, roughness: .8 });
        this.add('glass', { color: '#dce4d7', roughness: .22, metalness: .12, transparent: true, opacity: .14, depthWrite: false });
        const loader = new T.TextureLoader();
        const scanTiles = { brick: [1.42, 1.42], plaster: [1.78, 1.78], wood: [1.22, 1.22], floor: [2.05, 2.05] };
        const load = (path: string, srgb: boolean, apply: (texture: T.Texture) => void) => {
            loader.load(`${import.meta.env.BASE_URL}${path}`, texture => {
                texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
                texture.wrapS = texture.wrapT = T.RepeatWrapping;
                texture.anisotropy = 8;
                this.textures.add(texture);
                apply(texture);
                onTexture();
            }, undefined, () => {});
        };
        for (const [key, tile] of Object.entries(scanTiles)) {
            const material = this.materials[key];
            material.userData.metricUV = tile;
            load(`v3/materials/${key}-color.webp`, true, texture => {
                material.color.set('#ffffff');
                material.map = texture;
                material.bumpMap = null;
                material.needsUpdate = true;
            });
            load(`v3/materials/${key}-normal.webp`, false, texture => {
                material.normalMap = texture;
                material.normalScale.setScalar(key === 'brick' ? .7 : .46);
                material.needsUpdate = true;
            });
            load(`v3/materials/${key}-arm.webp`, false, texture => {
                material.roughness = 1;
                material.roughnessMap = material.aoMap = texture;
                material.aoMapIntensity = .7;
                material.needsUpdate = true;
            });
        }
        for (const [key, surface] of Object.entries({ paper: 'paper', kraft: 'kraft', cardboard: 'kraft' })) {
            const material = this.materials[key];
            load(`v2/materials/${surface}-color.webp`, true, texture => {
                material.map = texture;
                material.color.set('#ffffff');
                material.needsUpdate = true;
            });
        }
        load('v3/materials/press-wrapper.webp', true, texture => {
            this.materials.ream.map = texture;
            this.materials.ream.needsUpdate = true;
        });
        load('v2/materials/paper-edge.webp', true, texture => {
            this.materials.edge.map = texture;
            this.materials.edge.needsUpdate = true;
        });
    }
    add(name: string, params: T.MeshStandardMaterialParameters): T.MeshStandardMaterial { const m = new T.MeshStandardMaterial(params); this.materials[name] = m; this.owned.add(m); return m; }
    color(color: string, roughness = .88): T.MeshStandardMaterial { const key = `color:${color}:${roughness}`; return this.materials[key] || this.add(key, { color, roughness }); }
    sign(title: string, subtitle: string, color: string): T.MeshStandardMaterial { const key = title + '|' + subtitle + '|' + color; const cached = this.signs.get(key); if (cached)
        return cached; const t = textTexture(title, subtitle, color); this.textures.add(t); const m = new T.MeshStandardMaterial({ map: t, roughness: .8 }); this.owned.add(m); this.signs.set(key, m); return m; }
    dispose() { this.owned.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); }
}
