import type { ProductKind } from '../domain/model.ts';

const legacy = {
    notebook: 'دفتر با جلد و عطف دوخته',
    'carton-closed': 'کارتن بسته',
    'swatch-fan': 'بادبزن نمونهٔ رنگ',
    'merchant-counter': 'پیشخوان چوب و سنگ',
};
const updated = {
    'paper-ream': 'بند کاغذ با لفاف چاپی',
    'paper-ream-open': 'بند نیمه‌باز با ورق‌های بلندشده',
    'wood-pallet': 'پالت چوبی با رد برش و میخ',
    'paper-bundle': 'ورق برش‌خورده با تسمه',
    'carton-open': 'کارتن با لبهٔ موج‌دار و خط تا',
    'kraft-roll': 'رول کرافت با پیچش کاغذ و هستهٔ توخالی',
};
export type AssetId = keyof typeof legacy | keyof typeof updated;
export interface AssetDefinition {
    id: AssetId;
    url: string;
    label: string;
    units: 'meters';
    maxBytes: number;
    maxTriangles: number;
}
export const ASSET_REGISTRY = Object.fromEntries(
    Object.entries({ ...legacy, ...updated }).map(([id, label]) => [id, {
        id, label, url: `${Object.hasOwn(updated, id) ? 'v3' : 'v2'}/models/${id}.glb`,
        units: 'meters', maxBytes: 2 * 1024 * 1024, maxTriangles: 60_000,
    }]),
) as Record<AssetId, AssetDefinition>;

export function assetForProduct(kind: ProductKind): AssetId {
    return ({
        ream: 'paper-ream-open', sheet: 'paper-bundle', kraft: 'paper-bundle',
        box: 'carton-open', roll: 'kraft-roll', swatch: 'swatch-fan', notebook: 'notebook',
    } as const)[kind];
}

export const LIGHTING = [
    { id: 'day', label: 'نور ورودی', key: '#ffe7c6', fill: '#c6dce8', exposure: 1.18,
      intensity: 2.95, ambient: .96, practical: 47, environment: .38 },
    { id: 'warm', label: 'غروب', key: '#ffb570', fill: '#a6bad7', exposure: 1.23,
      intensity: 1.95, ambient: .65, practical: 59, environment: .31 },
    { id: 'night', label: 'چراغ‌های راسته', key: '#9ab9d8', fill: '#a1b5cb', exposure: 1.30,
      intensity: .72, ambient: .38, practical: 86, environment: .24 },
] as const;
