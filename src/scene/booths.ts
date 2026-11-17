import * as T from 'three';
import type { Booth, Product } from '../domain/model.ts';
import { boothPose } from '../domain/model.ts';
import { Batch, GEOMETRY, softContact } from './batch.ts';
import { MaterialLibrary, seeded } from './materials.ts';
export interface Collider {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    height: number;
    occludes: boolean;
}
export interface Target {
    mesh: T.Mesh;
    boothId: string;
    productId?: string;
}
export interface BoothCell {
    root: T.Group;
    inventory: T.Group;
    booth: Booth;
    targets: Target[];
    colliders: Collider[];
}
function ream(b: Batch, m: MaterialLibrary, x: number, y: number, z: number, angle = 0, large = false, shade = 1): void {
    const w = large ? .7 : .305, d = large ? 1 : .435, h = large ? .14 : .065;
    b.box(m.materials.paper, [x, y, z], [w, h, d], [0, angle, 0], shade, true);
    // The printed wrapper lies on the top of a true 500-sheet proportioned ream.
    b.add('plane', m.materials.ream, [x, y + h / 2 + .001, z], [w * .96, d * .96, 1], [-Math.PI / 2, 0, -angle], shade, false);
}
function pallet(b: Batch, m: MaterialLibrary, x: number, z: number): void {
    for (const y of [.04, .15])
        for (const dx of [-.39, 0, .39])
            b.box(m.materials.wood, [x + dx, y, z], [.2, .065, 1.2], [], .88);
    for (const dz of [-.44, 0, .44])
        b.box(m.materials.wood, [x, .095, z + dz], [1.1, .065, .2]);
}
function paperPallet(b: Batch, m: MaterialLibrary, x: number, z: number, color: string, seed: number): void {
    pallet(b, m, x, z);
    const r = seeded(seed);
    for (let i = 0; i < 12; i++) {
        b.box(i === 11 ? m.color(color) : m.materials.edge, [x + (r() - .5) * .02, .22 + i * .045, z + (r() - .5) * .015], [.96, .042, 1.04], [0, (r() - .5) * .01, 0], .88 + i * .009);
    }
    for (const dx of [-.34, .34])
        b.box(m.materials.tape, [x + dx, .49, z], [.028, .58, 1.06], [], .9);
}
function carton(b: Batch, m: MaterialLibrary, x: number, y: number, z: number, w = .6, h = .42, d = .46, open = false): void {
    // Separate wall panels, inset top seam and actual flaps distinguish a carton from a solid brown cube.
    const k = m.materials.kraft, t = .012;
    b.box(k, [x, y + h * .5, z - d * .5], [w, h, t], [], .88);
    b.box(k, [x, y + h * .5, z + d * .5], [w, h, t]);
    b.box(k, [x - w * .5, y + h * .5, z], [t, h, d], [], .85);
    b.box(k, [x + w * .5, y + h * .5, z], [t, h, d], [], .92);
    if (open) {
        b.box(k, [x - w * .64, y + h, z], [w * .32, t, d], [0, 0, .38]);
        b.box(k, [x + w * .64, y + h, z], [w * .32, t, d], [0, 0, -.38]);
        b.box(m.materials.dark, [x, y + .015, z], [w * .96, .02, d * .96], [], 1, false, false);
        for (let i = 0; i < 4; i++)
            b.box(m.materials.paper, [x + (i % 2) * .07 - .04, y + h * .35 + i * .025, z], [w * .67, .035, d * .75], [], .95);
    }
    else {
        b.box(k, [x, y + h, z], [w, t, d], [], 1);
        b.box(m.materials.tape, [x, y + h + .008, z], [.055, .004, d + .01], [], .95);
        b.box(m.materials.tape, [x, y + h * .7, z + d * .5 + .009], [.055, h * .58, .004], [], .9);
    }
    b.box(m.materials.paper, [x + w * .19, y + h * .5, z + d * .5 + .01], [w * .32, h * .35, .003], [], .9, false, false);
    for (let i = 0; i < 5; i++)
        b.box(m.materials.dark, [x + w * .08 + i * .013, y + h * .5, z + d * .5 + .013], [.004, h * .19, .001], [], .7, false, false);
}
function paperRoll(b: Batch, m: MaterialLibrary, parent: T.Group, x: number, z: number, radius = .35, height = 1.05): void {
    const g = new T.Group();
    g.position.set(x, height / 2 + .16, z);
    parent.add(g);
    const side = new T.Mesh(new T.CylinderGeometry(radius, radius, height, 48, 1, true), m.materials.kraft);
    side.castShadow = true;
    side.receiveShadow = true;
    g.add(side);
    side.userData.ownedGeometry = true;
    for (const sideSign of [-1, 1]) {
        const ring = new T.Mesh(new T.RingGeometry(.055, radius, 56), m.materials.rollend);
        ring.rotation.x = sideSign === 1 ? -Math.PI / 2 : Math.PI / 2;
        ring.position.y = sideSign * height / 2;
        g.add(ring);
        ring.userData.ownedGeometry = true;
    }
    const core = new T.Mesh(new T.CylinderGeometry(.055, .055, height, 24, 1, true), m.materials.darkwood);
    core.material.side = T.DoubleSide;
    g.add(core);
    core.userData.ownedGeometry = true;
    // Paper tail: a curved, thin loose sheet ending at the floor, not a capped pipe.
    const curve = new T.PlaneGeometry(.6, height * .8, 14, 1);
    const positions = curve.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const u = (positions.getX(i) + .3) / .6;
        positions.setZ(i, Math.sin(u * 1.6) * .12);
    }
    curve.computeVertexNormals();
    const tailMaterial = m.materials.kraft.clone();
    tailMaterial.side = T.DoubleSide;
    const tail = new T.Mesh(curve, tailMaterial);
    tail.position.set(radius + .18, -height * .1, 0);
    tail.rotation.y = -.8;
    g.add(tail);
    tail.userData.ownedGeometry = true;
    tail.userData.ownedMaterial = true;
    softContact(parent, x, z, radius * 3, radius * 3, .18);
}
function swatch(b: Batch, m: MaterialLibrary, x: number, y: number, z: number, accent: string): void {
    const colors = ['#e3d7b8', '#caa065', '#a36f58', '#929d77', '#729b9b', '#567282', '#8e7a94', accent];
    colors.forEach((c, i) => {
        const angle = (i - 3.5) * .15;
        b.box(m.color(c), [x + Math.sin(angle) * .21, y + i * .003, z - Math.cos(angle) * .2], [.16, .004, .45], [0, angle, 0], 1, false);
    });
    b.add('cylinder', m.materials.brass, [x, y + .04, z], [.016, .018, .016]);
}
function counter(b: Batch, m: MaterialLibrary, accent: string): void {
    b.box(m.materials.darkwood, [-.7, .44, -1.02], [3.45, .87, .8], [], .85, true);
    b.box(m.materials.wood, [-.7, .9, -1.02], [3.65, .08, .98], [], 1, true);
    for (const x of [-1.83, -.7, .43]) {
        b.box(m.color(accent), [x, .48, -.605], [1, .65, .012]);
        b.box(m.materials.brass, [x, .77, -.591], [.85, .008, .008]);
    }
    b.box(m.materials.dark, [-.7, .09, -.58], [3.4, .09, .02]);
    // Ledger, pen and calculator make the desk a recognisable merchant's workspace.
    b.box(m.materials.edge, [.45, .965, -1.08], [.29, .035, .38], [0, -.18, 0]);
    b.box(m.color(accent), [.45, .987, -1.08], [.3, .008, .39], [0, -.18, 0]);
    b.box(m.materials.dark, [-1.85, .973, -1.11], [.12, .045, .18], [.12, .15, 0], 1, true);
    b.box(m.materials.glass, [-1.85, 1.002, -1.16], [.09, .004, .045], [-.1, .15, 0]);
    for (let i = 0; i < 12; i++)
        b.box(m.color(i === 11 ? '#a07b49' : '#b3b3a4'), [-1.89 + (i % 3) * .035, 1.003, -1.09 + Math.floor(i / 3) * .027], [.023, .005, .016]);
    b.add('cylinder', m.materials.metal, [.12, .958, -1.05], [.005, .24, .005], [0, 0, Math.PI / 2]);
}
export function createBooth(booth: Booth, products: Product[], m: MaterialLibrary): BoothCell {
    const root = new T.Group();
    root.name = `booth:${booth.id}`;
    const pose = boothPose(booth.slot);
    root.position.set(pose.x, 0, pose.z);
    root.rotation.y = pose.rotation;
    const architecture = new T.Group();
    root.add(architecture);
    const a = new Batch(architecture);
    const inventory = new T.Group();
    root.add(inventory);
    const b = new Batch(inventory);
    const accent = m.color(booth.accent), r = seeded(booth.slot * 91 + 38);
    a.box(m.materials.plaster, [0, 1.85, -4.5], [7.15, 3.7, .18]);
    a.box(m.materials.plaster, [-3.56, 1.85, -2.25], [.16, 3.7, 4.5]);
    a.box(m.materials.plaster, [3.56, 1.85, -2.25], [.16, 3.7, 4.5]);
    a.box(m.materials.wood, [0, .018, -2.25], [7, .035, 4.5], [], .8);
    a.box(m.materials.plaster, [0, 3.84, -2.25], [7.2, .2, 4.7]);
    a.box(m.materials.darkwood, [0, 3.03, -.06], [7.15, .16, .22]);
    a.box(accent, [0, 3.52, .03], [6.7, .77, .22]);
    // Real readable Persian texture on a shallow framed fascia.
    const signMaterial = m.sign(booth.name, booth.subtitle, booth.accent);
    const sign = new T.Mesh(new T.PlaneGeometry(5.25, .7), signMaterial);
    sign.position.set(0, 3.52, .15);
    architecture.add(sign);
    sign.userData.ownedGeometry = true;
    for (const x of [-3.53, 3.53]) {
        a.box(m.materials.brick, [x, 1.58, .01], [.44, 3.16, .49]);
        a.box(m.materials.wood, [x, .14, .01], [.51, .28, .56], [], .7);
        a.box(m.materials.brass, [x, 2.85, .28], [.2, .12, .015]);
    }
    for (let i = 0; i < 10; i++)
        a.box(m.materials.metal, [0, 3.09 + i * .018, -.11], [6.65, .014, .25], [], .75, false, false);
    a.box(m.materials.lamp, [0, 3.14, -1.4], [2.7, .025, .1], [], 1, false, false);
    a.box(m.materials.metal, [0, 3.19, -1.4], [2.8, .08, .14], [], .8, false, false);
    // Three bookcases stocked with correctly scaled flat reams and cartons.
    const shelfZ = -3.95;
    for (const x of [-2.1, 0, 2.1]) {
        for (const dx of [-.89, .89])
            b.box(m.materials.metal, [x + dx, 1.5, shelfZ], [.035, 2.96, .52]);
        b.box(m.materials.darkwood, [x, 1.48, -4.22], [1.82, 2.94, .04], [], .78);
        for (let row = 0; row < 5; row++) {
            const y = .2 + row * .6;
            b.box(m.materials.wood, [x, y, shelfZ], [1.85, .055, .58], [], .9);
            if (booth.category === 'packaging') {
                for (let col = 0; col < 2; col++)
                    carton(b, m, x - .45 + col * .87, y + .03, shelfZ, .73, .35 + r() * .1, .43);
            }
            else if (booth.category === 'creative') {
                for (let col = 0; col < 4; col++)
                    for (let layer = 0; layer < 2; layer++) {
                        const colors = ['#c3a274', '#a56d59', '#829777', '#729396', '#6f7a91', '#b5a3ac', '#d6bf90', '#e3dcc5'];
                        b.box(m.color(colors[(row * 3 + col + booth.slot) % colors.length]), [x - .66 + col * .44, y + .065 + layer * .08, shelfZ], [.4, .075, .46], [0, (r() - .5) * .02, 0], .8 + row * .025);
                    }
            }
            else {
                for (let col = 0; col < 4; col++)
                    for (let layer = 0; layer < 3; layer++)
                        ream(b, m, x - .66 + col * .44, y + .065 + layer * .084, shelfZ, (r() - .5) * .025, false, .8 + row * .035);
            }
        }
    }
    counter(b, m, booth.accent);
    const ps = products.filter(p => p.boothId === booth.id);
    if (booth.category === 'printing') {
        paperPallet(b, m, -2.55, -2.5, '#e6dfc8', booth.slot);
        paperPallet(b, m, 2.55, -2.65, '#f3edda', booth.slot + 1);
        for (let i = 0; i < 4; i++)
            ream(b, m, -.7, .99 + i * .072, -1.02, i * .025);
        ream(b, m, -1.23, .97, -1.02, -.1);
        swatch(b, m, .03, .95, -.95, booth.accent);
    }
    else if (booth.category === 'creative') {
        for (let i = 0; i < 7; i++)
            b.box(m.color(['#c9856d', '#dfbc7b', '#8da188', '#74939a', '#9b8aa5', '#d7c8ac', '#657b68'][i]), [-1.1, .956 + i * .012, -1.01], [.52, .01, .63], [0, i * .055, 0]);
        swatch(b, m, -.2, .96, -.85, booth.accent);
        paperPallet(b, m, 2.55, -2.4, '#bd9b73', booth.slot);
        for (let i = 0; i < 6; i++) {
            const mat = m.color(['#ae725d', '#ccac72', '#7c957e', '#657b91', '#9b8394', '#d2bf99'][i]);
            b.box(mat, [-3.43, 1.2 + (i % 3) * .64, -1.75 - Math.floor(i / 3) * 1.06], [.015, .53, .75], [0, 0, .01]);
        }
    }
    else if (booth.category === 'packaging') {
        carton(b, m, -1.05, .96, -1.01, .56, .33, .46, true);
        swatch(b, m, -.15, .95, -1.01, booth.accent);
        for (let i = 0; i < 6; i++)
            carton(b, m, -2.5 + (i % 2) * .7, .06 + Math.floor(i / 2) * .43, -2.3, .66, .42, .62);
        pallet(b, m, 2.3, -2.6);
        paperRoll(b, m, inventory, 2.2, -2.6, .4, 1.05);
        paperRoll(b, m, inventory, 2.75, -3.15, .3, .9);
    }
    else {
        paperPallet(b, m, 2.45, -2.6, '#e2dece', booth.slot);
        paperPallet(b, m, -2.5, -2.6, '#c3b69d', booth.slot + 13);
        for (let i = 0; i < 6; i++)
            b.box(m.materials.edge, [-1, .96 + i * .02, -1.02], [.8, .017, .6], [0, i * .016, 0]);
        swatch(b, m, -.1, .96, -1, booth.accent);
    }
    // Merchant stool; a few small lived-in details, no uncanny placeholder people.
    b.add('cylinder', m.materials.wood, [.4, .58, -2.13], [.24, .07, .24]);
    for (const dx of [-.15, .15])
        for (const dz of [-.15, .15])
            b.box(m.materials.metal, [.4 + dx, .28, -2.13 + dz], [.026, .55, .026]);
    b.box(m.materials.paper, [2.12, 2, -4.38], [.43, .6, .015], [], .93);
    for (let i = 0; i < 5; i++)
        b.box(accent, [2.12, 2.13 - i * .06, -4.36], [.3, .008, .005]);
    // A brass pendant with a broad warm shade.
    b.add('cylinder', m.materials.metal, [-.8, 3.31, -2.2], [.012, .75, .012]);
    b.add('cylinder', m.materials.brass, [-.8, 2.88, -2.2], [.22, .11, .22]);
    b.add('sphere', m.materials.lamp, [-.8, 2.83, -2.2], [.07, .08, .07], [], 1, false);
    a.finish();
    b.finish();
    softContact(inventory, -.7, -1.02, 4.2, 1.7, .25);
    softContact(inventory, 0, -3.9, 7.1, 1.9, .25);
    const targets: Target[] = [];
    const proxy = (x: number, y: number, z: number, w: number, h: number, d: number, productId?: string) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false }));
        mesh.position.set(x, y, z);
        root.add(mesh);
        mesh.userData = { boothId: booth.id, productId, ownedGeometry: true, ownedMaterial: true };
        targets.push({ mesh, boothId: booth.id, productId });
    };
    proxy(0, 3.52, .14, 6.3, .8, .15);
    ps.slice(0, 3).forEach((p, i) => proxy(-1.22 + i * .72, 1.08, -1.01, .64, .36, .9, p.id));
    proxy(2.3, .7, -2.65, 1.25, 1.4, 1.4, ps[1]?.id);
    const colliders: Collider[] = [];
    function collider(x: number, z: number, w: number, d: number, height = 3.7, occludes = true) {
        const point = new T.Vector3(x, 0, z).applyAxisAngle(new T.Vector3(0, 1, 0), pose.rotation).add(root.position);
        colliders.push({ minX: point.x - d / 2, maxX: point.x + d / 2, minZ: point.z - w / 2, maxZ: point.z + w / 2, height, occludes });
    }
    collider(0, -4.5, 7.3, .28);
    collider(-3.56, -2.25, .3, 4.5);
    collider(3.56, -2.25, .3, 4.5);
    collider(-.7, -1.02, 3.65, .98, .94, false);
    collider(0, -3.96, 6.5, .7, 3, false);
    collider(-2.5, -2.6, 1.2, 1.3, 1.2, false);
    collider(2.5, -2.6, 1.3, 1.4, 1.3, false);
    return { root, inventory, booth, targets, colliders };
}
export function disposeCell(cell: BoothCell): void {
    cell.root.traverse(o => {
        if (o instanceof T.Mesh) {
            if (o.userData.ownedGeometry)
                o.geometry.dispose();
            if (o.userData.ownedMaterial)
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
            if (o.userData.ownedContact) {
                const mat = o.material as T.MeshBasicMaterial;
                mat.map?.dispose();
                mat.dispose();
            }
        }
        if (o instanceof T.InstancedMesh)
            o.dispose();
    });
    cell.root.removeFromParent();
}
