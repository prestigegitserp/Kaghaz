import { MATERIAL_PROFILES } from '../domain/material-profiles.ts';
import * as T from 'three';
import type { Booth, Product } from '../domain/model.ts';
import { boothPose } from '../domain/model.ts';
import { Batch, softContact } from './batch.ts';
import { MaterialLibrary, seeded } from './materials.ts';
import type { AssetId } from './asset-registry.ts';
import { STOCK_COLORS } from './architecture.ts';
import { HALL, type Level } from '../domain/hall.ts';
export interface Collider {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    height: number;
    occludes: boolean;
    level: Level;
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
    level: Level;
    targets: Target[];
    colliders: Collider[];
    authored: T.Group;
    fallback: T.Group;
    slots: {asset:AssetId;position:[number,number,number];rotation?:number;scale?:number}[];
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
    const k = m.materials.cardboard, t = .012;
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
export function createBooth(booth: Booth, products: Product[], library: MaterialLibrary): BoothCell {
    const root = new T.Group(), pose = boothPose(booth.slot), m = library.materials;
    const architecture = new T.Group(), inventory = new T.Group(), authored = new T.Group(), fallback = new T.Group();
    const shade=library.color(booth.accent,.53),metal=library.color('#344742',.41),anodized=library.color('#979c8e',.36);
    const cream = library.color('#e9e6d8'), rng = seeded(booth.slot * 91 + 38);
    const own = products.filter(p => p.boothId === booth.id);
    const specimen = own.find(p => p.profile && MATERIAL_PROFILES[p.profile].lead === p.id);
    const isBoard = booth.category === 'board', isCreative = booth.category === 'creative';
    const isPack = booth.category === 'packaging', swatches = isBoard || isCreative;
    root.name = `booth:${booth.id}`;
    root.position.set(pose.x, HALL.decks[pose.level], pose.z);
    root.rotation.y = pose.rotation;
    root.add(architecture, inventory);
    inventory.add(fallback, authored);
    authored.visible = false;

    const a = new Batch(architecture), b = new Batch(inventory), details = new Batch(fallback);
    a.box(m.plaster,[0,1.62,-3.96],[6.15,3.25,.13],[],.94);
    a.box(m.floor,[0,.017,-1.97],[6.14,.046,3.95],[],.91,false,false);
    a.box(shade,[0,2.996,-.055],[6.14,.50,.306],[],.97,true);
    a.box(anodized,[0,3.277,-.032],[6.17,.076,.332],[],.94,true);
    a.box(m.lamp,[0,2.742,.041],[5.68,.027,.038],[],.94,false,false);
    const unit = ((pose.level + 1) * 100 + (booth.slot % 6) + 1).toLocaleString('fa-IR');
    const sign = new T.Mesh(new T.PlaneGeometry(5.73,.431),library.sign(booth.name,booth.subtitle,booth.accent,unit));
    sign.position.set(0,3.004,.118);
    sign.userData.ownedGeometry = true;
    architecture.add(sign);
    for (const x of [-3.01, 3.01]) {
        a.box(metal,[x,1.43,-.055],[.116,2.86,.238],[],1,true);
        a.box(m.plaster,[x,1.55,-3.31],[.13,3.10,1.28],[],.93);
        a.box(shade, [x,.092,-1.005], [.041,.12,1.63], [], .78, false, false);
    }
    a.box(metal,[0,3.166,-1.59],[5.84,.052,.059],[],1,false,false);
    a.box(m.lamp,[0,3.126,-1.59],[5.62,.022,.046],[],1,false,false);
    // The right-hand opening remains walkable. Stock is visible through the shopfront on the left.
    a.box(metal,[-.97,.235,.027],[3.81,.47,.081],[],.9,true);
    a.add('plane',m['shop-glass'],[-.97,1.548,.054],[3.80,2.17,1],[0,0],1,false);
    for(const x of [-2.88,-1.03,.933]){
        a.box(anodized,[x,1.57,.065],[.033,2.194,.054],[],.9,true);
        a.box(anodized,[x,1.13,.109],[.024,.292,.031],[],.91,false,false);
    }
    a.box(anodized,[-.97,1.978,.069],[3.78,.036,.041],[],.78,true);
    a.box(shade,[2.125,2.477,.051],[.69,.242,.047],[],.93,true);
    a.box(m.metal, [2.11,.045,-.343], [1.22,.013,.56], [], .91, false);
    for (let slat=0; slat<18; slat++) {
        a.box(anodized,[1.54+slat*.065,.053,.045],[.008,.006,.13],[],.9,false);
    }
    for (const x of [.97,1.034]) a.box(anodized,[x,1.29,.124],[.024,.269,.039],[],.98,true);
    for (const x of [-2.86,-1.06,.91])
        for (const y of [.48,2.69]) a.box(metal,[x,y,.091],[.064,.035,.021],[],.86,false);

    for (const [bay,sx] of [-1.87,0,1.87].entries()) {
        b.box(shade,[sx,1.55,-3.709],[1.72,2.63,.042],[],.88 + bay*.047);
        for (const dx of [-.837,.837]) b.box(metal,[sx+dx,1.62,-3.46],[.043,2.95,.498],[],1);
        for (let row=0;row<6;row++) {
            const y=.263+row*.451;
            b.box(m.wood,[sx,y,-3.441],[1.747,.044,.542],[],.94,false);
            b.box(cream,[sx,y+.015,-3.153],[1.70,.021,.026],[],.96,false,false);
            for (let column=0;column<4;column++) {
                const x = sx-.60+column*.396;
                if (isPack) {
                    const w = .31 + (column%2)*.024, dy = .38;
                    b.box(m.kraft,[x,y+.15,-3.43],[w,.248,dy],[0,(rng()-.5)*.075,0],.9+.15*rng(),true);
                    b.box(m.tape,[x,y+.278,-3.43],[.037,.008,.399],[],1,false,false);
                    b.add('plane',m[`stock-${(booth.slot+row+column)%6}`],[x,y+.153,-3.226],
                        [w*.83,.155,1],[0,0],.95,false);
                } else if (swatches) {
                    const paper = library.color(STOCK_COLORS[(booth.slot+row+column) % STOCK_COLORS.length]);
                    for (let i=0;i<4+(column%2);i++) {
                        b.box(paper,[x+(rng()-.5)*.023,y+.039+i*.035,-3.43], [.328,.03,.408],[0,(rng()-.5)*.061,0],.83+.043*i,false);
                    }
                    if (row>=3 && bay===booth.slot%3) {
                        b.box(paper,[x,y+.225,-3.26],[.23,.28,.019],[-.16,0,.03],.93,true);
                    }
                } else if(row===0||row===5||(bay===0 && column>1)){
                    const mark=(row+column+booth.slot)%6;
                    b.box(row===0?shade:cream,[x,y+.135,-3.431],[.341,.213,.387],[0,(rng()-.5)*.034,0],
                        .89+.095*rng(),false);
                    b.add('plane',m[`stock-${mark}`],[x,y+.135,-3.233],[.308,.183,1],[0,0],.98,false);
                } else {
                    const paper = (row+column+bay)%3 === 0 ? m['warm-ream'] : m.ream;
                    for (let i=0;i<3+(row%2);i++) {
                        b.box(i%2 ? shade : m.edge,[x+(rng()-.5)*.018,y+.059+i*.064,-3.429],
                            [.285,.053,.406],[0,(rng()-.5)*.055,0],.89+.07*rng(),false);
                        b.add('plane',paper,[x,y+.087+i*.064,-3.429],[.285,.406,1],[-Math.PI/2,0],1,false);
                    }
                }
            }
        }
    }
    const px = -.71, pz = -1.065;
    b.box(library.color('#354641',.62),[px,.478,pz],[2.95,.952,.86],[],1,true);
    b.box(m.wood,[px,.985,pz],[3.1,.087,.955],[],1,true);
    b.box(metal,[px,.092,pz+.425],[2.87,.135,.048],[],.85);
    for (let i=0;i<18;i++) b.box(shade,[px-1.34+i*.155,.51,pz+.437],[.083,.65,.015],[],.86+(i%3)*.058,false,false);
    details.box(metal,[.46,1.047,-1.01],[.22,.031,.18],[],.93,true);
    details.box(library.color('#234143'),[.46,1.132,-1.09],[.25,.163,.024],[.29,0,0],.99,true);
    details.box(m.edge,[.05,1.041,-1.17],[.28,.026,.41],[0,.17,0],.99,true);
    details.add('cylinder',m.brass,[.13,1.066,-.99],[.004,.19,.004],[0,0,Math.PI/2],.9,false);
    softContact(inventory,px,pz,3.73,1.53,.23);
    softContact(inventory,0,-3.43,6.13,1.34,.19);

    // An open-sided stock stand keeps the product mix visible from the main hall.
    const standX=-2.83, standZ=-.49;
    for (const dx of [-.285,.285]) a.box(metal,[standX+dx,.48,standZ],[.039,.96,.52],[],.85,true);
    for (const h of [.16,.52,.89]) {
        a.box(m.wood,[standX,h,standZ],[.648,.041,.55],[],.94,true);
        if (h > .8 && specimen?.profile) {
            a.box(m.metal, [standX,h+.025,standZ], [.56,.017,.44], [], .92, true);
            const surface = library.color(specimen.color,.68);
            for (let i=0;i<3;i++)
                details.box(surface,[standX-.04+i*.02,h+.039+i*.011,standZ],[.35,.009,.31],[0,i*.116,0],.87+i*.045);
        } else if (isPack) carton(a,library,standX,h+.024,standZ,.43,.21,.38,h>.8);
        else if (swatches) {
            for (let k=0;k<5;k++) a.box(library.color(STOCK_COLORS[(booth.slot+k)%STOCK_COLORS.length]),
                [standX+k*.009,h+.035+k*.028,standZ],[.50,.020,.42],[0,k*.064,0],.94,false);
        } else {
            for (let j=0;j<3;j++) ream(a,library,standX+j*.015,h+.058+j*.071,standZ,j*.043);
        }
    }

    const slots: BoothCell['slots'] = [];
    const add=(asset:AssetId, position:[number,number,number], rotation=0, scale=1) =>
        slots.push({asset,position,rotation,scale});
    if (specimen?.profile) add(specimen.profile, [standX,.93,standZ], -.12, 1.40);
    add('counter-accessories',[.13,1.031,-1.116],.12,.99);
    if (isPack) {
        carton(details,library,-1.54,1.028,-1.01,.44,.27,.43,true);
        carton(details,library,-.76,1.028,-1.04,.41,.26,.36,false);
        pallet(details,library,2.1,-2.94);
        paperRoll(details,library,fallback,1.88,-2.75,.28,.78);
        paperRoll(details,library,fallback,2.43,-3.01,.24,.62);
        add('carton-open',[-1.54,1.028,-1.01],-.23,1.08);
        add('carton-closed',[-.76,1.028,-1.10],.17,.88);
        add('wood-pallet',[2.1,0,-2.94],0,.81);
        add('kraft-roll',[1.87,.124,-2.77],.28,.83);
        add('kraft-roll',[2.44,.124,-2.97],-.62,.64);
    } else if (swatches) {
        swatch(details,library,-1.31,1.035,-1.08,booth.accent);
        add('swatch-fan',[-1.43,1.029,-1.07],-.29,1.96);
        add('notebook',[-.56,1.031,-.98],.26,1.28);
        for (let i=0;i<6;i++) b.box(library.color(STOCK_COLORS[(booth.slot+i)%STOCK_COLORS.length]),
            [-.79+i*.144,1.039+i*.006,-1.26],[.27,.008,.33],[0,i*.17,0],.95);
    } else {
        for (let i=0;i<4;i++) {
            ream(details,library,-1.42,1.065+i*.07,-1.04,i*.036);
            add('paper-ream-modern',[-1.42,1.029+i*.053,-1.04],i*.036,1.14);
        }
        ream(details,library,-.73,1.065,-1.04,-.10);
        add('paper-ream-open-modern',[-.72,1.029,-1.08],-.27,1.09);
        add('notebook',[-.35,1.029,-1.03],.18,1.06);
    }
    if (isBoard || booth.category==='printing') {
        paperPallet(details,library,-2.1,-2.40,'#e4ded0',booth.slot);
        add('wrapped-stock-pallet',[-2.16,.008,-2.35],.13,.78);
    }
    a.finish(); b.finish(); details.finish();

    const targets: Target[] = [];
    const proxy = (coords: [number,number,number], dimensions: [number,number,number], productId?: string) => {
        const box = new T.Mesh(new T.BoxGeometry(...dimensions), new T.MeshBasicMaterial({visible:false}));
        box.position.set(...coords);
        box.userData = {ownedGeometry:true,ownedMaterial:true};
        root.add(box);
        targets.push({mesh:box,boothId:booth.id,productId});
    };
    proxy([0,2.998,.137],[5.94,.49,.18]);
    own.slice(0,3).forEach((product,i)=>proxy([-1.53+i*.63,1.14,-1.01],[.56,.33,.57],product.id));
    if (own.length) proxy([standX,.56,standZ],[.65,1.12,.56],own[0].id);
    if (specimen) proxy([standX,1.037,standZ],[.57,.23,.49],specimen.id);

    const colliders: Collider[] = [];
    function collider(x:number,z:number,w:number,d:number,height:number,occludes=true) {
        const c=Math.cos(pose.rotation),s=Math.sin(pose.rotation);
        const xx=pose.x+x*c+z*s,zz=pose.z-x*s+z*c;
        const hx=(Math.abs(c)*w+Math.abs(s)*d)*.5,hz=(Math.abs(s)*w+Math.abs(c)*d)*.5;
        colliders.push({minX:xx-hx,maxX:xx+hx,minZ:zz-hz,maxZ:zz+hz,height,occludes,level:pose.level});
    }
    collider(0,-3.96,6.15,.16,3.33);
    collider(-.97,.035,3.81,.12,2.71,false);
    collider(0,-3.45,5.66,.61,2.98,false);
    for (const x of [-3.01,3.01]) {
        collider(x,-.055,.13,.26,3.09);
        collider(x,-3.31,.155,1.29,3.28);
    }
    collider(px,pz,3.10,.955,1.033,false);
    collider(standX,standZ,.65,.56,1.1,false);
    if (isPack) collider(2.13,-2.85,1.10,.93,1.12,false);
    if (isBoard||booth.category==='printing') collider(-2.16,-2.35,1.01,.82,.74,false);
    return {root,inventory,booth,level:pose.level,targets,colliders,authored,fallback,slots};
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
