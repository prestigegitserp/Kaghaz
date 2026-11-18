import { cartonPanels, cartonSize, pileDimensions, type Panel, type Vertex } from './domain/carton.ts';
import { number, type ProductKind } from './domain/model.ts';
import { icon } from './icons.ts';

const surfaces = {
    kraft: { label:'کرافت طبیعی', paper:'#ae8051', grain:.49, gloss:.14, tint:[1,.92,.78] },
    matte: { label:'تحریر مات', paper:'#eee5d2', grain:.29, gloss:.27, tint:[1,.98,.92] },
    gloss: { label:'گلاسه', paper:'#eeeade', grain:.10, gloss:.87, tint:[1,1,.98] },
    ivory: { label:'مقوای عاجی', paper:'#d9c5a2', grain:.22, gloss:.28, tint:[1,.99,.89] },
} as const;
type Surface = keyof typeof surfaces;
const choice=(current:Surface) => Object.entries(surfaces).map(([id,mat])=>
    `<option value="${id}" ${id===current?'selected':''}>${mat.label}</option>`).join('');

export function surfaceForProduct(kind?:ProductKind):Surface {
    if (kind==='kraft'||kind==='roll'||kind==='box') return 'kraft';
    if (kind==='sheet') return 'gloss';
    if (kind==='swatch') return 'ivory';
    return 'matte';
}

const workingCanvas=(id:string,label:string) =>
    `<div class="lab-stage"><canvas id="${id}" width="960" height="655" role="img" aria-label="${label}"></canvas></div>`;

export function foldingMarkup() {
    return `<div class="lab-layout">
        <div>${workingCanvas('fold-canvas','مدل تعاملی جعبه و الگوی خط تا')}
          <div class="lab-preview-controls"><button type="button" class="secondary-button" id="fold-plan" aria-pressed="false">${icon('map',16)} نمای الگو</button><button type="button" class="secondary-button" id="fold-reset">${icon('orbit',16)} بازنشانی زاویه</button></div>
        </div>
        <div class="lab-config"><h3>ابعاد و جنس</h3><div class="lab-dimensions">
          <label class="field-label">عرض <input id="fold-width" type="number" min="60" max="270" value="155"></label>
          <label class="field-label">عمق <input id="fold-depth" type="number" min="45" max="220" value="104"></label>
          <label class="field-label">ارتفاع <input id="fold-height" type="number" min="25" max="150" value="52"></label>
        </div><label class="field-label">جنس جعبه<select id="fold-surface">${choice('kraft')}</select></label>
        <label class="lab-range">میزان تا شدن <output id="fold-value">۰٪</output><input id="fold-amount" type="range" min="0" max="100" value="0"></label>
        <button class="primary-button lab-primary" id="fold-play">${icon('play',17)} جعبه را تا کن</button>
        <div class="lab-output" id="fold-spec" aria-live="polite"></div>
        <p class="lab-help">ابعاد بر حسب میلی‌متر است. مدل را بکشید تا زاویه عوض شود یا نمای الگو را برای دیدن خطوط تا باز کنید.</p>
        </div></div>`;
}

const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const color=(hex:string,factor:number) => {
    const rgb=[1,3,5].map(i=>clamp(Math.round(Number.parseInt(hex.slice(i,i+2),16)*factor),0,255));
    return `rgb(${rgb.join(',')})`;
};

function stageBackground(ctx:CanvasRenderingContext2D, light='#e9e1cb', dark='#bdb3a0') {
    const grad=ctx.createLinearGradient(60,125,820,610);
    grad.addColorStop(0,light);grad.addColorStop(1,dark);
    ctx.fillStyle=grad;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
}

function path(ctx:CanvasRenderingContext2D,points:[number,number][]) {
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();
}

function stockPattern(ctx:CanvasRenderingContext2D, strength:number, light=false) {
    const tile=document.createElement('canvas');tile.width=tile.height=140;
    const pen=tile.getContext('2d')!;
    let seed=52903;
    const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    for(let i=0;i<4850;i++){
        const a=rand(),x=rand()*140,y=rand()*140;
        pen.strokeStyle=a>.5?`rgba(255,255,255,${strength*rand()*.52})`:`rgba(36,32,22,${strength*rand()*.45})`;
        pen.lineWidth=a<.90?.72:1.17;
        pen.beginPath();pen.moveTo(x,y);pen.lineTo(x+1+rand()*3,y+rand()*1.9-.95);pen.stroke();
    }
    if(light){pen.fillStyle='rgba(255,255,255,.06)';pen.fillRect(0,0,140,140);}
    return ctx.createPattern(tile,'repeat')!;
}

