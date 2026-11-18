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
const current = { 'paper-ream-modern': 'لفاف تحریر بهارستان', 'paper-ream-open-modern': 'بند نیمه‌باز بهارستان' };
export type AssetId = keyof typeof legacy | keyof typeof updated | keyof typeof current;
export interface AssetDefinition {
    id: AssetId;
    url: string;
    label: string;
    units: 'meters';
    maxBytes: number;
    maxTriangles: number;
}
export const ASSET_REGISTRY = Object.fromEntries(
    Object.entries({ ...legacy, ...updated, ...current }).map(([id, label]) => [id, {
        id, label, url: `${Object.hasOwn(current,id) ? 'v4' : Object.hasOwn(updated,id) ? 'v3' : 'v2'}/models/${id}.glb`,
        units: 'meters', maxBytes: 2 * 1024 * 1024, maxTriangles: 60_000,
    }]),
) as Record<AssetId, AssetDefinition>;

export function assetForProduct(kind: ProductKind): AssetId {
    return ({
        ream: 'paper-ream-open-modern', sheet: 'paper-bundle', kraft: 'paper-bundle',
        box: 'carton-open', roll: 'kraft-roll', swatch: 'swatch-fan', notebook: 'notebook',
    } as const)[kind];
}

export const LIGHTING = [
    { id: 'day', label: 'نور روز', key: '#fff1dc', fill: '#dae9ff', exposure: 1.09,
      intensity: 2.7, ambient: 1.41, practical: 23, environment: .44 },
    { id: 'warm', label: 'نور گرم', key: '#ffd9a9', fill: '#dee8ff', exposure: 1.19,
      intensity: 1.78, ambient: 1.59, practical: 37, environment: .48 },
    { id: 'night', label: 'نور ویترین', key: '#bccfe8', fill: '#e2e6ff', exposure: 1.24,
      intensity: 1.11, ambient: 1.26, practical: 61, environment: .44 },
] as const;
