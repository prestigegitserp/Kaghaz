import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import './style.css';
import './v3.css';
import './v4.css';
import './v5.css';
import './v6.css';
import { MATERIAL_PROFILES, PROFILE_IDS, renderImage, type MaterialProfileId } from './domain/material-profiles.ts';
import { BOOTHS, PRODUCTS } from './domain/catalog.ts';
import { CATEGORIES, boothPose, emptyState, escapeHtml as esc, inquiryText, normalize, number, parseState, quantity, searchProducts, type Booth, type Category, type Product, type Quality } from './domain/model.ts';
import { deleteAsset, download, getAsset, loadState, putAsset, saveState } from './domain/storage.ts';
import { icon } from './icons.ts';
import { productArt } from './art.ts';
import type { BazaarWorld } from './scene/world.ts';
import type { StudioControl } from './scene/studio.ts';
import { LIGHTING } from './scene/asset-registry.ts';
import { toggleComparison } from './domain/comparison.ts';
import { INSPECTION_VIEWS, MATERIAL_NOTES, MATERIAL_PLATES, REVIEW_VIEWS, reviewImage, reviewThumb, type InspectionView } from './domain/review.ts';
import { cutForm, updateCut } from './cut-ui.ts';
import { HALL, PHOTO_SHOTS, STATION_IDS, levelName, type Level, type PhotoShotId, type StationId } from './domain/hall.ts';
import { foldingMarkup, mountFold, proofMarkup, mountProof, surfaceForProduct } from './lab.ts';
import { mountPassageTool,passageToolMarkup,passageToolTitle } from './passage-labs.ts';
let state = loadState();
let category: Category = 'all', query = '', selectedBooth: string | undefined, favoriteFilter = false, currentView = 'market';
let world: BazaarWorld | undefined, studioCleanup: (() => void) | undefined, mode: 'walk' | 'orbit' = 'walk', metricsVisible = false;
let studio: StudioControl | undefined, lighting = 'day', comparison: string[] = [], tourIndex = -1;
let activeLevel: Level = 0;
let profileFilter: MaterialProfileId | undefined;
const versionUrl = (version: 1 | 2 | 3 | 4 | 5) => new URL(`../v${version}/`, location.href).href;
const booths = () => [...BOOTHS, ...state.customBooths];
const products = () => [...PRODUCTS, ...state.customProducts];
const hallImage = (id:string) => `${import.meta.env.BASE_URL}v4/renders/${id}.webp`;
const GALLERY = [
    { id: 'passage', title: 'ورودی پاساژ', detail: 'راهروی دوطبقه، شیشهٔ ویترین و نور پیوستهٔ زیر بالکن' },
    { id: 'store', title: 'داخل مغازه', detail: 'قفسه‌های کاغذ، پیشخوان، نمونهٔ چاپی و استند عرضۀ کالا' },
    { id: 'balcony', title: 'بالکن طبقهٔ اول', detail: 'اتصال پلکان به پاگرد و جزئیات دستگیره و شیشهٔ جان‌پناه' },
    ...PROFILE_IDS.map(id => ({ id, title: MATERIAL_PROFILES[id].title, detail: MATERIAL_PROFILES[id].description })),
].map(view => ({ ...view, url: renderImage(view.id, true), thumb: renderImage(view.id) }));
const GALLERY_ARCHIVE = REVIEW_VIEWS.slice(2).map(view => ({
    ...view, url: view.id === 'ream' ? hallImage('ream') : reviewImage(view.id),
}));
type GalleryView = (typeof GALLERY)[number];
const STATION_ART = {
    samples: {icon:'layers',description:'نمونهٔ جنس را بچرخانید و از نزدیک ببینید.'},
    unwrap: {icon:'box',description:'فیلم و تسمهٔ بسته را جدا کنید.'},
    proof: {icon:'sun',description:'چاپ روی دو روکش را زیر نور مقایسه کنید.'},
    fold: {icon:'box',description:'الگوی تخت را به جعبه تبدیل کنید.'},
    roll: {icon:'orbit',description:'کاغذ را بکشید و مقدار باقی‌مانده را ببینید.'},
    press: {icon:'palette',description:'لایه‌های مرکب را جدا و تراز کنید.'},
    pallet: {icon:'grid',description:'کارتن‌ها را بچینید و تعداد و وزن را حساب کنید.'},
};
const MAP = {x:(x:number)=>100+x*6.4,y:(z:number)=>100+z*5.33};
const app = document.querySelector<HTMLDivElement>('#app')!;
const btn = (action: string, label: string, ico: string, extra = '') => `<button type="button" data-action="${action}" class="icon-button" title="${label}" aria-label="${label}" ${extra}>${icon(ico)}</button>`;
const folded = `<svg viewBox="0 0 42 44" aria-hidden="true"><path d="M6 4h23l8 10v26H6z" fill="#f2eddf"/><path d="m6 4 23 10V4M29 14h8M13 23h15M13 29h11" stroke="#b5a27b" stroke-width="1.5" fill="none"/></svg>`;
app.innerHTML = `
  <header class="app-header">
    <button class="mobile-menu icon-button" data-action="sidebar" aria-controls="showroom-sidebar" aria-expanded="false" aria-label="فهرست غرفه‌ها">${icon('menu')}</button>
    <a class="brand" href="#" aria-label="کاغذ، شروع بازار"><span class="brand-mark">${folded}</span><span class="brand-name">کاغذ<small>KAGHAZ</small></span></a>
    <nav class="main-nav" aria-label="ناوبری اصلی"><button data-action="view-market" class="active">گشت‌وگذار بازار</button><button data-action="view-catalog">کاتالوگ کالاها</button><button data-action="cut">چیدمان برش</button><button data-action="creator">غرفهٔ من</button></nav>
    <div class="header-actions"><details class="version-menu"><summary>نسخهٔ ۶</summary><div><a href="${versionUrl(5)}">نسخهٔ پنجم ${icon('arrow',13)}</a><a href="${versionUrl(4)}">نسخهٔ چهارم ${icon('arrow',13)}</a><a href="${versionUrl(3)}">نسخهٔ سوم ${icon('arrow', 13)}</a><a href="${versionUrl(2)}">نسخهٔ دوم ${icon('arrow', 13)}</a><a href="${versionUrl(1)}">نسخهٔ اول ${icon('arrow', 13)}</a></div></details>${btn('help', 'راهنمای بازار', 'info')}<button data-action="inquiry" class="inquiry-button">${icon('bag')}<span>فهرست استعلام</span><b id="inquiry-count">۰</b></button></div>
  </header>
  <div class="workspace">
    <aside class="sidebar" id="showroom-sidebar" aria-label="غرفه‌ها و جست‌وجوی کالا">
      <div class="sidebar-intro"><h2>فهرست غرفه‌ها</h2>${btn('sidebar', 'بستن فهرست', 'close')}</div>
      <label class="search-box">${icon('search', 18)}<input id="search" type="search" placeholder="کاغذ، گرماژ یا نام غرفه…" aria-label="جستجوی کالا و غرفه" autocomplete="off"/><kbd>/</kbd></label>
      <div class="section-heading"><h2>راسته‌ها</h2><span id="total-products">${number(products().length)} کالا</span></div>
      <div id="categories" class="categories"></div>
      <div class="section-heading vendor-heading"><h2>اهل این راسته</h2><span id="booth-count">${number(booths().length)} غرفه</span></div>
      <div id="booth-list" class="booth-list"></div>
      <button data-action="favorites" class="favorites-link">${icon('heart', 18)} نشان‌شده‌ها <span id="favorite-count">۰</span></button>
      <div class="sidebar-bottom"><span class="folded-corner"></span><div class="small-store">${icon('store', 24)}</div><strong>این‌جا جای شماست.</strong><p>غرفهٔ خودتان را بسازید.<br>با محصولات و هویت خودتان.</p><button data-action="creator">ساخت غرفه ${icon('arrow', 17)}</button></div>

    </aside>
    <main class="main-content" id="main-content">
      <div class="view-heading hall-heading">
        <div><div class="breadcrumb">${icon('location', 16)}<span>تهران · خیابان ظهیرالاسلام</span></div><h1 id="current-heading">پاساژ کاغذ بهارستان</h1></div>
        <div class="hall-heading-actions"><button data-action="sidebar" class="secondary-button">${icon('store', 17)} فهرست غرفه‌ها</button><button data-action="gallery" class="secondary-button render-link">${icon('film', 16)} گالری 4K</button></div>
      </div>
      <section class="scene-shell" aria-label="گردش سه‌بعدی در بازار">
        <div id="scene" class="scene" data-floor="0" style="--arrival: url('${renderImage('passage')}')"><div class="scene-loading" id="scene-loading"><span>در حال آماده‌سازی نمای زنده…</span></div></div>
        <div class="scene-topline"><div class="floor-group"><span class="scene-location" id="scene-location"><i></i> گردش زنده</span>
          <div class="floor-picker" aria-label="طبقات پاساژ"><button data-level="0" class="active" aria-pressed="true">همکف</button><button data-level="1" aria-pressed="false">طبقهٔ اول ↑</button></div></div><div class="scene-tools">${btn('shots', 'قاب‌های دوربین', 'film', 'aria-expanded="false" aria-controls="shot-panel"')}${btn('capture', 'ذخیرهٔ تصویر بازار', 'camera')}${btn('quality', 'کیفیت تصویر', 'settings')}${btn('fullscreen', 'تمام صفحه', 'expand')}</div></div>
        <div class="scene-editorial" id="scene-editorial"><button data-action="start">رفتن به اولین غرفه ${icon('arrow', 17)}</button></div>
        <div class="station-hotspots" id="station-hotspots">${STATION_IDS.map(id=>`<button data-live-station="${id}" data-station="${id}" style="--station:${HALL.stations[id].accent}" hidden>${icon(STATION_ART[id].icon,17)}${HALL.stations[id].label}<span>↗</span></button>`).join('')}</div>
        <div class="experience-bar"><button data-action="tour">${icon('play', 14)} بازدید راهنما</button><div class="lighting-controls" aria-label="نور محیط">${LIGHTING.map(p => `<button data-lighting="${p.id}" aria-pressed="${p.id === lighting}" class="${p.id === lighting ? 'active' : ''}">${p.label}</button>`).join('')}</div></div><div id="tour-panel" class="tour-panel" hidden></div>
        <div id="shot-panel" class="shot-panel" hidden><strong>قاب‌های دوربین</strong>${PHOTO_SHOTS.map(shot => `<button data-shot="${shot.id}">${shot.label} ${icon('arrow', 15)}</button>`).join('')}</div>
        <div id="hover-label" class="hover-label" hidden></div>
        <div id="booth-focus" class="booth-focus" hidden></div>
        <div class="scene-bottomline"><div class="navigation-controls"><div class="mode-switch"><button data-action="walk" class="active" aria-label="حالت قدم زدن" title="قدم زدن">${icon('walk', 18)}<span>قدم زدن</span></button><button data-action="orbit" aria-label="حالت نمای آزاد" title="نمای آزاد">${icon('orbit', 18)}<span>نمای آزاد</span></button></div>${btn('reset', 'بازگشت به ورودی', 'home')}</div><div class="walk-hint">${icon('keyboard', 17)}<span>روی کف بزنید تا حرکت کنید <b>·</b> برای نگاه کردن بکشید</span></div><button data-action="map" class="map-toggle">${icon('map', 17)} نقشهٔ طبقه</button></div>
        <div class="mini-map" id="mini-map" hidden></div>
        <div id="quality-panel" class="quality-panel" hidden></div>
        <div id="metrics" class="metrics" hidden></div>
        <div class="touch-controls" id="touch-controls"><button data-motion="0,1" aria-label="جلو">↑</button><div><button data-motion="-1,0" aria-label="چپ">←</button><button data-motion="0,-1" aria-label="عقب">↓</button><button data-motion="1,0" aria-label="راست">→</button></div></div>
        <div class="scene-caption"><span>طراحی الهام‌گرفته از پاساژهای کاغذ بهارستان</span><span id="light-caption">نور روز</span></div>
      </section>
      <section class="material-room" aria-labelledby="material-room-title">
        <div class="material-room-heading"><h2 id="material-room-title">نمونه‌خانهٔ کاغذ</h2><button class="text-button" data-action="specialty-catalog">دیدن کاتالوگ ${icon('arrow', 17)}</button></div>
        <div class="material-room-grid">${PROFILE_IDS.map(id => `<button class="material-tile" data-show-render="${id}">
          <img src="${renderImage(id)}" alt="" loading="lazy" decoding="async" />
          <span><strong>${MATERIAL_PROFILES[id].label}</strong>${icon('arrow', 16)}</span>
        </button>`).join('')}</div>
      </section>
      <section class="station-section" id="station-section" aria-label="کارگاه‌های پاساژ"><div class="station-heading"><h2>کارگاه‌های پاساژ</h2></div>
        <div class="station-dock">${STATION_IDS.map(id=>`<button data-station="${id}" class="station-card" style="--station:${HALL.stations[id].accent}">
          <span class="station-icon">${icon(STATION_ART[id].icon,23)}</span><span><strong>${HALL.stations[id].label}</strong><small>${STATION_ART[id].description}</small><small class="station-floor">${levelName(HALL.stations[id].level as Level)}</small></span>${icon('arrow',17)}
        </button>`).join('')}</div>
      </section>
      <section class="catalog-section" aria-label="کاتالوگ کالاها"><div class="catalog-heading"><div><h2 id="catalog-title">روی پیشخوان بازار <span id="result-count"></span></h2></div><div class="catalog-actions"><button data-action="clear-filters" class="text-button" id="clear-filter" hidden>حذف فیلترها</button><button data-action="view-catalog" class="text-button" id="all-catalog">همهٔ کالاها ${icon('arrow', 17)}</button></div></div><div id="material-filters" class="material-filters" aria-label="فیلتر جنس">
        <button data-profile-filter="all" aria-pressed="true">همهٔ جنس‌ها</button>
        ${PROFILE_IDS.map(id => `<button data-profile-filter="${id}" aria-pressed="false">${MATERIAL_PROFILES[id].label}</button>`).join('')}
      </div><div id="product-grid" class="product-grid"></div></section>
      <footer class="content-footer"><span>پاساژ کاغذ بهارستان</span><button data-action="help">دربارهٔ این تجربه ${icon('arrow', 14)}</button></footer>
    </main>
  </div>
  <div id="comparison-tray" class="comparison-tray" hidden></div>
  <dialog id="modal" class="modal"></dialog><div id="toast" class="toast" role="status" aria-live="polite"></div>
  <input type="file" id="restore-file" accept="application/json,.json" hidden/>
`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
function showLevel(level:Level) {
    activeLevel=level;
    el('scene').dataset.floor=String(level);
    document.querySelectorAll<HTMLButtonElement>('.floor-picker [data-level]').forEach(button=>{
        const selected=Number(button.dataset.level)===level;
        button.classList.toggle('active',selected);
        button.setAttribute('aria-pressed',String(selected));
    });
    if(!world)el('scene').style.setProperty('--arrival',`url('${renderImage(level === 0 ? 'passage' : 'balcony')}')`);
    renderMap();
}
function persist() { if (!saveState(state))
    toast('ذخیرهٔ مرورگر در دسترس نیست؛ از خروجی فایل استفاده کنید.'); updateCounts(); }
