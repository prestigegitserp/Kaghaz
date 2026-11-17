import type { ProductKind } from '../domain/model.ts';
export type AssetId = 'notebook'|'paper-ream'|'wood-pallet'|'paper-bundle'|'carton-open'|'carton-closed'|'kraft-roll'|'swatch-fan'|'merchant-counter';
export interface AssetDefinition { id:AssetId; url:string; label:string; units:'meters'; maxBytes:number; maxTriangles:number; }
const labels:Record<AssetId,string>={
  'notebook':'دفتر با جلد و عطف دوخته',
  'paper-ream':'بند کاغذ با لفاف چاپی','wood-pallet':'پالت چوبی انبار','paper-bundle':'بند ورق با تسمه',
  'carton-open':'کارتن باز با زبانه','carton-closed':'کارتن بسته','kraft-roll':'رول کاغذ توخالی',
  'swatch-fan':'بادبزن نمونهٔ رنگ','merchant-counter':'پیشخوان چوب و سنگ',
};
export const ASSET_REGISTRY=Object.fromEntries(Object.entries(labels).map(([id,label])=>[id,{id,label,url:`v2/models/${id}.glb`,units:'meters',maxBytes:4*1024*1024,maxTriangles:60000}])) as Record<AssetId,AssetDefinition>;
export function assetForProduct(kind:ProductKind):AssetId {
  return ({ream:'paper-ream',sheet:'paper-bundle',kraft:'paper-bundle',box:'carton-open',roll:'kraft-roll',swatch:'swatch-fan',notebook:'notebook'} as const)[kind];
}
export interface LightingProfile { id:'day'|'warm'|'neutral';label:string;key:string;fill:string;exposure:number;intensity:number; }
export const LIGHTING:LightingProfile[]=[
  {id:'day',label:'نور روز',key:'#fff1d4',fill:'#dbe8eb',exposure:1.02,intensity:3.15},
  {id:'warm',label:'عصر گرم',key:'#ffc98a',fill:'#c1d1df',exposure:.95,intensity:2.9},
  {id:'neutral',label:'بررسی جنس',key:'#fffdf6',fill:'#e8eff0',exposure:1.12,intensity:3.0},
];
