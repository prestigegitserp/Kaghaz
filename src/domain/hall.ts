import layout from './passage-layout.json' with { type: 'json' };

export const HALL = layout;
export const STATION_IDS = ['samples','unwrap','proof','fold','roll','press','pallet'] as const;
export type StationId = typeof STATION_IDS[number];
export type Point2 = [x: number, z: number];
export type Level = 0 | 1;
export const levelName = (level:Level) => level===0 ? 'همکف' : 'طبقهٔ اول';

export function boothCoordinates(slot: number) {
    const [x,z,rotation,level] = HALL.booths[slot] ?? HALL.booths[0];
    return { x,z,rotation,level:level as Level };
}

export function boothPoint(slot: number, across: number, forward: number): Point2 {
    const {x,z,rotation} = boothCoordinates(slot),c=Math.cos(rotation),s=Math.sin(rotation);
    return [x+across*c+forward*s,z-across*s+forward*c];
}

export const PHOTO_SHOTS = [
    {id:'entry',label:'ورودی پاساژ',level:0,camera:HALL.entry,target:HALL.entryLook,fov:57},
    {id:'stock',label:'ویترین کاغذ تحریر',level:0,camera:[.24,1.72,8.42],target:[3.73,1.42,10.42],fov:53},
    {id:'stair',label:'راه‌پله و بالکن',level:0,camera:[.23,1.78,-2.71],target:[0,3.23,-11.65],fov:58},
    {id:'balcony',label:'بالکن طبقهٔ اول',level:1,camera:[-2.06,5.48,8.46],target:[1.5,4.03,-4.7],fov:55},
] as const;
export type PhotoShotId = typeof PHOTO_SHOTS[number]['id'];