function updateCounts() { el('inquiry-count').textContent = number(state.inquiry.length); el('favorite-count').textContent = number(state.favorites.length); el('booth-count').textContent = `${number(booths().length)} غرفه`; el('total-products').textContent = `${number(products().length)} کالا`; }
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) { el('toast').textContent = message; el('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el('toast').classList.remove('show'), 3300); }
function renderSidebar() {
    el('categories').innerHTML = CATEGORIES.map(c => `<button class="category-button ${category === c.id ? 'active' : ''}" data-category="${c.id}" aria-pressed="${category === c.id}"><span>${icon(c.icon, 19)} ${c.label}</span><small>${number(c.id === 'all' ? products().length : products().filter(p => p.category === c.id).length)}</small></button>`).join('');
    el('booth-list').innerHTML = booths().filter(b => category === 'all' || b.category === category).map((b, i) => `<button class="vendor-button ${selectedBooth === b.id ? 'active' : ''}" data-booth="${b.id}"><span class="vendor-avatar" style="--vendor:${b.accent}">${icon('store', 17)}</span><span><strong>${esc(b.name)}</strong><small>${esc(b.subtitle)}</small></span>${icon('chevron', 14)}</button>`).join('');
    document.querySelector('[data-action="favorites"]')?.classList.toggle('active', favoriteFilter);
    updateCounts();
    renderMap();
}
function filteredProducts() {
    return searchProducts(products(), booths(), query, category, selectedBooth).filter(p =>
        (!favoriteFilter || state.favorites.includes(p.id)) && (!profileFilter || p.profile === profileFilter),
    );
}
function productDisplay(p: Product, large = false) {
    if (p.profile) {
        const label = MATERIAL_PROFILES[p.profile].title;
        return `<img class="product-render" src="${renderImage(p.profile)}" alt="نمونهٔ ${label}" ${large ? '' : 'loading="lazy"'} decoding="async" />`;
    }
    const plate = MATERIAL_PLATES[p.kind];
    if (!plate) return productArt(p, large);
    const description = REVIEW_VIEWS.find(view => view.id === plate)!.detail;
    const url = plate==='ream' ? hallImage(large?'ream':'ream-thumb') : large ? reviewImage(plate) : reviewThumb(plate);
    return `<img class="product-render" src="${url}" alt="${description}" ${large ? '' : 'loading="lazy"'} decoding="async" />`;
}
function renderProducts() {
    const result = filteredProducts(), visible = currentView === 'catalog' ? result : result.slice(0, 4);
    const filtered = Boolean(query || category !== 'all' || selectedBooth || favoriteFilter || profileFilter);
    for (const button of app.querySelectorAll<HTMLButtonElement>('[data-profile-filter]')) {
        button.setAttribute('aria-pressed', String(button.dataset.profileFilter === (profileFilter || 'all')));
    }
    el('clear-filter').hidden = !filtered;
    el('all-catalog').hidden = currentView === 'catalog';
    el('result-count').textContent = `${number(result.length)} کالا`;
    el('catalog-title').childNodes[0].textContent = favoriteFilter ? 'انتخاب‌های شما ' : selectedBooth ? `روی پیشخوان ${booths().find(b => b.id === selectedBooth)?.name} ` : 'روی پیشخوان بازار ';
    el('product-grid').innerHTML = visible.length ? visible.map(p => {
        const b = booths().find(b => b.id === p.boothId)!, favorite = state.favorites.includes(p.id), inq = state.inquiry.some(l => l.productId === p.id);
        return `<article class="product-card"><div class="product-art"><button class="product-open" data-product="${p.id}" aria-label="بررسی ${esc(p.name)}">${productDisplay(p)}</button><span class="product-kind">${p.grammage ? `${number(p.grammage)} گرم` : ''}</span><button class="favorite-button ${favorite ? 'saved' : ''}" data-favorite="${p.id}" aria-pressed="${favorite}" aria-label="نشان کردن ${esc(p.name)}">${icon('heart', 17)}</button><span class="art-annotation">${p.profile ? 'نمونهٔ خانواده' : MATERIAL_PLATES[p.kind] ? 'رندر جنس' : 'نمای مفهومی'}</span></div><div class="product-info"><button class="product-name" data-product="${p.id}">${esc(p.name)}</button><div class="product-meta">${esc(p.size)}<span>·</span>${esc(p.unit)}</div><div class="product-card-bottom"><button class="product-vendor" data-booth="${b.id}"><i style="background:${b.accent}"></i>${esc(b.name)}</button><button class="add-inquiry ${inq ? 'added' : ''}" data-add="${p.id}" title="${inq ? 'در فهرست استعلام' : 'افزودن به استعلام'}" aria-label="${inq ? 'در فهرست استعلام' : 'افزودن به استعلام'} ${esc(p.name)}">${icon(inq ? 'check' : 'plus', 17)}</button></div><button class="compare-product ${comparison.includes(p.id) ? 'active' : ''}" data-compare="${p.id}" aria-pressed="${comparison.includes(p.id)}">${icon('layers', 14)} ${comparison.includes(p.id) ? 'در مقایسه' : 'مقایسهٔ مشخصات'}</button></div></article>`;
    }).join('') : `<div class="empty-state">${icon(favoriteFilter ? 'heart' : 'search', 34)}<h3>${favoriteFilter ? 'هنوز چیزی نشان نکرده‌اید.' : 'کالایی با این مشخصات پیدا نشد.'}</h3><p>${favoriteFilter ? 'قلب کنار هر کالا، آن را اینجا نگه می‌دارد.' : 'نام کوتاه‌تر یا گرماژ دیگری را امتحان کنید.'}</p><button data-action="clear-filters" class="primary-button">بازگشت به راسته</button></div>`;
}
function setView(view: string) {
    currentView = view;
    app.classList.toggle('catalog-mode', view === 'catalog');
    document.querySelector('[data-action="view-market"]')?.classList.toggle('active', view === 'market');
    document.querySelector('.main-nav [data-action="view-catalog"]')?.classList.toggle('active', view === 'catalog');
    el('current-heading').textContent = view === 'catalog' ? 'کاتالوگ کالاها' : selectedBooth ? booths().find(b => b.id === selectedBooth)?.name || 'پاساژ کاغذ بهارستان' : 'پاساژ کاغذ بهارستان';
    renderProducts();
}
function clearFilters() { profileFilter = undefined; category = 'all'; query = ''; selectedBooth = undefined; favoriteFilter = false; el<HTMLInputElement>('search').value = ''; renderSidebar(); renderProducts(); el('booth-focus').hidden = true; el('current-heading').textContent = currentView === 'catalog' ? 'کاتالوگ کالاها' : 'پاساژ کاغذ بهارستان'; }
function selectBooth(id: string, focus = true) {
    const b = booths().find(b => b.id === id);
    if (!b)
        return;
    selectedBooth = id;
    profileFilter = undefined;
    favoriteFilter = false;
    category = 'all';
    query = '';
    el<HTMLInputElement>('search').value = '';
    setView('market');
    renderSidebar();
    renderProducts();
    el('scene-editorial').classList.add('dismissed');
    if (focus && world) {
        mode='walk';
        updateMode();
        world.focusBooth(id);
    }
    el('current-heading').textContent = b.name;
    el('booth-focus').hidden = false;
    el('booth-focus').innerHTML = `<div class="booth-focus-top"><span class="eyebrow">غرفهٔ ${number(b.slot + 1)}</span>${btn('dismiss-booth', 'بستن اطلاعات غرفه', 'close')}</div><h3>${esc(b.name)}</h3><p>${esc(b.subtitle)}</p><div class="booth-focus-meta"><span>${number(products().filter(p => p.boothId === id).length)} کالای نمایشی</span><span>کاتالوگ نمونه</span></div><div class="booth-focus-actions"><button data-enter="${b.id}" class="primary-button">ورود به غرفه ${icon('arrow', 16)}</button><button data-catalog="${b.id}" class="secondary-button">دیدن کالاها</button></div>${b.catalogKey ? `<button class="text-button attached-catalog" data-pdf="${b.id}">${icon('paper', 15)} باز کردن کاتالوگ PDF</button>` : ''}`;
    setSidebar(false);
    renderMap();
}
function toggleFavorite(id: string) { state.favorites = state.favorites.includes(id) ? state.favorites.filter(p => p !== id) : [...state.favorites, id]; persist(); renderProducts(); document.querySelector(`[data-modal-favorite="${id}"]`)?.classList.toggle('saved', state.favorites.includes(id)); }
function addInquiry(id: string) {
    const p = products().find(p => p.id === id);
    if (!p)
        return;
    if (state.inquiry.some(l => l.productId === id)) {
        showInquiry();
        return;
    }
    state.inquiry.push({ productId: id, quantity: p.minOrder });
    persist();
    renderProducts();
    toast(`${p.name} به فهرست استعلام اضافه شد.`);
    const button = document.querySelector(`[data-modal-add="${id}"]`);
    if (button)
        button.innerHTML = `${icon('check', 18)} در فهرست استعلام`;
}
const modal = el<HTMLDialogElement>('modal');
let previousFocus: HTMLElement | null = null, modalRevision=0;
function setSidebar(open:boolean) {
    app.classList.toggle('sidebar-open',open);
    app.querySelector('[aria-controls="showroom-sidebar"]')?.setAttribute('aria-expanded',String(open));
}
function openModal(content: string, cls = '') {
    modalRevision++;
    studioCleanup?.();
    studioCleanup = undefined; studio = undefined;
    if (!modal.open)
        previousFocus = document.activeElement as HTMLElement;
    modal.className = `modal ${cls}`;
    modal.innerHTML = content;
    world?.setMotion(0, 0);
    if (!modal.open)
        modal.showModal();
}
function closeModal() { modalRevision++;studioCleanup?.(); studioCleanup = undefined; studio = undefined; modal.close(); previousFocus?.focus({ preventScroll: true }); }
modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
modal.addEventListener('click', e => { if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeModal();
} });
function modalHead(eyebrow: string, title: string) { return `<div class="modal-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>${btn('close', 'بستن پنجره', 'close')}</div>`; }
async function showProduct(id: string) {
    const p = products().find(product => product.id === id);
    if (!p) return;
    const b = booths().find(booth => booth.id === p.boothId)!;
    const inInquiry = state.inquiry.some(line => line.productId === id);
    const profile = p.profile ? MATERIAL_PROFILES[p.profile] : undefined;
    const plate = p.profile || MATERIAL_PLATES[p.kind];
    const sheet = ['ream', 'sheet', 'kraft', 'swatch'].includes(p.kind);
    openModal(`${modalHead('میز بررسی جنس', esc(p.name))}
        <div class="product-dialog-body">
          <div class="studio-wrap">
            <div class="studio-heading"><span>${icon('cube', 16)} نمونهٔ جنس</span><small id="studio-status">${plate ? 'رندر Blender' : 'تصویر مفهومی'}</small></div>
            <div id="product-studio" class="product-studio" data-inspection="whole">${productDisplay(p, true)}</div>
            <div class="inspection-tools">
              <div class="inspection-views" aria-label="نمای بررسی">${INSPECTION_VIEWS.map(v => `<button data-inspection="${v.id}" class="${v.id === 'whole' ? 'active' : ''}" aria-pressed="${v.id === 'whole'}" ${!plate && v.id !== 'whole' ? 'disabled' : ''}>${v.label}</button>`).join('')}</div>
              <div class="inspection-sliders" id="inspection-sliders" hidden>
                <label>${icon('sun', 16)} زاویهٔ نور <output id="angle-output">۳۴°</output><input id="studio-angle" type="range" min="7" max="76" step="1" value="34" /></label>
                ${p.profile === 'foil' ? '' : `<label>${icon('layers', 16)} فاصلهٔ اجزا <output id="separation-output">۰٪</output><input id="studio-separation" type="range" min="0" max="100" step="1" value="0" /></label>`}
              </div>
            </div>
            <p class="studio-foot">${profile?.inspection || MATERIAL_NOTES[p.kind]} مدل و رندر، نمایندهٔ خانوادهٔ کالا هستند.</p>
          </div>
          <div class="product-detail">
            <button class="detail-vendor" data-booth="${b.id}" data-close-first="true"><i style="background:${b.accent}"></i>${esc(b.name)} ${icon('chevron', 15)}</button>
            <p class="product-description">${esc(p.detail)}</p>
            <dl class="specifications"><div><dt>${p.profile === 'labels' ? 'گرماژ رویه' : 'گرماژ'}</dt><dd>${number(p.grammage)} گرم بر مترمربع</dd></div><div><dt>ابعاد</dt><dd>${esc(p.size)}</dd></div><div><dt>واحد سفارش</dt><dd>${esc(p.unit)}</dd></div><div><dt>حداقل سفارش نمونه</dt><dd>${number(p.minOrder)} ${esc(p.unit)}</dd></div></dl>
            <div class="detail-actions"><button class="primary-button" data-modal-add="${p.id}">${icon(inInquiry ? 'check' : 'plus', 18)} ${inInquiry ? 'در فهرست استعلام' : 'افزودن به استعلام'}</button><button class="favorite-button detail-favorite ${state.favorites.includes(id) ? 'saved' : ''}" data-modal-favorite="${id}" aria-label="نشان کردن کالا" aria-pressed="${state.favorites.includes(id)}">${icon('heart', 20)}</button></div>
            ${sheet ? `<button class="text-button detail-cut" data-cut-product="${p.id}">${icon('grid', 16)} محاسبهٔ چیدمان برش ${icon('arrow', 15)}</button>` : ''}
            ${p.profile
                ? `<button class="text-button detail-cut" data-show-render="${p.profile}">${icon('search', 16)} رندر کامل و بزرگ‌نمایی ${icon('arrow', 15)}</button>`
                : `<button class="text-button detail-cut" data-proof-product="${p.id}">${icon('sun', 16)} دیدن چاپ روی این جنس ${icon('arrow', 15)}</button>`}
          </div>
        </div>`, 'product-modal');
    const revision = modalRevision, assets = world?.assets;
    if (!assets) return;
    try {
        const { mountStudio } = await import('./scene/studio.ts');
        if (!modal.open || modalRevision !== revision) return;
        const host = el('product-studio');
        const control = mountStudio(host, p, assets, () => {
            host.classList.add('studio-live');
            el('studio-status').textContent = 'مدل زنده · بکشید و بزرگ کنید';
            el('inspection-sliders').hidden = false;
            modal.querySelectorAll<HTMLButtonElement>('button[data-inspection]').forEach(button => { button.disabled = false; });
        });
        control.setView(host.dataset.inspection as InspectionView);
        studio = control;
        studioCleanup = () => control.dispose();
    } catch {
        // The rendered plate is already in place for browsers without a second WebGL context.
    }
}
function showInquiry() {
    openModal(`${modalHead('انتخاب‌های شما', 'فهرست استعلام')}<p class="modal-description">کالاها را کنار هم بگذارید و درخواست خود را آماده کنید.</p><div class="inquiry-note">${icon('info', 17)} این یک پیش‌نویس محلی است و به فروشنده ارسال نمی‌شود.</div><div class="inquiry-lines">${state.inquiry.length ? state.inquiry.map(l => {
        const p = products().find(p => p.id === l.productId);
        if (!p)
            return '';
        const b = booths().find(b => b.id === p.boothId);
        return `<div class="inquiry-line"><div class="inquiry-art">${productArt(p)}</div><div class="inquiry-line-info"><strong>${esc(p.name)}</strong><small>${esc(b?.name)} · ${esc(p.unit)}</small><label>تعداد <input type="text" inputmode="numeric" data-quantity="${p.id}" value="${number(l.quantity)}" aria-label="تعداد ${esc(p.name)}"/></label></div><button class="icon-button" data-remove="${p.id}" aria-label="حذف ${esc(p.name)}">${icon('trash', 18)}</button></div>`;
    }).join('') : `<div class="empty-state">${icon('bag', 38)}<h3>پیشخوان شما هنوز خالی است.</h3><p>از کنار هر کالا، آن را به این فهرست اضافه کنید.</p><button class="primary-button" data-action="close">ادامهٔ گشت‌وگذار</button></div>`}</div>${state.inquiry.length ? `<label class="field-label">توضیحات درخواست<textarea id="inquiry-notes" maxlength="3000" rows="3" placeholder="مثلاً: محل تحویل، زمان مورد نیاز، نوع بسته‌بندی…">${esc(state.notes)}</textarea></label><div class="modal-footer"><button class="primary-button" data-action="download-inquiry">${icon('download', 17)} دریافت فایل درخواست</button><button class="secondary-button" data-action="copy-inquiry">${icon('copy', 17)} کپی متن</button></div>` : ''}`, 'inquiry-modal');
}
function renderMap() {
    const rooms=booths().filter(booth=>boothPose(booth.slot).level===activeLevel);
    const floor=levelName(activeLevel);
    el('mini-map').innerHTML=`<div class="map-heading"><strong>${floor}</strong>${btn('map','بستن نقشه','close')}</div>
        <svg viewBox="0 0 200 195" role="group" aria-label="نقشهٔ ${floor}">
        <rect x="43" y="10" width="114" height="176" fill="#eae4d6" stroke="#cfc7b5" rx="6"/>
        ${activeLevel===1?'<rect x="89" y="34" width="22" height="121" rx="2" fill="#bcc4bc" stroke="#868f82" stroke-dasharray="3 3"/>':''}
        ${rooms.map(b=>{
            const p=boothPose(b.slot),x=MAP.x(p.x),z=MAP.y(p.z);
            return `<g data-map-booth="${b.id}" tabindex="0" role="button" aria-label="رفتن به ${esc(b.name)}"><rect x="${x-13}" y="${z-9}" width="26" height="18" rx="3" fill="${b.accent}" opacity="${b.id===selectedBooth?1:.67}"/><text x="${x}" y="${z+4}" text-anchor="middle" fill="white" font-size="9">${number(b.slot+1)}</text></g>`;
        }).join('')}
        ${STATION_IDS.filter(id=>HALL.stations[id].level===activeLevel).map(id=>{
            const [x,z]=HALL.stations[id].position;
            return `<g data-map-station="${id}" tabindex="0" role="button" aria-label="${HALL.stations[id].label}"><circle cx="${MAP.x(x*.48)}" cy="${MAP.y(z)}" r="5.4" fill="${HALL.stations[id].accent}" stroke="#fff" stroke-width="1.3"/></g>`;
        }).join('')}
        <rect x="94" y="32" width="12" height="34" rx="2" fill="#66766d"/>
        <circle id="map-player" cx="${MAP.x(HALL.entry[0])}" cy="${MAP.y(HALL.entry[2])}" r="3.7" fill="#23483d" stroke="#fff" stroke-width="1.45" pointer-events="none"/>
        </svg>
        <button class="text-button map-stairs" data-level="${activeLevel?0:1}">${icon('walk',15)} رفتن به ${levelName(activeLevel?0:1)}</button>`;
}
function renderQuality() {
    el('quality-panel').innerHTML = `<div class="map-heading"><strong>کیفیت تصویر</strong>${btn('quality', 'بستن تنظیمات', 'close')}</div>${([['auto', 'خودکار', 'با توجه به دستگاه شما'], ['high', 'جزئیات بیشتر', 'سایه و عمق بیشتر'], ['balanced', 'متعادل', 'انتخاب مناسب بیشتر دستگاه‌ها'], ['low', 'سبک', 'برای موبایل و دستگاه ضعیف']] as const).map(([id, title, desc]) => `<button data-quality="${id}" class="quality-option ${state.quality === id ? 'active' : ''}"><span><strong>${title}</strong><small>${desc}</small></span>${state.quality === id ? icon('check', 16) : ''}</button>`).join('')}<button class="diagnostic-toggle" data-action="diagnostics">${icon('settings', 14)} نمایش آمار واقعی رندر</button>`;
}
function showHelp() { openModal(`${modalHead('خوش آمدید', 'بازار را کشف کنید.')}<div class="help-intro"><span class="help-icon">${icon('walk', 34)}</span><p>در راسته قدم بزنید؛ روی نام غرفه یا نمونهٔ روی پیشخوان بزنید و جنس را از نزدیک ببینید.</p></div><div class="help-grid"><div>${icon('walk', 23)}<strong>قدم زدن</strong><p>روی کف راهرو بزنید یا با جهت‌های صفحه‌کلید حرکت کنید. تصویر را برای تغییر نگاه بکشید.</p></div><div>${icon('store', 23)}<strong>غرفه و کالا</strong><p>از فهرست غرفه‌ها یا نقشهٔ طبقه به فروشگاه بروید. «ورود به غرفه» شما را از کنار پیشخوان داخل می‌برد.</p></div><div>${icon('bag', 23)}<strong>فهرست استعلام</strong><p>محصول‌ها را انتخاب کنید، تعداد بدهید و متن یا فایل درخواست را دریافت کنید. این نسخه ارسال سفارش ندارد.</p></div><div>${icon('cube', 23)}<strong>غرفهٔ شما</strong><p>نام، محصولات، فایل PDF و مدل GLB خود را وارد کنید. داده‌ها روی همین دستگاه و مرورگر نگه داشته می‌شوند.</p></div></div><div class="demo-disclosure"><strong>حدود این نسخه</strong><p>فضا از بازار بهارستان الهام گرفته شده و نام غرفه‌ها و کالاها برای نمایش‌اند. اطلاعات غرفهٔ شخصی، PDF و مدل روی همین مرورگر ذخیره می‌شوند.</p></div><div class="modal-footer"><button data-action="close" class="primary-button">برویم به راسته ${icon('arrow', 17)}</button><button data-action="export-workspace" class="text-button">پشتیبان انتخاب‌های من</button></div>`, 'help-modal'); }
function showCreator(editId?: string) {
    const b = editId === 'new' ? undefined : state.customBooths.find(b => b.id === editId) || state.customBooths[0];
    const ownProducts = b ? state.customProducts.filter(p => p.boothId === b.id) : [];
    const defaultAccent = b?.accent || '#456552';
    openModal(`${modalHead('راسته با شما کامل می‌شود', 'غرفهٔ خودتان را بسازید.')}<p class="modal-description">هویت غرفه، کالاها و مدل خودتان را وارد این بازار کنید.</p><div class="creator-tabs"><span class="active">۱. هویت و محصولات</span><span>۲. مدل و کاتالوگ</span></div><form id="creator-form" data-edit="${b?.id || ''}"><div class="creator-layout"><div class="creator-fields"><label class="field-label">نام غرفه<input name="name" required maxlength="40" placeholder="مثلاً: کاغذ پارس" value="${esc(b?.name || '')}"/></label><label class="field-label">توضیح کوتاه<input name="subtitle" required maxlength="110" placeholder="تخصص و جنس‌های شما…" value="${esc(b?.subtitle || '')}"/></label><div class="form-row"><label class="field-label">راسته<select name="category">${CATEGORIES.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${b?.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label><label class="field-label color-field">رنگ هویت<input name="accent" type="color" value="${defaultAccent}"/></label></div><label class="field-label">نام اولین محصول<input name="productName" required maxlength="70" placeholder="مثلاً: تحریر A4 ممتاز" value="${esc(ownProducts[0]?.name || '')}"/></label><div class="form-row"><label class="field-label">گرماژ<input name="grammage" inputmode="numeric" value="${ownProducts[0]?.grammage || 80}" required/></label><label class="field-label">نوع نمایش<select name="kind">${[['ream', 'بند کاغذ'], ['sheet', 'ورق کاغذ / مقوا'], ['swatch', 'نمونهٔ رنگ'], ['box', 'جعبه'], ['roll', 'رول کاغذ'], ['kraft', 'کرافت']].map(([v, l]) => `<option value="${v}" ${ownProducts[0]?.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div><div class="form-row"><label class="field-label">اندازه<input name="size" value="${esc(ownProducts[0]?.size || 'A4')}" maxlength="35" required/></label><label class="field-label">واحد فروش<input name="unit" value="${esc(ownProducts[0]?.unit || 'بند ۵۰۰ برگی')}" maxlength="35" required/></label></div></div><div class="creator-preview" style="--preview-accent:${defaultAccent}"><span class="eyebrow">پیش‌نمایش هویت غرفه</span><div class="booth-preview-art"><div class="booth-preview-sign" id="preview-name">${esc(b?.name || 'غرفهٔ شما')}</div><div class="booth-preview-shelves"><i></i><i></i><i></i></div><div class="booth-preview-desk"></div></div><strong>در کنار اهل راسته.</strong><p>غرفه پس از ذخیره در انتهای راسته قرار می‌گیرد. نام و رنگ شما روی تابلوی سه‌بعدی هم دیده می‌شود.</p><span class="local-badge">${icon('check', 14)} ذخیره روی همین مرورگر</span></div></div><div class="creator-attachments"><h3>مدل و کاتالوگ اختصاصی</h3><div class="attachment-grid"><label class="upload-tile">${icon('cube', 27)}<strong>${b?.modelKey ? 'جایگزینی مدل سه‌بعدی' : 'افزودن مدل سه‌بعدی'}</strong><span>GLB مستقل · حداکثر ۲۵ MB</span><input type="file" name="model" accept=".glb"/><small class="file-name">یک شیء اسکن‌شده را در غرفه نمایش دهید</small></label><label class="upload-tile">${icon('paper', 27)}<strong>${b?.catalogKey ? 'جایگزینی کاتالوگ' : 'افزودن کاتالوگ'}</strong><span>PDF · حداکثر ۱۰ MB</span><input type="file" name="catalog" accept=".pdf,application/pdf"/><small class="file-name">فایل محصولات واقعی شما</small></label></div><p class="field-help">مدل در یک بخش از غرفه قرار می‌گیرد؛ ورودی اسکن کامل فروشگاه و انتشار عمومی به خط پردازش و سرور نیاز دارد. فایل‌ها روی همین دستگاه ذخیره می‌شوند.</p></div><div class="creator-current">${state.customBooths.length ? `<span>غرفه‌های شما: </span>${state.customBooths.map(c => `<button type="button" data-edit-booth="${c.id}" class="text-button">${esc(c.name)}</button>`).join('')}${state.customBooths.length < 2 ? '<button type="button" data-action="new-booth" class="text-button">+ غرفهٔ دوم</button>' : ''}` : ''}</div><p id="creator-error" class="form-error" role="alert" hidden></p><div class="modal-footer"><button type="submit" class="primary-button">${icon('store', 18)} ${b ? 'ذخیرهٔ تغییرات' : 'ساختن غرفه در راسته'}</button>${b ? `<button type="button" data-delete-booth="${b.id}" class="text-button danger">حذف غرفه</button>` : ''}<button type="button" data-action="restore-workspace" class="text-button">ورود فایل پشتیبان</button></div></form>`, 'creator-modal');
    if (b) {
        const manage = document.createElement("button");
        manage.type = "button";
        manage.className = "secondary-button";
        manage.dataset.manageProducts = b.id;
        manage.innerHTML = icon("layers", 16) + " مدیریت کالاهای این غرفه";
        modal.querySelector(".creator-current")?.append(manage);
    }
}
function showProductManager(boothId: string, productId?: string) {
    const b = state.customBooths.find(b => b.id === boothId);
    if (!b)
        return;
    const own = state.customProducts.filter(p => p.boothId === b.id), p = own.find(p => p.id === productId);
    openModal(`${modalHead(esc(b.name), 'کالاهای غرفهٔ شما')}<p class="modal-description">مشخصات کالا را خودتان وارد کنید. این اطلاعات روی همین مرورگر نگه داشته می‌شود.</p><div class="managed-products">${own.map(p => `<div><span><strong>${esc(p.name)}</strong><small>${number(p.grammage)} گرم · ${esc(p.unit)}</small></span><button class="text-button" data-edit-custom-product="${p.id}">ویرایش</button><button class="icon-button" data-delete-product="${p.id}" aria-label="حذف ${esc(p.name)}">${icon('trash', 16)}</button></div>`).join('')}</div><form id="product-manager-form" data-booth="${b.id}" data-product-id="${p?.id || ''}"><h3 class="manager-title">${p ? 'ویرایش کالا' : 'افزودن کالای تازه'}</h3><label class="field-label">نام کالا<input name="name" maxlength="70" required value="${esc(p?.name || '')}" placeholder="نام دقیق محصول شما"/></label><div class="form-row"><label class="field-label">گرماژ<input name="grammage" inputmode="numeric" required value="${p?.grammage || 80}"/></label><label class="field-label">نوع نمایش<select name="kind">${[['ream', 'بند کاغذ'], ['sheet', 'ورق کاغذ / مقوا'], ['swatch', 'نمونهٔ رنگ'], ['box', 'جعبه'], ['roll', 'رول کاغذ'], ['kraft', 'کرافت'], ['notebook', 'دفتر']].map(([v, l]) => `<option value="${v}" ${p?.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="field-label color-field">رنگ<input name="color" type="color" value="${p?.color || '#e7dfce'}"/></label></div><div class="form-row"><label class="field-label">ابعاد<input name="size" maxlength="35" required value="${esc(p?.size || 'A4')}"/></label><label class="field-label">واحد فروش<input name="unit" maxlength="35" required value="${esc(p?.unit || 'بسته')}"/></label><label class="field-label">حداقل تعداد<input name="minimum" inputmode="numeric" value="${p?.minOrder || 1}"/></label></div><label class="field-label">توضیح محصول<textarea name="detail" maxlength="500" rows="3">${esc(p?.detail || '')}</textarea></label><div class="modal-footer"><button type="submit" class="primary-button">${icon('plus', 17)} ${p ? 'ذخیرهٔ کالا' : 'افزودن کالا'}</button><button type="button" data-edit-booth="${b.id}" class="text-button">تنظیمات غرفه ${icon('arrow', 16)}</button></div></form>`, 'product-manager-modal');
}
async function saveManagedProduct(form: HTMLFormElement) {
    const b = state.customBooths.find(b => b.id === form.dataset.booth);
    if (!b)
        return;
    const data = new FormData(form), id = form.dataset.productId;
    if (!id && state.customProducts.length >= 40) {
        toast('در این نسخه حداکثر ۴۰ محصول شخصی ذخیره می‌شود.');
        return;
    }
    const p: Product = { id: id || `custom-${crypto.randomUUID().slice(0, 12)}`, boothId: b.id, name: String(data.get('name')).trim().slice(0, 70), category: b.category, kind: data.get('kind') as Product['kind'], grammage: Math.min(1200, quantity(data.get('grammage'))), color: String(data.get('color')), size: String(data.get('size')).slice(0, 35), unit: String(data.get('unit')).slice(0, 35), detail: String(data.get('detail')).slice(0, 500), minOrder: quantity(data.get('minimum')), sample: true };
    if (id)
        state.customProducts = state.customProducts.map(x => x.id === id ? p : x);
    else
        state.customProducts.push(p);
    persist();
    world?.setBooths(booths(), products());
    await restoreModels();
    renderSidebar();
    renderProducts();
    showProductManager(b.id);
    toast('کالای غرفه ذخیره شد.');
}
async function saveCreator(form: HTMLFormElement) {
    const data = new FormData(form);
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const error = el('creator-error');
    error.hidden = true;
    const old = state.customBooths.find(b => b.id === form.dataset.edit);
    if (!old && state.customBooths.length >= 2) {
        error.textContent = 'در نسخهٔ نمایشی دو غرفهٔ شخصی می‌توانید بسازید.';
        error.hidden = false;
        return;
    }
    const name = String(data.get('name') || '').trim(), subtitle = String(data.get('subtitle') || '').trim();
    if (!name || !subtitle)
        return;
    const model = data.get('model') as File, catalog = data.get('catalog') as File;
    submit.disabled = true;
    submit.textContent = 'در حال آماده کردن غرفه…';
    try {
        if (model.size) {
            if (model.size > 25 * 1024 * 1024)
                throw new Error('حجم مدل باید حداکثر ۲۵ مگابایت باشد.');
            if (!world)
                throw new Error('برای نمایش مدل ابتدا نمایش سه‌بعدی باید در دسترس باشد.');
            const { inspectGLB } = await import('./scene/importer.ts');
            inspectGLB(await model.arrayBuffer());
        }
        if (catalog.size) {
            if (catalog.size > 10 * 1024 * 1024)
                throw new Error('حجم کاتالوگ باید کمتر از ۱۰ مگابایت باشد.');
            if (!new TextDecoder().decode(await catalog.slice(0, 5).arrayBuffer()).startsWith('%PDF-'))
                throw new Error('فایل کاتالوگ باید PDF معتبر باشد.');
        }
        const b: Booth = { id: old?.id || `custom-${crypto.randomUUID().slice(0, 12)}`, name, subtitle, category: data.get('category') as Booth['category'], accent: String(data.get('accent')), slot: old?.slot ?? 8 + state.customBooths.length, custom: true, ...(old?.modelKey ? { modelKey: old.modelKey } : {}), ...(old?.catalogKey ? { catalogKey: old.catalogKey } : {}) };
        const existing = state.customProducts.find(p => p.boothId === b.id);
        const product: Product = { id: existing?.id || `${b.id}-product`, boothId: b.id, name: String(data.get('productName')).trim(), category: b.category, kind: data.get('kind') as Product['kind'], grammage: Math.min(1200, quantity(data.get('grammage'))), size: String(data.get('size')), unit: String(data.get('unit')), color: b.accent, detail: 'مشخصات توسط صاحب این غرفه در همین مرورگر وارد شده است.', minOrder: 1, sample: true };
        if (catalog.size) {
            await putAsset(`catalog:${b.id}`, catalog);
            b.catalogKey = `catalog:${b.id}`;
        }
        const oldBooths = [...state.customBooths], oldProducts = [...state.customProducts];
        if (old)
            state.customBooths = state.customBooths.map(x => x.id === old.id ? b : x);
        else
            state.customBooths.push(b);
        if (existing)
            state.customProducts = state.customProducts.map(p => p.id === existing.id ? product : p);
        else
            state.customProducts.push(product);
        world?.setBooths(booths(), products());
        try {
            if (model.size) {
                const result = await world!.attachModel(b.id, model);
                await putAsset(`model:${b.id}`, model);
                b.modelKey = `model:${b.id}`;
                toast(`مدل آماده شد: ${result}`);
            }
        }
        catch (e) {
            state.customBooths = oldBooths;
            state.customProducts = oldProducts;
            world?.setBooths(booths(), products());
            await restoreModels();
            throw e;
        }
        persist();
        renderSidebar();
        renderProducts();
        await restoreModels();
        closeModal();
        selectBooth(b.id);
        toast('غرفهٔ شما در انتهای راسته آماده است.');
    }
    catch (e) {
        error.textContent = (e as Error).message || 'ذخیرهٔ فایل انجام نشد.';
        error.hidden = false;
    }
    finally {
        submit.disabled = false;
        submit.innerHTML = `${icon('store', 18)} ${old ? 'ذخیرهٔ تغییرات' : 'ساختن غرفه در راسته'}`;
    }
}
async function restoreModels() { for (const b of state.customBooths) {
    if (b.modelKey && world) {
        try {
            const blob = await getAsset(b.modelKey);
            if (blob)
                await world.attachModel(b.id, blob);
        }
        catch {
            toast(`مدل ${b.name} بازیابی نشد؛ می‌توانید دوباره وارد کنید.`);
        }
    }
} }
async function openPDF(id: string) { const b = booths().find(b => b.id === id); if (!b?.catalogKey)
    return; try {
    const file = await getAsset(b.catalogKey);
    if (!file) {
        toast('کاتالوگ روی این دستگاه موجود نیست.');
        return;
    }
    download(`Kaghaz-${b.id}-catalog.pdf`, file);
}
catch {
    toast('کاتالوگ خوانده نشد.');
} }
function galleryCaption(view: GalleryView) {
    const profile = MATERIAL_PROFILES[view.id as MaterialProfileId];
    return `<div><strong id="gallery-title">${view.title}</strong><p id="gallery-description">${view.detail}</p></div>
        ${profile ? `<button class="secondary-button" data-product="${profile.lead}">${icon('cube', 16)} مدل سه‌بعدی</button>` : ''}
        <button data-action="gallery-zoom" class="secondary-button" aria-pressed="false">${icon('search', 16)} بزرگ‌نمایی</button>
        <a class="text-button" id="gallery-download" download="Kaghaz-${view.id}.webp" href="${view.url}">${icon('download', 16)} تصویر کامل</a>`;
}
function showGallery(id?: string) {
    const first = GALLERY.find(view => view.id === id) || GALLERY[0];
    openModal(`${modalHead('Blender · Cycles', 'گالری پاساژ و جنس')}
        <div class="render-gallery">
          <figure class="gallery-figure">
            <div class="gallery-stage" tabindex="0" aria-label="نمای رندر"><img class="review-image" src="${first.thumb}" data-full="${first.url}" data-thumb="${first.thumb}" alt="${first.detail}" /></div>
            <figcaption class="gallery-caption" id="gallery-caption">${galleryCaption(first)}</figcaption>
          </figure>
          <div class="review-tabs gallery-rail" aria-label="قاب‌ها">${GALLERY.map(view => `<button data-review="${view.id}" aria-pressed="${view.id === first.id}">
            <img src="${view.thumb}" alt="" loading="lazy" decoding="async" /><span>${view.title}</span></button>`).join('')}</div>
        </div>
        <details class="gallery-archive"><summary>رندرهای بررسی کالا از نسخه‌های قبلی</summary>
          <div>${GALLERY_ARCHIVE.map(view => `<a href="${view.url}" target="_blank" rel="noopener">${view.title} ${icon('arrow', 14)}</a>`).join('')}</div>
        </details>`, 'gallery-modal v6-gallery');
    modal.querySelector('[data-review][aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function selectGalleryFrame(view: GalleryView) {
    const stage = modal.querySelector<HTMLElement>('.gallery-stage')!;
    const img = stage.querySelector<HTMLImageElement>('.review-image')!;
    stage.classList.remove('zoomed');
    stage.scrollTo(0, 0);
    img.dataset.full = view.url;
    img.dataset.thumb = view.thumb;
    img.src = view.thumb;
    img.alt = view.detail;
    el('gallery-caption').innerHTML = galleryCaption(view);
    for (const button of modal.querySelectorAll<HTMLButtonElement>('[data-review]')) {
        button.setAttribute('aria-pressed', String(button.dataset.review === view.id));
    }
}
function showStation(id:StationId,product?:Product) {
    const place=HALL.stations[id],floor=levelName(place.level as Level);
    const footer=`<div class="lab-footer">${world?`<button class="text-button" data-visit-station="${id}">${icon('location',16)} رفتن به میز در پاساژ</button>`:''}
        <button class="text-button" data-action="all-stations">${icon('grid',16)} کارگاه‌های پاساژ</button></div>`;
    if(id==='samples'){
        const cards = ['a4-80', ...PROFILE_IDS.map(key => MATERIAL_PROFILES[key].lead)]
            .map(key => PRODUCTS.find(item => item.id === key)!);
        openModal(`${modalHead(floor,place.label)}<div class="lab-samples">${cards.map(p=>`<article>
            <button data-product="${p.id}" class="sample-art">${productDisplay(p)}</button><h3>${esc(p.name)}</h3>
            <span>${number(p.grammage)} گرم بر مترمربع</span><div><button class="secondary-button" data-product="${p.id}">بررسی جنس</button><button class="icon-button" data-proof-product="${p.id}" title="نور و چاپ" aria-label="نور و چاپ ${esc(p.name)}">${icon('sun',18)}</button></div>
        </article>`).join('')}</div>${footer}`,'lab-modal');
        return;
    }
    if(id==='fold'||id==='proof'){
        const content=id==='fold'?foldingMarkup():proofMarkup(surfaceForProduct(product?.kind));
        openModal(`${modalHead(floor,id==='fold'?'ساخت و تا زدن جعبه':'مقایسهٔ نور و چاپ')}${content}${footer}`,'lab-modal');
        studioCleanup=id==='fold'?mountFold(modal):mountProof(modal);
        return;
    }
    openModal(`${modalHead(floor,passageToolTitle(id))}${passageToolMarkup(id)}${footer}`,'lab-modal');
    const work=mountPassageTool(modal,id),revision=modalRevision,source=world?.assets;
    let viewer:StudioControl|undefined;
    studioCleanup=()=>{work.dispose();viewer?.dispose();};
    if(id==='unwrap'&&source)void import('./scene/studio.ts').then(({mountStudio})=>{
        if(!modal.open||modalRevision!==revision)return;
        const stage=el('passage-stage'),ream=PRODUCTS.find(p=>p.id==='a4-80')!;
        viewer=mountStudio(stage,ream,source,()=>{
            stage.classList.add('package-live');
            work.attach((film,straps)=>viewer?.setWrap(film,straps));
        },'wrapped-stock-pallet');
    }).catch(()=>{});
}
function showCut(product?: Product) {
    openModal(`${modalHead(product ? esc(product.name) : 'محاسبهٔ ورق', 'چیدمان برش')}${cutForm(product)}`, 'cut-modal');
    const form = el<HTMLFormElement>('cut-form'), result = el('cut-result');
    form.addEventListener('input', () => updateCut(form, result));
    form.addEventListener('submit', event => event.preventDefault());
    updateCut(form, result);
}
function renderComparisonTray() {
    comparison=comparison.filter(id=>products().some(p=>p.id===id));
    const tray=el('comparison-tray');tray.hidden=!comparison.length;
    tray.innerHTML=`<span>${icon('layers',18)} ${number(comparison.length)} از ۳ کالا</span><div>${comparison.map(id=>`<button data-compare="${id}" title="حذف از مقایسه">${esc(products().find(p=>p.id===id)?.name)} ${icon('close',12)}</button>`).join('')}</div><button data-action="compare" class="primary-button">مقایسه</button><button data-action="clear-comparison" class="icon-button" aria-label="خالی کردن مقایسه">${icon('close',17)}</button>`;
}
function showComparison() {
    const selected=comparison.map(id=>products().find(p=>p.id===id)).filter((p):p is Product=>Boolean(p));
    const rows:[string,(p:Product)=>string][]=[['غرفه',p=>booths().find(b=>b.id===p.boothId)?.name||''],['گرماژ',p=>`${number(p.grammage)} گرم بر مترمربع`],['ابعاد',p=>p.size],['واحد سفارش',p=>p.unit],['حداقل سفارش',p=>`${number(p.minOrder)} ${p.unit}`],['ویژگی',p=>p.detail]];
    openModal(`${modalHead('انتخاب آگاهانه', 'مقایسهٔ مشخصات')}<p class="modal-description">ابعاد، گرماژ و واحد هر کالا جداست. رنگ نمایشگر معیار تطبیق نمونهٔ فیزیکی نیست.</p>${selected.length?`<div class="comparison-scroll"><table class="comparison-table"><thead><tr><th>مشخصه</th>${selected.map(p=>`<th><span class="comparison-color" style="background:${p.color}"></span>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([title,value])=>`<tr><th>${title}</th>${selected.map(p=>`<td>${esc(value(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="modal-footer">${selected.map(p=>`<button class="secondary-button" data-modal-add="${p.id}">${icon('plus',15)} ${esc(p.name)}</button>`).join('')}</div>`:'<p class="modal-description">با دکمهٔ «مقایسهٔ مشخصات» کنار کالاها، تا سه نمونه را انتخاب کنید.</p>'}`, 'comparison-modal');
}
function showTourStop() {
    const stops=[BOOTHS[0],BOOTHS[1],BOOTHS[2],BOOTHS[3]], b=stops[tourIndex];
    if(!b)return;selectBooth(b.id);el('tour-panel').hidden=false;
    el('tour-panel').innerHTML=`<div><span class="eyebrow">ایستگاه ${number(tourIndex+1)} از ۴</span><strong>${esc(b.name)}</strong></div><button data-tour-move="-1" ${tourIndex===0?'disabled':''} aria-label="غرفهٔ قبلی">${icon('chevron',17)}</button><button data-tour-move="1" ${tourIndex===3?'disabled':''} aria-label="غرفهٔ بعدی">${icon('arrow',17)}</button>${btn('end-tour','پایان بازدید','close')}`;
}
app.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button,[data-map-booth],[data-map-station]');
    if (!target)
        return;
    if (target.dataset.closeFirst)
        closeModal();
    if(target.dataset.level!==undefined){
        const level=Number(target.dataset.level)===1?1:0;
        mode='walk';
        updateMode();
        el('scene-editorial').classList.add('dismissed');
        el('booth-focus').hidden=true;
        if(world)world.changeLevel(level);
        else showLevel(level);
        return;
    }
    const station = target.dataset.station || target.dataset.mapStation;
    if (station && STATION_IDS.includes(station as StationId)) {
        showStation(station as StationId);
        return;
    }
    if (target.dataset.visitStation) {
        closeModal();
        setView('market');
        mode='walk';
        updateMode();
        el('booth-focus').hidden=true;
        el('scene-editorial').classList.add('dismissed');
        world?.focusStation(target.dataset.visitStation as StationId);
        return;
    }
    if (target.dataset.proofProduct) {
        showStation('proof',products().find(p=>p.id===target.dataset.proofProduct));
        return;
    }
    if (target.dataset.category) {
        category = target.dataset.category as Category;
        selectedBooth = undefined;
        favoriteFilter = false;
        renderSidebar();
        renderProducts();
        el('booth-focus').hidden = true;
        return;
    }
    if (target.dataset.booth) {
        selectBooth(target.dataset.booth);
        return;
    }
    if (target.dataset.mapBooth) {
        selectBooth(target.dataset.mapBooth);
        return;
    }
    if (target.dataset.product) {
        showProduct(target.dataset.product);
        return;
    }
    if (target.dataset.favorite) {
        toggleFavorite(target.dataset.favorite);
        return;
    }
    if (target.dataset.modalFavorite) {
        toggleFavorite(target.dataset.modalFavorite);
        return;
    }
    if (target.dataset.add) {
        addInquiry(target.dataset.add);
        return;
    }
    if (target.dataset.modalAdd) {
        addInquiry(target.dataset.modalAdd);
        return;
    }
    if (target.dataset.remove) {
        state.inquiry = state.inquiry.filter(l => l.productId !== target.dataset.remove);
        persist();
        renderProducts();
        showInquiry();
        return;
    }
    if (target.dataset.enter) {
        world?.enterBooth(target.dataset.enter);
        el('scene-editorial').classList.add('dismissed');
        return;
    }
    if (target.dataset.catalog) {
        selectedBooth = target.dataset.catalog;
        profileFilter = undefined;
        setView('catalog');
        return;
    }
    if (target.dataset.pdf) {
        openPDF(target.dataset.pdf);
        return;
    }
    if (target.dataset.editBooth) {
        showCreator(target.dataset.editBooth);
        return;
    }
    if (target.dataset.manageProducts) {
        showProductManager(target.dataset.manageProducts);
        return;
    }
    if (target.dataset.editCustomProduct) {
        const p = state.customProducts.find(p => p.id === target.dataset.editCustomProduct);
        if (p)
            showProductManager(p.boothId, p.id);
        return;
    }
    if (target.dataset.deleteProduct) {
        const p = state.customProducts.find(p => p.id === target.dataset.deleteProduct);
        if (!p)
            return;
        state.customProducts = state.customProducts.filter(x => x.id !== p.id);
        state.inquiry = state.inquiry.filter(x => x.productId !== p.id);
        state.favorites = state.favorites.filter(id => id !== p.id);
        persist();
        world?.setBooths(booths(), products());
        await restoreModels();
        renderSidebar();
        renderProducts();
        showProductManager(p.boothId);
        return;
    }
    if (target.dataset.deleteBooth) {
        const id = target.dataset.deleteBooth;
        state.customBooths = state.customBooths.filter(b => b.id !== id);
        state.customBooths.forEach((b, i) => b.slot = 8 + i);
        const ids = state.customProducts.filter(p => p.boothId === id).map(p => p.id);
        state.customProducts = state.customProducts.filter(p => p.boothId !== id);
        state.favorites = state.favorites.filter(p => !ids.includes(p));
        state.inquiry = state.inquiry.filter(p => !ids.includes(p.productId));
        world?.removeModel(id);
        world?.setBooths(booths(), products());
        await Promise.allSettled([deleteAsset(`model:${id}`), deleteAsset(`catalog:${id}`)]);
        await restoreModels();
        persist();
        closeModal();
        clearFilters();
        world?.reset();
        toast('غرفهٔ شخصی حذف شد.');
        return;
    }
    if (target.dataset.quality) {
        state.quality = target.dataset.quality as Quality;
        world?.setQuality(state.quality);
        persist();
        renderQuality();
        return;
    }
    if (target.dataset.compare) {
        const next = toggleComparison(comparison, target.dataset.compare, products().map(p => p.id)); comparison = next.ids;
        if (next.full) toast('تا سه کالا را کنار هم مقایسه کنید.');
        renderProducts(); renderComparisonTray(); return;
    }
    if (target.dataset.cutProduct) {
        showCut(products().find(p => p.id === target.dataset.cutProduct));
        return;
    }
    if (target.dataset.lighting) {
        lighting = target.dataset.lighting;
        world?.setLighting(lighting);
        el('light-caption').textContent = LIGHTING.find(p => p.id === lighting)?.label || '';
        document.querySelectorAll<HTMLButtonElement>('[data-lighting]').forEach(button => {
            const selected = button.dataset.lighting === lighting;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        return;
    }
    if (target.dataset.inspection) {
        const view = target.dataset.inspection as InspectionView;
        el('product-studio').dataset.inspection = view;
        studio?.setView(view);
        modal.querySelectorAll<HTMLButtonElement>('button[data-inspection]').forEach(button => {
            const selected = button.dataset.inspection === view;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        return;
    }
    if (target.dataset.showRender) {
        showGallery(target.dataset.showRender);
        return;
    }
    if (target.dataset.profileFilter) {
        const id = target.dataset.profileFilter;
        profileFilter = Object.hasOwn(MATERIAL_PROFILES, id) ? id as MaterialProfileId : undefined;
        renderProducts();
        return;
    }
    if (target.dataset.review) {
        const view = GALLERY.find(item => item.id === target.dataset.review);
        if (view) selectGalleryFrame(view);
        return;
    }
    if (target.dataset.shot) {
        world?.frameShot(target.dataset.shot as PhotoShotId);
        mode = 'walk';
        updateMode();
        el('scene-editorial').classList.add('dismissed');
        el('booth-focus').hidden = true;
        el('shot-panel').hidden = true;
        app.querySelector('[data-action="shots"]')?.setAttribute('aria-expanded', 'false');
        return;
    }
    if (target.dataset.tourMove) { tourIndex = Math.max(0, Math.min(3, tourIndex + Number(target.dataset.tourMove)));showTourStop(); return; }
    const action = target.dataset.action;
    switch (action) {
        case 'gallery':
            showGallery(); break;
        case 'all-stations':
            closeModal();
            setView('market');
            el('station-section').scrollIntoView({block:'start'});
            break;
        case 'compare':
            showComparison(); break;
        case 'clear-comparison':
            comparison=[];renderProducts();renderComparisonTray();if(modal.open)showComparison();break;
        case 'tour':
            tourIndex=0;showTourStop();break;
        case 'end-tour':
            tourIndex=-1;el('tour-panel').hidden=true;break;
        case 'cut':
            showCut(); break;
        case 'gallery-zoom': {
            const stage = modal.querySelector<HTMLElement>('.gallery-stage')!;
            const img = stage.querySelector<HTMLImageElement>('.review-image')!;
            const zoomed = stage.classList.toggle('zoomed');
            img.src = (zoomed ? img.dataset.full : img.dataset.thumb)!;
            if (!zoomed) stage.scrollTo(0, 0);
            target.setAttribute('aria-pressed', String(zoomed));
            target.innerHTML = `${icon('search', 16)} ${zoomed ? 'نمای کامل' : 'بزرگ‌نمایی'}`;
            break;
        }
        case 'shots': {
            const panel = el('shot-panel');
            panel.hidden = !panel.hidden;
            target.setAttribute('aria-expanded', String(!panel.hidden));
            break;
        }
        case 'view-market':
            setView('market');
            break;
        case 'specialty-catalog':
            clearFilters();
            setView('catalog');
            el('material-filters').scrollIntoView({ block: 'nearest' });
            break;
        case 'view-catalog':
            setView('catalog');
            break;
        case 'close':
            closeModal();
            break;
        case 'help':
            showHelp();
            break;
        case 'creator':
            showCreator();
            break;
        case 'new-booth': {
            showCreator('new');
            const f = el<HTMLFormElement>('creator-form');
            f.dataset.edit = '';
            for (const input of f.querySelectorAll<HTMLInputElement>('input:not([type="color"]):not([type="file"])'))
                input.value = input.name === 'grammage' ? '80' : input.name === 'size' ? 'A4' : input.name === 'unit' ? 'بند ۵۰۰ برگی' : '';
            el('preview-name').textContent = 'غرفهٔ شما';
            break;
        }
        case 'inquiry':
            showInquiry();
            break;
        case 'favorites':
            favoriteFilter = !favoriteFilter;
            selectedBooth = undefined;
            category = 'all';
            query = '';
            el<HTMLInputElement>('search').value = '';
            setView('catalog');
            renderSidebar();
            renderProducts();
            break;
        case 'clear-filters':
            clearFilters();
            break;
        case 'sidebar':
            setSidebar(!app.classList.contains('sidebar-open'));
            break;
        case 'start':
            el('scene-editorial').classList.add('dismissed');
            selectBooth('sepid');
            break;
        case 'dismiss-booth':
            el('booth-focus').hidden = true;
            break;
        case 'reset':
            clearFilters();
            mode='walk';
            updateMode();
            world?.reset();
            if (world) el('scene-editorial').classList.remove('dismissed');
            break;
        case 'walk':
            mode = 'walk';
            world?.setMode(mode);
            updateMode();
            break;
        case 'orbit':
            mode = 'orbit';
            world?.setMode(mode);
            updateMode();
            break;
        case 'map':
            el('mini-map').hidden = !el('mini-map').hidden;
            break;
        case 'quality':
            el('quality-panel').hidden = !el('quality-panel').hidden;
            break;
        case 'diagnostics':
            metricsVisible = !metricsVisible;
            el('metrics').hidden = !metricsVisible;
            break;
        case 'fullscreen':
            try {
                if (document.fullscreenElement)
                    await document.exitFullscreen();
                else
                    await document.querySelector('.scene-shell')!.requestFullscreen();
            }
            catch {
                toast('نمایش تمام صفحه روی این دستگاه در دسترس نیست.');
            }
            break;
        case 'capture':
            if (world)
                world.capture();
            else
                toast('تصویر سه‌بعدی هنوز آماده نیست.');
            break;
        case 'download-inquiry':
            download('Kaghaz-Inquiry.txt', inquiryText(state, products(), booths()));
            break;
        case 'copy-inquiry':
            try {
                await navigator.clipboard.writeText(inquiryText(state, products(), booths()));
                toast('متن درخواست کپی شد.');
            }
            catch {
                download('Kaghaz-Inquiry.txt', inquiryText(state, products(), booths()));
            }
            break;
        case 'export-workspace':
            download('Kaghaz-Workspace-v6.json', new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
            toast('فایل پشتیبان شامل داده‌هاست؛ مدل و PDF را جدا نگه دارید.');
            break;
        case 'restore-workspace':
            el<HTMLInputElement>('restore-file').click();
            break;
    }
});
function updateMode() { document.querySelector('[data-action="walk"]')?.classList.toggle('active', mode === 'walk'); document.querySelector('[data-action="orbit"]')?.classList.toggle('active', mode === 'orbit'); el('touch-controls').classList.toggle('orbit-hidden', mode === 'orbit'); }
modal.addEventListener('input', ({ target }) => {
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'studio-angle') {
        studio?.setAngle(target.valueAsNumber);
        el('angle-output').textContent = `${number(target.valueAsNumber)}°`;
    } else if (target.id === 'studio-separation') {
        studio?.setSeparation(target.valueAsNumber / 100);
        el('separation-output').textContent = `${number(target.valueAsNumber)}٪`;
    }
});
let searchTimer: ReturnType<typeof setTimeout>;
el('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { query = el<HTMLInputElement>('search').value; selectedBooth = undefined; favoriteFilter = false; if (query)
    setView('catalog'); renderSidebar(); renderProducts(); }, 130); });
app.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.quantity) {
        const line = state.inquiry.find(l => l.productId === input.dataset.quantity);
        if (line) {
            const p = products().find(p => p.id === line.productId);
            line.quantity = quantity(input.value, p?.minOrder);
            input.value = number(line.quantity);
            persist();
        }
    }
    if (input.type === 'file' && input.closest('.upload-tile'))
        input.closest('.upload-tile')!.querySelector('.file-name')!.textContent = input.files?.[0]?.name || 'فایلی انتخاب نشده است.';
});
app.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'inquiry-notes') {
        state.notes = input.value;
        persist();
    }
    if (input.closest('#creator-form') && input.name === 'name')
        el('preview-name').textContent = input.value || 'غرفهٔ شما';
    if (input.closest('#creator-form') && input.name === 'accent')
        document.querySelector<HTMLElement>('.creator-preview')?.style.setProperty('--preview-accent', input.value);
});
app.addEventListener('submit', event => { if ((event.target as HTMLElement).id === 'creator-form') {
    event.preventDefault();
    saveCreator(event.target as HTMLFormElement);
} if ((event.target as HTMLElement).id === 'product-manager-form') {
    event.preventDefault();
    saveManagedProduct(event.target as HTMLFormElement);
} });
el('restore-file').addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file)
        return;
    try {
        if (file.size > 1024 * 1024)
            throw new Error('فایل پشتیبان بیش از حد بزرگ است.');
        const next = parseState(JSON.parse(await file.text()));
        // Merge rather than erase existing data or local attachments without confirmation.
        state.favorites = [...new Set([...state.favorites, ...next.favorites])];
        for (const line of next.inquiry)
            if (!state.inquiry.some(l => l.productId === line.productId))
                state.inquiry.push(line);
        for (const b of next.customBooths)
            if (!state.customBooths.some(x => x.id === b.id) && state.customBooths.length < 2) {
                b.slot = 8 + state.customBooths.length;
                state.customBooths.push(b);
                state.customProducts.push(...next.customProducts.filter(p => p.boothId === b.id));
            }
        const valid = new Set(products().map(p => p.id));
        state.inquiry = state.inquiry.filter(l => valid.has(l.productId));
        state.favorites = state.favorites.filter(p => valid.has(p));
        if (next.notes)
            state.notes = [state.notes, next.notes].filter(Boolean).join('\n').slice(0, 3000);
        persist();
        world?.setBooths(booths(), products());
        await restoreModels();
        renderSidebar();
        renderProducts();
        closeModal();
        toast('داده‌های فایل به فضای شما اضافه شد.');
    }
    catch (e) {
        toast((e as Error).message || 'فایل خوانده نشد.');
    }
    finally {
        input.value = '';
    }
});
document.addEventListener('keydown', e => {
    if (e.code === 'Slash' && !(e.target as HTMLElement).closest('input,textarea,dialog')) {
        e.preventDefault();
        setSidebar(true);
        el('search').focus();
    }
    if (e.code === 'F3') {
        e.preventDefault();
        metricsVisible = !metricsVisible;
        el('metrics').hidden = !metricsVisible;
    }
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-map-booth],[data-map-station]');
    if (target && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        if (target.dataset.mapStation) showStation(target.dataset.mapStation as StationId);
        else if (target.dataset.mapBooth) selectBooth(target.dataset.mapBooth);
    }
});
for (const button of document.querySelectorAll<HTMLElement>('[data-motion]')) {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); const [x, y] = button.dataset.motion!.split(',').map(Number); world?.setMotion(x, y); el('scene-editorial').classList.add('dismissed'); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        button.addEventListener(event, () => world?.setMotion(0, 0));
}
renderSidebar();
renderProducts();
renderQuality();
updateCounts();
async function startWorld() {
    let context: WebGL2RenderingContext | null = null;
    try {
        context = document.createElement('canvas').getContext('webgl2', {
            antialias: true, alpha: false, powerPreference: 'high-performance',
        });
        if (!context) throw new Error('WebGL2 unavailable');
        await document.fonts.ready;
        const { BazaarWorld } = await import('./scene/world.ts');
        world = new BazaarWorld(el('scene'), booths(), products(), state.quality, {
            select: (id, product) => product ? showProduct(product) : selectBooth(id),
            station: id => showStation(id),
            level: showLevel,
            hotspots: spots => spots.forEach(({id,x,y,visible})=>{
                const button=app.querySelector<HTMLButtonElement>(`[data-live-station="${id}"]`)!;
                button.hidden=!visible;
                button.style.left=`${x}%`;
                button.style.top=`${y}%`;
            }),
            hover: (text, x, y) => { const label = el('hover-label'); label.hidden = !text; if (text) {
                label.textContent = text;
                label.style.left = `${Math.max(10, Math.min(el('scene').clientWidth - 160, x + 14))}px`;
                label.style.top = `${Math.max(70, y - 34)}px`;
            } },
            pose: (x,z) => {
                const dot=el('map-player');
                dot?.setAttribute('cx',String(MAP.x(x)));
                dot?.setAttribute('cy',String(MAP.y(z)));
                el('scene').dataset.pose=`${x.toFixed(2)},${z.toFixed(2)}`;
            },
            metrics: m => { el('metrics').textContent = `${m.draws} draws · ${number(Math.round(m.triangles / 1000))}k tris · CPU ${m.frameMs.toFixed(1)}ms · DPR ${m.dpr} · ${m.mode}`; },
            error: message => toast(message),
        }, context);
        el('scene-loading').remove();world.setLighting(lighting);
        await restoreModels();
    }
    catch (error) {
        context?.getExtension('WEBGL_lose_context')?.loseContext();
        el('scene-loading')?.remove();
        el('scene-location').textContent = 'رندر Blender';
        el('scene').classList.add('is-fallback');
        document.querySelector('.scene-shell')?.classList.add('fallback-shell');
        for (const button of app.querySelectorAll<HTMLButtonElement>('[data-action="walk"],[data-action="orbit"],[data-action="capture"],[data-action="shots"],[data-lighting]')) {
            button.disabled = true;
            button.title = 'ویژهٔ نمای زندهٔ WebGL2';
        }
        el('scene-editorial').innerHTML = `<button data-action="gallery">گالری پاساژ ${icon('arrow',17)}</button>`;
        if (context) console.warn('Market rendering unavailable', error);
    }
}
void startWorld();