export function mountFold(root:HTMLElement):()=>void {
    const controller=new AbortController(), event={signal:controller.signal};
    const select=<T extends HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
    const canvas=select<HTMLCanvasElement>('fold-canvas'), ctx=canvas.getContext('2d')!;
    const input=select<HTMLInputElement>('fold-amount'), swatch=select<HTMLSelectElement>('fold-surface');
    const sizeInputs=['width','depth','height'].map(id=>select<HTMLInputElement>(`fold-${id}`));
    const play=select<HTMLButtonElement>('fold-play'), layout=select<HTMLButtonElement>('fold-plan');
    const texture=stockPattern(ctx,.32);
    let yaw=.38,pitch=.72,plan=false,anim=0,drag:{id:number;x:number;y:number}|undefined;
    function draw(){
        const [w,d,h]=sizeInputs.map(v=>v.valueAsNumber), size=cartonSize(w,d,h), progress=Number(input.value)/100;
        const folded=cartonPanels(size,plan?0:progress), dimensions=pileDimensions(cartonPanels(size,0));
        const surface=surfaces[swatch.value as Surface];
        stageBackground(ctx,plan?'#fbf7ec':'#f1ebdf',plan?'#ece3d1':'#c9bb9d');
        const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
        const stockPoints=cartonPanels(size,0).flatMap(panel=>panel.vertices);
        const minZ=Math.min(...stockPoints.map(point=>point[2])), maxZ=Math.max(...stockPoints.map(point=>point[2]));
        const centerZ=plan?(minZ+maxZ)/2:(minZ+maxZ)/2*(1-progress);
        const scale=plan?Math.min(770/dimensions.width,528/dimensions.depth)
            :Math.min(615/(dimensions.width+dimensions.depth*.46),446/(dimensions.depth*.73+size.height*.42))*(1+progress*.42);
        function project(v:Vertex):[number,number,number]{
            const x=v[0],y=v[1],z=v[2]-centerZ;
            if(plan)return[480+x*scale,326+z*scale,0];
            const nx=x*cy-z*sy, nz=x*sy+z*cy;
            const ny=y*cp-nz*sp, depth=y*sp+nz*cp;
            return [480+nx*scale,354-ny*scale,depth];
        }
        const polys=folded.map(panel=>{
            const v=panel.vertices.map(project), depth=v.reduce((n,p)=>n+p[2],0)/v.length;
            return {panel,v,depth};
        }).sort((a,b)=>a.depth-b.depth);
        if(!plan){
            ctx.fillStyle='#5f432537';
            for(const {panel} of polys){
                path(ctx,panel.vertices.map(([x,y,z])=>{
                    const p=project([x+y*.43,0,z+y*.19]);return [p[0]+5,p[1]+6];
                }));
                ctx.fill();
            }
        }
        for(const {panel,v} of polys){
            path(ctx,v.map(p=>[p[0],p[1]]));
            const phase=panel.kind==='lid'?1.10:panel.kind==='tab'?.98:panel.id==='left'?.89:panel.id==='front'?1.01:.96;
            ctx.fillStyle=plan?'#eadbc3':color(surface.paper,phase);
            ctx.fill();
            if(!plan){ctx.fillStyle=texture;ctx.fill();}
            ctx.strokeStyle=plan?'#8e6740':'#7b5d3b90';ctx.lineWidth=plan?2:1.4;
            ctx.stroke();
            if(panel.id==='cover'&&!plan)drawLidImage(panel,project);
        }
        if(plan){
            ctx.strokeStyle='#26756b';ctx.setLineDash([6,5]);ctx.lineWidth=2.3;
            for(const panel of folded){
                if(panel.id==='base')continue;
                const a=project(panel.vertices[0]),b=project(panel.vertices[1]);
                ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        canvas.dataset.progress=String(input.value);
        select<HTMLOutputElement>('fold-value').value=`${number(Number(input.value))}٪`;
        const format=(n:number)=>number(Math.round(n));
        select('fold-spec').innerHTML=`<span>جعبهٔ بسته <b>${format(size.width)} × ${format(size.depth)} × ${format(size.height)}</b></span><span>ابعاد کادر الگو <b>${format(dimensions.width)} × ${format(dimensions.depth)}</b></span>`;
        play.innerHTML=`${icon('play',17)} ${progress>=.999?'جعبه را باز کن':'جعبه را تا کن'}`;
    }
    function drawLidImage(cover:Panel,project:(v:Vertex)=>[number,number,number]){
        const [a,b,,d]=cover.vertices, p=project(a),q=project(b),r=project(d);
        ctx.save();
        ctx.transform((q[0]-p[0])/100,(q[1]-p[1])/100,(r[0]-p[0])/100,(r[1]-p[1])/100,p[0],p[1]);
        ctx.fillStyle='#2c6858';ctx.fillRect(7,13,86,64);
        ctx.fillStyle='#fff1d6';ctx.font='600 11px sans-serif';ctx.fillText('KAGHAZ',15,38);
        ctx.font='5.5px sans-serif';ctx.fillText('BAHARESTAN',15,53);
        ctx.strokeStyle='#e2ba7b';ctx.lineWidth=.54;
        for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(87,66,10+i*4,Math.PI,1.5*Math.PI);ctx.stroke();}
        ctx.restore();
    }
    root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.lab-config input,.lab-config select').forEach(control=>{
        control.addEventListener('input',()=>{cancelAnimationFrame(anim);draw();},event);
    });
    layout.addEventListener('click',()=>{
        plan=!plan;layout.setAttribute('aria-pressed',String(plan));draw();
    },event);
    select('fold-reset').addEventListener('click',()=>{yaw=.38;pitch=.72;draw();},event);
    play.addEventListener('click',()=>{
        cancelAnimationFrame(anim);
        if (plan) {plan=false;layout.setAttribute('aria-pressed','false');}
        const value=Number(input.value),next=value>=100?0:100,start=performance.now();
        const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:1610;
        function tick(time:number){
            const t=clamp((time-start)/duration,0,1);
            input.value=String(Math.round(value+(next-value)*t));
            draw();
            if(t<1)anim=requestAnimationFrame(tick);
        }
        anim=requestAnimationFrame(tick);
    },event);
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};},event);
    canvas.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId||plan)return;
        yaw+=(e.clientX-drag.x)*.009;pitch=clamp(pitch+(e.clientY-drag.y)*.008,.32,1.38);
        drag={id:e.pointerId,x:e.clientX,y:e.clientY};draw();
    },event);
    canvas.addEventListener('lostpointercapture',()=>{drag=undefined;},event);
    draw();
    return ()=>{cancelAnimationFrame(anim);controller.abort();};
}

