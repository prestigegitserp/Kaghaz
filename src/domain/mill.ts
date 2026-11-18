import { planCut } from './cut.ts';

/** Cylindrical roll approximation. Thickness and diameters are mm, width is mm and grammage is g/m². */
export function rollUsage(diameter:number, width:number, grammage:number, taken:number, caliper=.118, core=76) {
    const bound=(value:number,lo:number,hi:number)=>Number.isFinite(value)?Math.min(hi,Math.max(lo,value)):lo;
    const d=bound(diameter,core+4,1600),w=bound(width,300,2200),gsm=bound(grammage,30,450);
    const spacing=bound(caliper,.045,.350),progress=bound(taken,0,1);
    const initial=Math.PI*(d*d-core*core)/(4000*spacing);
    const remaining=initial*(1-progress);
    return {used:initial-remaining,remaining,diameter:Math.sqrt(core*core+(d*d-core*core)*(1-progress)),
        mass:remaining*w*gsm/1_000_000};
}

export function palletLoad(width:number,depth:number,height:number,layerChoice:number,boxKg:number) {
    if(!Number.isFinite(width)||!Number.isFinite(depth)||width<105||depth<105||width>1200||depth>800)return;
    const cut=planCut({stockWidth:1200,stockHeight:800,pieceWidth:width,pieceHeight:depth,grammage:100,
        margin:0,gap:2,rotate:true});
    const valid=Number.isFinite(height)&&height>=85&&height<=800&&Number.isFinite(layerChoice)&&Number.isFinite(boxKg)&&boxKg>=0;
    if(!valid||!cut)return;
    const layers=Math.max(0,Math.min(6,Math.floor(layerChoice),Math.floor(1056/height)));
    return {bands:cut.bands,perLayer:cut.pieces,layers,total:layers*cut.pieces,net:layers*cut.pieces*boxKg,
        height:144+height*layers};
}
