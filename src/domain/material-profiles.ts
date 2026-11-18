import type { StationId } from './hall.ts';

export const MATERIAL_PROFILES = {
    carbonless: {
        title: 'فرم خودکپی', label: 'خودکپی', lead: 'ncr-set-55',
        description: 'برگهٔ اصل و برگ‌های انتقال رنگ در یک بلوک با لبهٔ چسب‌خورده.',
        inspection: 'در نمای لبه، اختلاف ارتفاع کپی‌های صورتی و زرد را ببینید. در تصویر چاپی، ترتیب اصل و کپی مشخص است.',
    },
    foil: {
        title: 'مقوای فویل‌دار و مرواریدی', label: 'فویل و مروارید', lead: 'foil-teal-300',
        description: 'خطوط فویل روی زمینهٔ رنگ‌شده با برگ مرواریدی روشن در کنار آن.',
        inspection: 'نور را از کنار به سطح بدهید تا بازتاب فویل، زبری مقوا و خط برجستهٔ طرح از هم متمایز شوند.',
    },
    labels: {
        title: 'رول لیبل چسب‌دار', label: 'لیبل رول', lead: 'label-thermal-75',
        description: 'هستهٔ مقوایی، پیچش لبه‌به‌لبه و لیبل‌های جداشونده از زیره.',
        inspection: 'حلقه‌های مقطع را کنار زبانهٔ لیبل ببینید. گرماژ کالا به رویه اشاره دارد.',
    },
    microflute: {
        title: 'ورق میکروفلوت', label: 'میکروفلوت', lead: 'microflute-e-460',
        description: 'موج پیوسته میان دو رویهٔ کرافت و ورق‌های برش‌خورده در چند ارتفاع.',
        inspection: 'در نمای مقطع، فاصلهٔ قله‌های موج و اتصال آن‌ها به رویه را ببینید. با فاصلهٔ اجزا، رویه بالا می‌رود.',
    },
    vellum: {
        title: 'کاغذ کالک نیمه‌شفاف', label: 'کالک', lead: 'vellum-92',
        description: 'دو برگ نیمه‌شفاف روی یک نقشهٔ چاپی، با لبه‌های آزاد و هم‌پوشانی.',
        inspection: 'خطوط چاپی زیر یک برگ و زیر دو برگ را مقایسه کنید. هم‌پوشانی، جزئیات زمینه را محوتر می‌کند.',
    },
    deckle: {
        title: 'کاغذ پنبه‌ای لبه‌دست‌ساز', label: 'پنبه‌ای دست‌ساز', lead: 'deckle-cotton-300',
        description: 'سطح دانه‌دار، لبهٔ ناهموار و تفاوت دو برگ عاجی و رنگ‌شده.',
        inspection: 'زاویهٔ نور را کم کنید تا برجستگی دانه و لبه‌های نامنظم کاغذ سایه بیندازند.',
    },
    'coated-board': {
        title: 'مقوای مغزی‌دار پوشش‌دار', label: 'مقوای چندلایه', lead: 'board-coated-350',
        description: 'رویهٔ پوشش‌دار چاپی، لایه‌های روشن و مغزی خاکستری از کنار ورق.',
        inspection: 'نمای لبه تفاوت روکش سفید و مغزی را نشان می‌دهد. تکهٔ جداگانه، سطح پشت مقوا را نشان می‌دهد.',
    },
    honeycomb: {
        title: 'پنل کاغذی لانه‌زنبوری', label: 'لانه‌زنبوری', lead: 'honeycomb-15',
        description: 'سلول‌های شش‌ضلعی واقعی، رویهٔ جداشده و اتصال سلول‌ها به آستر.',
        inspection: 'روی سطح بچرخید و داخل سلول‌ها را ببینید. با فاصلهٔ اجزا، رویه از شبکه بلند می‌شود.',
    },
} as const;

export type MaterialProfileId = keyof typeof MATERIAL_PROFILES;
export const PROFILE_IDS = Object.keys(MATERIAL_PROFILES) as MaterialProfileId[];
export const renderImage = (id: string, full = false) => `${import.meta.env.BASE_URL}v6/renders/${id}${full ? '' : '-thumb'}.webp`;

export const STATION_SPECIMENS: Partial<Record<StationId, { asset: MaterialProfileId; offset: number; scale: number }[]>> = {
    samples: [{ asset: 'deckle', offset: .34, scale: 1.62 }, { asset: 'foil', offset: -.25, scale: 1.62 }],
    unwrap: [{ asset: 'carbonless', offset: -.39, scale: 1.5 }],
    proof: [{ asset: 'coated-board', offset: .37, scale: 1.55 }, { asset: 'vellum', offset: -.28, scale: 1.46 }],
    fold: [{ asset: 'microflute', offset: -.32, scale: 1.4 }],
    roll: [{ asset: 'labels', offset: -.35, scale: 1.22 }],
    pallet: [{ asset: 'honeycomb', offset: -.43, scale: 1.17 }],
};
