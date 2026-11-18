import type { ProductKind } from './model.ts';

export const REVIEW_VIEWS = [
    { id: 'market', title: 'ورودی راسته', detail: 'طاق آجری، نورگیرها و پیشخوان‌های راسته' },
    { id: 'workshop', title: 'داخل کاغذفروشی', detail: 'چیدمان قفسه‌ها، نور پیشخوان و انبار کوچک غرفه' },
    { id: 'ream', title: 'بند نیمه‌باز', detail: 'لفاف چاپی، ورق‌های آزاد و لبهٔ فشردهٔ کاغذ' },
    { id: 'roll', title: 'مقطع رول', detail: 'پیچش لایه‌های کاغذ کرافت و هستهٔ مقوایی توخالی' },
    { id: 'carton', title: 'خط تای کارتن', detail: 'زبانه، برچسب، چسب و لایهٔ موج‌دار کارتن' },
    { id: 'bundle', title: 'بند و پالت', detail: 'ورق‌های تسمه‌شده و تخته‌های پالت چوبی' },
] as const;
export type ReviewId = typeof REVIEW_VIEWS[number]['id'];

export const reviewImage = (id: ReviewId) => `${import.meta.env.BASE_URL}v3/renders/${id}.webp`;
export const reviewThumb = (id: ReviewId) => `${import.meta.env.BASE_URL}v3/renders/${id}-thumb.webp`;

type PlateId = 'ream' | 'roll' | 'carton' | 'bundle';
export const MATERIAL_PLATES: Partial<Record<ProductKind, PlateId>> = {
    ream: 'ream', sheet: 'bundle', kraft: 'bundle', roll: 'roll', box: 'carton',
};

export const MATERIAL_NOTES: Record<ProductKind, string> = {
    ream: 'در لبهٔ بند، ورق‌های فشرده را ببینید. نور را پایین بیاورید تا چین‌های لفاف و انحنای ورق‌های آزاد مشخص شود.',
    sheet: 'نمای لبه، لایه‌های برش‌خورده را بهتر نشان می‌دهد. برای دیدن لبهٔ زیر تسمه، اجزا را از هم باز کنید.',
    kraft: 'نور از کنار، تغییر زبری و الیاف سطح را نشان می‌دهد. رنگ نمونه با نور محیط تغییر می‌کند.',
    box: 'کنارهٔ زبانه‌ها را بررسی کنید. با باز کردن اجزا، هندسهٔ خط تا و لایهٔ موج‌دار بهتر دیده می‌شود.',
    roll: 'از بالا به مقطع نگاه کنید تا پیچش ورق و هستهٔ توخالی دیده شود. کاغذ آزادشده را زیر نور کم‌زاویه مقایسه کنید.',
    swatch: 'تغییر زاویهٔ نور برای دیدن بازتاب سطح نمونه‌های مات و رنگی کمک می‌کند.',
    notebook: 'در نمای لبه به عطف، جلد و بلوک ورق‌ها نگاه کنید.',
};

export const SHOTS = [
    { id: 'entry', label: 'ورودی', camera: [.48, 1.79, 17.2], target: [-.48, 1.88, 2.8], fov: 56 },
    { id: 'vault', label: 'طاق و نورگیر', camera: [.31, 1.78, 10.65], target: [-.25, 4.72, -5.3], fov: 52 },
    { id: 'counter', label: 'پیشخوان تحریر', camera: [-1.56, 1.61, 11.25], target: [-4.27, 1.15, 10.35], fov: 40 },
    { id: 'stock', label: 'انبار بسته‌بندی', camera: [1.52, 1.66, 2.67], target: [5.59, .95, 2.76], fov: 43 },
] as const;
export type ShotId = typeof SHOTS[number]['id'];

export const INSPECTION_VIEWS = [
    { id: 'whole', label: 'نمای کلی' },
    { id: 'edge', label: 'لبه و مقطع' },
    { id: 'macro', label: 'ماکرو' },
] as const;
export type InspectionView = typeof INSPECTION_VIEWS[number]['id'];
