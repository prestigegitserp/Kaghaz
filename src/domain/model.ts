import { boothCoordinates } from './hall.ts';

export type ProductKind = 'ream' | 'sheet' | 'kraft' | 'box' | 'swatch' | 'roll' | 'notebook';
export type Category = 'all' | 'printing' | 'board' | 'packaging' | 'creative';
export type Quality = 'auto' | 'high' | 'balanced' | 'low';
export interface Product {
    id: string;
    boothId: string;
    name: string;
    category: Exclude<Category, 'all'>;
    kind: ProductKind;
    grammage: number;
    size: string;
    unit: string;
    color: string;
    detail: string;
    minOrder: number;
    sample: boolean;
}
export interface Booth {
    id: string;
    name: string;
    subtitle: string;
    category: Exclude<Category, 'all'>;
    accent: string;
    slot: number;
    custom?: boolean;
    modelKey?: string;
    catalogKey?: string;
}
export interface InquiryLine {
    productId: string;
    quantity: number;
}
export interface SavedState {
    version: 1;
    favorites: string[];
    inquiry: InquiryLine[];
    notes: string;
    customBooths: Booth[];
    customProducts: Product[];
    quality: Quality;
}
export const STORAGE_KEY = 'kaghaz.workspace.v4';
export const CATEGORIES: {
    id: Category;
    label: string;
    icon: string;
}[] = [
    { id: 'all', label: 'تمام راسته', icon: 'grid' },
    { id: 'printing', label: 'کاغذ تحریر و چاپ', icon: 'paper' },
    { id: 'board', label: 'مقوا و گلاسه', icon: 'layers' },
    { id: 'packaging', label: 'کرافت و بسته‌بندی', icon: 'box' },
    { id: 'creative', label: 'کاغذ رنگی و هنری', icon: 'palette' },
];
export const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
export function normalize(text: string): string {
    return text.normalize('NFKC').replace(/ي|ى/g, 'ی').replace(/ك/g, 'ک')
        .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u200c\u200d]/g, ' ')
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/\s+/g, ' ').trim().toLowerCase();
}
export function searchProducts(products: Product[], booths: Booth[], query: string, category: Category = 'all', boothId?: string): Product[] {
    const tokens = normalize(query).split(' ').filter(Boolean);
    return products.filter(p => {
        if (category !== 'all' && p.category !== category)
            return false;
        if (boothId && p.boothId !== boothId)
            return false;
        const haystack = normalize([p.name, p.detail, p.size, p.grammage, booths.find(b => b.id === p.boothId)?.name].join(' '));
        return tokens.every(t => haystack.includes(t));
    });
}
export function quantity(value: unknown, minimum = 1): number {
    const n = typeof value === 'string' ? Number(normalize(value)) : Number(value);
    return Number.isFinite(n) ? Math.max(minimum, Math.min(99999, Math.round(n))) : minimum;
}
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export const boothPose = boothCoordinates;
export function emptyState(): SavedState {
    return { version: 1, favorites: [], inquiry: [], notes: '', customBooths: [], customProducts: [], quality: 'auto' };
}
const categories = ['printing', 'board', 'packaging', 'creative'];
const kinds = ['ream', 'sheet', 'kraft', 'box', 'swatch', 'roll', 'notebook'];
/** Import is a bounded allow-list, never a spread of untrusted JSON into application state. */
export function parseState(input: unknown): SavedState {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('ساختار فایل معتبر نیست.');
    const d = input as Record<string, unknown>;
    if (d.version !== 1)
        throw new Error('نسخهٔ فایل پشتیبانی نمی‌شود.');
    const s = emptyState();
    s.notes = typeof d.notes === 'string' ? d.notes.slice(0, 3000) : '';
    s.quality = ['auto', 'high', 'balanced', 'low'].includes(String(d.quality)) ? d.quality as Quality : 'auto';
    const cleanId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(id);
    if (Array.isArray(d.favorites))
        s.favorites = [...new Set(d.favorites.filter(cleanId))].slice(0, 200);
    if (Array.isArray(d.inquiry)) {
        for (const line of d.inquiry.slice(0, 200)) {
            if (line && typeof line === 'object' && cleanId(line.productId) && !s.inquiry.some(x => x.productId === line.productId)) {
                s.inquiry.push({ productId: line.productId, quantity: quantity(line.quantity) });
            }
        }
    }
    if (Array.isArray(d.customBooths)) {
        for (const b of d.customBooths.slice(0, 2)) {
            if (!b || typeof b !== 'object' || !cleanId(b.id) || !b.id.startsWith('custom-'))
                continue;
            if (s.customBooths.some(x => x.id === b.id))
                continue;
            if (typeof b.name !== 'string' || !b.name.trim())
                continue;
            s.customBooths.push({ id: b.id, name: b.name.trim().slice(0, 40), subtitle: String(b.subtitle || '').slice(0, 110),
                category: categories.includes(b.category) ? b.category : 'printing',
                accent: /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : '#3d6051',
                slot: 8 + s.customBooths.length, custom: true,
                // Blob attachments are origin-local and deliberately not restored from JSON.
            });
        }
    }
    if (Array.isArray(d.customProducts)) {
        for (const p of d.customProducts.slice(0, 40)) {
            if (!p || !cleanId(p.id) || !p.id.startsWith('custom-') || !s.customBooths.some(b => b.id === p.boothId) || typeof p.name !== 'string')
                continue;
            if (s.customProducts.some(x => x.id === p.id))
                continue;
            s.customProducts.push({ id: p.id, boothId: p.boothId, name: p.name.slice(0, 70),
                category: categories.includes(p.category) ? p.category : 'printing', kind: kinds.includes(p.kind) ? p.kind : 'ream',
                grammage: Math.min(1200, quantity(p.grammage)), size: String(p.size || '').slice(0, 35),
                unit: String(p.unit || 'بسته').slice(0, 35), color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#eee8dc',
                detail: String(p.detail || '').slice(0, 500), minOrder: quantity(p.minOrder), sample: Boolean(p.sample) });
        }
    }
    return s;
}
export function inquiryText(state: SavedState, products: Product[], booths: Booth[]): string {
    const lines = ['فهرست درخواست استعلام — کاغذ', 'این فایل پیش‌نویس است؛ به فروشنده ارسال نشده است.', ''];
    for (const line of state.inquiry) {
        const p = products.find(p => p.id === line.productId);
        if (!p)
            continue;
        const b = booths.find(b => b.id === p.boothId);
        lines.push(`${p.name} | ${p.grammage} گرم | ${p.size}`, `غرفه: ${b?.name || ''} | تعداد: ${number(line.quantity)} ${p.unit}`, '');
    }
    if (state.notes)
        lines.push('توضیحات:', state.notes);
    return lines.join('\n');
}
