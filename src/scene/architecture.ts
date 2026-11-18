import * as T from 'three';
import { Batch, GEOMETRY, softContact } from './batch.ts';
import { MaterialLibrary } from './materials.ts';
export function createArchitecture(m: MaterialLibrary): T.Group {
    const root = new T.Group();
    root.name = 'baharestan-arcade';
    const b = new Batch(root);
    const floor = new T.Mesh(new T.PlaneGeometry(17, 52), m.materials.floor);
    const uvFloor = floor.geometry.attributes.uv;
    for (let i = 0; i < uvFloor.count; i++) uvFloor.setXY(i, uvFloor.getX(i) * (17 / 2.05), uvFloor.getY(i) * (52 / 2.05));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -.014, -5);
    floor.receiveShadow = true;
    root.add(floor);
    // Limestone kerbs lead the eye along the circulation route, not a huge empty hall.
    for (const x of [-2.67, 2.67]) {
        b.box(m.materials.plaster, [x, .008, -5], [.16, .03, 51], [], .79, false, false);
        b.box(m.materials.brass, [x * .96, .006, -5], [.014, .008, 51], [], .7, false, false);
    }
    for (const x of [-7.55, 7.55])
        b.box(m.materials.plaster, [x, 2, -5], [.2, 4.1, 52]);
    // Segmented vaults leave small skylight gaps; inner faces have continuous brick UVs.
    const span = 2.91, rise = 1.9, spring = 3.34;
    for (let bay = 0; bay < 7; bay++) {
        const z = 16 - bay * 8;
        const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
        for (let iz = 0; iz <= 1; iz++)
            for (let j = 0; j <= 40; j++) {
                const angle = j / 40 * Math.PI;
                vertices.push(Math.cos(angle) * span, spring + Math.sin(angle) * rise, z - iz * 7.4);
                uv.push(j / 40 * 5.4, iz * 7.4 / 1.42);
            }
        for (let j = 0; j < 40; j++) {
            const a = j, bb = j + 1, c = j + 41, d = j + 42;
            indices.push(a, c, bb, bb, c, d);
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mat = m.materials.brick;
        mat.side = T.DoubleSide;
        const vault = new T.Mesh(geo, mat);
        vault.receiveShadow = true;
        root.add(vault);
        for (const xx of [-3.03, 3.03]) {
            b.box(m.materials.brick, [xx, 1.67, z], [.48, 3.34, .55]);
            b.box(m.materials.plaster, [xx, .17, z], [.6, .34, .66], [], .79);
            b.box(m.materials.plaster, [xx, 3.26, z], [.6, .16, .68], [], .9);
        }
        // Voussoirs on the arch are individual instances, with varied stone coloration.
        for (let j = 0; j < 43; j++) {
            const angle = (j + .5) / 43 * Math.PI;
            const x = Math.cos(angle) * span, y = spring + Math.sin(angle) * rise;
            const rotation = Math.atan2(rise * Math.cos(angle), -span * Math.sin(angle));
            b.box(m.materials.plaster, [x, y, z + .05], [.19, .23, .62], [0, 0, rotation], .84 + (j % 5) * .025);
        }
        // Brass reflectors give the practical lights a visible source.
        b.add('cylinder', m.materials.metal, [0, 4.57, z - 3.5], [.012, .55, .012]);
        b.add('cylinder', m.materials.brass, [0, 4.23, z - 3.5], [.34, .095, .34]);
        b.add('cylinder', m.materials.metal, [0, 4.31, z - 3.5], [.081, .11, .081]);
        b.add('sphere', m.materials.lamp, [0, 4.12, z - 3.5], [.085, .107, .085], [], 1, false);
        for (const xx of [-2.8, 2.8])
            b.box(m.materials.darkwood, [xx, 3.85, z - 3.7], [.07, .1, 7.5], [], .8);
    }
    // High roof lanterns and framing at the small daylight slots.
    for (const z of [8.4, .4, -7.6, -15.6, -23.6]) {
        b.box(m.materials.lamp, [0, 5.36, z], [2.6, .025, .43], [], .65, false, false);
        for (const x of [-1.35, 0, 1.35])
            b.box(m.materials.metal, [x, 5.32, z], [.045, .05, .49], [], .8, false, false);
    }
    // Far end: a framed service door and wayfinding, rather than a dead blank wall.
    b.box(m.materials.brick, [0, 2.6, -30.7], [15.3, 5.2, .22]);
    b.box(m.materials.darkwood, [0, 1.55, -30.52], [2.1, 3.1, .12], [], .8);
    for (const x of [-.5, .5]) {
        b.box(m.materials.wood, [x, 1.58, -30.43], [.92, 2.84, .06]);
        for (let y = .4; y < 3; y += .34)
            b.box(m.materials.brass, [x, y, -30.38], [.8, .012, .015], [], .7);
    }
    const sign = new T.Mesh(new T.PlaneGeometry(3.4, .85), m.sign('راستهٔ کاغذ', 'بهارستان · تهران', '#3f5645'));
    sign.position.set(0, 3.74, -30.5);
    root.add(sign);
    // Entry wall hides the outside without obstructing the aisle perspective.
    for (const x of [-5.5, 5.5])
        b.box(m.materials.brick, [x, 2.2, 19.4], [5, 4.4, .3]);
    // Delivery cart parked outside the walk lane.
    const cartX = -2, cartZ = 16.8;
    b.box(m.materials.wood, [cartX, .23, cartZ], [.8, .08, 1.3]);
    for (const dx of [-.42, .42])
        for (const dz of [-.42, .42])
            b.add('cylinder', m.materials.rubber, [cartX + dx, .12, cartZ + dz], [.11, .065, .11], [0, 0, Math.PI / 2]);
    for (const dx of [-.34, .34])
        b.box(m.materials.metal, [cartX + dx, .62, cartZ - .62], [.03, .82, .03]);
    b.box(m.materials.metal, [cartX, 1.03, cartZ - .62], [.71, .03, .03]);
    for (let i = 0; i < 5; i++)
        b.box(m.materials.edge, [cartX, .34 + i * .09, cartZ], [.69, .085, .91], [0, i * .01, 0], .85 + i * .02);
    softContact(root, cartX, cartZ, 1.5, 2, .25);
    b.finish();
    return root;
}
