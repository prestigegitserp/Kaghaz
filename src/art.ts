import { escapeHtml, type Product } from './domain/model.ts';
/** Lightweight catalog illustrations; the inspected product uses actual 3D geometry. */
export function productArt(p: Product, large = false): string {
    const color = escapeHtml(p.color), id = `a-${p.id}-${large ? 'l' : 's'}`;
    let body = '';
    const stack = `<path d="m35 98 77-35 90 25-76 39Z" fill="#c4bdac"/><path d="M35 98v25l91 32v-28Z" fill="#c4bdac"/><path d="m126 127 76-39v25l-76 42Z" fill="#e4dfd0"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="m36 ${101 + i * 4} 90 31 75-38" fill="none" stroke="#8a8577" opacity=".28" stroke-width=".7"/>`).join('')}<path d="m35 98 77-35 90 25-76 39Z" fill="${color}"/>`;
    if (p.kind === 'box')
        body = `<path d="m56 81 74-28 57 34-73 31Z" fill="#715535"/><path d="M56 81v61l58 35v-59Z" fill="${color}"/><path d="m114 118 73-31v61l-73 29Z" fill="#a17c4e"/><path d="m56 81-26-17 74-27 26 16Z" fill="#c8a375"/><path d="m187 87 22-25-57-33-22 24Z" fill="#b48d5d"/><path d="m56 81 58 37-22 18-59-39Z" fill="#d0b087"/><path d="m114 118 73-31 20 16-74 33Z" fill="#bc9866"/><path d="M75 120v16l20 11v-17Z" fill="#e9ddc8"/>`;
    else if (p.kind === 'roll')
        body = `<path d="M72 60v99c0 31 98 31 98 0V60Z" fill="url(#${id})"/><ellipse cx="121" cy="60" rx="49" ry="24" fill="#ccb58f"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<ellipse cx="121" cy="60" rx="${13 + i * 5}" ry="${6 + i * 2.5}" fill="none" stroke="#9c805a" stroke-width=".7"/>`).join('')}<ellipse cx="121" cy="60" rx="10" ry="5" fill="#4b3822"/><path d="M164 63q37 25 28 88l-18 9V69Z" fill="#d8c399"/>`;
    else if (p.kind === 'swatch')
        body = ['#dac8a3', '#cbac75', '#b67d65', '#9b8f77', '#819886', '#70929a', p.color].map((c, i) => `<rect x="91" y="36" width="55" height="133" rx="2" fill="${c}" transform="rotate(${(i - 3) * 12} 118 159)"/><circle cx="118" cy="159" r="2.5" fill="#b89c69"/>`).join('');
    else if (p.kind === 'notebook')
        body = stack + `<path d="m55 91 59-26 69 20-61 29Z" fill="${color}"/>${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${48 + i * 9}" cy="${92 - i * 4}" rx="3" ry="7" fill="none" stroke="#5d645e" stroke-width="2" transform="rotate(-30 ${48 + i * 9} ${92 - i * 4})"/>`).join('')}`;
    else if (p.kind === 'ream')
        body = stack + `<path d="m61 86 42-19 68 19-43 22Z" fill="#f0ece2"/><path d="m61 86 42-19 20 6-42 19Z" fill="#4d6a55"/><text x="117" y="88" fill="#38533f" font-family="sans-serif" font-size="15" font-weight="700" transform="rotate(-13 117 88)">A4</text><text x="121" y="99" fill="#7e8174" font-family="sans-serif" font-size="5.5" transform="rotate(-13 121 99)">80 gsm · 500</text>`;
    else
        body = stack;
    return `<svg viewBox="0 0 240 208" role="img" aria-label="نمای مفهومی ${escapeHtml(p.name)}" class="product-illustration"><defs><linearGradient id="${id}" x1="0" x2="1"><stop stop-color="#b49363"/><stop offset=".44" stop-color="${color}"/><stop offset="1" stop-color="#927046"/></linearGradient><radialGradient id="${id}-shadow"><stop stop-color="#433820" stop-opacity=".15"/><stop offset="1" stop-color="#433820" stop-opacity="0"/></radialGradient></defs><ellipse cx="122" cy="173" rx="97" ry="21" fill="url(#${id}-shadow)"/>${body}</svg>`;
}
