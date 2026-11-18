import { planCut, type CutInput } from './domain/cut.ts';
import { normalize, number, type Product } from './domain/model.ts';

const decimal = (digits: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits });
const dimensions = (p?: Product): [number, number] | undefined => {
    if (!p) return;
    const value = normalize(p.size).replaceAll('٫', '.');
    const a: Record<string, [number, number]> = { a3: [297, 420], a4: [210, 297], a5: [148, 210] };
    if (Object.hasOwn(a, value)) return a[value];
    const match = value.match(/^(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*(سانتی|میلی)/);
    if (!match) return;
    const scale = match[3] === 'سانتی' ? 10 : 1;
    return [Number(match[1]) * scale, Number(match[2]) * scale];
};

export function cutForm(product?: Product): string {
    const [width, height] = dimensions(product) || [700, 1000];
    const field = (label: string, name: string, value: number) =>
        `<label class="field-label">${label}<input name="${name}" value="${decimal(2).format(value).replaceAll('٬', '')}" inputmode="decimal" required></label>`;
    return `<div class="cut-layout"><form id="cut-form" class="cut-form">
        <fieldset><legend>ورق مادر <small>میلی‌متر</small></legend>
            <div class="cut-fields">${field('عرض', 'stockWidth', width)}${field('طول', 'stockHeight', height)}</div>
        </fieldset><fieldset><legend>قطعهٔ نهایی <small>میلی‌متر</small></legend>
            <div class="cut-fields">${field('عرض', 'pieceWidth', 210)}${field('طول', 'pieceHeight', 297)}</div>
        </fieldset><div class="cut-fields">${field('حاشیهٔ هر طرف', 'margin', 5)}${field('فاصلهٔ برش', 'gap', 2)}</div>
        ${field('گرماژ · گرم بر مترمربع', 'grammage', product?.grammage || 80)}
        <label class="cut-rotate"><input name="rotate" type="checkbox" checked> اجازهٔ چرخش ۹۰ درجه</label>
        <p>با غیرفعال کردن چرخش، جهت قطعه‌ها ثابت می‌ماند. ابعاد حاشیه و فاصله را بر حسب میلی‌متر وارد کنید.</p>
        </form><div class="cut-result" id="cut-result"></div></div>`;
}

export function updateCut(form: HTMLFormElement, result: HTMLElement) {
    const data = new FormData(form);
    const value = (name: string) => {
        const raw = normalize(String(data.get(name) || '')).replaceAll('٫', '.');
        return raw ? Number(raw) : NaN;
    };
    const input: CutInput = {
        stockWidth: value('stockWidth'), stockHeight: value('stockHeight'),
        pieceWidth: value('pieceWidth'), pieceHeight: value('pieceHeight'),
        margin: value('margin'), gap: value('gap'), grammage: value('grammage'), rotate: data.has('rotate'),
    };
    const plan = planCut(input);
    if (!plan) {
        result.innerHTML = '<p class="cut-empty" role="status">ابعاد، حاشیه، فاصله و گرماژ را بررسی کنید.</p>';
        return;
    }
    const { stockWidth: w, stockHeight: h, gap, margin } = input;
    const format = decimal(1);
    result.innerHTML = `<div class="cut-stats" role="status"><span><strong>${number(plan.pieces)}</strong>قطعه در هر ورق</span><span><strong>${format.format(plan.waste)}٪</strong>پرت ورق</span><span><strong>${format.format(plan.grams)}</strong>گرم وزن قطعه‌ها</span></div>
        <div class="cut-preview"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="چیدمان پیشنهادی قطعه‌ها روی ورق مادر">
          <rect width="${w}" height="${h}" fill="#d7c9a8"/>
          <rect x="${margin}" y="${margin}" width="${w - 2 * margin}" height="${h - 2 * margin}" fill="#ede5d1"/>
          ${plan.bands.map((b, i) => {
                const pitchX = b.width + gap, pitchY = b.height + gap;
                const edge = Math.min(b.width, b.height) * .009;
                return `<defs><pattern id="cut-grid-${i}" x="${b.x}" y="${b.y}" width="${pitchX}" height="${pitchY}" patternUnits="userSpaceOnUse"><rect x="${edge * .5}" y="${edge * .5}" width="${b.width - edge}" height="${b.height - edge}" fill="${b.rotated ? '#a16e41' : '#507560'}"/></pattern></defs><rect x="${b.x}" y="${b.y}" width="${b.columns * pitchX - gap}" height="${b.rows * pitchY - gap}" fill="url(#cut-grid-${i})"/>`;
          }).join('')}
        </svg></div><div class="cut-legend">${plan.pieces ? '<span>جهت اصلی</span><span>چرخیده</span>' : '<span>هیچ قطعه‌ای در محدودهٔ برش جا نمی‌شود.</span>'}</div>
        <p class="cut-note">بهترین چیدمان در میان الگوهای نواری افقی و عمودی، با حاشیه و فاصلهٔ واردشده.</p>`;
}
