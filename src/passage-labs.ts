import { palletLoad,rollUsage } from './domain/mill.ts';
import { number } from './domain/model.ts';
import type { StationId } from './domain/hall.ts';
import { icon } from './icons.ts';

const labels={unwrap:'باز کردن فیلم و تسمه',roll:'بازکردن رول کرافت',press:'رجیستر چاپ چهاررنگ',pallet:'چیدمان کارتن روی پالت'};
export type PassageTool=Extract<StationId,keyof typeof labels>;
export const passageToolTitle=(mode:PassageTool)=>labels[mode];

const PAPER='#bd9369', INK='#284b46';
const INKS = { C:'#24a9c6', M:'#be467c', Y:'#e4bc3a', K:'#263634' } as const;
const format=(n:number,d=1)=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:d}).format(n);
const sliders=(id:string, title:string,min:number,max:number,value:number,step=1) =>
    `<label class="lab-range">${title}<output id="${id}-value"></output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
const field=(id:string,label:string,content:string) => `<label class="field-label">${label}<select id="${id}">${content}</select></label>`;
const choose=(items:Record<string,string>)=>Object.entries(items).map(([id,value])=>`<option value="${id}">${value}</option>`).join('');
const measure=(id:string,label:string,min:number,max:number,value:number) =>
    `<label class="field-label">${label}<input id="${id}" type="number" min="${min}" max="${max}" value="${value}"></label>`;

export function passageToolMarkup(mode:PassageTool) {
    const controls:Record<PassageTool,string>={
        unwrap: `<h3>بستهٔ عمدهٔ تحریر</h3>${sliders('unwrap-film','مقدار باز کردن فیلم',0,100,0)}${sliders('unwrap-straps','فاصلهٔ تسمه‌ها',0,100,0)}
            <button class="primary-button lab-primary" id="unwrap-play">${icon('play',17)} باز کردن بسته</button><p class="lab-help">فیلم دور کارتن‌ها و تسمه‌های جداگانه را روی مدل بررسی کنید.</p>`,
        roll: `<h3>مشخصات رول</h3><div class="lab-dimensions">
            ${measure('roll-d','قطر بیرونی',180,1000,530)}
            ${measure('roll-w','عرض',300,2200,1000)}
            ${measure('roll-gsm','گرماژ',30,450,100)}</div>
            ${sliders('roll-used','کاغذ کشیده‌شده',0,100,0)}
            <button class="secondary-button lab-primary" id="roll-reset">برگرداندن رول</button>
            <p class="lab-help">عرض و قطر به میلی‌متر است. دستهٔ کنار لبهٔ کاغذ را بکشید. محاسبه با هستهٔ ۷۶ و ضخامت ۰٫۱۱۸ میلی‌متر انجام می‌شود.</p>`,
        press: `<h3>لایه‌های مرکب</h3><div class="press-inks">${Object.keys(INKS).map(id=>`<button class="secondary-button active" type="button" data-ink="${id}" aria-pressed="true">${id}</button>`).join('')}</div>
            ${field('press-paper','سطح چاپ',choose({matte:'تحریر روشن',kraft:'کرافت'}))}
            ${sliders('press-offset','جابه‌جایی لایهٔ ارغوانی',-7,7,3,.5)}
            <button class="primary-button lab-primary" id="press-align">تنظیم لایه‌ها</button>
            <p class="lab-help">لایه‌ها را جدا و با هم بررسی کنید. هدف، دیدن لبهٔ دوبلِ ناشی از جابه‌جایی است.</p>`,
        pallet: `<h3>کارتن روی پالت ۱۲۰۰ × ۸۰۰</h3><div class="lab-dimensions">
            ${measure('pallet-w','عرض',105,1200,400)}
            ${measure('pallet-d','عمق',105,800,300)}
            ${measure('pallet-h','ارتفاع',85,800,218)}</div>
            ${measure('pallet-kg','وزن هر کارتن · کیلوگرم',0,85,11)}
            ${sliders('pallet-levels','لایه‌های بار',1,6,3)}
            <p class="lab-help">ابعاد به میلی‌متر است. جای‌گیری چرخیده و عادی روی یک پالت محاسبه می‌شود.</p>`,
    };
    return `<div class="lab-layout"><div><div class="lab-stage passage-stage" id="passage-stage"><canvas id="passage-canvas"
        width="960" height="648" role="img" aria-label="${labels[mode]}"></canvas></div></div>
        <div class="lab-config">${controls[mode]}<div class="lab-output" id="passage-spec" aria-live="polite"></div></div></div>`;
}

type XY=[number,number];
type XYZ=[number,number,number];
const path=(ctx:CanvasRenderingContext2D,points:XY[])=>{
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();
};
const fill=(ctx:CanvasRenderingContext2D,points:XY[],color:string,edge?:string)=>{
    path(ctx,points);
    ctx.fillStyle=color;ctx.fill();
    if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}
};
function shade(ctx:CanvasRenderingContext2D,color1='#ebeadc',color2='#a99c86') {
    const back=ctx.createLinearGradient(0,0,940,660);
    back.addColorStop(0,color1);back.addColorStop(1,color2);
    ctx.fillStyle=back;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
}
function speckle(ctx:CanvasRenderingContext2D,amount=.3) {
    const tile=document.createElement('canvas');tile.width=tile.height=108;
    const p=tile.getContext('2d')!;
    let seed=9147;
    const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    for(let i=0;i<1900;i++){
        p.fillStyle=`rgba(${random()>.53?'255,252,235':'63,47,28'},${random()*amount})`;
        p.fillRect(random()*108,random()*108,1+random()*2.1,.55+random());
    }
    return ctx.createPattern(tile,'repeat')!;
}
function isoBox(ctx:CanvasRenderingContext2D,pos:XYZ,size:XYZ,point:(v:XYZ)=>XY,mats:string[],grain?:CanvasPattern) {
    const [x,d,z]=pos,[w,l,h]=size;
    const front:XYZ[]=[[x,d+l,z],[x+w,d+l,z],[x+w,d+l,z+h],[x,d+l,z+h]];
    const right:XYZ[]=[[x+w,d+l,z],[x+w,d,z],[x+w,d,z+h],[x+w,d+l,z+h]];
    const top:XYZ[]=[[x,d+l,z+h],[x+w,d+l,z+h],[x+w,d,z+h],[x,d,z+h]];
    for(const [i,face] of [front,right,top].entries()){
        const vertices=face.map(point);
        fill(ctx,vertices,mats[i],'#594d3c66');
        if(grain){
            path(ctx,vertices);ctx.fillStyle=grain;ctx.fill();
        }
    }
}

export interface PassageLab {dispose:()=>void;attach:(cb:(film:number,straps:number)=>void)=>void}
export function mountPassageTool(root:HTMLElement,mode:PassageTool):PassageLab {
    const abort=new AbortController(),events={signal:abort.signal};
    const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
    const canvas=get<HTMLCanvasElement>('passage-canvas'),ctx=canvas.getContext('2d')!;
    const scalar=(id:string)=>get<HTMLInputElement>(id).valueAsNumber;
    const pattern=speckle(ctx,.17);
    const selected=new Set(Object.keys(INKS));
    let useGL:(film:number,straps:number)=>void,animation=0,drag=false;
    const row=(title:string,value:string)=>`<span>${title}<b>${value}</b></span>`;
    const handle=(id:string,value:string)=>{get<HTMLOutputElement>(id+'-value').value=value;};
    function palletPreview(unwrap=false) {
        const width=unwrap?420:scalar('pallet-w'),depth=unwrap?345:scalar('pallet-d'),h=unwrap?198:scalar('pallet-h');
        const model=palletLoad(width,depth,h,unwrap?3:scalar('pallet-levels'),unwrap?11:scalar('pallet-kg'));
        shade(ctx,'#eeece1','#ac9d87');
        if(!model){get('passage-spec').innerHTML=row('ابعاد قابل محاسبه را وارد کنید','');return;}
        const pr=([x,y,z]:XYZ):XY=>[468+x*.347-y*.335,442+x*.157+y*.172-z*.360];
        const origin=(v:XYZ)=>pr([v[0]-600,v[1]-400,v[2]]);
        fill(ctx,[origin([-100,-100,0]),origin([1320,-100,0]),origin([1320,950,0]),origin([-100,950,0])],'#2e342922');
        for(let j=0;j<5;j++){
            isoBox(ctx,[0,j*172,0],[1200,112,139],origin,['#8c6844','#705438','#bd9669'],pattern);
        }
        for(let floor=0;floor<model.layers;floor++){
            const boxes:XYZ[]=[];
            for(const b of model.bands)for(let r=0;r<b.rows;r++)for(let c=0;c<b.columns;c++)
                boxes.push([b.x+c*(b.width+2),b.y+r*(b.height+2),b.rotated?1:0]);
            boxes.sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
            for(const [x,y,rotate] of boxes){
                const w=rotate?depth:width,l=rotate?width:depth,z=144+floor*h;
                isoBox(ctx,[x,y,z],[w,l,h-2],origin,['#b68559','#96704e','#dab087'],pattern);
                fill(ctx,[[x+w*.17,y+l,z+h*.25],[x+w*.67,y+l,z+h*.25],
                    [x+w*.67,y+l,z+h*.53],[x+w*.17,y+l,z+h*.53]].map(v=>origin(v as XYZ)),
                    floor%2?'#d5e0d0':'#e8e1ca');
            }
        }
        if(unwrap){
            const film=scalar('unwrap-film')/100,straps=scalar('unwrap-straps')/100;
            const z=144+model.layers*h;
            ctx.save();ctx.globalAlpha=(1-film)*.50;
            fill(ctx,[[0,804,150],[1200,804,150],[1240,804-film*290,z],[.0,804-film*260,z]].map(v=>origin(v as XYZ)),
                '#efede4','#f0ede6');
            ctx.strokeStyle='#ffffffab';ctx.lineWidth=2;
            for(let i=0;i<16;i++){
                const p=origin([0,807,166+i*34]),q=origin([1200,808,171+i*33]);
                ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
            }
            ctx.restore();
            ctx.globalAlpha=1-straps*.88;
            for(const x of [316,871])fill(ctx,[[x,805,143],[x+29,805,143],[x+29,805,z],[x,805,z]].map(v=>origin(v as XYZ)),INK);
            ctx.globalAlpha=1;
            handle('unwrap-film',number(film*100)+'٪');handle('unwrap-straps',number(straps*100)+'٪');
            get('passage-spec').innerHTML=row('وضعیت فیلم',film>.95?'باز':'روی بسته')+row('وضعیت تسمه',straps>.95?'جداشده':'روی بسته');
            useGL?.(film,straps);
        } else {
            handle('pallet-levels',number(model.layers));
            get('passage-spec').innerHTML=row('در هر لایه',number(model.perLayer)+' کارتن')+
                row('جمع بار',number(model.total)+' کارتن')+row('وزن خالص تقریبی',format(model.net)+' کیلوگرم')+
                row('ارتفاع با پالت',number(Math.round(model.height))+' میلی‌متر');
        }
    }
    function rollPreview(){
        const amount=scalar('roll-used'),model=rollUsage(scalar('roll-d'),scalar('roll-w'),scalar('roll-gsm'),amount/100);
        shade(ctx,'#ede7d5','#b0a28d');
        ctx.fillStyle='#443c2d43';ctx.beginPath();ctx.ellipse(489,446,282,38,0,0,Math.PI*2);ctx.fill();
        const radius=Math.max(34,Math.min(148,model.diameter*.242)),rpx=radius*.60,center=392;
        const x0=273,x1=596,end=470+amount*4.45;
        const tail:XY[]=[[x1-22,center+radius*.27],[x1-29,center+radius*.80],[end,521],[end-71,460]];
        fill(ctx,tail,'#c79e74','#a58359');
        path(ctx,tail);ctx.fillStyle=pattern;ctx.fill();
        const body=ctx.createLinearGradient(0,center-radius,0,center+radius);
        body.addColorStop(0,'#e0bf93');body.addColorStop(.45,'#af7d50');body.addColorStop(1,'#8c6244');
        ctx.fillStyle=body;ctx.fillRect(x0,center-radius,x1-x0,radius*2);
        ctx.fillStyle=pattern;ctx.fillRect(x0,center-radius,x1-x0,radius*2);
        ctx.fillStyle='#d5b18b';ctx.beginPath();ctx.ellipse(x1,center,rpx,radius,0,0,Math.PI*2);ctx.fill();
        for(let i=1;i<32;i++){
            const f=.19+i*.024;
            ctx.strokeStyle=i%6===0?'#88674480':'#a9805a62';
            ctx.beginPath();ctx.ellipse(x1,center,rpx*f,radius*f,0,0,Math.PI*2);ctx.stroke();
        }
        ctx.fillStyle='#654e37';ctx.beginPath();ctx.ellipse(x1,center,15,23,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fbefcd';ctx.beginPath();ctx.arc(end-22,490,21,0,Math.PI*2);ctx.fill();
        ctx.font='600 23px sans-serif';ctx.textAlign='center';ctx.fillStyle=INK;ctx.fillText('↔',end-22,497);ctx.textAlign='start';
        handle('roll-used',number(amount)+'٪');
        get('passage-spec').innerHTML=row('باز شده',format(model.used)+' متر')+
          row('مانده روی رول',format(model.remaining)+' متر')+row('وزن خالص مانده',format(model.mass)+' کیلوگرم');
    }
    function pressPreview(){
        const shift=scalar('press-offset'),kraft=get<HTMLSelectElement>('press-paper').value==='kraft';
        shade(ctx,'#e4e9e4','#929e97');
        ctx.save();
        ctx.shadowColor='#28312a6e';ctx.shadowBlur=29;ctx.shadowOffsetY=16;
        ctx.fillStyle=kraft?PAPER:'#f1ebd8';ctx.fillRect(138,97,684,458);ctx.restore();
        ctx.fillStyle=pattern;ctx.fillRect(138,97,684,458);
        ctx.save();ctx.beginPath();ctx.rect(138,97,684,458);ctx.clip();
        ctx.globalCompositeOperation='multiply';
        ['C','M','Y','K'].forEach((key,i)=>{
            if(!selected.has(key))return;
            ctx.save();
            if(key==='M')ctx.translate(shift*4.3,shift*1.7);
            ctx.fillStyle=ctx.strokeStyle=INKS[key as keyof typeof INKS];
            ctx.globalAlpha=key==='K'?.93:.80;
            ctx.beginPath();ctx.arc(381+i*57,299+(i%2)*33,79+(i%2)*22,0,Math.PI*2);ctx.fill();
            ctx.font='700 51px sans-serif';ctx.direction='ltr';ctx.textAlign='left';ctx.fillText('BAHARESTAN',204,468);
            for(const [x,y] of [[179,132],[781,132],[179,520],[781,520]]){
                ctx.lineWidth=2;
                ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
                ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.stroke();
            }
            for(let row=0;row<7;row++)for(let col=0;col<12;col++){
                ctx.beginPath();ctx.arc(621+col*9,171+i*62+row*7,1.3+col*.12,0,Math.PI*2);ctx.fill();
            }
            ctx.restore();
        });
        ctx.restore();
        handle('press-offset',format(shift)+' میلی‌متر');
        get('passage-spec').innerHTML=row('لایه‌های روشن',number(selected.size))+
            row('رجیستر ارغوانی',shift===0?'تراز':format(Math.abs(shift))+' میلی‌متر جابه‌جایی');
    }
    const draw=()=>{if(mode==='roll')rollPreview();else if(mode==='press')pressPreview();else palletPreview(mode==='unwrap');};
    root.querySelectorAll('select,input').forEach(control=>control.addEventListener('input',()=>{cancelAnimationFrame(animation);draw();},events));
    if(mode==='roll'){
        function dragAt(x:number){
            const bounds=canvas.getBoundingClientRect();
            get<HTMLInputElement>('roll-used').value=String(Math.round(Math.min(100,Math.max(0,((x-bounds.left)/bounds.width-.51)*228))));
            draw();
        }
        canvas.addEventListener('pointerdown',event=>{drag=true;canvas.setPointerCapture(event.pointerId);dragAt(event.clientX);},events);
        canvas.addEventListener('pointermove',event=>{if(drag)dragAt(event.clientX);},events);
        canvas.addEventListener('lostpointercapture',()=>{drag=false;},events);
        get('roll-reset').addEventListener('click',()=>{get<HTMLInputElement>('roll-used').value='0';draw();},events);
    }
    if(mode==='press'){
        root.querySelectorAll<HTMLButtonElement>('[data-ink]').forEach(button=>button.addEventListener('click',()=>{
            const id=button.dataset.ink!;
            if(selected.has(id))selected.delete(id);else selected.add(id);
            button.classList.toggle('active',selected.has(id));
            button.setAttribute('aria-pressed',String(selected.has(id)));
            draw();
        },events));
        get('press-align').addEventListener('click',()=>{get<HTMLInputElement>('press-offset').value='0';draw();},events);
    }
    if(mode==='unwrap'){
        get('unwrap-play').addEventListener('click',()=>{
            cancelAnimationFrame(animation);
            const start=performance.now(),film=get<HTMLInputElement>('unwrap-film'),straps=get<HTMLInputElement>('unwrap-straps');
            const goal=Number(film.value)>=95?0:100,current=Number(film.value),band=Number(straps.value);
            const time=matchMedia('(prefers-reduced-motion: reduce)').matches?1:1450;
            function animate(now:number){
                const f=Math.min(1,Math.max(0,(now-start)/time)),ease=f*f*(3-2*f);
                film.value=String(Math.round(current+(goal-current)*ease));straps.value=String(Math.round(band+(goal-band)*ease));
                draw();if(f<1)animation=requestAnimationFrame(animate);
                else get('unwrap-play').textContent=goal?'بستن بسته':'باز کردن بسته';
            }
            animation=requestAnimationFrame(animate);
        },events);
    }
    draw();
    return {dispose(){cancelAnimationFrame(animation);abort.abort();},attach(cb){useGL=cb;draw();}};
}