export function proofMarkup(start?:Surface) {
    return `<div class="lab-layout"><div>${workingCanvas('proof-canvas','مقایسهٔ چاپ روی دو کاغذ با نور قابل تنظیم')}<div class="proof-legend"><span id="proof-name-a"></span><span id="proof-name-b"></span></div></div>
      <div class="lab-config"><h3>یک طرح، دو جنس</h3><div class="lab-dimensions proof-pair">
      <label class="field-label">نمونهٔ چپ<select id="proof-a">${choice(start||'matte')}</select></label><label class="field-label">نمونهٔ راست<select id="proof-b">${choice(start==='kraft'?'gloss':'kraft')}</select></label></div>
      <label class="field-label">منبع نور<select id="proof-light"><option value="day">نور طبیعی</option><option value="warm">نور گرم ویترین</option><option value="cool">نور سرد کارگاه</option></select></label>
      <label class="lab-range">زاویهٔ نور <output id="proof-angle-output">۳۷°</output><input id="proof-angle" type="range" min="7" max="80" value="37"></label>
      <label class="lab-range">مرز مقایسه<input id="proof-split" type="range" min="5" max="95" value="50" aria-label="مرز مقایسهٔ دو جنس"></label>
      <p class="lab-help">این مقایسه رفتار تقریبی رنگ، الیاف و بازتاب کاغذ را روی نمایشگر نشان می‌دهد.</p></div></div>`;
}

