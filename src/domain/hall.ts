import layout from './hall-layout.json' with { type: 'json' };

export const HALL = layout;
export const STATION_IDS = ['proof', 'fold', 'samples'] as const;
export type StationId = typeof STATION_IDS[number];
export type Point2 = [x: number, z: number];

export function boothCoordinates(slot: number) {
    const [x, z, rotation] = HALL.booths[slot] ?? HALL.booths[0];
    return { x, z, rotation };
}

export function boothPoint(slot: number, across: number, forward: number): Point2 {
    const { x, z, rotation } = boothCoordinates(slot), c = Math.cos(rotation), s = Math.sin(rotation);
    return [x + across * c + forward * s, z - across * s + forward * c];
}

export const PHOTO_SHOTS = [
    { id: 'entry', label: 'ورودی شیشه‌ای', camera: HALL.entry, target: HALL.entryLook, fov: 62 },
    { id: 'islands', label: 'میدان نمونه‌ها', camera: [-2.4, 2.13, 5.45], target: [.1, 1.34, -3.0], fov: 57 },
    { id: 'color', label: 'خانهٔ رنگ', camera: [-5.48, 1.82, 6.36], target: [-10.5, 1.49, 6.62], fov: 51 },
    { id: 'ceiling', label: 'نورگیر مرکزی', camera: [1.15, 2.42, -4.9], target: [.6, 4.62, 1.1], fov: 60 },
] as const;
export type PhotoShotId = typeof PHOTO_SHOTS[number]['id'];
