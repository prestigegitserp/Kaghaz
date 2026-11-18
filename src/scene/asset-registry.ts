import { MATERIAL_PROFILES, PROFILE_IDS, type MaterialProfileId } from '../domain/material-profiles.ts';
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
const v4 = { 'paper-ream-modern': 'لفاف تحریر بهارستان', 'paper-ream-open-modern': 'بند نیمه‌باز بهارستان' };
const specimens = Object.fromEntries(PROFILE_IDS.map(id => [id, MATERIAL_PROFILES[id].title]));
const current = {
    'wrapped-stock-pallet':'پالت بسته‌شده با فیلم و تسمه',
    'loaded-paper-cart':'چرخ‌دستی بارگیری‌شدهٔ پاساژ',
    'counter-accessories':'ماشین‌حساب، قبض و چسب‌کش',
};
export type AssetId = keyof typeof legacy | keyof typeof updated | keyof typeof v4 | keyof typeof current | MaterialProfileId;
export interface AssetDefinition {
    id: AssetId;
    url: string;
    label: string;
    units: 'meters';
    maxBytes: number;
    maxTriangles: number;
}
export const ASSET_REGISTRY = Object.fromEntries(
    Object.entries({ ...legacy, ...updated, ...v4, ...current, ...specimens }).map(([id, label]) => [id, {
        id, label, url: `${Object.hasOwn(specimens,id) ? 'v6' : Object.hasOwn(current,id) ? 'v5' : Object.hasOwn(v4,id) ? 'v4' : Object.hasOwn(updated,id) ? 'v3' : 'v2'}/models/${id}.glb`,
        units: 'meters', maxBytes: 2 * 1024 * 1024, maxTriangles: 60_000,
    }]),
) as Record<AssetId, AssetDefinition>;

export function assetForProduct(kind: ProductKind, profile?: MaterialProfileId): AssetId {
    return profile ?? ({
        ream: 'paper-ream-open-modern', sheet: 'paper-bundle', kraft: 'paper-bundle',
        box: 'carton-open', roll: 'kraft-roll', swatch: 'swatch-fan', notebook: 'notebook',
    } as const)[kind];
}

export const LIGHTING = [
    {id:'day',label:'نور روز',key:'#f4f5ec',fill:'#d8e6ef',exposure:1.08,
        intensity:1.92,ambient:1.27,practical:9,environment:.43},
    {id:'warm',label:'نور گرم',key:'#ffe0b0',fill:'#dbe8ef',exposure:1.09,
        intensity:1.69,ambient:1.08,practical:14,environment:.40},
    {id:'night',label:'نور ویترین',key:'#c9d7e3',fill:'#d0e0f9',exposure:1.17,
        intensity:1.16,ambient:.86,practical:22,environment:.35},
] as const;