export function mountProof(root:HTMLElement):()=>void {
    const controller=new AbortController(),event={signal:controller.signal};
    const get=<T extends HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
    const canvas=get<HTMLCanvasElement>('proof-canvas'),ctx=canvas.getContext('2d')!;
    const left=get<HTMLSelectElement>('proof-a'),right=get<HTMLSelectElement>('proof-b');
    const angle=get<HTMLInputElement>('proof-angle'), split=get<HTMLInputElement>('proof-split');
    const textures = Object.fromEntries(Object.entries(surfaces).map(([id,m])=>[id,stockPattern(ctx,m.grain,true)])) as Record<Surface,CanvasPattern>;
    let dragging=false;
    function paint(key:Surface, filter:string) {
        const mat=surfaces[key], x=142,y=95,w=676,h=455;
        ctx.save();
        ctx.shadowBlur=35;ctx.shadowColor='rgba(42,35,22,.40)';ctx.shadowOffsetY=17;
        ctx.fillStyle=mat.paper;ctx.fillRect(x,y,w,h);
        ctx.shadowColor='transparent';
        ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
        ctx.fillStyle=textures[key];ctx.fillRect(x,y,w,h);
        ctx.globalAlpha=key==='kraft'?.74:.96;
        for(const [i,c] of ['#176e67','#d6684b','#d5a349','#596c91','#283d3b'].entries()){
            ctx.fillStyle=c;ctx.fillRect(184+i*119,167,119,120);
        }
        ctx.fillStyle='#253c35';ctx.font='750 87px sans-serif';ctx.fillText('KAGHAZ',181,446);
        ctx.font='600 24px Vazirmatn, sans-serif';ctx.direction='rtl';ctx.textAlign='right';
        ctx.fillText('چاپ روی کاغذ بهارستان',777,492);ctx.direction='ltr';ctx.textAlign='left';
        ctx.globalAlpha=1;
        const v=Number(angle.value)/80, hx=201+545*v, hy=174+237*(1-v);
        const glow=ctx.createRadialGradient(hx,hy,2,hx,hy,220);
        glow.addColorStop(0,`rgba(255,253,236,${mat.gloss*(1-v*.63)})`);
        glow.addColorStop(1,'rgba(255,253,236,0)');
        ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
        if(filter!=='day'){
            ctx.fillStyle=filter==='warm'?'rgba(209,139,53,.21)':'rgba(78,126,200,.16)';
            ctx.fillRect(x,y,w,h);
        }
        ctx.restore();
    }
    function draw() {
        const cut=Number(split.value)/100*canvas.width;
        const light=get<HTMLSelectElement>('proof-light').value;
        stageBackground(ctx,light==='cool'?'#e4edf0':'#f0e7d6',light==='cool'?'#8ca5a8':'#b8a78e');
        const a=left.value as Surface,b=right.value as Surface;
        ctx.save();ctx.beginPath();ctx.rect(0,0,cut,canvas.height);ctx.clip();paint(a,light);ctx.restore();
        ctx.save();ctx.beginPath();ctx.rect(cut,0,canvas.width-cut,canvas.height);ctx.clip();paint(b,light);ctx.restore();
        ctx.strokeStyle='#fff7e5';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(cut,0);ctx.lineTo(cut,canvas.height);ctx.stroke();
        ctx.fillStyle='#faf2db';ctx.beginPath();ctx.arc(cut,canvas.height*.5,21,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#355a4d';ctx.font='600 21px sans-serif';ctx.textAlign='center';ctx.fillText('↔',cut,canvas.height*.5+7);ctx.textAlign='left';
        canvas.dataset.split=split.value;
        get('proof-name-a').textContent=surfaces[a].label;
        get('proof-name-b').textContent=surfaces[b].label;
        get<HTMLOutputElement>('proof-angle-output').value=`${number(Number(angle.value))}°`;
    }
    root.querySelectorAll('select,input').forEach(control=>control.addEventListener('input',draw,event));
    function setSplit(clientX:number){
        const r=canvas.getBoundingClientRect();
        split.value=String(Math.round(clamp((clientX-r.x)/r.width*100,5,95)));draw();
    }
    canvas.addEventListener('pointerdown',e=>{dragging=true;canvas.setPointerCapture(e.pointerId);setSplit(e.clientX);},event);
    canvas.addEventListener('pointermove',e=>{if(dragging)setSplit(e.clientX);},event);
    canvas.addEventListener('lostpointercapture',()=>{dragging=false;},event);
    draw();
    return ()=>controller.abort();
}
