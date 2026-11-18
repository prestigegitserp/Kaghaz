import * as T from 'three';
import { HALL, STATION_IDS } from '../domain/hall.ts';
import { Batch, softContact } from './batch.ts';
import { STATION_SPECIMENS } from '../domain/material-profiles.ts';
import type { MaterialLibrary } from './materials.ts';

export const STOCK_COLORS = ['#396477','#a95043','#638172','#ac8054','#5d6386','#916879','#d4c4a2'];
export const PASSAGE_PROPS = [
    { asset:'loaded-paper-cart', x:-1.99, z:12.42, level:0, turn:-.23, scale:.83, width:.73, depth:.88 },
    { asset:'wrapped-stock-pallet', x:2.13, z:-8.48, level:0, turn:-.08, scale:.76, width:.94, depth:.78 },
    { asset:'loaded-paper-cart', x:-4.12, z:-8.65, level:1, turn:.27, scale:.79, width:.73, depth:.88 },
] as const;

export function createArchitecture(library:MaterialLibrary) {
    const root=new T.Group(), batch=new Batch(root), m=library.materials;
    root.name='baharestan-passage';
    const {width,depth,decks,opening,stairs}=HALL,h=decks[1],f=opening.halfWidth;
    const metal=library.color('#374b45',.39), guard=library.color('#9e9e8c',.32), beam=library.color('#d4cebb',.61);
    const dark=library.color('#2a473d',.59), stripe=library.color('#6e765f',.59);
    const glass=library.add('passage-glass',{color:'#bccbc0',transparent:true,opacity:.17,roughness:.19,
        metalness:.11,depthWrite:false,side:T.DoubleSide});

    const floorGeo=new T.PlaneGeometry(width,depth),uv=floorGeo.attributes.uv;
    for (let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*width/2.02,uv.getY(i)*depth/2.02);
    const floor=new T.Mesh(floorGeo,m.floor);
    floor.rotation.x=-Math.PI/2;
    floor.position.y=-.009;
    floor.receiveShadow=true;
    root.add(floor);
    for (const side of [-1,1]) {
        const span=width/2-f,cx=side*(f+span*.5);
        batch.box(m.floor,[cx,h-.132,0],[span,.258,depth],[],1,false,false);
        batch.box(m.plaster,[side*f,h-.143,0],[.141,.246,depth],[],1,false,false);
        batch.box(dark,[side*(f+.017),h-.09,0],[.078,.142,depth],[],.86,false,false);
        batch.box(m.plaster,[side*(width/2-.107),3.77,0],[.215,7.54,depth],[],1,false,false);
        batch.box(stripe,[side*2.425,.006,-.01],[.064,.017,28.2],[],.84,false,false);
        batch.box(metal,[side*(width/2-.227),.155,0],[.148,.31,depth],[],.9,true);
        batch.box(metal,[side*2.97,7.17,0],[.084,.043,31.70],[],1,false,false);
        batch.box(m.lamp,[side*2.92,7.143,0],[.036,.023,31.56],[],1,false,false);
        for (let z = -10.11; z < 13.2; z += 3.59) {
            batch.box(m.lamp,[side*(f+.104),h-.271,z],[.038,.023,3.51],[],1,false,false);
            batch.box(guard,[side*2.62,-.002,z],[.034,.014,3.50],[],.89,false,false);
        }
        for (let z=-12.02;z<14.5;z+=3.21){
            batch.box(beam,[side*2.82,1.62,z],[.142,3.27,.206],[],1,true);
            batch.box(guard,[side*2.82,.112,z],[.159,.231,.22],[],.9,true);
        }
        const mid=(opening.near+opening.far)*.5,spanZ=opening.near-opening.far;
        batch.box(guard,[side*f,h+1.042,mid],[.072,.054,spanZ],[],.94,true);
        batch.box(guard,[side*f,h+.16,mid],[.043,.034,spanZ],[],.93,true);
        for (let i=0;i<=9;i++){
            const z=opening.far+i*spanZ/9;
            batch.box(metal,[side*f,h+.566,z],[.046,.96,.046],[],.98,true);
            if(i<9) batch.add('plane',glass,[side*f,h+.60,z+spanZ/18],[spanZ/9-.066,.836,1],[0,Math.PI/2],1,false);
        }
        for(let z=-13.55;z<14.4;z+=3.27){
            batch.box(metal,[side*2.715,h-.201,z],[.075,.064,2.65],[],1,false,false);
            batch.box(m.lamp,[side*2.719,h-.241,z],[.046,.016,2.50],[],1.07,false,false);
        }
    }
    for (const [low,high] of [[-depth/2,opening.far],[opening.near,depth/2]]) {
        batch.box(m.floor,[0,h-.133,(low+high)*.5],[f*2+.06,.256,high-low],[],1,false,false);
    }
    batch.box(guard,[0,h+1.042,opening.near],[f*2,.054,.065],[],.91,true);
    batch.add('plane',glass,[0,h+.593,opening.near],[f*2-.043,.89,1],[0,0],1,false);
    for(const side of [-1,1]){
        batch.box(guard,[side*1.149,h+1.044,opening.far],[.621,.054,.062],[],.98,true);
        batch.box(metal,[side*.839,h+.559,opening.far],[.044,1.01,.052],[],1,true);
    }
    batch.box(m.plaster,[0,7.444,0],[width,.27,depth],[],.96,false,false);
    for (const z of [-14.7,-10.24,-5.8,-1.36,3.08,7.52,11.96]){
        batch.box(beam,[0,7.227,z],[width,.166,.124],[],1,false,false);
        batch.box(m.lamp,[0,7.151,z+.18],[6.38,.035,.088],[],1.03,false,false);
    }
    for (let i=0;i<12;i++)
        batch.box(beam,[0,7.23,14.75-i*2.685],[5.78,.102,2.663],[],.99,false,false);
    batch.box(metal,[0,.004,13.38],[2.83,.018,.162],[],.87,true);
    for(let slot=0;slot<65;slot++)
        batch.box(m.dark,[-1.33+slot*.0416,.014,13.38],[.012,.002,.117],[],.91,false);
    batch.box(m.plaster,[0,3.57,-15.43],[width,7.16,.29],[],.86,false,false);
    batch.box(dark,[0,5.46,-15.224],[5.40,1.1,.13],[],1,true);
    const sign=new T.Mesh(new T.PlaneGeometry(5.21,.89),library.sign('پاساژ کاغذ بهارستان','خیابان ظهیرالاسلام · تهران','#2f574a'));
    sign.position.set(0,5.49,-15.148);
    root.add(sign);
    batch.box(guard,[-3.78,1.32,-15.21],[2.14,2.64,.108],[],.85,true);
    batch.box(metal,[-3.78,1.28,-15.148],[.013,2.58,.008],[],.9,false,false);
    batch.box(m.lamp,[-3.78,2.77,-15.14],[.23,.059,.018],[],.96,false,false);

    const length=stairs.low-stairs.high,rise=h/stairs.steps,tread=length/stairs.steps;
    for(let i=0;i<stairs.steps;i++){
        const y=(i+1)*rise,z=stairs.low-(i+.5)*tread;
        batch.box(m.floor,[0,y-.104,z],[stairs.width,.207,tread+.011],[],.96,true);
        batch.box(metal,[0,y+.006,z+tread/2-.014],[stairs.width-.05,.014,.028],[],.96,false,false);
    }
    const slope=Math.atan2(h,length);
    for(const side of [-1,1]){
        const x=side*(stairs.width/2+.051),z=(stairs.low+stairs.high)/2;
        batch.box(metal,[x,h*.5+.082,z],[.061,.12,Math.hypot(h,length)],[slope,0,0],.95,true);
        batch.box(guard,[x,h*.5+.948,z],[.061,.054,Math.hypot(h,length)+.12],[slope,0,0],.99,true);
        for(let i=0;i<stairs.steps;i+=3)
            batch.box(metal,[x,i*rise+.50,stairs.low-(i+.32)*tread],[.036,.93,.037],[],.91,true);
    }

    for(const id of STATION_IDS){
        const spot=HALL.stations[id],[x,z]=spot.position,[w,d]=spot.size,y=decks[spot.level];
        const tint=library.color(spot.accent,.56),front=x>0?-1:1;
        batch.box(tint,[x,y+.485,z],[w-.107,.968,d-.09],[],1,true);
        batch.box(m.wood,[x,y+1.004,z],[w,.075,d],[],.99,true);
        batch.box(metal,[x,y+.082,z],[w-.19,.132,d-.16],[],.8,true);
        const name=new T.Mesh(new T.PlaneGeometry(d*.77,.24),library.sign(spot.label,'',spot.accent));
        name.position.set(x+front*(w*.5-.041),y+.685,z);
        name.rotation.y=front*Math.PI/2;
        root.add(name);
        const specimens=STATION_SPECIMENS[id] || [];
        for (const {offset} of specimens)
            batch.box(m.dark,[x,y+1.048,z+offset],[.59,.008,.43],[],.83,false);
        for(let i=0;i<(id==='samples'?7:5);i++){
            const color=library.color(STOCK_COLORS[(i+spot.level)%STOCK_COLORS.length]);
            const offset=(i-2.3)*.186, zz=z+offset;
            if (specimens.some(specimen => Math.abs(specimen.offset-offset)<.215)) continue;
            const block = id==='unwrap' || id==='pallet' ? .103 : .012;
            batch.box(color,[x+(i%2-.5)*.15,y+1.05+block/2,zz],[.36,block,.156],[0,.18*(i-2),0],.97,true);
            if(id==='samples')
                batch.box(color,[x-front*.18,y+1.226,zz],[.015,.379,.149],[0,0,.08*front],1,true);
        }
        if(id==='proof' || id==='press'){
            for(const dz of [-.604,.604])
                batch.box(metal,[x-front*.25,y+1.392,z+dz],[.037,.701,.042],[],1,true);
            batch.box(metal,[x-front*.25,y+1.731,z],[.103,.088,1.258],[],1,true);
            batch.box(m.lamp,[x-front*.20,y+1.661,z],[.058,.023,1.17],[],.97,false,false);
        }
        const contact=softContact(root,x,z,w+.2,d+.18,.24);
        contact.position.y+=y;
    }
    batch.finish();
    return root;
}
