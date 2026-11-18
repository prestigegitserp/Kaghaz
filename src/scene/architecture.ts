import * as T from 'three';
import { HALL, STATION_IDS } from '../domain/hall.ts';
import { Batch, softContact } from './batch.ts';
import { seeded, type MaterialLibrary } from './materials.ts';

export const STOCK_COLORS = ['#32796e', '#ce6956', '#dfaf5f', '#6777a4', '#8d9e71', '#a7768d', '#e8ddc0'];

export function createArchitecture(library: MaterialLibrary): T.Group {
    const root = new T.Group(), b = new Batch(root), m = library.materials;
    root.name = 'baharestan-showroom';
    const floorGeometry = new T.PlaneGeometry(HALL.width, HALL.depth);
    const uv = floorGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * HALL.width / 2.2, uv.getY(i) * HALL.depth / 2.2);
    const floor = new T.Mesh(floorGeometry, m.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.016;
    floor.receiveShadow = true;
    root.add(floor);

    const steel = library.color('#435b60', .47), ivory = library.color('#e6e0d1', .63);
    const brass = library.color('#b28b58', .46), city = library.color('#babead', .91);
    const glass = library.add('hallglass', {
        color: '#c4e6e9', transparent: true, opacity: .12, side: T.DoubleSide, roughness: .23,
        metalness: .07, depthWrite: false,
    });
    for (const side of [-1, 1]) {
        b.box(m.plaster, [side * 10.48, 7.21, 0], [8.7, .26, 29.3], [], 1, false, false);
        b.box(steel, [side * 6.12, 6.90, 0], [.21, .23, 28.8], [], 1, false, false);
        b.box(m.lamp, [side * 6.12, 6.766, 0], [.084, .025, 28.1], [], 1, false, false);
        b.box(m.plaster, [side * 14.62, .65, 0], [.18, 1.3, 29.4]);
        b.box(ivory, [side * 14.55, 1.32, 0], [.27, .075, 29.2]);
        for (const y of [1.36, 4.38, 6.98]) b.box(steel, [side * 14.60, y, 0], [.091, .092, 29.3], [], 1, false, false);
        for (let z = -13.78; z < 14.5; z += 3.42) {
            b.box(steel, [side * 14.60, 4.19, z], [.091, 5.69, .092], [], 1, false, false);
            b.add('plane', glass, [side * 14.58, 4.19, z + 1.69], [3.39, 5.60, 1], [0, Math.PI / 2], 1, false);
        }
        for (let index = 0; index < 4; index++) {
            const x = side * (20.2 + index * 1.13), z = -15.47 + index * 11.12, height = 8.1 + (index % 3) * 1.7;
            b.box(index % 2 ? ivory : city, [x, height / 2, z], [8.8, height, 8.45], [], .79 + index * .047, false, false);
            for (let level = 2.15; level < height - .7; level += 2.12)
                for (let w = -2.85; w < 4; w += 1.88)
                    b.box(steel, [x - side * 4.415, level, z + w], [.04, 1.22, 1.27], [], .76 + level * .017, false, false);
        }
    }
    for (const z of [-12, -8, -4, 0, 4, 8, 12])
        b.box(ivory, [0, 7.02, z], [29.0, .22, .16], [], 1, false, false);
    for (const x of [-4.1, -2.07, 0, 2.07, 4.1])
        b.box(steel, [x, 7.29, 0], [.104, .16, 29.2], [], 1, false, false);

    b.box(m.plaster, [0, 3.58, -13.73], [29.9, 7.2, .24]);
    b.box(library.color('#30776d'), [0, 5.31, -13.54], [14.8, 1.49, .15], [], 1, true);
    const sign = new T.Mesh(new T.PlaneGeometry(11.01, 1.26),
        library.sign('بازار کاغذ بهارستان', 'تهران · خیابان ظهیرالاسلام', '#285d55'));
    sign.position.set(0, 5.31, -13.437);
    root.add(sign);
    for (const x of [-12.53, 12.53])
        for (const z of [-12.68, 13.45])
            b.box(ivory, [x, 3.55, z], [.29, 7.11, .36], [], .9, true);
    for (const x of [-10.4, 10.4]) {
        b.box(steel, [x, 6.86, 14.54], [8.4, .24, .14], [], 1, false, false);
        for (const dx of [-4, -2, 0, 2, 4]) b.box(steel, [x + dx, 3.35, 14.54], [.083, 6.74, .086], [], 1, false, false);
    }

    for (const x of [-6.14, 6.14]) {
        b.box(brass, [x, .002, .02], [.024, .008, 24.34], [], .92, false, false);
        for (const z of [8.87, -6.22]) {
            b.box(m.wood, [x, .47, z], [1.89, .106, .51], [], .96, true);
            for (const dx of [-.71, .71]) b.box(steel, [x + dx, .22, z], [.086, .44, .44], [], .88, true);
            softContact(root, x, z, 2.06, .79, .16);
        }
    }

    for (let i=0;i<15;i++) {
        const x=(i-7)*.377,z=-3.32-.29*Math.sin(i*.62),y=4.54+.26*Math.cos(i*.56);
        const mesh=new T.PlaneGeometry(.296,1.66,3,15);
        const pos=mesh.attributes.position;
        for(let j=0;j<pos.count;j++) {
            const u=pos.getX(j)/.296,v=pos.getY(j)/1.66;
            pos.setXYZ(j,pos.getX(j),.22*Math.sin(v*3.9+i*.29)+.12*u*v,-pos.getY(j));
        }
        mesh.computeVertexNormals();
        const material=library.add(`art-${i}`,{color:STOCK_COLORS[i%STOCK_COLORS.length],side:T.DoubleSide,roughness:.83});
        const strip=new T.Mesh(mesh,material);
        strip.position.set(x,y,z);
        strip.castShadow=true;
        root.add(strip);
        b.box(steel,[x,(y+6.94)*.5,z+.64],[.010,6.94-y,.010],[],.95,false,false);
    }
    b.box(steel,[0,6.94,-3.31],[5.9,.054,.061],[],1,false,false);

    const soil=library.color('#474e3a',1), leafMaterials=['#476754','#60805a','#7e9368'].map(c=>library.color(c,.56));
    for(const [x,z,seed] of [[-6.62,8.36,9],[6.65,8.36,22],[-5.78,-5.62,25],[5.82,-5.62,34]]) {
        const random=seeded(seed);
        b.box(ivory,[x,.27,z],[.84,.55,.67],[],1,true);
        b.box(soil,[x,.552,z],[.74,.022,.58],[],.95,true);
        for(let branch=0;branch<5;branch++){
            const dx=(random()-.5)*.77,dz=(random()-.5)*.63,h=1.17+random()*.76;
            b.box(m.wood,[x+dx*.5,.55+h*.5,z+dz*.5],[.025,h,.025],[dz/h,0,-dx/h],.89,false);
            for(let k=0;k<9;k++){
                const t=.22+k*.086,a=random()*Math.PI*2;
                const lx=x+dx*t+Math.cos(a)*.13,lz=z+dz*t+Math.sin(a)*.13;
                b.add('sphere',leafMaterials[k%3],[lx,.55+h*t,lz],[.274,.032,.103],[-.28,-a,.31],.84+random()*.18,false);
            }
        }
        softContact(root,x,z,1.23,.99,.17);
    }
    for (const id of STATION_IDS) {
        const station = HALL.stations[id], [x,z] = station.position, [w,d] = station.size;
        const accent = library.color(station.accent, .59);
        b.box(accent, [x, .484, z], [w-.14, .97, d-.12], [], 1, true);
        b.box(m.wood, [x, 1.014, z], [w, .09, d], [], 1, true);
        b.box(steel, [x, .087, z], [w-.18, .14, d-.15], [], .72, true);
        const legend = new T.Mesh(new T.PlaneGeometry(w * .67, .34),
            library.sign(station.label, id === 'samples' ? 'تحریر، گلاسه و کرافت' : id === 'fold' ? 'الگو و خط تا' : 'نور و روکش', station.accent));
        legend.position.set(x, .69, z + d / 2 - .013);
        root.add(legend);
        const n = id === 'samples' ? 11 : 6;
        for (let i=0;i<n;i++) {
            const dx = (i - (n-1)/2) * (id === 'samples' ? .348 : .338);
            const color = library.color(STOCK_COLORS[(i + (id === 'proof' ? 1 : 0)) % STOCK_COLORS.length]);
            if (id === 'samples') {
                for (let k=0;k<4;k++) b.box(color, [x+dx + k*.009, 1.074+k*.017, z+.22-k*.112], [.29,.014,.45], [0,i*.056+k*.038,0], .93, k===3);
                b.box(color, [x+dx,1.325,z-.49],[.28,.51,.021],[-.14,0,0],.95,true);
            } else if (id==='fold' && i%2===0) {
                b.box(m.kraft,[x+dx,1.182,z-.34],[.30,.229,.32],[0,.12*i,0],.94,true);
                b.box(m.tape,[x+dx,1.299,z-.34],[.038,.008,.30],[0,.12*i,0],.86,false,false);
            } else {
                b.box(color,[x+dx,1.071,z+.19],[.28,.013,.47],[0,.07*(i-3),0],.9,true);
                b.box(ivory,[x+dx,1.079,z+.23],[.19,.010,.27],[0,.07*(i-3),0],.96,false,false);
            }
        }
        if (id === 'proof') {
            for (const dx of [-.81,.81]) b.box(steel,[x+dx,1.429,z-.43],[.035,.75,.038],[],1,true);
            b.box(steel,[x,1.826,z-.43],[1.674,.104,.116],[],1,true);
            b.box(m.lamp,[x,1.756,z-.43],[1.54,.023,.083],[],1,false,false);
        }
        softContact(root,x,z,w+.36,d+.24,.21);
    }
    b.finish();
    return root;
}
